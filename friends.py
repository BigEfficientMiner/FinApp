"""Friends between app users: add by username, accept/decline requests, list friends.

You add a friend by typing their exact username. There is no list or search
of everyone using the app, so people can only find you if you share your username.

Friendships are stored in app.db (see db.py) and point at app user IDs,
so they don't depend on anyone's bank link.

"You" is always the logged-in user (from the session token).

One row per pair of people in `friendships`:
  status = 'pending'  -> requester asked, addressee hasn't answered
  status = 'accepted' -> they're friends
Declining, cancelling or removing a friend deletes the row, so either person
can send a fresh request later.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import db
from auth import current_user, normalize_username, public_user

router = APIRouter(prefix="/api")


class FriendRequestIn(BaseModel):
    username: str


def _row_for_pair(conn, a, b):
    low, high = sorted((a, b))
    return conn.execute(
        "SELECT * FROM friendships WHERE pair_low = ? AND pair_high = ?", (low, high)
    ).fetchone()


def friend_ids(conn, user_id: int) -> set:
    """IDs of the user's accepted friends (groups will use this)."""
    rows = conn.execute(
        "SELECT requester_id, addressee_id FROM friendships "
        "WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)",
        (user_id, user_id),
    ).fetchall()
    return {r["addressee_id"] if r["requester_id"] == user_id else r["requester_id"] for r in rows}


@router.get("/friends")
def friends_overview(user: dict = Depends(current_user)):
    """Your friends and your incoming and outgoing requests."""
    me = user["id"]
    with db.connect() as conn:
        users = {r["id"]: r for r in conn.execute("SELECT * FROM users").fetchall()}
        rows = conn.execute(
            "SELECT * FROM friendships WHERE requester_id = ? OR addressee_id = ?", (me, me)
        ).fetchall()

    friends, incoming, outgoing = [], [], []
    for r in rows:
        other_id = r["addressee_id"] if r["requester_id"] == me else r["requester_id"]
        if other_id not in users:
            continue
        entry = {"request_id": r["id"], "person": public_user(users[other_id]),
                 "since": r["responded_at"] or r["created_at"]}
        if r["status"] == "accepted":
            friends.append(entry)
        elif r["addressee_id"] == me:
            incoming.append(entry)
        else:
            outgoing.append(entry)

    by_name = lambda e: e["person"]["display_name"].lower()
    return {
        "friends": sorted(friends, key=by_name),
        "incoming": sorted(incoming, key=by_name),
        "outgoing": sorted(outgoing, key=by_name),
    }


@router.post("/friend-requests", status_code=201)
def send_request(body: FriendRequestIn, user: dict = Depends(current_user)):
    """Send a friend request to someone by their exact username."""
    me = user["id"]
    username = normalize_username(body.username)
    if not username:
        raise HTTPException(400, "Enter a username")

    with db.connect() as conn:
        target = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if target is None:
            raise HTTPException(404, f"No one has the username @{username}. Check the spelling.")
        other = target["id"]
        if other == me:
            raise HTTPException(400, "That's your own username")
        person = public_user(target)
        existing = _row_for_pair(conn, me, other)
        if existing:
            if existing["status"] == "accepted":
                raise HTTPException(409, f"You and @{username} are already friends")
            if existing["requester_id"] == me:
                raise HTTPException(409, f"You already sent @{username} a request")
            # They already asked you, so sending one back accepts theirs.
            conn.execute(
                "UPDATE friendships SET status = 'accepted', responded_at = ? WHERE id = ?",
                (db.now(), existing["id"]),
            )
            return {"request_id": existing["id"], "status": "accepted", "person": person}

        low, high = sorted((me, other))
        cur = conn.execute(
            "INSERT INTO friendships (requester_id, addressee_id, status, created_at, pair_low, pair_high) "
            "VALUES (?, ?, 'pending', ?, ?, ?)",
            (me, other, db.now(), low, high),
        )
        return {"request_id": cur.lastrowid, "status": "pending", "person": person}


def _get_request(conn, request_id):
    row = conn.execute("SELECT * FROM friendships WHERE id = ?", (request_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Friend request not found")
    return row


@router.post("/friend-requests/{request_id}/accept")
def accept_request(request_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        row = _get_request(conn, request_id)
        if row["addressee_id"] != user["id"]:
            raise HTTPException(403, "Only the person who received this request can accept it")
        if row["status"] != "accepted":
            conn.execute(
                "UPDATE friendships SET status = 'accepted', responded_at = ? WHERE id = ?",
                (db.now(), request_id),
            )
    return {"request_id": request_id, "status": "accepted"}


@router.post("/friend-requests/{request_id}/decline")
def decline_request(request_id: int, user: dict = Depends(current_user)):
    """The receiver declines, or the sender cancels. Either way the request goes away."""
    with db.connect() as conn:
        row = _get_request(conn, request_id)
        if user["id"] not in (row["requester_id"], row["addressee_id"]):
            raise HTTPException(403, "This isn't your friend request")
        if row["status"] != "pending":
            raise HTTPException(409, "This request was already accepted. Remove the friend instead.")
        conn.execute("DELETE FROM friendships WHERE id = ?", (request_id,))
    return {"request_id": request_id, "status": "removed"}


@router.delete("/friends/{friend_id}")
def remove_friend(friend_id: int, user: dict = Depends(current_user)):
    with db.connect() as conn:
        row = _row_for_pair(conn, user["id"], friend_id)
        if row is None or row["status"] != "accepted":
            raise HTTPException(404, "You're not friends with this person")
        conn.execute("DELETE FROM friendships WHERE id = ?", (row["id"],))
    return {"status": "removed"}
