import { useEffect, useState } from "react";
import { api, setToken } from "./api";

type DemoUser = { id: number; display_name: string };

const input =
  "w-full rounded-xl border border-[#d8e0dd] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#357866]";
const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#587068]";

export default function Auth({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);

  useEffect(() => {
    api<DemoUser[]>("GET", "/api/dev/demo-users").then(setDemoUsers).catch(() => setDemoUsers([]));
  }, []);

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
      finish(() => api("POST", "/api/auth/signup", { email, password, display_name: name }));
    } else {
      finish(() => api("POST", "/api/auth/login", { email, password }));
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f7f8] px-5 py-10 text-[#14211d]">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="grid size-10 place-items-center rounded-[12px] bg-[#173f35] text-white">
            <svg aria-hidden="true" height="22" viewBox="0 0 24 24" width="22">
              <path d="M4 18V9l8-5 8 5v9l-8-4.6L4 18Z" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[22px] font-bold tracking-[-0.04em]">Northstar</span>
        </div>

        <div className="rounded-[20px] border border-[#e0e6e4] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-[24px] font-bold tracking-[-0.04em]">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-[#697975]">
            {mode === "login" ? "Log in to see your spending and your friends." : "You'll link your bank right after this."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "signup" && (
              <label className="block">
                <span className={label}>Your name</span>
                <input autoComplete="name" className={input} onChange={(e) => setName(e.target.value)} required value={name} />
              </label>
            )}
            <label className="block">
              <span className={label}>Email</span>
              <input autoComplete="email" className={input} onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
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

            {error && (
              <p className="rounded-xl border border-[#f3c9bd] bg-[#fff4f0] px-3 py-2.5 text-xs font-semibold text-[#9a3b22]" role="alert">
                {error}
              </p>
            )}

            <button className="w-full rounded-xl bg-[#173f35] py-3 text-sm font-bold text-white transition hover:bg-[#0f2c25] disabled:opacity-60" disabled={busy} type="submit">
              {busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#697975]">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              className="font-bold text-[#235749] hover:underline"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              type="button"
            >
              {mode === "login" ? "Create an account" : "Log in"}
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
                  className="rounded-lg border border-[#d8e0dd] bg-white px-3 py-2 text-xs font-bold text-[#31433e] transition hover:bg-[#f3f6f5] disabled:opacity-60"
                  disabled={busy}
                  key={u.id}
                  onClick={() => finish(() => api("POST", "/api/dev/login-as", { user_id: u.id }))}
                  type="button"
                >
                  {u.display_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
