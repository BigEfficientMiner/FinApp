"""Add test deposits to the customers already listed in test_data.json.

Run it with:  venv\\Scripts\\python.exe add_deposits.py

Uses the existing helpers in nessie.py (nothing there is changed).
Credit card accounts are skipped. Each run adds NEW deposits, so running
it twice doubles them. The IDs created are saved to deposits_log.json.
"""
import json

import nessie

# Deposits to add for each account nickname: (amount, description, date)
NEW_DEPOSITS = {
    "Everyday Checking": [(1500, "Paycheck", "2026-10-15"), (45, "Refund - bookstore", "2026-10-16")],
    "Emergency Fund": [(250, "Monthly savings transfer", "2026-10-16")],
    "Student Checking": [(600, "Part-time job", "2026-10-17"), (75, "Venmo - concert tickets", "2026-10-16")],
    "Main Checking": [(150, "Cashback reward", "2026-10-16")],
    "House Fund": [(1000, "Savings goal", "2026-10-16")],
}


def add_deposits():
    with open("test_data.json") as f:
        customers = json.load(f)

    log = []
    for customer in customers:
        print(customer["name"])
        for acct in customer["accounts"]:
            deposits = NEW_DEPOSITS.get(acct["nickname"], [])
            if acct["type"] == "Credit Card" or not deposits:
                continue

            for amount, description, when in deposits:
                deposit_id = nessie.create_deposit(acct["account_id"], amount, description, when)
                print(f"  + ${amount:,} into {acct['nickname']} ({description})")
                log.append({"customer": customer["name"], "account_id": acct["account_id"],
                            "amount": amount, "description": description, "deposit_id": deposit_id})

            balance = nessie.get_account(acct["account_id"])["balance"]
            print(f"    {acct['nickname']} balance now ${balance:,}")
        print()

    with open("deposits_log.json", "w") as f:
        json.dump(log, f, indent=2)
    print(f"Done! Added {len(log)} deposits (saved to deposits_log.json)")


if __name__ == "__main__":
    try:
        add_deposits()
    except nessie.NessieError as e:
        print("Something went wrong:", e)
