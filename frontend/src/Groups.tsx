import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { initials } from "./Friends";

// ---------- Types (match groups.py) ----------
type Person = { id: number; display_name: string };
type Status = "on_track" | "behind" | "complete" | "not_committed" | "missed";
type MemberProgress = { person: Person; share: number | null; saved: number; expected_by_now: number; percent: number; status: Status };
type Goal = {
  id: number;
  title: string;
  target: number;
  deadline: string;
  created_by: number;
  days_left: number;
  total_saved: number;
  former_members_saved: number;
  percent: number;
  expected_by_now: number;
  committed_total: number;
  uncommitted_count: number;
  status: Status;
  my_share: number | null;
  suggested_share: number;
  members: MemberProgress[];
};
type GroupSummary = {
  id: number;
  name: string;
  members: Person[];
  goals: Pick<Goal, "id" | "title" | "target" | "total_saved" | "percent" | "status" | "days_left" | "my_share">[];
};
type Invite = { id: number; created_at: string; group: { id: number; name: string; member_count: number }; invited_by: Person };
type GroupDetail = {
  id: number;
  name: string;
  owner_id: number;
  members: (Person & { joined_at: string; is_owner: boolean })[];
  pending_invites: { id: number; person: Person; can_cancel: boolean }[];
  invitable_friends: Person[];
  goals: Goal[];
  my_contributions: { id: number; goal_id: number; amount: number; note: string; created_at: string }[];
  activity: { kind: string; message: string; created_at: string }[];
};

// ---------- Small pieces ----------
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const moneyShort = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const primaryBtn = "rounded-lg bg-[#173f35] px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-[#0f2c25] disabled:opacity-50";
const secondaryBtn = "rounded-lg border border-[#d8e0dd] bg-white px-3.5 py-2 text-[11px] font-bold text-[#31433e] transition hover:bg-[#f3f6f5] disabled:opacity-50";
const quietBtn = "rounded-lg px-2 py-2 text-[11px] font-bold text-[#8a9893] transition hover:text-[#b4502f] disabled:opacity-50";
const input = "w-full rounded-xl border border-[#d8e0dd] bg-white px-3.5 py-2.5 text-xs outline-none transition focus:border-[#357866]";
const fieldLabel = "mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#587068]";

const STATUS: Record<Status, { label: string; cls: string }> = {
  on_track: { label: "On track", cls: "bg-[#e5f5ed] text-[#167454]" },
  behind: { label: "Behind", cls: "bg-[#fff0e9] text-[#b4502f]" },
  complete: { label: "Complete", cls: "bg-[#f0eaff] text-[#6c499e]" },
  not_committed: { label: "Not committed", cls: "bg-[#eef1f4] text-[#5b6b80]" },
  missed: { label: "Deadline passed", cls: "bg-[#fde8e4] text-[#9a3b22]" },
};

function Pill({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}

function Avatar({ person, size = "size-9" }: { person: Person; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full border-2 border-white bg-[#d9eadf] text-[11px] font-bold text-[#235749]`} title={person.display_name}>
      {initials(person.display_name)}
    </span>
  );
}

function AvatarStack({ people }: { people: Person[] }) {
  return (
    <div className="flex -space-x-2">
      {people.slice(0, 5).map((p) => (
        <Avatar key={p.id} person={p} size="size-8" />
      ))}
      {people.length > 5 && <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-[#eef1f4] text-[10px] font-bold">+{people.length - 5}</span>}
    </div>
  );
}

/** Progress bar with a tick showing where you should be by now. */
function Bar({ percent, expectedPercent, tone = "green" }: { percent: number; expectedPercent?: number; tone?: "green" | "orange" | "purple" }) {
  const fill = tone === "orange" ? "bg-[#ef8a5f]" : tone === "purple" ? "bg-[#9a6bff]" : "bg-[#2f8a6f]";
  return (
    <div className="relative h-2.5 w-full overflow-visible rounded-full bg-[#e8eeeb]">
      <div className={`h-full rounded-full ${fill} transition-all`} style={{ width: `${Math.min(100, percent)}%` }} />
      {expectedPercent !== undefined && expectedPercent > 0 && expectedPercent < 100 && (
        <div className="absolute -top-1 h-[18px] w-0.5 rounded bg-[#31433e]" style={{ left: `${expectedPercent}%` }} title="Where you should be by now" />
      )}
    </div>
  );
}

function Notice({ message }: { message: { kind: "ok" | "error"; text: string } | null }) {
  if (!message) return null;
  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-3 text-xs font-semibold ${message.kind === "ok" ? "border-[#bfe3d3] bg-[#eefaf4] text-[#146d57]" : "border-[#f3c9bd] bg-[#fff4f0] text-[#9a3b22]"}`}
      role={message.kind === "error" ? "alert" : "status"}
    >
      {message.text}
    </div>
  );
}

type Msg = { kind: "ok" | "error"; text: string } | null;

// Runs an API action, shows a message, reloads.
function useAction(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg>(null);
  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: "ok", text: success });
      reload();
      return true;
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, message, setMessage, run };
}

// ---------- Page ----------
export default function Groups({ meId }: { meId: number }) {
  const [openGroupId, setOpenGroupId] = useState<number | null>(null);
  return openGroupId === null ? (
    <GroupList onOpen={setOpenGroupId} />
  ) : (
    <GroupView groupId={openGroupId} meId={meId} onBack={() => setOpenGroupId(null)} />
  );
}

// ---------- List of groups, invites, create ----------
function GroupList({ onOpen }: { onOpen: (id: number) => void }) {
  const [data, setData] = useState<{ groups: GroupSummary[]; invites: Invite[] } | null>(null);
  const [friends, setFriends] = useState<Person[]>([]);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<{ groups: GroupSummary[]; invites: Invite[] }>("GET", "/api/groups").then(setData).catch((e) => setMessage({ kind: "error", text: e.message }));
    api<{ friends: { person: Person }[] }>("GET", "/api/friends").then((f) => setFriends(f.friends.map((x) => x.person))).catch(() => {});
  }, []);
  const { busy, message, setMessage, run } = useAction(load);
  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    let newId = 0;
    const ok = await run(async () => {
      newId = (await api<{ id: number }>("POST", "/api/groups", { name, invite_user_ids: picked })).id;
    }, `Created “${name.trim()}”${picked.length ? ` and invited ${picked.length} ${picked.length === 1 ? "friend" : "friends"}` : ""}.`);
    if (ok) {
      setName("");
      setPicked([]);
      setCreating(false);
      onOpen(newId);
    }
  }

  return (
    <div>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#71817c]">Groups</p>
          <h1 className="text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">Save together</h1>
          <p className="mt-1 text-sm text-[#697975]">Start a group with friends, set a shared goal, and keep each other on track.</p>
        </div>
        {!creating && (
          <button className={`${primaryBtn} !px-5 !py-3 !text-xs`} onClick={() => setCreating(true)}>
            + New group
          </button>
        )}
      </div>

      <Notice message={message} />

      {data && data.invites.length > 0 && (
        <section className="panel mb-5 !p-0">
          <div className="px-5 pt-5 sm:px-6">
            <p className="panel-title">Group invites</p>
            <p className="panel-subtitle">Friends who want you to save with them</p>
          </div>
          <div className="mt-3">
            {data.invites.map((inv) => (
              <div className="flex flex-wrap items-center gap-3 border-t border-[#edf0ef] px-5 py-3.5 sm:px-6" key={inv.id}>
                <Avatar person={inv.invited_by} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold">{inv.group.name}</p>
                  <p className="text-[10px] text-[#8a9893]">
                    {inv.invited_by.display_name} invited you · {inv.group.member_count} {inv.group.member_count === 1 ? "member" : "members"}
                  </p>
                </div>
                <button className={secondaryBtn} disabled={busy} onClick={() => run(() => api("POST", `/api/group-invites/${inv.id}/decline`), `Declined the invite to ${inv.group.name}.`)}>
                  Decline
                </button>
                <button
                  className={primaryBtn}
                  disabled={busy}
                  onClick={async () => {
                    if (await run(() => api("POST", `/api/group-invites/${inv.id}/accept`), `You joined ${inv.group.name}.`)) onOpen(inv.group.id);
                  }}
                >
                  Join group
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {creating && (
        <section className="panel mb-5">
          <form onSubmit={create}>
            <p className="panel-title">New group</p>
            <p className="panel-subtitle">You can add goals once the group exists.</p>
            <label className="mt-4 block max-w-md">
              <span className={fieldLabel}>Group name</span>
              <input autoFocus className={input} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Break Crew" required value={name} />
            </label>
            <p className={`${fieldLabel} mt-4`}>Invite friends</p>
            {friends.length === 0 ? (
              <p className="text-xs text-[#8a9893]">You don't have any friends added yet. Add some on the Friends page, or invite them later.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {friends.map((f) => {
                  const on = picked.includes(f.id);
                  return (
                    <button
                      aria-pressed={on}
                      className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition ${on ? "border-[#2f8a6f] bg-[#eefaf4] text-[#146d57]" : "border-[#d8e0dd] bg-white text-[#31433e] hover:bg-[#f3f6f5]"}`}
                      key={f.id}
                      onClick={() => setPicked(on ? picked.filter((x) => x !== f.id) : [...picked, f.id])}
                      type="button"
                    >
                      <Avatar person={f} size="size-7" />
                      {f.display_name}
                      {on && <span aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button className={primaryBtn} disabled={busy} type="submit">
                Create group
              </button>
              <button className={secondaryBtn} onClick={() => setCreating(false)} type="button">
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {data && data.groups.length === 0 && !creating && (
        <section className="panel text-center">
          <p className="text-sm font-bold">No groups yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[#8a9893]">Create one for a trip, a concert, or anything you're saving for with friends.</p>
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {data?.groups.map((g) => (
          <button className="panel text-left transition hover:border-[#bcd3ca] hover:shadow-md" key={g.id} onClick={() => onOpen(g.id)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold tracking-[-0.02em]">{g.name}</p>
                <p className="mt-0.5 text-[11px] text-[#8a9893]">
                  {g.members.length} {g.members.length === 1 ? "member" : "members"} · {g.goals.length} {g.goals.length === 1 ? "goal" : "goals"}
                </p>
              </div>
              <AvatarStack people={g.members} />
            </div>
            <div className="mt-5 space-y-4">
              {g.goals.length === 0 && <p className="text-xs text-[#8a9893]">No goals yet. Open the group to add one.</p>}
              {g.goals.slice(0, 2).map((goal) => (
                <div key={goal.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">{goal.title}</span>
                    <Pill status={goal.status} />
                  </div>
                  <Bar percent={goal.percent} tone={goal.status === "behind" ? "orange" : goal.status === "complete" ? "purple" : "green"} />
                  <p className="mt-1.5 text-[10px] text-[#8a9893]">
                    {moneyShort(goal.total_saved)} of {moneyShort(goal.target)} · {goal.days_left >= 0 ? `${goal.days_left} days left` : "deadline passed"}
                  </p>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- One group ----------
function GroupView({ groupId, meId, onBack }: { groupId: number; meId: number; onBack: () => void }) {
  const [g, setG] = useState<GroupDetail | null>(null);
  const [inviteId, setInviteId] = useState("");
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const load = useCallback(() => {
    api<GroupDetail>("GET", `/api/groups/${groupId}`)
      .then(setG)
      .catch((e) => setMessage({ kind: "error", text: e.message }));
  }, [groupId]);
  const { busy, message, setMessage, run } = useAction(load);
  useEffect(load, [load]);

  if (!g)
    return (
      <div>
        <BackLink onBack={onBack} />
        <Notice message={message} />
      </div>
    );

  const isOwner = g.owner_id === meId;

  return (
    <div>
      <BackLink onBack={onBack} />
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#71817c]">Group</p>
          <h1 className="text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">{g.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <AvatarStack people={g.members} />
            <span className="text-xs text-[#697975]">{g.members.map((m) => m.display_name.split(" ")[0]).join(", ")}</span>
          </div>
        </div>
        <button className={`${primaryBtn} !px-5 !py-3 !text-xs`} onClick={() => setShowNewGoal(true)}>
          + New goal
        </button>
      </div>

      <Notice message={message} />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {showNewGoal && <NewGoalForm busy={busy} onCancel={() => setShowNewGoal(false)} onCreate={async (body) => {
            if (await run(() => api("POST", `/api/groups/${g.id}/goals`, body), `Created the goal “${body.title}”. Everyone can now commit their share.`)) setShowNewGoal(false);
          }} />}

          {g.goals.length === 0 && !showNewGoal && (
            <section className="panel text-center">
              <p className="text-sm font-bold">No shared goals yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-[#8a9893]">Set a target and a deadline, and everyone in the group commits their share.</p>
              <button className={`${primaryBtn} mt-4`} onClick={() => setShowNewGoal(true)}>
                Create the first goal
              </button>
            </section>
          )}

          {g.goals.map((goal) => (
            <GoalCard
              busy={busy}
              canDelete={goal.created_by === meId || isOwner}
              contributions={g.my_contributions.filter((c) => c.goal_id === goal.id)}
              goal={goal}
              key={goal.id}
              meId={meId}
              run={run}
            />
          ))}
        </div>

        <div className="space-y-5">
          <section className="panel">
            <p className="panel-title">Members</p>
            <div className="mt-3 space-y-3">
              {g.members.map((m) => (
                <div className="flex items-center gap-3" key={m.id}>
                  <Avatar person={m} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">
                      {m.display_name}
                      {m.id === meId && <span className="font-normal text-[#8a9893]"> (you)</span>}
                    </p>
                    <p className="text-[10px] text-[#8a9893]">{m.is_owner ? "Owner" : `Joined ${when(m.joined_at)}`}</p>
                  </div>
                </div>
              ))}
              {g.pending_invites.map((i) => (
                <div className="flex items-center gap-3 opacity-70" key={i.id}>
                  <Avatar person={i.person} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{i.person.display_name}</p>
                    <p className="text-[10px] text-[#8a9893]">Invited, hasn't joined yet</p>
                  </div>
                  {i.can_cancel && (
                    <button className={quietBtn} disabled={busy} onClick={() => run(() => api("POST", `/api/group-invites/${i.id}/decline`), `Cancelled the invite to ${i.person.display_name}.`)}>
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-[#edf0ef] pt-4">
              <p className={fieldLabel}>Invite a friend</p>
              {g.invitable_friends.length === 0 ? (
                <p className="text-[11px] text-[#8a9893]">All your friends are already here or invited. Add more on the Friends page.</p>
              ) : (
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const friend = g.invitable_friends.find((f) => String(f.id) === inviteId);
                    if (!friend) return;
                    if (await run(() => api("POST", `/api/groups/${g.id}/invites`, { user_id: friend.id }), `Invited ${friend.display_name}.`)) setInviteId("");
                  }}
                >
                  <select className={input} onChange={(e) => setInviteId(e.target.value)} required value={inviteId}>
                    <option value="">Choose a friend…</option>
                    {g.invitable_friends.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.display_name}
                      </option>
                    ))}
                  </select>
                  <button className={primaryBtn} disabled={busy || !inviteId} type="submit">
                    Invite
                  </button>
                </form>
              )}
            </div>
          </section>

          <section className="panel">
            <p className="panel-title">Activity</p>
            <p className="panel-subtitle">Everything the group has done</p>
            <ol className="mt-4 space-y-3.5">
              {g.activity.length === 0 && <li className="text-xs text-[#8a9893]">Nothing yet.</li>}
              {g.activity.map((a, i) => (
                <li className="flex gap-3" key={i}>
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.kind === "contribution" ? "bg-[#2f8a6f]" : a.kind === "commit" ? "bg-[#9a6bff]" : a.kind === "leave" || a.kind === "decline" ? "bg-[#ef8a5f]" : "bg-[#c3cfca]"}`} />
                  <div>
                    <p className="text-xs leading-5">{a.message}</p>
                    <p className="text-[10px] text-[#8a9893]">{when(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="text-center">
            {confirmLeave ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-[#697975]">{g.members.length === 1 ? "You're the last member. Leaving deletes the group." : "Leave this group?"}</span>
                <button className={secondaryBtn} onClick={() => setConfirmLeave(false)}>
                  Stay
                </button>
                <button
                  className="rounded-lg bg-[#b4502f] px-3.5 py-2 text-[11px] font-bold text-white"
                  disabled={busy}
                  onClick={async () => {
                    if (await run(() => api("POST", `/api/groups/${g.id}/leave`), `You left ${g.name}.`)) onBack();
                  }}
                >
                  Leave
                </button>
              </div>
            ) : (
              <button className={quietBtn} onClick={() => setConfirmLeave(true)}>
                Leave group
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button className="mb-4 text-xs font-bold text-[#41675c] hover:underline" onClick={onBack}>
      ← All groups
    </button>
  );
}

function NewGoalForm({ busy, onCreate, onCancel }: { busy: boolean; onCreate: (b: { title: string; target_amount: number; deadline: string }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return (
    <section className="panel">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ title: title.trim(), target_amount: Number(target), deadline });
        }}
      >
        <p className="panel-title">New shared goal</p>
        <p className="panel-subtitle">Everyone in the group can commit a share once it's created.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <label className="block">
            <span className={fieldLabel}>What are you saving for?</span>
            <input autoFocus className={input} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Miami spring break" required value={title} />
          </label>
          <label className="block">
            <span className={fieldLabel}>Target ($)</span>
            <input className={input} inputMode="decimal" min="1" onChange={(e) => setTarget(e.target.value)} placeholder="3000" required step="0.01" type="number" value={target} />
          </label>
          <label className="block">
            <span className={fieldLabel}>Deadline</span>
            <input className={input} min={tomorrow} onChange={(e) => setDeadline(e.target.value)} required type="date" value={deadline} />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button className={primaryBtn} disabled={busy} type="submit">
            Create goal
          </button>
          <button className={secondaryBtn} onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function GoalCard({
  goal,
  meId,
  canDelete,
  contributions,
  busy,
  run,
}: {
  goal: Goal;
  meId: number;
  canDelete: boolean;
  contributions: GroupDetail["my_contributions"];
  busy: boolean;
  run: (fn: () => Promise<unknown>, success: string) => Promise<boolean>;
}) {
  const [share, setShare] = useState(String(goal.my_share ?? goal.suggested_share));
  const [editingShare, setEditingShare] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const committed = goal.my_share !== null;
  const expectedPct = goal.target ? (100 * goal.expected_by_now) / goal.target : 0;
  const memberCount = goal.members.length;
  const committedCount = memberCount - goal.uncommitted_count;
  const tone = goal.status === "behind" ? "orange" : goal.status === "complete" ? "purple" : "green";

  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold tracking-[-0.025em]">{goal.title}</p>
            <Pill status={goal.status} />
          </div>
          <p className="mt-0.5 text-[11px] text-[#8a9893]">
            Due {longDate(goal.deadline)} · {goal.days_left >= 0 ? `${goal.days_left} days left` : `${-goal.days_left} days ago`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-bold tracking-[-0.04em]">{money(goal.total_saved)}</p>
          <p className="text-[11px] text-[#8a9893]">of {money(goal.target)} · {goal.percent}%</p>
        </div>
      </div>

      <div className="mt-4">
        <Bar expectedPercent={expectedPct} percent={goal.percent} tone={tone} />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-[#8a9893]">
          <span>The tick marks where the group should be by now: {money(goal.expected_by_now)}</span>
          <span>
            {committedCount} of {memberCount} committed · {money(goal.committed_total)} pledged
          </span>
        </div>
        {goal.committed_total < goal.target && committedCount === memberCount && (
          <p className="mt-2 rounded-lg bg-[#fff7e6] px-3 py-2 text-[11px] font-semibold text-[#8a5a12]">
            Everyone's committed, but shares add up to {money(goal.target - goal.committed_total)} less than the goal. Someone may want to raise their share.
          </p>
        )}
      </div>

      {/* Per-member accountability */}
      <div className="mt-5 space-y-3 border-t border-[#edf0ef] pt-4">
        {goal.members.map((m) => (
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[180px_1fr_auto]" key={m.person.id}>
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar person={m.person} size="size-8" />
              <span className="truncate text-xs font-bold">
                {m.person.display_name.split(" ")[0]}
                {m.person.id === meId && <span className="font-normal text-[#8a9893]"> (you)</span>}
              </span>
            </div>
            <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
              {m.share !== null ? (
                <>
                  <Bar
                    expectedPercent={(100 * m.expected_by_now) / m.share}
                    percent={m.percent}
                    tone={m.status === "behind" ? "orange" : m.status === "complete" ? "purple" : "green"}
                  />
                  <p className="mt-1 text-[10px] text-[#8a9893]">
                    {money(m.saved)} of {money(m.share)} · should be at {money(m.expected_by_now)}
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-[#8a9893]">Hasn't committed a share yet{m.saved > 0 ? ` (saved ${money(m.saved)})` : ""}</p>
              )}
            </div>
            <Pill status={m.status} />
          </div>
        ))}
        {goal.former_members_saved > 0 && (
          <p className="text-[10px] text-[#8a9893]">Includes {money(goal.former_members_saved)} saved by people who have left the group.</p>
        )}
      </div>

      {/* Your actions */}
      <div className="mt-5 rounded-2xl bg-[#f5f8f7] p-4">
        {!committed || editingShare ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                () => api("POST", `/api/goals/${goal.id}/commit`, { share_amount: Number(share) }),
                committed ? `Your share is now ${money(Number(share))}.` : `You're in! You committed ${money(Number(share))}.`,
              );
              if (ok) setEditingShare(false);
            }}
          >
            <div className="min-w-[160px] flex-1">
              <p className="text-xs font-bold">{committed ? "Change your share" : "Are you in?"}</p>
              <p className="text-[11px] text-[#697975]">
                {committed ? "Your progress will be measured against the new amount." : `Commit your share so the group knows you're in. An even split is ${money(goal.suggested_share)}.`}
              </p>
            </div>
            <label className="block w-36">
              <span className={fieldLabel}>Your share ($)</span>
              <input className={input} inputMode="decimal" min="0.01" onChange={(e) => setShare(e.target.value)} required step="0.01" type="number" value={share} />
            </label>
            <button className={primaryBtn} disabled={busy} type="submit">
              {committed ? "Save share" : "Commit"}
            </button>
            {committed && (
              <button className={secondaryBtn} onClick={() => setEditingShare(false)} type="button">
                Cancel
              </button>
            )}
          </form>
        ) : (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                () => api("POST", `/api/goals/${goal.id}/contributions`, { amount: Number(amount), note }),
                `Logged ${money(Number(amount))} toward ${goal.title}.`,
              );
              if (ok) {
                setAmount("");
                setNote("");
              }
            }}
          >
            <div className="min-w-[160px] flex-1">
              <p className="text-xs font-bold">Log what you've saved</p>
              <p className="text-[11px] text-[#697975]">
                Your share: {money(goal.my_share!)} ·{" "}
                <button className="font-bold text-[#41675c] hover:underline" onClick={() => setEditingShare(true)} type="button">
                  change
                </button>
              </p>
            </div>
            <label className="block w-28">
              <span className={fieldLabel}>Amount ($)</span>
              <input className={input} inputMode="decimal" min="0.01" onChange={(e) => setAmount(e.target.value)} placeholder="50" required step="0.01" type="number" value={amount} />
            </label>
            <label className="block w-44">
              <span className={fieldLabel}>Note (optional)</span>
              <input className={input} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Skipped takeout" value={note} />
            </label>
            <button className={primaryBtn} disabled={busy} type="submit">
              Log savings
            </button>
          </form>
        )}

        {contributions.length > 0 && (
          <div className="mt-4 border-t border-[#e3e9e6] pt-3">
            <p className={fieldLabel}>Your recent entries</p>
            {contributions.slice(0, 4).map((c) => (
              <div className="flex items-center justify-between py-1 text-[11px]" key={c.id}>
                <span>
                  <strong>{money(c.amount)}</strong> <span className="text-[#8a9893]">{c.note && `· ${c.note} `}· {when(c.created_at)}</span>
                </span>
                <button className={quietBtn} disabled={busy} onClick={() => run(() => api("DELETE", `/api/contributions/${c.id}`), `Removed the ${money(c.amount)} entry.`)}>
                  Undo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {canDelete && (
        <div className="mt-3 text-right">
          {confirmDelete ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-[11px] text-[#697975]">Delete this goal and all its entries?</span>
              <button className={secondaryBtn} onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
              <button className="rounded-lg bg-[#b4502f] px-3 py-2 text-[11px] font-bold text-white" disabled={busy} onClick={() => run(() => api("DELETE", `/api/goals/${goal.id}`), `Deleted ${goal.title}.`)}>
                Delete
              </button>
            </span>
          ) : (
            <button className={quietBtn} onClick={() => setConfirmDelete(true)}>
              Delete goal
            </button>
          )}
        </div>
      )}
    </section>
  );
}
