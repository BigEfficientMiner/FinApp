import { useEffect, useState } from "react";
import { api } from "./api";

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
export function LinkBankForm({ onLinked, displayName }: { onLinked: () => void; displayName: string }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [lastName, setLastName] = useState("");
  const [zip, setZip] = useState("");

  const [first, setFirst] = useState(displayName.split(" ")[0] ?? "");
  const [last, setLast] = useState(displayName.split(" ").slice(1).join(" "));
  const [streetNumber, setStreetNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [newZip, setNewZip] = useState("");

  async function run(request: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await request();
      onLinked();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mx-auto max-w-[640px]">
      <div className="mb-1 grid size-11 place-items-center rounded-2xl bg-[#e7f1ed] text-[#276858]">
        <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="22">
          <path d="m3 10 9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
        </svg>
      </div>
      <h2 className="mt-3 text-[22px] font-bold tracking-[-0.035em]">Link your bank</h2>
      <p className="mt-1 text-sm text-[#697975]">Connect your bank profile so we can show your spending. Your friends never see your bank details.</p>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-[#eef3f1] p-1" role="tablist">
        {(["existing", "new"] as const).map((m) => (
          <button
            aria-selected={mode === m}
            className={`rounded-lg py-2 text-xs font-bold transition ${mode === m ? "bg-white text-[#14211d] shadow-sm" : "text-[#587068]"}`}
            key={m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            role="tab"
            type="button"
          >
            {m === "existing" ? "I have a bank profile" : "Create a new one"}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api("POST", "/api/bank/link", { nessie_customer_id: customerId, last_name: lastName, zip }));
          }}
        >
          <Field name="customer_id" onChange={setCustomerId} placeholder="e.g. c5b9f2b6-8a6d-…" title="Bank customer ID" value={customerId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field autoComplete="family-name" name="last_name" onChange={setLastName} title="Last name on the account" value={lastName} />
            <Field autoComplete="postal-code" inputMode="numeric" name="zip" onChange={setZip} title="ZIP code" value={zip} />
          </div>
          <p className="text-[11px] text-[#8a9893]">We check your last name and ZIP against the bank's records to confirm the profile is yours.</p>
          {error && <ErrorBox text={error} />}
          <button className={primaryBtn} disabled={busy} type="submit">
            {busy ? "Linking…" : "Link bank"}
          </button>
        </form>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              api("POST", "/api/bank/create", {
                first_name: first, last_name: last, street_number: streetNumber, street_name: streetName, city, state, zip: newZip,
              }),
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field autoComplete="given-name" name="first_name" onChange={setFirst} title="First name" value={first} />
            <Field autoComplete="family-name" name="last_name" onChange={setLast} title="Last name" value={last} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <Field name="street_number" onChange={setStreetNumber} title="Street no." value={streetNumber} />
            <Field name="street_name" onChange={setStreetName} title="Street name" value={streetName} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_90px_120px]">
            <Field autoComplete="address-level2" name="city" onChange={setCity} title="City" value={city} />
            <Field autoComplete="address-level1" maxLength={2} name="state" onChange={setState} placeholder="FL" title="State" value={state} />
            <Field autoComplete="postal-code" inputMode="numeric" name="zip" onChange={setNewZip} title="ZIP" value={newZip} />
          </div>
          <p className="text-[11px] text-[#8a9893]">This creates a new profile at the bank with an empty checking account, then links it to you.</p>
          {error && <ErrorBox text={error} />}
          <button className={primaryBtn} disabled={busy} type="submit">
            {busy ? "Creating…" : "Create and link"}
          </button>
        </form>
      )}
    </section>
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
export default function AccountsPage({ linked, displayName, onChange }: { linked: boolean; displayName: string; onChange: () => void }) {
  const [bank, setBank] = useState<BankSummary | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!linked) return;
    api<BankSummary>("GET", "/api/bank").then(setBank).catch((e) => setError(e.message));
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
        <LinkBankForm displayName={displayName} onLinked={onChange} />
      ) : (
        <section className="panel max-w-[720px]">
          {error && <ErrorBox text={error} />}
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
