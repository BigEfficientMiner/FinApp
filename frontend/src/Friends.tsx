import { useCallback, useEffect, useState } from "react";
import { api as call } from "./api";

type Person = { id: number; display_name: string };
type Link = { request_id: number; person: Person; since: string };
type Overview = { friends: Link[]; incoming: Link[]; outgoing: Link[]; suggestions: Person[] };

const fullName = (p: Person) => p.display_name;
const firstName = (p: Person) => p.display_name.split(" ")[0];
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
const sinceDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Avatar({ person }: { person: Person }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d9eadf] text-xs font-bold text-[#235749]">
      {initials(person.display_name)}
    </span>
  );
}

function PersonRow({ person, detail, children }: { person: Person; detail?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-[#edf0ef] px-5 py-3.5 first:border-t-0 sm:px-6">
      <Avatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold">{fullName(person)}</p>
        {detail && <p className="text-[10px] text-[#8a9893]">{detail}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

const primaryBtn = "rounded-lg bg-[#173f35] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#0f2c25] disabled:opacity-50";
const secondaryBtn = "rounded-lg border border-[#d8e0dd] bg-white px-3 py-2 text-[11px] font-bold text-[#31433e] transition hover:bg-[#f3f6f5] disabled:opacity-50";
const quietBtn = "rounded-lg px-2 py-2 text-[11px] font-bold text-[#8a9893] transition hover:text-[#b4502f] disabled:opacity-50";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-xs text-[#8a9893] sm:px-6">{children}</p>;
}

export default function Friends() {
  const [data, setData] = useState<Overview | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(() => {
    call<Overview>("GET", `/api/friends?q=${encodeURIComponent(query)}`)
      .then(setData)
      .catch((e) => setMessage({ kind: "error", text: `Couldn't load friends: ${e.message}` }));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(key: string, run: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await run();
      setMessage({ kind: "ok", text: success });
      load();
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const sendRequest = (p: Person) =>
    act(`add-${p.id}`, () => call("POST", "/api/friend-requests", { to_user_id: p.id }), `Friend request sent to ${firstName(p)}.`);
  const accept = (l: Link) =>
    act(`accept-${l.request_id}`, () => call("POST", `/api/friend-requests/${l.request_id}/accept`), `You and ${firstName(l.person)} are now friends.`);
  const decline = (l: Link, cancel = false) =>
    act(
      `decline-${l.request_id}`,
      () => call("POST", `/api/friend-requests/${l.request_id}/decline`),
      cancel ? `Request to ${firstName(l.person)} cancelled.` : `Request from ${firstName(l.person)} declined.`,
    );
  const remove = (l: Link) =>
    act(`remove-${l.person.id}`, () => call("DELETE", `/api/friends/${l.person.id}`), `Removed ${firstName(l.person)} from your friends.`);

  return (
    <div>
      <div className="mb-7">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#71817c]">Friends</p>
        <h1 className="text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">Your people</h1>
        <p className="mt-1 text-sm text-[#697975]">Add friends now so you can save toward shared goals together.</p>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-xs font-semibold ${message.kind === "ok" ? "border-[#bfe3d3] bg-[#eefaf4] text-[#146d57]" : "border-[#f3c9bd] bg-[#fff4f0] text-[#9a3b22]"}`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <section className="panel !p-0">
            <div className="panel-heading px-5 pt-5 sm:px-6">
              <div>
                <p className="panel-title">Friend requests</p>
                <p className="panel-subtitle">People who want to connect with you</p>
              </div>
              {data && data.incoming.length > 0 && (
                <span className="rounded-full bg-[#ef6b4a] px-2 py-0.5 text-[10px] font-bold text-white">{data.incoming.length}</span>
              )}
            </div>
            <div className="mt-3">
              {data?.incoming.length === 0 && <Empty>No pending requests.</Empty>}
              {data?.incoming.map((l) => (
                <PersonRow detail={`Sent ${sinceDate(l.since)}`} key={l.request_id} person={l.person}>
                  <button className={secondaryBtn} disabled={busy !== null} onClick={() => decline(l)}>
                    Decline
                  </button>
                  <button className={primaryBtn} disabled={busy !== null} onClick={() => accept(l)}>
                    Accept
                  </button>
                </PersonRow>
              ))}
            </div>
          </section>

          <section className="panel !p-0">
            <div className="panel-heading px-5 pt-5 sm:px-6">
              <div>
                <p className="panel-title">Your friends</p>
                <p className="panel-subtitle">
                  {data ? `${data.friends.length} ${data.friends.length === 1 ? "friend" : "friends"}` : "Loading…"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              {data?.friends.length === 0 && <Empty>No friends yet. Find people to add on this page.</Empty>}
              {data?.friends.map((l) => (
                <PersonRow detail={`Friends since ${sinceDate(l.since)}`} key={l.request_id} person={l.person}>
                  <button className={quietBtn} disabled={busy !== null} onClick={() => remove(l)}>
                    Remove
                  </button>
                </PersonRow>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel !p-0">
            <div className="px-5 pt-5 sm:px-6">
              <p className="panel-title">Find people</p>
              <p className="panel-subtitle">Search by name or exact email, then send a friend request</p>
              <label className="mt-4 block">
                <span className="sr-only">Search people by name</span>
                <input
                  className="w-full rounded-xl border border-[#d8e0dd] bg-white px-4 py-2.5 text-xs outline-none focus:border-[#357866]"
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email"
                  type="search"
                  value={query}
                />
              </label>
            </div>
            <div className="mt-3">
              {data?.suggestions.length === 0 && <Empty>{query ? `No one matching “${query}”.` : "You're connected with everyone here."}</Empty>}
              {data?.suggestions.map((p) => (
                <PersonRow key={p.id} person={p}>
                  <button className={primaryBtn} disabled={busy !== null} onClick={() => sendRequest(p)}>
                    {busy === `add-${p.id}` ? "Sending…" : "Add friend"}
                  </button>
                </PersonRow>
              ))}
            </div>
          </section>

          <section className="panel !p-0">
            <div className="px-5 pt-5 sm:px-6">
              <p className="panel-title">Sent requests</p>
              <p className="panel-subtitle">Waiting for them to accept</p>
            </div>
            <div className="mt-3">
              {data?.outgoing.length === 0 && <Empty>No requests waiting.</Empty>}
              {data?.outgoing.map((l) => (
                <PersonRow detail={`Sent ${sinceDate(l.since)}`} key={l.request_id} person={l.person}>
                  <button className={secondaryBtn} disabled={busy !== null} onClick={() => decline(l, true)}>
                    Cancel
                  </button>
                </PersonRow>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
