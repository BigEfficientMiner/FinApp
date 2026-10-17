"""Fetch every customer from Nessie and print their accounts and deposits.

Run seed.py first to create test customers, then run:
    venv\\Scripts\\python.exe app.py
"""
import nessie


def show_everything():
    customers = nessie.get_customers()
    print(f"Found {len(customers)} customers\n")

    for customer in customers:
        print(f"{customer['first_name']} {customer['last_name']}  (id {customer['_id']})")

        accounts = nessie.get_customer_accounts(customer["_id"])
        if not accounts:
            print("    no accounts")

        for account in accounts:
            print(f"    {account['type']:<12} {account['nickname']:<20} balance ${account['balance']:,}")

            for deposit in nessie.get_account_deposits(account["_id"]):
                print(f"        + ${deposit['amount']:,}  {deposit['description']}  ({deposit['transaction_date']})")
        print()


if __name__ == "__main__":
    try:
        show_everything()
    except nessie.NessieError as e:
        print("Something went wrong:", e)
