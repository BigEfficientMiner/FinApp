import { useEffect, useState } from "react";
import { api } from "./api";
import { ConnectBankLoading } from "./Loading";

const input =
  "w-full rounded-xl border border-[#d8e0dd] bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#357866]";
const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#587068]";
const primaryBtn = "rounded-xl bg-[#173f35] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#0f2c25] disabled:opacity-60";

type FieldProps = { name: string; title: string; value: string; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "name" | "title"
>;

function Field({ name, title, value, onChange, ...rest }: FieldProps) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      <input className={input} name={name} onChange={(e) => onChange(e.target.value)} required value={value} {...rest} />
    </label>
  );
}

/** Shown when the logged-in user has no bank linked yet. */
export function LinkBankForm({ onLinked }: { onLinked: () => void }) {
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); // shows the "Connecting your bank" screen, which does the linking
    setError("");
  }

  return (
    <section className="panel mx-auto max-w-[560px]">
      {busy && (
        <ConnectBankLoading
          connect={() => api("POST", "/api/bank/link", { nessie_customer_id: customerId.trim() })}
          newAccount={false}
          onDone={onLinked}
          onError={(message) => {
            setError(message);
            setBusy(false);
          }}
        />
      )}
      <div className="mb-1 grid size-11 place-items-center rounded-2xl bg-[#e7f1ed] text-[#276858]">
        <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="22">
          <path d="m3 10 9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
        </svg>
      </div>
      <h2 className="mt-3 text-[22px] font-bold tracking-[-0.035em]">Link your bank</h2>
      <p className="mt-1 text-sm text-[#697975]">Enter your bank customer ID to connect your bank profile. Your friends never see your bank details.</p>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <Field
          autoCapitalize="none"
          name="customer_id"
          onChange={setCustomerId}
          placeholder="e.g. c5b9f2b6-8a6d-4afa-80bd-…"
          spellCheck={false}
          title="Bank customer ID"
          value={customerId}
        />
        <p className="text-[11px] text-[#8a9893]">Each bank profile can only be linked to one app profile. Keep your ID private, like an account number.</p>
        {error && <ErrorBox text={error} />}
        <button className={primaryBtn} disabled={busy} type="submit">
          {busy ? "Linking…" : "Link bank"}
        </button>
      </form>

      <OpenBankAccount onLinked={onLinked} />
    </section>
  );
}

const STYLES = [
  { key: "student", title: "Student", body: "Part-time paychecks, rent, coffee and groceries. Checking + Savings." },
  { key: "commuter", title: "Commuter", body: "Lots of rides and takeout on a starter credit card. Checking + Credit Card." },
  { key: "professional", title: "Professional", body: "Salary, bigger bills, saving for a house. Checking, Savings + Credit Card." },
];

/** No bank customer ID? Open a brand-new bank profile in Nessie and link it. */
function OpenBankAccount({ onLinked }: { onLinked: () => void }) {
  const [style, setStyle] = useState("student");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function open() {
    setBusy(true); // shows the "Connecting your bank" screen, which opens the account
    setError("");
  }

  return (
    <div className="mt-6 border-t border-[#edf0ef] pt-5">
      {busy && (
        <ConnectBankLoading
          connect={() => api("POST", "/api/bank/create", { style })}
          newAccount
          onDone={onLinked}
          onError={(message) => {
            setError(message);
            setBusy(false);
          }}
        />
      )}
      <p className="text-sm font-bold">Don't have a customer ID?</p>
      <p className="mt-1 text-xs text-[#697975]">Open a new Northstar bank account instead. We'll create it, link it, and fill in about two months of sample activity.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {STYLES.map((s) => (
          <button
            className={`rounded-xl border p-3 text-left transition ${style === s.key ? "border-[#357866] bg-[#eef6f2]" : "border-[#d8e0dd] hover:bg-[#f7faf9]"}`}
            key={s.key}
            onClick={() => setStyle(s.key)}
            type="button"
          >
            <span className="block text-xs font-bold">{s.title}</span>
            <span className="mt-1 block text-[11px] leading-4 text-[#697975]">{s.body}</span>
          </button>
        ))}
      </div>
      {error && <div className="mt-3"><ErrorBox text={error} /></div>}
      <button className={`${primaryBtn} mt-4`} disabled={busy} onClick={open} type="button">
        {busy ? "Opening your account…" : "Open a new account"}
      </button>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-[#f3c9bd] bg-[#fff4f0] px-3 py-2.5 text-xs font-semibold text-[#9a3b22]" role="alert">
      {text}
    </p>
  );
}

type BankSummary = {
  customer_id: string;
  linked_at: string;
  name: string;
  accounts: { id: string; type: string; nickname: string; balance: number }[];
};

/** The Accounts page: your linked bank, or the form to link one. */
export default function AccountsPage({ linked, onChange }: { linked: boolean; onChange: () => void }) {
  const [bank, setBank] = useState<BankSummary | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const [building, setBuilding] = useState(false);

  useEffect(() => {
    if (!linked) return;
    api<BankSummary>("GET", "/api/bank").then(setBank).catch((e) => setError(e.message));
  }, [linked]);

  // A newly opened account fills in its history in the background: show that, then refresh.
  useEffect(() => {
    if (!linked) return;
    let stop = false;
    const check = () =>
      api<{ status: string }>("GET", "/api/bank/history-status")
        .then((r) => {
          if (stop) return;
          setBuilding(r.status === "building");
          if (r.status === "building") setTimeout(check, 5000);
          else api<BankSummary>("GET", "/api/bank").then(setBank).catch(() => {});
        })
        .catch(() => {});
    check();
    return () => {
      stop = true;
    };
  }, [linked]);

  async function unlink() {
    try {
      await api("DELETE", "/api/bank/link");
      setBank(null);
      setConfirming(false);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#71817c]">Accounts</p>
        <h1 className="text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">Your bank</h1>
      </div>
      {!linked ? (
        <LinkBankForm onLinked={onChange} />
      ) : (
        <section className="panel max-w-[720px]">
          {error && <ErrorBox text={error} />}
          {building && (
            <p className="mb-4 rounded-xl bg-[#eef6f2] px-3 py-2.5 text-xs font-semibold text-[#276858]">
              Setting up your account history… your dashboard fills in over the next minute or two.
            </p>
          )}
          {bank && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Linked bank profile</p>
                  <p className="mt-1 text-lg font-bold">{bank.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-[#8a9893]">{bank.customer_id}</p>
                  <p className="mt-1 text-[11px] text-[#8a9893]">
                    Linked {new Date(bank.linked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                {confirming ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#697975]">Unlink this bank?</span>
                    <button className="rounded-lg border border-[#d8e0dd] px-3 py-2 text-[11px] font-bold" onClick={() => setConfirming(false)} type="button">
                      Keep it
                    </button>
                    <button className="rounded-lg bg-[#b4502f] px-3 py-2 text-[11px] font-bold text-white" onClick={unlink} type="button">
                      Unlink
                    </button>
                  </div>
                ) : (
                  <button className="rounded-lg border border-[#d8e0dd] px-3 py-2 text-[11px] font-bold text-[#31433e] hover:bg-[#f3f6f5]" onClick={() => setConfirming(true)} type="button">
                    Unlink bank
                  </button>
                )}
              </div>
              <div className="mt-5 border-t border-[#edf0ef]">
                {bank.accounts.length === 0 && <p className="py-4 text-xs text-[#8a9893]">No accounts at this bank yet.</p>}
                {bank.accounts.map((a) => (
                  <div className="flex items-center justify-between border-b border-[#edf0ef] py-3.5 last:border-b-0" key={a.id}>
                    <div>
                      <p className="text-xs font-bold">{a.nickname}</p>
                      <p className="text-[10px] text-[#8a9893]">{a.type}</p>
                    </div>
                    <p className="text-sm font-bold">{a.balance.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-[#8a9893]">Unlinking keeps your friends and goals. Only your bank data disappears from the app.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
