"""The app's own database (app.db, SQLite, created automatically).

Nessie holds the bank data. This database holds everything that belongs to
the app itself:

  users        app accounts (email + hashed password)
  sessions     login tokens (only a hash of each token is stored)
  bank_links   which Nessie customer each app user has linked
  friendships  friend requests and friends, between app users

Friends, groups and goals always point at app user IDs, never Nessie IDs,
so they keep working if someone unlinks or switches banks.
"""
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).with_name("app.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- One bank customer can only be linked to one app user.
-- (One link per user is enforced in bank.py, so allowing several later
--  only means relaxing that check, not changing this table.)
CREATE TABLE IF NOT EXISTS bank_links (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nessie_customer_id TEXT NOT NULL UNIQUE,
    linked_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friendships (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at   TEXT NOT NULL,
    responded_at TEXT,
    -- the two user IDs in sorted order, so a pair can only have one row
    pair_low     INTEGER NOT NULL,
    pair_high    INTEGER NOT NULL,
    UNIQUE (pair_low, pair_high)
);

-- ---------- Groups and shared goals (see groups.py) ----------
-- Money is stored in whole cents (INTEGER) so totals never have rounding errors.

CREATE TABLE IF NOT EXISTS groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    owner_id   INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_invites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE (group_id, invitee_id)
);

CREATE TABLE IF NOT EXISTS goals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    target_cents INTEGER NOT NULL CHECK (target_cents > 0),
    deadline     TEXT NOT NULL,          -- YYYY-MM-DD
    created_by   INTEGER NOT NULL REFERENCES users(id),
    created_at   TEXT NOT NULL
);

-- A member "commits" to a goal by taking on a share of the target.
CREATE TABLE IF NOT EXISTS goal_commitments (
    goal_id      INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_cents  INTEGER NOT NULL CHECK (share_cents > 0),
    committed_at TEXT NOT NULL,
    PRIMARY KEY (goal_id, user_id)
);

CREATE TABLE IF NOT EXISTS contributions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id      INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    note         TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL
);

-- What happened in a group, newest first (joins, commitments, savings...).
CREATE TABLE IF NOT EXISTS group_activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    kind       TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init():
    with connect() as conn:
        conn.executescript(SCHEMA)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


init()
