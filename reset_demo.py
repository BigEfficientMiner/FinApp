"""Put the demo back exactly how demo_setup.py left it. Run between demo runs.

Run it with the server STOPPED:  venv\\Scripts\\python.exe reset_demo.py

What it does:
  1. Takes back every transaction the app added in Nessie since the baseline
     (goal savings, simulated paychecks and purchases). Deposits and bills are
     deleted in Nessie; withdrawals and purchases can't be deleted there, so the
     app hides them. Either way, statements and balances go back to the baseline.
  2. Restores the app data (profiles, friends, groups, goals) from
     demo_baseline.db. Profiles made during the demo are removed; the three
     demo users are friends again with their baseline group and savings.

A copy of the current database is saved first as app.db.before-reset.

Other option:
  --empty   instead of the baseline, clear ALL friends, requests and groups
            (keeps profiles and bank links) for a completely clean slate.
"""
import shutil
import sqlite3
import sys

import banking
import db

BASELINE = db.DB_PATH.with_name("demo_baseline.db")


def _backup():
    if db.DB_PATH.exists():
        shutil.copyfile(db.DB_PATH, db.DB_PATH.with_name("app.db.before-reset"))
        print("Saved a copy of the current database to app.db.before-reset")


def _undo_demo_transactions() -> int:
    """Delete or hide every Nessie transaction added since the baseline."""
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT nessie_type, nessie_id FROM nessie_activity WHERE source != 'seed' ORDER BY id"
        ).fetchall()
    counts = {"deleted": 0, "hidden": 0}
    for r in rows:
        counts[banking.remove(r["nessie_type"], r["nessie_id"], reason="demo reset")] += 1
    if rows:
        print(f"Took back {len(rows)} demo transactions ({counts['deleted']} deleted in Nessie, {counts['hidden']} hidden)")
    else:
        print("No demo transactions to take back")
    return len(rows)


def restore_baseline():
    if not BASELINE.exists():
        print("There's no baseline yet. Run demo_setup.py first.")
        return
    _backup()
    _undo_demo_transactions()

    with db.connect() as conn:
        hidden = conn.execute("SELECT nessie_id, nessie_type, hidden_at, reason FROM nessie_hidden").fetchall()
        hidden = [tuple(r) for r in hidden]

    shutil.copyfile(BASELINE, db.DB_PATH)
    db.init()  # bring the restored copy up to date with the current schema
    with db.connect() as conn:
        conn.executemany("INSERT OR IGNORE INTO nessie_hidden (nessie_id, nessie_type, hidden_at, reason) VALUES (?, ?, ?, ?)", hidden)
        profiles = [f"@{r['username']}" for r in conn.execute("SELECT username FROM users ORDER BY id")]
    print("Restored profiles, friends, groups and goals from the baseline:", ", ".join(profiles))
    print("\nDemo is back to its baseline. Start server.py and go.")


def clear_everything():
    _backup()
    _undo_demo_transactions()
    with db.connect() as conn:
        for table in ("contributions", "goal_commitments", "goals", "group_activity",
                      "group_invites", "group_members", "groups", "friendships", "sessions"):
            conn.execute(f"DELETE FROM {table}")
    print("Cleared all friends, friend requests and groups (profiles and bank links kept).")


if __name__ == "__main__":
    if "--empty" in sys.argv:
        clear_everything()
    else:
        restore_baseline()
