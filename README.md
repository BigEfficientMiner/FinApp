# FinanceApp (Northstar)

A hackathon banking app built on Capital One's [Nessie](https://nessieisreal.com) mock banking API.

- **Spending dashboard:** your purchases by category, daily/weekly trends, and a partner offer for your top category.
- **Accounts:** sign up and log in, then link your bank profile (Nessie customer) or create a new one.
- **Friends:** find people, send and accept friend requests.
- **Groups and shared goals:** invite friends to a group, set a savings goal (like a trip), commit your share, log what you save, and see who's on track or behind.

## Project layout

```
server.py          FastAPI backend (run this)
nessie.py          Helper for calling the Nessie API
db.py              App database schema (SQLite, app.db is created automatically)
auth.py            Sign up / log in / sessions
bank.py            Linking an app account to a Nessie customer
friends.py         Friend requests
groups.py          Groups, shared goals, commitments, contributions
seed*.py           Scripts that create test data
frontend/          React + Vite + Tailwind app (designed in Figma Make)
```

## Setup

You need Python 3.12+ and Node.js 22+.

1. Get a Nessie API key at nessieisreal.com and create a file named `.env` in this folder:
   ```
   NESSIE_API_KEY=your_key_here
   ```
   `.env` is in `.gitignore`. Never commit it.

2. Install the backend:
   ```
   python -m venv venv
   venv\Scripts\pip install -r requirements.txt
   ```
   (On macOS/Linux use `venv/bin/pip` and `venv/bin/python`.)

3. Install the frontend:
   ```
   cd frontend
   npm install
   ```

## Test data

Each Nessie API key has its own data, so run these once with your key, from this folder:

```
venv\Scripts\python.exe seed.py              # 3 test customers with accounts and deposits (writes test_data.json)
venv\Scripts\python.exe seed_purchases.py    # merchants + purchases so the dashboard has data
venv\Scripts\python.exe seed_users.py        # demo app logins linked to those customers
venv\Scripts\python.exe seed_demo_group.py   # a demo group with a shared goal
```

Demo logins: `maya@demo.finapp`, `carlos@demo.finapp`, `priya@demo.finapp`, password `demo1234`.
They also appear as one-click buttons on the login screen while demo mode is on.

## Run

Two terminals:

```
venv\Scripts\python.exe server.py        # backend on http://localhost:8000
```
```
cd frontend
npm run dev                              # app on http://localhost:8443
```

Open http://localhost:8443.

## Notes

- Demo mode (one-click logins) is on by default. Set `FINAPP_DEV=0` to turn it off.
- Savings logged in groups are recorded in the app; they don't move money in Nessie yet.
- `app.db` holds accounts and social data locally and is not committed.
