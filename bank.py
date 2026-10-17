"""Linking an app profile to a bank profile (a Nessie customer).

Bank profiles are set up in Nessie ahead of time (see seed.py). To link one,
you enter its bank customer ID; the app checks the ID exists in Nessie and
saves the link.

Rules:
  - One bank link per app profile (for now).
  - A bank profile can only be linked to one app profile, so nobody else can
    link a bank that's already yours.
Note: the ID is the only proof of ownership, so treat it like an account number.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import db
import nessie
from auth import current_user

router = APIRouter(prefix="/api/bank")


class LinkIn(BaseModel):
    nessie_customer_id: str


def require_bank_link(user: dict = Depends(current_user)) -> dict:
    """Dependency for endpoints that need bank data: the user, who must have a link."""
    if not user["bank_link"]:
        raise HTTPException(409, "Link your bank account first")
    return user


@router.get("")
def bank_summary(user: dict = Depends(require_bank_link)):
    """The linked bank profile and its accounts (for the Accounts page)."""
    customer_id = user["bank_link"]["nessie_customer_id"]
    try:
        customer = nessie.get_customer(customer_id)
        accounts = nessie.get_customer_accounts(customer_id)
    except nessie.NessieError as e:
        raise HTTPException(502, str(e))
    return {
        "customer_id": customer_id,
        "linked_at": user["bank_link"]["linked_at"],
        "name": f"{customer['first_name']} {customer['last_name']}",
        "accounts": [
            {"id": a["_id"], "type": a["type"], "nickname": a["nickname"], "balance": a.get("balance", 0)}
            for a in accounts
        ],
    }


@router.post("/link", status_code=201)
def link_bank(body: LinkIn, user: dict = Depends(current_user)):
    if user["bank_link"]:
        raise HTTPException(409, "You already have a bank linked. Unlink it first to link a different one.")
    customer_id = body.nessie_customer_id.strip()
    if not customer_id:
        raise HTTPException(400, "Enter your bank customer ID")

    try:
        customer = nessie.get_customer(customer_id)
    except nessie.NessieError:
        raise HTTPException(400, "We couldn't find a bank profile with that ID. Check it and try again.")

    with db.connect() as conn:
        if conn.execute("SELECT 1 FROM bank_links WHERE nessie_customer_id = ?", (customer_id,)).fetchone():
            raise HTTPException(409, "This bank profile is already linked to another app profile")
        conn.execute(
            "INSERT INTO bank_links (user_id, nessie_customer_id, linked_at) VALUES (?, ?, ?)",
            (user["id"], customer_id, db.now()),
        )
    return {"nessie_customer_id": customer_id, "name": f"{customer['first_name']} {customer['last_name']}"}


@router.delete("/link")
def unlink(user: dict = Depends(current_user)):
    if not user["bank_link"]:
        raise HTTPException(404, "No bank is linked")
    with db.connect() as conn:
        conn.execute("DELETE FROM bank_links WHERE user_id = ?", (user["id"],))
    return {"status": "unlinked"}
