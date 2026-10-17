"""Create demo app profiles and link them to the test bank customers.

Run it with:  venv\\Scripts\\python.exe seed_users.py

For each customer in test_data.json (Maya, Carlos, Priya) this creates an app
profile and links it to that customer's Nessie bank profile. Safe to run
again: existing profiles and links are left alone.

Demo logins (all use the same password, for testing only):
  usernames maya, carlos, priya   password: demo1234
They also show up as one-click buttons on the login screen while the demo
shortcut is on (see auth.py).
"""
import json

import db
from auth import hash_password

DEMO_PASSWORD = "demo1234"


def seed_users():
    with open("test_data.json") as f:
        customers = json.load(f)

    with db.connect() as conn:
        for c in customers:
            username = c["name"].split()[0].lower()

            user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
            if user:
                user_id = user["id"]
                conn.execute("UPDATE users SET is_demo = 1 WHERE id = ?", (user_id,))
                print(f"Profile @{username} already exists")
            else:
                user_id = conn.execute(
                    "INSERT INTO users (username, password_hash, display_name, is_demo, created_at) VALUES (?, ?, ?, 1, ?)",
                    (username, hash_password(DEMO_PASSWORD), c["name"], db.now()),
                ).lastrowid
                print(f"Created profile @{username}")

            linked = conn.execute(
                "SELECT user_id FROM bank_links WHERE nessie_customer_id = ?", (c["customer_id"],)
            ).fetchone()
            if linked:
                print(f"  bank profile already linked (to user {linked['user_id']})")
            elif conn.execute("SELECT 1 FROM bank_links WHERE user_id = ?", (user_id,)).fetchone():
                print("  profile already has a different bank linked")
            else:
                conn.execute(
                    "INSERT INTO bank_links (user_id, nessie_customer_id, linked_at) VALUES (?, ?, ?)",
                    (user_id, c["customer_id"], db.now()),
                )
                print(f"  linked to bank customer {c['customer_id']}")

    print(f"\nDone! Demo password for all of them: {DEMO_PASSWORD}")


if __name__ == "__main__":
    seed_users()
