"""App profiles: create a profile, log in, log out, and "who am I".

A profile has a name (shown to friends), a username (used to log in and for
friends to find you) and a password.

- Passwords are hashed with PBKDF2-SHA256 (Python standard library) and a
  random salt. The plain password is never stored.
- Logging in returns a random session token. The frontend sends it back as
  "Authorization: Bearer <token>". Only a SHA-256 hash of the token is stored,
  so a copy of app.db can't be used to log in as anyone.
- Other modules protect an endpoint by adding `user = Depends(current_user)`.

Demo shortcut (for testing and judging): /api/dev/demo-users and
/api/dev/login-as let you switch between the seeded demo users without typing
passwords. It is ON unless the environment variable FINAPP_DEV is set to 0.
Turn it off for anything that isn't a local demo.
"""
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

import db

router = APIRouter(prefix="/api")

SESSION_DAYS = 7
PBKDF2_ITERATIONS = 200_000
DEV_MODE = os.getenv("FINAPP_DEV", "1") != "0"

# 3-20 characters: letters, numbers, underscores and periods. Stored lowercase.
USERNAME_RE = re.compile(r"^[a-z0-9_.]{3,20}$")


def normalize_username(raw: str) -> str:
    return raw.strip().lstrip("@").lower()


# ---------- Passwords and tokens ----------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _start_session(conn, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    created = datetime.now(timezone.utc)
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (_hash_token(token), user_id, created.isoformat(timespec="seconds"),
         (created + timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds")),
    )
    return token


# ---------- Current user ----------

def public_user(row) -> dict:
    """What other users may see about someone."""
    return {"id": row["id"], "username": row["username"], "display_name": row["display_name"]}


def _bank_link(conn, user_id):
    row = conn.execute(
        "SELECT nessie_customer_id, linked_at FROM bank_links WHERE user_id = ?", (user_id,)
    ).fetchone()
    return dict(row) if row else None


def current_user(authorization: str = Header(default="")) -> dict:
    """FastAPI dependency: the logged-in user, or 401."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Please log in")
    with db.connect() as conn:
        row = conn.execute(
            "SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
            (_hash_token(token),),
        ).fetchone()
        if row is None or row["expires_at"] < db.now():
            raise HTTPException(401, "Your session has ended. Please log in again.")
        return {
            "id": row["id"],
            "username": row["username"],
            "display_name": row["display_name"],
            "bank_link": _bank_link(conn, row["id"]),
            "token_hash": _hash_token(token),
        }


def me_response(user: dict) -> dict:
    return {k: user[k] for k in ("id", "username", "display_name", "bank_link")}


# ---------- Endpoints ----------

class SignupIn(BaseModel):
    display_name: str
    username: str
    password: str


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/auth/signup", status_code=201)
def signup(body: SignupIn):
    """Create an app profile and log in."""
    name = body.display_name.strip()
    username = normalize_username(body.username)
    if not name:
        raise HTTPException(400, "Enter your name")
    if not USERNAME_RE.match(username):
        raise HTTPException(400, "Usernames are 3-20 characters: letters, numbers, underscores and periods")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    with db.connect() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
            raise HTTPException(409, f"The username @{username} is taken. Try another one.")
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)",
            (username, hash_password(body.password), name[:60], db.now()),
        )
        token = _start_session(conn, cur.lastrowid)
    return {"token": token}


@router.get("/auth/username-available")
def username_available(username: str):
    """Lets the profile form say "taken" while you type."""
    name = normalize_username(username)
    if not USERNAME_RE.match(name):
        return {"username": name, "valid": False, "available": False}
    with db.connect() as conn:
        taken = conn.execute("SELECT 1 FROM users WHERE username = ?", (name,)).fetchone() is not None
    return {"username": name, "valid": True, "available": not taken}


@router.post("/auth/login")
def login(body: LoginIn):
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (normalize_username(body.username),)).fetchone()
        # Same message whether the username or the password is wrong.
        if row is None or not check_password(body.password, row["password_hash"]):
            raise HTTPException(401, "Username or password is incorrect")
        token = _start_session(conn, row["id"])
    return {"token": token}


@router.post("/auth/logout")
def logout(user: dict = Depends(current_user)):
    with db.connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (user["token_hash"],))
    return {"status": "logged out"}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return me_response(user)


# ---------- Demo shortcut ----------

class LoginAsIn(BaseModel):
    user_id: int


@router.get("/dev/demo-users")
def demo_users():
    """Seeded demo users (only those, never real profiles)."""
    if not DEV_MODE:
        return []
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM users WHERE is_demo = 1 ORDER BY display_name").fetchall()
    return [public_user(r) for r in rows]


@router.post("/dev/login-as")
def login_as(body: LoginAsIn):
    if not DEV_MODE:
        raise HTTPException(404, "Not found")
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ? AND is_demo = 1", (body.user_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Demo user not found")
        token = _start_session(conn, row["id"])
    return {"token": token}
