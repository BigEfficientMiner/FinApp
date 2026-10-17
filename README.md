# FinanceApp (Northstar)

A hackathon banking app built on Capital One's [Nessie](https://nessieisreal.com) mock banking API.

- **Spending dashboard:** your purchases by category, daily/weekly trends, and a partner offer for your top category.
- **Bank statement:** every deposit, purchase, withdrawal, transfer, paid bill and goal deposit from Nessie, with live balances, filterable by account and period, with CSV download and print.
- **Profiles:** create an app profile (name, username, password) and log in with your username.
- **Bank linking:** link your app profile to a bank profile set up in Nessie by entering its bank customer ID.
- **Friends:** add friends by username, accept or decline requests.
- **Groups and shared goals:** invite friends to a group, set a savings goal (like a trip), commit your share, move money in from your bank account, and see who's on track or behind.

## Project layout

```
server.py          FastAPI backend (run this)
nessie.py          Helper for calling the Nessie API
db.py              App database schema (SQLite, app.db is created automatically)
auth.py            App profiles: create profile / log in / sessions
bank.py            Linking an app profile to a Nessie bank profile by customer ID
friends.py         Friend requests
groups.py          Groups, shared goals, commitments, contributions
statement.py       Bank statement pulled from Nessie
banking.py         Shared bank logic: transactions, balances, moving money
simulate.py        Demo-only simulated transactions
demo_setup.py      Builds the demo baseline once
reset_demo.py      Puts the demo back to its baseline
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

## Demo data (do this once)

With the server stopped, run:

```
venv\Scripts\python.exe demo_setup.py
```

It creates, in your Nessie account, fresh bank profiles for Maya, Carlos and Priya with about 3 months of
realistic history (paychecks, rent and bills, everyday purchases, ATM withdrawals, transfers to savings,
credit card payments). In the app, @maya, @carlos and @priya (password `demo1234`) are linked to them,
are already friends (no pending requests), and share the group "Spring Break Crew" with a $3,000
"Miami spring break" goal that already has real savings in it. It runs once; after that it refuses to
change anything (use `--force` to build brand-new profiles).

## During a demo

- **Add money to a goal** (Groups page): it's a real withdrawal from your checking account in Nessie.
  The goal, your statement, your balance and the dashboard all update, and other people's screens
  pick it up within a few seconds.
- **Simulate** (Transactions page, demo mode only): one-click paycheck, coffee, groceries, dinner,
  ride or shopping, created in Nessie on the spot.
- **Undo** a goal deposit to send the money back.
- Judges can create their own profile live and add `@maya` as a friend.

## Reset after each demo run

With the server stopped:

```
venv\Scripts\python.exe reset_demo.py
```

This takes back every transaction added during the demo and restores the baseline from `demo_setup.py`
(profiles, friends, group, goal, balances, statements). `reset_demo.py --empty` instead clears all
friends and groups for a completely clean slate.

**About balances:** this Nessie server never changes an account's stored balance, and it can't delete
withdrawals or purchases. So the app treats Nessie's stored balance as the opening balance, adds up every
transaction to get the current one, and hides (rather than deletes) anything it takes back. See `banking.py`.

The older scripts (`seed.py`, `seed_purchases.py`, `seed_users.py`, `seed_demo_group.py`) built the first
test data and aren't needed for the demo anymore.

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

## Using it

1. **Create a profile:** on the login screen click *Create a profile* and enter your name, a username and a password.
2. **Link your bank:** enter your bank customer ID (the Nessie customer ID, e.g. from `test_data.json`). Each bank profile can only be linked to one app profile.
3. **Add friends:** on the Friends page, type a friend's username. They accept the request on their Friends page.
4. **Save together:** on the Groups page, create a group, invite friends, set a shared goal, and add money to it from your bank account.

## Notes

- Demo mode (one-click logins) is on by default. Set `FINAPP_DEV=0` to turn it off.
- Adding money to a goal is a real withdrawal in Nessie; undoing it returns the money.
- `app.db` holds profiles and social data locally and is not committed. Older databases that used email logins are converted to usernames automatically (a backup is saved as `app.db.bak`).
