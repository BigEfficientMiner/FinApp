# Gatorstar: AI-Assisted Development Log

**Project:** Gatorstar, a social savings app for friend groups (Capital One Nessie + Google Gemini + Solana devnet)
**Developer:** Alwin (with teammates)
**AI assistant:** Claude, used through Claude Cowork (configured model ID `claude-opus-5-5`)
**Sessions covered:** October 17–18, 2026 (one long, continuous working session)

---

## About this log

This is a record of how we built Gatorstar with Claude as a coding assistant. Claude wrote it at the end of the session from the conversation history. Requests are paraphrased and grouped by topic in roughly the order they happened. It is not a verbatim transcript.

For every request it lists:
- what we asked for
- what Claude built or changed
- which files changed
- how the change was checked
- any problems we hit along the way

**Who did what:** the team set the direction, design choices, priorities and all product decisions, and ran the app on our own machines. Claude wrote and edited code, ran tests in its own cloud workspace, explained trade-offs, and saved finished files into our project folder. Every change was reviewed and run by us before we pushed it.

**No secrets are recorded here.** API keys and the Solana wallet secret were never pasted into this log, and Claude repeatedly advised keeping them out of chat and out of Git.

---

## How we worked with Claude

- **Project folder link.** Claude read and wrote files in our local project folders (`FinApp-main`, then `FinApp-main 928pm`, then `FinApp-main 1213am`) through the Cowork desktop link.
- **Copy, edit, write back.** Claude copied files into its workspace, edited and tested them there, and wrote them back to our folder. Before overwriting, it checked that we hadn't changed the file in the meantime, so our edits weren't lost.
- **Testing in Claude's workspace:**
  - **Backend:** Python tests against a fake Nessie bank, a fake Gemini, and a simulated Solana network that checks signatures.
  - **Frontend:** TypeScript type-checking (`tsc --strict`).
  - **Screens:** a headless Chromium browser (Playwright) to click through screens and take screenshots at desktop and phone sizes.
- **Our side.** We ran the app with `start.bat`, pushed to GitHub, and deployed on Railway.

---

## Timeline

### 1. Getting started
- **Asked:** take in the project context and ask questions before coding. Then run the app locally to see changes in real time.
- **Done:**
  - Claude reviewed the existing FastAPI + React app built on Nessie.
  - It confirmed `start.bat` starts the backend (port 8000) and frontend (port 8443) with live reload.

### 2. UI revamp: Overview vs. Insights
- **Asked:**
  - Remove "Recent purchases" from Overview to cut clutter.
  - Make Overview and Insights clearly different.
  - Move the Transactions page into Insights.
- **Done:** removed the clutter from Overview. Insights now shows Gemini's explanation plus the full transaction statement on one page.

### 3. Speeding up slow pages
- **Asked:** switching tabs took too long to load metrics.
- **Done:**
  - Nessie calls for a ledger now run in parallel.
  - Ledgers are cached for 30 seconds, and the cache clears on every write.
  - The frontend reuses identical requests that are already in flight.
  - Pages show the last loaded data right away while fresh data loads.
- **Files:** `banking.py`, `frontend/src/api.ts`, pages using `cached()`.

### 4. Loading screens and bank connection
- **Asked:** a short loading screen after login and signup. Simulate connecting a bank, with Nessie filling in the data automatically.
- **Done:** `Loading.tsx` added `SignInLoading` and `ConnectBankLoading`. Each one preloads the user's data while it shows its steps.

### 5. Start each launch logged out
- **Asked:** `start.bat` shouldn't open already signed in to a demo account.
- **Done:** `start.bat` now opens the app with `?signout`, which ends the old session before the page draws.

### 6. Pushing and API keys for hosting
- **Asked:** how to push the revamp, and how to give Railway API keys without committing them. Also, check that our setup was right.
- **Done:**
  - Confirmed `.env` stays local and is in `.gitignore`.
  - Keys go in Railway's Variables.
  - Reviewed how the code loads them.
  - Suggested rotating keys that had appeared in a screenshot.

### 7. Faster Gemini and demo logins on Railway
- **Asked:** Gemini felt slow, and the demo accounts didn't show up on Railway.
- **Done:**
  - Faster Gemini settings and caching.
  - `demo_setup.ensure_demo()` builds or restores the demo users automatically on an empty database, because Railway starts each deploy with a fresh `app.db`.

### 8. Rollback and re-applying the work
- **Asked:** save all work before a rollback, then re-apply it to the new folder "FinApp-main 928pm".
- **Done:** Claude kept copies of every changed file and re-applied them to the new folder.

### 9. Gemini goal coach (Groups)
- **Asked:**
  - A guided chat that helps a group plan a savings goal: deadline, pace, how realistic it is, payment frequency.
  - Penalties for missed payments: a money percentage, or an honor-code "dare" like fantasy football.
  - "Use this plan" should fill in the goal form.
  - We picked guided chat, terms chosen per goal, and coach first.
- **Done:**
  - `goal_coach.py` has a structured JSON chat with tap-to-answer chips.
  - Python recalculates the payment math and caps the realism score.
  - New goal columns hold frequency, penalty, pace and realism.
  - Each member gets a payment schedule with missed-payment tracking.
- **Files:** `goal_coach.py`, `groups.py`, `db.py`, `GoalCoach.tsx`, `Groups.tsx`.

### 10. Gemini status badge, waiting screen and model tiers
- **Asked:** a badge confirming Gemini works, a loading buffer for slow Gemini calls, and lighter or heavier models depending on the job.
- **Done:**
  - `AiStatusBadge` in the header.
  - A `GeminiThinking` step-by-step waiting screen.
  - Model tiers in `gemini.py`: fast, smart and coach.
  - Fallback models and time limits on every call.

### 11. Solana vault for group goals
- **Asked:** use Solana to hold group savings like escrow. Is it possible, and how? We chose a tokenized vault with app-managed wallets.
- **Done:**
  - `solana_vault.py` created the GSD token (1 = $1, stored in cents).
  - A wallet per user and a vault per goal.
  - A queue of on-chain steps (deposit, refund) with a background worker that retries.
  - It uses `solders` and raw JSON-RPC, after finding that `solana-py` has no synchronous client.
  - The vault panel shows balances, a "Verified" match against the app's records, and Explorer links.
- **Questions answered:**
  - What "needs funding" means: the app wallet needs free test SOL from the devnet faucet to pay fees.
  - That GSD stands in for the dollars, and that devnet involves no real money.
  - How to store the wallet secret as `SOLANA_AUTHORITY_SECRET` on Railway.
- **Checked:** with the simulated Solana network (deposits, refunds, backfill, outage recovery). We also confirmed a real devnet transaction on Solana Explorer.

### 12. Git reconnection and a pull request conflict
- **Asked:** fix a rejected push, then resolve 5 conflicts in a pull request.
- **Done:**
  - Recommended "Accept current change" for all 5.
  - Checked that the merged result matched our branch and built.
  - Explained why "incoming" would have thrown away our new work.

### 13. New folder "FinApp-main 1213am": coach fix, live updates, celebrations
- **Asked:** the coach sometimes didn't answer (use a lighter model?), changes should show live for all users, and add confetti plus a notification when a goal is reached.
- **Done:**
  - **Coach:** uses the fast model with a 15-second limit. A built-in backup planner answers if Gemini is slow.
  - **Live updates:** `live.py` keeps change counters, raised on every successful write. `live.ts` checks them every 2 seconds and reloads only the affected screens.
  - **Celebrations:** `Celebration.tsx` shows confetti for every member once, and a "Goal reached" notification is added.
  - **Wallet funding message:** caused by the new folder creating an empty wallet. Fixed by copying the funded wallet file across; recommended `SOLANA_AUTHORITY_SECRET`.
- **Checked:** two-user backend tests (counters change, each member sees the celebration exactly once, coach backup answers within the time limit).

### 14. Solana showcase
- **Asked:** make the blockchain a bigger part of the project by showing that it verifies payments and holds money in escrow. We chose all four options.
- **Done:**
  - **Verify on Solana:** the browser checks each transaction straight from Solana: signer, destination vault, amount, token and memo, plus the vault balance.
  - **"Try to cheat":** edits one record in the browser's copy and shows Solana catching the change.
  - **Live tracker:** follows a contribution from bank withdrawal to queued, signed, confirmed (slot and fee) and vault updated.
  - **Escrow:** locked until the goal is reached, then the creator or owner releases it. The payout goes to their bank account, and the vault's tokens are sent out and burned. Deleting a goal before release refunds everyone. No more money can be added or undone after release.
  - **Public proof page:** link plus a QR code, no login, first names only, runs verification automatically.
- **Files:** `solana_vault.py`, `groups.py`, `db.py`, `requirements.txt` (`qrcode`), `Vault.tsx`, `Proof.tsx`, `App.tsx`, `Groups.tsx`.
- **Checked:** backend escrow tests and a browser run against a simulated Solana network (tamper caught, release verified, QR shown).

### 15. Tab title and new logo
- **Asked:** rename the browser tab from "Figma Make App" to Gatorstar and use the new gator logo.
- **Done:** set the title in the Figma site config, and swapped the logo in the header, login, loading screens and proof page.
- **Follow-up bug:** the logo didn't show on Railway.
  - **Cause:** the template's `.gitattributes` sends `.png` files through Git LFS, so Railway only got a placeholder file.
  - **Fix:** embedded the logo in code (`logoData.ts`) and used an SVG tab icon, which doesn't go through LFS.

### 16. Recovering from an accidental rollback
- **Asked:** the folder had been reset to an older version; restore everything.
- **Done:**
  - Compared every file first and confirmed the old copies held no new work.
  - Restored all 23 changed files and confirmed every size matched.
  - Advised committing right away so a reset couldn't lose the work again.

### 17. Budgeting, points, leaderboard and lessons
- **Asked:**
  - A budgeting feature with Gemini: suggestions, high-spending categories, and a form Gemini fills in.
  - Points for staying under budget, on a weekly leaderboard with friends.
  - A financial-education section.
  - We chose: a new Budget tab, weekly periods, points and percentages only for friends, and lessons + quiz + Ask.
- **Done:**
  - **Budgets** (`budget.py`): weekly limits per category, scoring, streaks, and saved results for finished weeks.
  - **Budget coach:** Gemini plus a backup planner.
  - **Spending tips:** with one-click "lower this limit".
  - **Leaderboard and cheers:** cheers show up in the bell.
  - **Demo budgets:** created automatically for the demo personas.
  - **Lessons** (`learn.py`): 7 lessons tailored by Gemini, with built-in fallbacks. Quizzes are graded on the server, with answer order shuffled per person, +10 points, up to 3 a week.
  - **Ask Gemini:** with quick built-in answers as a fallback.
- **Checked:** two-user backend tests, plus a check that Gemini's answers get cleaned up (made-up categories removed, unrealistic amounts capped). Browser screenshots at desktop and phone sizes.

### 18. Social and Learn revamp, plus design review
- **Asked:**
  - Rename Friends to Social, with friends, leaderboards and a feed of what friends are doing.
  - Make Learn its own tab.
  - Suggestions to make the app more intuitive.
- **Claude's suggestions (we approved all):**
  - A 6-item menu, with Accounts moved into an account menu.
  - Labels under the icons on phones.
  - An account menu that holds Log out.
  - A points counter in the header.
  - A Settings page with privacy switches.
  - A "your week" summary on Home.
  - Remove the dead buttons.
  - Show dollar amounts only inside shared groups, with an opt-in for more.
- **Done:**
  - `social.py`: activity feed (savings, milestones, streaks, lessons, budgets, friendships, cheers), reactions with notifications, sharing settings, and the `/api/me/week` summary.
  - New `Social.tsx`, `Settings.tsx` and `week.ts`.
  - `Learn.tsx` became its own tab with progress stats.
  - Navigation, header and phone-menu updates in `App.tsx` and `index.css`.
- **Checked:** feed and privacy tests, plus screenshots at desktop and phone sizes. We trimmed noise from the feed after reviewing screenshots.

### 19. Submission writing (Devpost)
- **Asked:** help write the project story ("About the project"), the "Built with" tags, the "Did you use generative AI?" answer, and an elevator pitch.
- **Done:** Claude drafted all four from our story: friends frustrated by group-trip money, plus our twist of education and social accountability. It suggested also disclosing that we used AI coding assistants if the hackathon asks.

### 20. Bug: simulated grocery runs counted as "Other"
- **Cause:** the demo button saved the store's category as blank, and blank counts as "Other". It also overwrote the remembered category for that store.
- **Fix:** demo buttons pass the real category. `banking.categorize()` matches each purchase to one of our five categories, guessing from the merchant name when needed, and failed lookups are retried instead of saved as Other.
- **Checked:** every demo button lands in the right category on Budget and Insights.

### 21. Bug: same-day transactions in random order
- **Cause:** Nessie only stores a date, not a time.
- **Fix:** each ledger line now carries the moment the app recorded it (from `nessie_activity`, ties broken by row number). The statement and dashboard sort newest first.
- **Checked:** seven quick transactions listed in exact reverse order.

### 22. Git push help
- **Done:**
  - Step-by-step commands: status, add, commit, `pull --rebase`, push.
  - Checks that `.env`, `app.db` and `solana_authority.json` aren't included.
  - Advice on conflicts and login errors.

### 23. README verification and rewrite
- **Asked:** check our README draft for accuracy, then write the full version.
- **Done:**
  - Found 10 inaccuracies, including an outdated Gemini section, the release rules, the custodial wallets, the merchant data Gemini sees, and the demo buttons' location.
  - Listed the missing features.
  - Delivered a complete corrected `README.md`.

### 24. Final check: live updates across users
- **Asked:** verify that everything updates live between users (friend requests, leaderboard, everything), without switching tabs or refreshing.
- **Done:**
  - Audited every write action and every screen's live subscription.
  - Ran a two-browser end-to-end test, with two separate logins acting at the same time.
  - **21 of 21 checks passed**, typically within 0–3 seconds: friend requests, accepts, the leaderboard, budgets, purchases, cheers, reactions, group invites, joins, goals, contributions, the header points, confetti for both users, lessons, the Home summary and unfriending.
- **Fix:** the "This week's leaders" card now also refreshes when friends or goals change.

---

## Engineering practices along the way

- **Fallbacks everywhere.** Every Gemini feature has a time limit and a built-in fallback. If Solana is down, contributions still work and sync later.
- **Gemini's numbers are always checked.** Every Gemini response must match a JSON schema, and Python recalculates or caps the numbers.
- **Privacy by default.** Gemini sees only the user's own aggregated numbers. Friends see points and percentages, not purchases.
- **Secrets stay out of Git.** `.env`, `app.db` and `solana_authority.json` are in `.gitignore`. Railway Variables hold the keys.
- **Safe file writes.** Before overwriting a file in our folder, Claude checked it hadn't changed since it was copied.
- **Tested before handing over.** Backend tests, strict TypeScript checks and browser screenshots ran before files were saved to our folder.

## Final feature list (as submitted)

| Area | Features |
| --- | --- |
| Home | "Your week" summary and spending dashboard |
| Insights | Gemini explanation and full statement (CSV, print) |
| Budget | Weekly limits, Gemini budget coach, tips, points |
| Social | Activity feed, reactions, leaderboard, cheers, friends |
| Groups | Shared goals, Gemini goal coach, payment schedules, penalties or dares |
| Solana | Per-goal vault, escrow release, live tracker, browser verification, tamper demo, public proof page with QR code |
| Learn | 7 tailored lessons, quizzes for points, Ask Gemini, progress |
| Across the app | Live updates for every user, notifications, goal confetti, privacy settings, demo mode with simulated purchases |
