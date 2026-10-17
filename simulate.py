"""Demo-only buttons that create real transactions in Nessie on the spot.

Each one adds a deposit or purchase to the logged-in user's checking account
(today's date), so judges can watch the statement, balance and dashboard
update live. Everything created here is logged in app.db and removed by
reset_demo.py.

Only available while the demo shortcut is on (FINAPP_DEV is not 0).

GET  /api/dev/simulations          -> the list of buttons
POST /api/dev/simulate {kind}      -> create that transaction
"""
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import banking
import nessie
from auth import DEV_MODE
from bank import require_bank_link

router = APIRouter(prefix="/api/dev")

DEMO_BANK = Path(__file__).with_name("demo_bank.json")

# kind -> (label, type, merchant or None, cents, description)
SIMULATIONS = {
    "paycheck": ("Paycheck arrives", "deposit", None, 85000, "Paycheck · direct deposit"),
    "coffee": ("Buy a coffee", "purchase", "Bean There Coffee", 625, "Latte"),
    "groceries": ("Grocery run", "purchase", "Greenleaf Grocer", 5840, "Weekly groceries"),
    "dinner": ("Dinner out", "purchase", "Juniper & Stone", 4280, "Dinner with friends"),
    "ride": ("Take a ride", "purchase", "CityRide", 1735, "Ride across town"),
    "shopping": ("New shoes", "purchase", "North & Loom", 6400, "Sneakers"),
}


class SimulateIn(BaseModel):
    kind: str


def _merchants() -> dict:
    if DEMO_BANK.exists():
        return {name: m["id"] for name, m in json.loads(DEMO_BANK.read_text())["merchants"].items()}
    legacy = Path(__file__).with_name("merchants.json")
    return json.loads(legacy.read_text()) if legacy.exists() else {}


@router.get("/simulations")
def list_simulations():
    if not DEV_MODE:
        return []
    return [{"kind": k, "label": v[0], "type": v[1], "amount": v[3] / 100, "merchant": v[2]} for k, v in SIMULATIONS.items()]


@router.post("/simulate", status_code=201)
def simulate(body: SimulateIn, user: dict = Depends(require_bank_link)):
    if not DEV_MODE:
        raise HTTPException(404, "Not found")
    if body.kind not in SIMULATIONS:
        raise HTTPException(400, "Unknown simulation")
    label, kind, merchant_name, cents, description = SIMULATIONS[body.kind]

    try:
        ledger = banking.customer_ledger(user["bank_link"]["nessie_customer_id"])
    except nessie.NessieError as e:
        raise HTTPException(502, f"Couldn't reach the bank: {e}")
    account = banking.spending_account(ledger["accounts"])
    if account is None:
        raise HTTPException(409, "This bank profile has no accounts")

    try:
        if kind == "deposit":
            banking.deposit(account["id"], cents, description, user_id=user["id"], source="simulation")
        else:
            merchant_id = _merchants().get(merchant_name)
            if not merchant_id:
                raise HTTPException(409, f"The merchant {merchant_name} isn't set up. Run demo_setup.py first.")
            banking.remember_merchant(merchant_id, merchant_name, "")
            banking.purchase(account["id"], merchant_id, cents, description, user_id=user["id"], source="simulation")
    except nessie.NessieError as e:
        raise HTTPException(502, f"The bank couldn't record it: {e}")

    sign = 1 if kind == "deposit" else -1
    return {"label": label, "account": account["nickname"], "amount": sign * cents / 100,
            "new_balance": round(account["balance"] + sign * cents / 100, 2)}
