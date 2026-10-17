"""Create test merchants and purchases for the customers in test_data.json.

Run it with:  venv\\Scripts\\python.exe seed_purchases.py

The dashboard groups spending by the merchant's category, so each purchase
is made at a merchant that has a category (Dining, Groceries, ...).
Each customer gets a different spending pattern so their top category, and
therefore their coupon, is different.

- Merchants are created once and saved to merchants.json (reused on later runs).
- Purchases are NEW on every run, so running this twice doubles them.
- Purchase IDs are saved to purchases_log.json.
Uses nessie.py as is (nothing there is changed).
"""
import json
import os

import nessie

# name -> category. Invented names, not real businesses.
MERCHANTS = {
    "Juniper & Stone": "Dining",
    "Midtown Noodle Bar": "Dining",
    "Greenleaf Grocer": "Groceries",
    "North & Loom": "Shopping",
    "Pixel Outfitters": "Shopping",
    "CityRide": "Transport",
    "Campus Books": "Other",
}

# Purchases per customer: (merchant, amount, date, description)
# Dates cover this month and last month so the period selector has data.
PURCHASES = {
    "Maya Johnson": [  # top category: Dining
        ("Juniper & Stone", 86.40, "2026-10-03", "Dinner with friends"),
        ("Midtown Noodle Bar", 24.75, "2026-10-06", "Lunch"),
        ("Juniper & Stone", 112.10, "2026-10-11", "Birthday dinner"),
        ("Greenleaf Grocer", 64.18, "2026-10-08", "Weekly groceries"),
        ("CityRide", 18.70, "2026-10-12", "Ride to campus"),
        ("Midtown Noodle Bar", 31.20, "2026-10-15", "Takeout"),
        ("North & Loom", 48.00, "2026-10-16", "Sweater"),
        ("Juniper & Stone", 72.35, "2026-09-20", "Dinner"),
        ("Greenleaf Grocer", 58.90, "2026-09-24", "Groceries"),
    ],
    "Carlos Rivera": [  # top category: Transport
        ("CityRide", 22.40, "2026-10-02", "Ride to work"),
        ("CityRide", 19.85, "2026-10-05", "Ride home"),
        ("CityRide", 41.30, "2026-10-09", "Airport ride"),
        ("Campus Books", 63.99, "2026-10-04", "Textbook"),
        ("Midtown Noodle Bar", 15.60, "2026-10-10", "Lunch"),
        ("CityRide", 27.15, "2026-10-14", "Ride to game"),
        ("Greenleaf Grocer", 38.42, "2026-10-13", "Groceries"),
        ("CityRide", 24.00, "2026-09-26", "Ride to work"),
    ],
    "Priya Patel": [  # top category: Shopping
        ("North & Loom", 142.00, "2026-10-04", "Jacket"),
        ("Pixel Outfitters", 219.99, "2026-10-07", "Headphones"),
        ("Greenleaf Grocer", 124.18, "2026-10-05", "Groceries"),
        ("Juniper & Stone", 96.50, "2026-10-09", "Client dinner"),
        ("North & Loom", 88.25, "2026-10-12", "Shoes"),
        ("Greenleaf Grocer", 97.60, "2026-10-14", "Groceries"),
        ("CityRide", 28.70, "2026-10-15", "Ride downtown"),
        ("Pixel Outfitters", 59.00, "2026-10-16", "Phone case"),
        ("North & Loom", 175.40, "2026-09-22", "Coat"),
    ],
}


def get_or_create_merchants():
    if os.path.exists("merchants.json"):
        with open("merchants.json") as f:
            merchants = json.load(f)
        print(f"Reusing {len(merchants)} merchants from merchants.json")
        return merchants

    merchants = {}
    for name, category in MERCHANTS.items():
        body = {
            "name": name,
            "category": category,
            "address": {
                "street_number": "100",
                "street_name": "Main St",
                "city": "Gainesville",
                "state": "FL",
                "zip": "32601",
            },
            "geocode": {"lat": 29.6516, "lng": -82.3248},
        }
        merchant_id = nessie._created_id(nessie._request("POST", "/merchants", body))
        merchants[name] = merchant_id
        print(f"Created merchant {name} ({category}): {merchant_id}")

    with open("merchants.json", "w") as f:
        json.dump(merchants, f, indent=2)
    return merchants


def first_spending_account(customer):
    """Purchases go on the credit card if the customer has one, else checking."""
    for wanted in ("Credit Card", "Checking"):
        for acct in customer["accounts"]:
            if acct["type"] == wanted:
                return acct
    return None


def seed_purchases():
    with open("test_data.json") as f:
        customers = json.load(f)

    merchants = get_or_create_merchants()
    log = []

    for customer in customers:
        purchases = PURCHASES.get(customer["name"], [])
        account = first_spending_account(customer)
        if not purchases or account is None:
            continue

        print(f"\n{customer['name']} -> {account['nickname']}")
        for merchant, amount, when, description in purchases:
            body = {
                "merchant_id": merchants[merchant],
                "medium": "balance",
                "purchase_date": when,
                "amount": amount,
                "status": "completed",
                "description": description,
            }
            path = f"/accounts/{account['account_id']}/purchases"
            purchase_id = nessie._created_id(nessie._request("POST", path, body))
            print(f"  - ${amount:,.2f} at {merchant} ({when})")
            log.append({"customer": customer["name"], "account_id": account["account_id"],
                        "merchant": merchant, "amount": amount, "purchase_id": purchase_id})

    with open("purchases_log.json", "w") as f:
        json.dump(log, f, indent=2)
    print(f"\nDone! Added {len(log)} purchases (saved to purchases_log.json)")


if __name__ == "__main__":
    try:
        seed_purchases()
    except nessie.NessieError as e:
        print("Something went wrong:", e)
