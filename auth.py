"""App accounts: sign up, log in, log out, and "who am I".

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
DEMO_EMAIL_DOMAIN = "@demo.finapp"  # seed_users.py creates users with this domain


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
    return {"id": row["id"], "display_name": row["display_name"]}


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
            raise HTTPException(401, "Your session has expired. Please log in again.")
        return {
            "id": row["id"],
            "email": row["email"],
            "display_name": row["display_name"],
            "bank_link": _bank_link(conn, row["id"]),
            "token_hash": _hash_token(token),
        }


def me_response(user: dict) -> dict:
    return {k: user[k] for k in ("id", "email", "display_name", "bank_link")}


# ---------- Endpoints ----------

class SignupIn(BaseModel):
    email: str
    password: str
    display_name: str


class LoginIn(BaseModel):
    email: str
    password: str


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@router.post("/auth/signup", status_code=201)
def signup(body: SignupIn):
    email = body.email.strip().lower()
    name = body.display_name.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not name:
        raise HTTPException(400, "Enter your name")
    with db.connect() as conn:
        if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
            raise HTTPException(409, "An account with this email already exists")
        cur = conn.execute(
            "INSERT INTO users (email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)",
            (email, hash_password(body.password), name[:60], db.now()),
        )
        token = _start_session(conn, cur.lastrowid)
    return {"token": token}


@router.post("/auth/login")
def login(body: LoginIn):
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (body.email.strip().lower(),)).fetchone()
        # Same message whether the email or the password is wrong.
        if row is None or not check_password(body.password, row["password_hash"]):
            raise HTTPException(401, "Email or password is incorrect")
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


def _require_dev():
    if not DEV_MODE:
        raise HTTPException(404, "Not found")


@router.get("/dev/demo-users")
def demo_users():
    """Seeded demo users (only those, never real sign-ups)."""
    if not DEV_MODE:
        return []
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM users WHERE email LIKE ? ORDER BY display_name", (f"%{DEMO_EMAIL_DOMAIN}",)
        ).fetchall()
    return [public_user(r) for r in rows]


@router.post("/dev/login-as")
def login_as(body: LoginAsIn):
    _require_dev()
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (body.user_id,)).fetchone()
        if row is None or not row["email"].endswith(DEMO_EMAIL_DOMAIN):
            raise HTTPException(404, "Demo user not found")
        token = _start_session(conn, row["id"])
    return {"token": token}
