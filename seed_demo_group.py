"""Create a demo group with a shared goal, for testing and judging.

Run it AFTER seed_users.py:  venv\\Scripts\\python.exe seed_demo_group.py

What it sets up:
  - Maya, Carlos and Priya (the demo users) become friends.
  - Maya creates "Spring Break Crew"; Carlos is a member; Priya has a pending
    invite (log in as Priya to accept it on the Groups page).
  - Goal: "Miami spring break", $3,000 by March 6, 2027, started Sep 15, 2026.
  - Maya and Carlos each committed $1,000. Maya has saved $420 (on track),
    Carlos $150 (behind), so the accountability view has something to show.

Safe to run again: if the group already exists, nothing is changed.
"""
import db
from auth import DEMO_EMAIL_DOMAIN

GROUP_NAME = "Spring Break Crew"
GOAL_CREATED = "2026-09-15T15:00:00+00:00"


def user_id(conn, first_name):
    row = conn.execute("SELECT id FROM users WHERE email = ?", (f"{first_name}{DEMO_EMAIL_DOMAIN}",)).fetchone()
    if row is None:
        raise SystemExit(f"Demo user {first_name} not found. Run seed_users.py first.")
    return row["id"]


def befriend(conn, a, b):
    low, high = sorted((a, b))
    conn.execute(
        "INSERT INTO friendships (requester_id, addressee_id, status, created_at, responded_at, pair_low, pair_high) "
        "VALUES (?, ?, 'accepted', ?, ?, ?, ?) "
        "ON CONFLICT (pair_low, pair_high) DO UPDATE SET status = 'accepted', responded_at = excluded.responded_at",
        (a, b, db.now(), db.now(), low, high),
    )


def log(conn, group_id, uid, kind, message, when):
    conn.execute(
        "INSERT INTO group_activity (group_id, user_id, kind, message, created_at) VALUES (?, ?, ?, ?, ?)",
        (group_id, uid, kind, message, when),
    )


def seed():
    with db.connect() as conn:
        maya, carlos, priya = (user_id(conn, n) for n in ("maya", "carlos", "priya"))
        befriend(conn, maya, carlos)
        befriend(conn, maya, priya)
        befriend(conn, carlos, priya)
        print("Maya, Carlos and Priya are now friends")

        if conn.execute("SELECT 1 FROM groups WHERE name = ? AND owner_id = ?", (GROUP_NAME, maya)).fetchone():
            print(f"'{GROUP_NAME}' already exists, leaving it as is")
            return

        group_id = conn.execute(
            "INSERT INTO groups (name, owner_id, created_at) VALUES (?, ?, ?)", (GROUP_NAME, maya, GOAL_CREATED)
        ).lastrowid
        for uid, when in ((maya, GOAL_CREATED), (carlos, "2026-09-16T01:00:00+00:00")):
            conn.execute("INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)", (group_id, uid, when))
        conn.execute(
            "INSERT INTO group_invites (group_id, inviter_id, invitee_id, created_at) VALUES (?, ?, ?, ?)",
            (group_id, maya, priya, db.now()),
        )

        goal_id = conn.execute(
            "INSERT INTO goals (group_id, title, target_cents, deadline, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (group_id, "Miami spring break", 300_000, "2027-03-06", maya, GOAL_CREATED),
        ).lastrowid
        for uid in (maya, carlos):
            conn.execute(
                "INSERT INTO goal_commitments (goal_id, user_id, share_cents, committed_at) VALUES (?, ?, ?, ?)",
                (goal_id, uid, 100_000, GOAL_CREATED),
            )
        contributions = [
            (maya, 20_000, "First paycheck of the month", "2026-09-20T14:00:00+00:00"),
            (carlos, 15_000, "Part-time job", "2026-09-27T14:00:00+00:00"),
            (maya, 22_000, "Skipped takeout this week", "2026-10-10T14:00:00+00:00"),
        ]
        for uid, cents, note, when in contributions:
            conn.execute(
                "INSERT INTO contributions (goal_id, user_id, amount_cents, note, created_at) VALUES (?, ?, ?, ?, ?)",
                (goal_id, uid, cents, note, when),
            )

        log(conn, group_id, maya, "create", "Maya Johnson created the group", GOAL_CREATED)
        log(conn, group_id, maya, "goal", "Maya Johnson created the goal “Miami spring break”: $3,000.00 by Mar 06, 2027", GOAL_CREATED)
        log(conn, group_id, maya, "commit", "Maya Johnson committed $1,000.00 to “Miami spring break”", GOAL_CREATED)
        log(conn, group_id, carlos, "join", "Carlos Rivera joined the group", "2026-09-16T01:00:00+00:00")
        log(conn, group_id, carlos, "commit", "Carlos Rivera committed $1,000.00 to “Miami spring break”", "2026-09-16T01:05:00+00:00")
        for uid, cents, _, when in contributions:
            who = "Maya Johnson" if uid == maya else "Carlos Rivera"
            log(conn, group_id, uid, "contribution", f"{who} saved ${cents / 100:,.2f} toward “Miami spring break”", when)
        log(conn, group_id, maya, "invite", "Maya Johnson invited Priya Patel", db.now())

    print(f"Created '{GROUP_NAME}' with the goal 'Miami spring break' ($3,000 by Mar 6, 2027)")
    print("Log in as Priya to accept the group invite.")


if __name__ == "__main__":
    seed()
