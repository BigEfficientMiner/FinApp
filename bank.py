"""Linking an app account to a Nessie bank customer.

Two ways to link:
  1. Link an existing bank profile: give the Nessie customer ID plus your
     last name and ZIP. They must match that customer's record in Nessie,
     so knowing someone's ID alone isn't enough to link their bank.
  2. Create a new bank profile: makes a new Nessie customer (with an empty
     checking account) and links it.

Rules: one bank link per app user for now, and a bank customer can only be
linked to one app user (enforced by the bank_links table).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import db
import nessie
from auth import current_user

router = APIRouter(prefix="/api/bank")

NO_MATCH = "We couldn't match those details to a bank profile. Check the customer ID, last name and ZIP."


class LinkIn(BaseModel):
    nessie_customer_id: str
    last_name: str
    zip: str


class CreateIn(BaseModel):
    first_name: str
    last_name: str
    street_number: str
    street_name: str
    city: str
    state: str
    zip: str


def require_bank_link(user: dict = Depends(current_user)) -> dict:
    """Dependency for endpoints that need bank data: the user, who must have a link."""
    if not user["bank_link"]:
        raise HTTPException(409, "Link your bank account first")
    return user


def _ensure_not_linked(user):
    if user["bank_link"]:
        raise HTTPException(409, "You already have a bank linked. Unlink it first to link a different one.")


def _save_link(user_id: int, customer_id: str):
    with db.connect() as conn:
        taken = conn.execute(
            "SELECT user_id FROM bank_links WHERE nessie_customer_id = ?", (customer_id,)
        ).fetchone()
        if taken:
            raise HTTPException(409, "This bank profile is already linked to another account")
        conn.execute(
            "INSERT INTO bank_links (user_id, nessie_customer_id, linked_at) VALUES (?, ?, ?)",
            (user_id, customer_id, db.now()),
        )


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
def link_existing(body: LinkIn, user: dict = Depends(current_user)):
    _ensure_not_linked(user)
    customer_id = body.nessie_customer_id.strip()
    try:
        customer = nessie.get_customer(customer_id)
    except nessie.NessieError:
        raise HTTPException(400, NO_MATCH)

    last_name_ok = customer.get("last_name", "").strip().lower() == body.last_name.strip().lower()
    zip_ok = str((customer.get("address") or {}).get("zip", "")).strip() == body.zip.strip()
    if not (last_name_ok and zip_ok):
        raise HTTPException(400, NO_MATCH)

    _save_link(user["id"], customer_id)
    return {"nessie_customer_id": customer_id}


@router.post("/create", status_code=201)
def create_and_link(body: CreateIn, user: dict = Depends(current_user)):
    _ensure_not_linked(user)
    fields = body.model_dump()
    if any(not str(v).strip() for v in fields.values()):
        raise HTTPException(400, "Fill in every field")
    try:
        customer_id = nessie.create_customer(
            body.first_name.strip(), body.last_name.strip(), body.street_number.strip(),
            body.street_name.strip(), body.city.strip(), body.state.strip().upper(), body.zip.strip(),
        )
    except nessie.NessieError as e:
        raise HTTPException(502, f"The bank couldn't create the profile: {e}")

    try:
        nessie.create_account(customer_id, "Checking", "Everyday Checking", balance=0)
    except nessie.NessieError:
        pass  # The profile still works without an account; one can be added later.

    _save_link(user["id"], customer_id)
    return {"nessie_customer_id": customer_id}


@router.delete("/link")
def unlink(user: dict = Depends(current_user)):
    if not user["bank_link"]:
        raise HTTPException(404, "No bank is linked")
    with db.connect() as conn:
        conn.execute("DELETE FROM bank_links WHERE user_id = ?", (user["id"],))
    return {"status": "unlinked"}
