import { useEffect, useState } from "react";
import { api, setToken } from "./api";

type DemoUser = { id: number; username: string; display_name: string };
type Availability = { username: string; valid: boolean; available: boolean } | null;

const input =
  "w-full rounded-xl border border-[#d8e0dd] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#357866]";
const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#587068]";
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const cleanUsername = (raw: string) => raw.trim().replace(/^@/, "").toLowerCase();

export default function Auth({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [availability, setAvailability] = useState<Availability>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);

  useEffect(() => {
    api<DemoUser[]>("GET", "/api/dev/demo-users").then(setDemoUsers).catch(() => setDemoUsers([]));
  }, []);

  // While creating a profile, check the username as you type (after a short pause).
  useEffect(() => {
    const wanted = cleanUsername(username);
    if (mode !== "signup" || !USERNAME_RE.test(wanted)) {
      setAvailability(null);
      return;
    }
    const timer = setTimeout(() => {
      api<Availability>("GET", `/api/auth/username-available?username=${encodeURIComponent(wanted)}`)
        .then(setAvailability)
        .catch(() => setAvailability(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [username, mode]);

  async function finish(run: () => Promise<{ token: string }>) {
    setBusy(true);
    setError("");
    try {
      const { token } = await run();
      setToken(token);
      onLoggedIn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "signup") {
      if (password !== confirm) {
        setError("Passwords don't match");
        return;
      }
      finish(() => api("POST", "/api/auth/signup", { display_name: name, username, password }));
    } else {
      finish(() => api("POST", "/api/auth/login", { username, password }));
    }
  }

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  }

  const wanted = cleanUsername(username);
  const usernameHint =
    mode !== "signup" || !username
      ? null
      : !USERNAME_RE.test(wanted)
        ? { ok: false, text: "3-20 characters: letters, numbers, underscores (_) and periods (.)" }
        : availability?.username === wanted
          ? availability.available
            ? { ok: true, text: `@${wanted} is available` }
            : { ok: false, text: `@${wanted} is taken` }
          : null;

  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f7f8] px-5 py-10 text-[#14211d]">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="grid size-10 place-items-center rounded-[12px] bg-[#173f35] text-white">
            <svg aria-hidden="true" height="22" viewBox="0 0 24 24" width="22">
              <path d="M4 18V9l8-5 8 5v9l-8-4.6L4 18Z" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[22px] font-bold tracking-[-0.04em]">Northstar</span>
        </div>

        <div className="rounded-[20px] border border-[#e0e6e4] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-[24px] font-bold tracking-[-0.04em]">{mode === "login" ? "Welcome back" : "Create your profile"}</h1>
          <p className="mt-1 text-sm text-[#697975]">
            {mode === "login" ? "Log in with your username and password." : "Pick a username your friends can find you by. You'll link your bank next."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "signup" && (
              <label className="block">
                <span className={label}>Your name</span>
                <input autoComplete="name" className={input} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan Lee" required value={name} />
                <span className="mt-1 block text-[11px] text-[#8a9893]">Shown to your friends.</span>
              </label>
            )}
            <label className="block">
              <span className={label}>Username</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#8a9893]">@</span>
                <input
                  autoCapitalize="none"
                  autoComplete="username"
                  className={`${input} pl-8`}
                  maxLength={21}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === "signup" ? "jordan.lee" : "your username"}
                  required
                  spellCheck={false}
                  value={username}
                />
              </div>
              {usernameHint && (
                <span className={`mt-1 block text-[11px] font-semibold ${usernameHint.ok ? "text-[#146d57]" : "text-[#b4502f]"}`}>{usernameHint.text}</span>
              )}
            </label>
            <label className="block">
              <span className={label}>Password</span>
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={input}
                minLength={mode === "signup" ? 8 : undefined}
                onChange={(e) => setPassword(e.target.value)}
                required
                type="password"
                value={password}
              />
              {mode === "signup" && <span className="mt-1 block text-[11px] text-[#8a9893]">At least 8 characters.</span>}
            </label>
            {mode === "signup" && (
              <label className="block">
                <span className={label}>Confirm password</span>
                <input autoComplete="new-password" className={input} onChange={(e) => setConfirm(e.target.value)} required type="password" value={confirm} />
                {confirm && confirm !== password && <span className="mt-1 block text-[11px] font-semibold text-[#b4502f]">Passwords don't match</span>}
              </label>
            )}

            {error && (
              <p className="rounded-xl border border-[#f3c9bd] bg-[#fff4f0] px-3 py-2.5 text-xs font-semibold text-[#9a3b22]" role="alert">
                {error}
              </p>
            )}

            <button className="w-full rounded-xl bg-[#173f35] py-3 text-sm font-bold text-white transition hover:bg-[#0f2c25] disabled:opacity-60" disabled={busy} type="submit">
              {busy ? "One moment…" : mode === "login" ? "Log in" : "Create profile"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#697975]">
            {mode === "login" ? "New here?" : "Already have a profile?"}{" "}
            <button className="font-bold text-[#235749] hover:underline" onClick={() => switchMode(mode === "login" ? "signup" : "login")} type="button">
              {mode === "login" ? "Create a profile" : "Log in"}
            </button>
          </p>
        </div>

        {demoUsers.length > 0 && (
          <div className="mt-5 rounded-[20px] border border-dashed border-[#c9d6d1] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#587068]">Demo mode</p>
            <p className="mt-1 text-xs text-[#697975]">Log in as a test user with one click.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {demoUsers.map((u) => (
                <button
                  className="rounded-lg border border-[#d8e0dd] bg-white px-3 py-2 text-left text-xs font-bold text-[#31433e] transition hover:bg-[#f3f6f5] disabled:opacity-60"
                  disabled={busy}
                  key={u.id}
                  onClick={() => finish(() => api("POST", "/api/dev/login-as", { user_id: u.id }))}
                  type="button"
                >
                  {u.display_name}
                  <span className="block text-[10px] font-semibold text-[#8a9893]">@{u.username}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
