"""Create a set of test customers, each with accounts and deposits.

Run it with:  venv\\Scripts\\python.exe seed.py

Every run creates NEW customers (Nessie doesn't check for duplicates).
The IDs of everything created are saved to test_data.json so the rest
of the app can look them up later.
"""
import json

import nessie

# Each profile: who the customer is, which accounts they have,
# and the deposits that go into each account.
TEST_PROFILES = [
    {
        "customer": ("Maya", "Johnson", "101", "University Ave", "Gainesville", "FL", "32601"),
        "accounts": [
            {"type": "Checking", "nickname": "Everyday Checking", "balance": 1200,
             "deposits": [(1500, "Paycheck", "2026-10-01"), (200, "Venmo from roommate", "2026-10-08")]},
            {"type": "Savings", "nickname": "Emergency Fund", "balance": 3000,
             "deposits": [(250, "Monthly savings transfer", "2026-10-02")]},
        ],
    },
    {
        "customer": ("Carlos", "Rivera", "45", "Archer Rd", "Gainesville", "FL", "32608"),
        "accounts": [
            {"type": "Checking", "nickname": "Student Checking", "balance": 350,
             "deposits": [(600, "Part-time job", "2026-10-03"), (100, "Birthday gift", "2026-10-12")]},
            {"type": "Credit Card", "nickname": "Starter Card", "balance": 0, "deposits": []},
        ],
    },
    {
        "customer": ("Priya", "Patel", "2200", "SW 13th St", "Gainesville", "FL", "32608"),
        "accounts": [
            {"type": "Checking", "nickname": "Main Checking", "balance": 5400,
             "deposits": [(3200, "Salary", "2026-10-01"), (3200, "Salary", "2026-10-15")]},
            {"type": "Savings", "nickname": "House Fund", "balance": 18000,
             "deposits": [(1000, "Savings goal", "2026-10-05")]},
            {"type": "Credit Card", "nickname": "Travel Rewards", "balance": 0, "deposits": []},
        ],
    },
]


def seed():
    created = []

    for profile in TEST_PROFILES:
        first, last, *address = profile["customer"]
        customer_id = nessie.create_customer(first, last, *address)
        print(f"Created customer {first} {last}: {customer_id}")

        customer_record = {"name": f"{first} {last}", "customer_id": customer_id, "accounts": []}

        for acct in profile["accounts"]:
            account_id = nessie.create_account(customer_id, acct["type"], acct["nickname"], balance=acct["balance"])
            print(f"  + {acct['type']} '{acct['nickname']}': {account_id}")

            deposit_ids = []
            for amount, description, when in acct["deposits"]:
                deposit_ids.append(nessie.create_deposit(account_id, amount, description, when))
                print(f"      deposit ${amount} ({description})")

            customer_record["accounts"].append({
                "type": acct["type"],
                "nickname": acct["nickname"],
                "account_id": account_id,
                "deposit_ids": deposit_ids,
            })

        created.append(customer_record)

    with open("test_data.json", "w") as f:
        json.dump(created, f, indent=2)
    print(f"\nDone! Saved {len(created)} customers to test_data.json")


if __name__ == "__main__":
    seed()
