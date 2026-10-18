"""Small helper library for talking to Capital One's Nessie API.

Every function sends one request and returns the parsed JSON response.
If the API returns an error, a NessieError is raised with the details.
"""
import os
from datetime import date

import requests
from dotenv import load_dotenv

# Load the API key from the .env file (kept out of GitHub by .gitignore)
load_dotenv()
API_KEY = os.getenv("NESSIE_API_KEY")

BASE_URL = "https://api.nessieisreal.com"

ACCOUNT_TYPES = ("Checking", "Savings", "Credit Card")


class NessieError(Exception):
    pass


# One shared session keeps connections to Nessie open between calls, so each
# request skips a fresh TLS handshake. Pool sized for banking.py's parallel reads.
_session = requests.Session()
_session.mount("https://", requests.adapters.HTTPAdapter(pool_connections=4, pool_maxsize=32))


def _request(method, path, body=None):
    if not API_KEY:
        raise NessieError("No API key found. Make sure your .env file contains NESSIE_API_KEY=your_key_here")

    response = _session.request(
        method,
        f"{BASE_URL}{path}",
        params={"key": API_KEY},
        json=body,
        timeout=15,
    )
    if not response.ok:
        raise NessieError(f"{method} {path} failed with {response.status_code}: {response.text}")
    return response.json() if response.text else None


def _created_id(response):
    """POST responses look like {"code": 201, "objectCreated": {"_id": ...}}."""
    return response["objectCreated"]["_id"]


# ---------- Customers ----------

def create_customer(first_name, last_name, street_number, street_name, city, state, zip_code):
    customer = {
        "first_name": first_name,
        "last_name": last_name,
        "address": {
            "street_number": street_number,
            "street_name": street_name,
            "city": city,
            "state": state,
            "zip": zip_code,
        },
    }
    return _created_id(_request("POST", "/customers", customer))


def get_customers():
    return _request("GET", "/customers")


def get_customer(customer_id):
    return _request("GET", f"/customers/{customer_id}")


# ---------- Accounts ----------

def create_account(customer_id, account_type, nickname, balance=0, rewards=0):
    if account_type not in ACCOUNT_TYPES:
        raise ValueError(f"account_type must be one of {ACCOUNT_TYPES}")

    account = {
        "type": account_type,
        "nickname": nickname,
        "rewards": rewards,
        "balance": balance,
    }
    return _created_id(_request("POST", f"/customers/{customer_id}/accounts", account))


def get_customer_accounts(customer_id):
    return _request("GET", f"/customers/{customer_id}/accounts")


def get_account(account_id):
    return _request("GET", f"/accounts/{account_id}")


# ---------- Deposits ----------

def create_deposit(account_id, amount, description, transaction_date=None):
    deposit = {
        "medium": "balance",
        "transaction_date": transaction_date or date.today().isoformat(),
        "status": "completed",
        "amount": amount,
        "description": description,
    }
    return _created_id(_request("POST", f"/accounts/{account_id}/deposits", deposit))


def get_account_deposits(account_id):
    return _request("GET", f"/accounts/{account_id}/deposits")
