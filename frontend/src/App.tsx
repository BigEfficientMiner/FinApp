import { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler, type Me } from "./api";
import Auth from "./Auth";
import Friends, { initials as initialsOf } from "./Friends";
import Groups from "./Groups";
import AccountsPage, { LinkBankForm } from "./LinkBank";

type Customer = { id: string; first_name: string; last_name: string };
type CategoryTotal = { name: string; amount: number; count: number; percent: number };
type Purchase = { id: string; date: string; amount: number; merchant: string; category: string; description: string };
type Dashboard = {
  customer: Customer;
  period: { key: string; start: string; end: string };
  total: number;
  previous_total: number;
  change_percent: number | null;
  purchase_count: number;
  top_category: CategoryTotal | null;
  categories: CategoryTotal[];
  daily: { unit: "day" | "week"; points: { date: string; amount: number }[] };
  transactions: Purchase[];
};

const PERIODS = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_3_months", label: "Last 3 months" },
];


type IconName =
  | "bell"
  | "card"
  | "chevron"
  | "close"
  | "gift"
  | "grid"
  | "help"
  | "home"
  | "insights"
  | "search"
  | "settings"
  | "sparkles"
  | "tag"
  | "trend"
  | "users"
  | "flag"
  | "wallet";

const iconPaths: Record<IconName, React.ReactNode> = {
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h2" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  gift: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 2.2-3.7L12 8Zm0 0h4.5a2.5 2.5 0 1 0-2.2-3.7L12 8Z" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.4 1-1.4 2.3M12 17h.01" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  insights: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
      <path d="M2 19h22" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3-1.2 3.3A3.8 3.8 0 0 1 8.5 8.6L5 10l3.5 1.4a3.8 3.8 0 0 1 2.3 2.3L12 17l1.2-3.3a3.8 3.8 0 0 1 2.3-2.3L19 10l-3.5-1.4a3.8 3.8 0 0 1-2.3-2.3L12 3Z" />
      <path d="m5 17-.5 1.3a2.2 2.2 0 0 1-1.3 1.3L2 20l1.2.4a2.2 2.2 0 0 1 1.3 1.3L5 23l.5-1.3a2.2 2.2 0 0 1 1.3-1.3L8 20l-1.2-.4a2.2 2.2 0 0 1-1.3-1.3L5 17Z" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.6 11 23.2 1.8 14V4.8H11l9.6 9.6a1.3 1.3 0 0 1 0 1.8Z" />
      <circle cx="7" cy="10" r="1.4" />
    </>
  ),
  trend: <path d="m3 17 6-6 4 4 8-9M15 6h6v6" />,
  wallet: (
    <>
      <path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12v3" />
      <path d="M15 11h7v5h-7a2.5 2.5 0 0 1 0-5Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name]}
    </svg>
  );
}

// Look of each category (the data itself now comes from the backend).
const categoryStyles: Record<string, { color: string; icon: string; badge: string }> = {
  Dining: { color: "#9a6bff", icon: "✦", badge: "bg-[#f2e9ff] text-[#7749c4]" },
  Groceries: { color: "#2ec7a6", icon: "⌂", badge: "bg-[#e3f7f0] text-[#16866e]" },
  Shopping: { color: "#ff9b6a", icon: "◇", badge: "bg-[#fff2df] text-[#ae7020]" },
  Transport: { color: "#ffcc57", icon: "↗", badge: "bg-[#fff0e9] text-[#d85f36]" },
  Other: { color: "#a9b6c8", icon: "••", badge: "bg-[#eef1f4] text-[#5b6b80]" },
};
const styleFor = (category: string) => categoryStyles[category] ?? categoryStyles.Other;

// Bank partner offer shown for the customer's top spending category.
const offers: Record<string, { title: string; body: string }> = {
  Dining: { title: "Enjoy 15% back at Juniper & Stone", body: "You dine out often, so we found something you’ll love. Earn up to $18 back on your next meal when you pay with your Northstar card." },
  Groceries: { title: "Get 10% back at Greenleaf Grocer", body: "Groceries are one of your biggest categories. Earn up to $15 back on your next grocery run with your Northstar card." },
  Shopping: { title: "Take 20% off at North & Loom", body: "You shop a lot, so here’s a deal on your next order. Save up to $25 when you pay with your Northstar card." },
  Transport: { title: "Save $5 on your next 5 CityRide trips", body: "You ride often, so we partnered with CityRide. The discount applies automatically when you pay with your Northstar card." },
  Other: { title: "Earn 5% back at Campus Books", body: "Earn up to $10 back on your next purchase when you pay with your Northstar card." },
};

const money = (n: number, cents = true) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

function donutGradient(categories: CategoryTotal[], total: number) {
  if (!total) return "conic-gradient(#e6ecea 0deg 360deg)";
  let angle = 0;
  const stops = categories.map((c) => {
    const start = angle;
    angle += (c.amount / total) * 360;
    return `${styleFor(c.name).color} ${start}deg ${angle}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

// ---------- Login gate ----------
// Shows the login screen until there's a valid session, then the app.
function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [startupError, setStartupError] = useState("");

  const loadMe = useCallback(() => {
    if (!getToken()) {
      setMe(null);
      setChecking(false);
      return;
    }
    api<Me>("GET", "/api/me")
      .then((m) => {
        setMe(m);
        setStartupError("");
      })
      .catch((e) => {
        setMe(null);
        if (e.status === 0) setStartupError(e.message);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    loadMe();
  }, [loadMe]);

  async function logout() {
    await api("POST", "/api/auth/logout").catch(() => {});
    setToken(null);
    setMe(null);
  }

  if (checking) return <div className="min-h-screen bg-[#f5f7f8]" />;
  if (!me)
    return (
      <>
        {startupError && (
          <p className="fixed inset-x-0 top-0 z-50 bg-[#fff4f0] px-4 py-2 text-center text-xs font-semibold text-[#9a3b22]" role="alert">
            {startupError}
          </p>
        )}
        <Auth onLoggedIn={loadMe} />
      </>
    );
  return <Shell me={me} onLogout={logout} onMeChanged={loadMe} />;
}

// ---------- The app once logged in ----------
function Shell({ me, onLogout, onMeChanged }: { me: Me; onLogout: () => void; onMeChanged: () => void }) {
  const [period, setPeriod] = useState("this_month");
  const [activeNav, setActiveNav] = useState("Overview");
  const [offerVisible, setOfferVisible] = useState(true);
  const [offerClaimed, setOfferClaimed] = useState(false);

  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const linked = me.bank_link !== null;

  // Load your dashboard (from your linked bank) whenever the period or bank link changes.
  useEffect(() => {
    if (!linked) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    api<Dashboard>("GET", `/api/me/dashboard?period=${period}`)
      .then((d) => {
        setData(d);
        setOfferVisible(true);
        setOfferClaimed(false);
      })
      .catch((e) => setError(`Couldn't load your spending data (${e.message})`))
      .finally(() => setLoading(false));
  }, [period, linked, me.bank_link?.nessie_customer_id]);

  const firstName = me.display_name.split(" ")[0] || "there";
  const initials = initialsOf(me.display_name) || "··";
  const total = data?.total ?? 0;
  const categories = data?.categories ?? [];
  const transactions = data?.transactions ?? [];
  const top = data?.top_category ?? null;
  const offer = top ? offers[top.name] ?? offers.Other : null;
  const points = data?.daily.points ?? [];
  const peak = points.reduce((best, p, i) => (p.amount > (points[best]?.amount ?? 0) ? i : best), 0);
  const chartMax = Math.max(40, Math.ceil((points[peak]?.amount ?? 0) / 40) * 40);
  const periodLabel = PERIODS.find((p) => p.key === period)?.label.toLowerCase() ?? "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const change = data?.change_percent ?? null;
  const labelIndexes = points.length ? [...new Set([0, 1, 2, 3, 4].map((k) => Math.round((k * (points.length - 1)) / 4)))] : [];

  return (
    <div className="min-h-screen bg-[#f5f7f8] text-[#14211d]">
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#dde4e1] bg-white px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-[12px] bg-[#173f35] text-white">
            <svg aria-hidden="true" height="21" viewBox="0 0 24 24" width="21">
              <path d="M4 18V9l8-5 8 5v9l-8-4.6L4 18Z" fill="currentColor" />
            </svg>
          </div>
          <span className="text-[19px] font-bold tracking-[-0.04em]">Northstar</span>
          <span className="hidden rounded-full bg-[#eef3f1] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#587068] sm:block">
            Banking
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button aria-label="Search" className="icon-button">
            <Icon name="search" />
          </button>
          <button aria-label="Notifications" className="icon-button relative">
            <Icon name="bell" />
            <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#ef6b4a]" />
          </button>
          <div className="mx-1 hidden h-7 w-px bg-[#e3e8e6] sm:block" />
          <div className="flex items-center gap-2 rounded-full p-1 pr-2">
            <span className="grid size-9 place-items-center rounded-full bg-[#d9eadf] text-sm font-bold text-[#235749]">{initials}</span>
            <span className="hidden text-sm font-semibold sm:block">{me.display_name}</span>
          </div>
          <button className="rounded-lg border border-[#d8e0dd] px-3 py-2 text-[11px] font-bold text-[#31433e] transition hover:bg-[#f3f6f5]" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="fixed bottom-0 left-0 right-0 z-20 flex h-16 items-center justify-around border-t border-[#dde4e1] bg-white px-2 lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:w-[232px] lg:flex-col lg:items-stretch lg:justify-between lg:border-r lg:border-t-0 lg:p-4">
          <nav className="flex w-full justify-around lg:flex-col lg:gap-1" aria-label="Main navigation">
            {[
              ["Overview", "grid"],
              ["Transactions", "card"],
              ["Insights", "insights"],
              ["Friends", "users"],
              ["Groups", "flag"],
              ["Rewards", "gift"],
              ["Accounts", "wallet"],
            ].map(([label, icon]) => (
              <button
                className={`nav-item ${activeNav === label ? "nav-item-active" : ""}`}
                key={label}
                onClick={() => setActiveNav(label)}
              >
                <Icon name={icon as IconName} size={19} />
                <span>{label}</span>
                {label === "Rewards" && <span className="ml-auto hidden rounded-full bg-[#daf2e8] px-2 py-0.5 text-[10px] font-bold text-[#146d57] lg:block">3</span>}
              </button>
            ))}
          </nav>
          <div className="hidden lg:block">
            <div className="mb-4 rounded-2xl bg-[#edf3f1] p-4">
              <div className="mb-3 grid size-8 place-items-center rounded-lg bg-white text-[#235749] shadow-sm">
                <Icon name="help" size={17} />
              </div>
              <p className="text-xs font-bold">Need a hand?</p>
              <p className="mt-1 text-[11px] leading-4 text-[#6a7c76]">Our support team is here around the clock.</p>
              <button className="mt-3 text-[11px] font-bold text-[#235749]">Get support →</button>
            </div>
            <button className="nav-item w-full">
              <Icon name="settings" size={19} />
              Settings
            </button>
          </div>
        </aside>

        <main className="w-full min-w-0 px-5 pb-24 pt-7 sm:px-7 lg:px-10 lg:pb-10 lg:pt-10">
          {activeNav === "Friends" ? (
            <Friends />
          ) : activeNav === "Groups" ? (
            <Groups meId={me.id} />
          ) : activeNav === "Accounts" ? (
            <AccountsPage displayName={me.display_name} linked={linked} onChange={onMeChanged} />
          ) : !linked ? (
            <>
              <div className="mb-7">
                <h1 className="text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">Welcome, {firstName}</h1>
                <p className="mt-1 text-sm text-[#697975]">One more step: link your bank to see your spending. You can add friends right away.</p>
              </div>
              <LinkBankForm displayName={me.display_name} onLinked={onMeChanged} />
            </>
          ) : (
          <>
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#71817c]">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-[28px] font-bold tracking-[-0.045em] sm:text-[34px]">{greeting}, {firstName}</h1>
              <p className="mt-1 text-sm text-[#697975]">Here’s where your money went—and where it can take you.</p>
            </div>
            <label className="relative">
              <span className="sr-only">Select reporting period</span>
              <select
                className="appearance-none rounded-xl border border-[#d8e0dd] bg-white py-2.5 pl-4 pr-10 text-xs font-bold text-[#31433e] shadow-sm outline-none focus:border-[#357866]"
                onChange={(event) => setPeriod(event.target.value)}
                value={period}
              >
                {PERIODS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-2.5 rotate-90 text-[#657771]">
                <Icon name="chevron" size={16} />
              </span>
            </label>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-[#f3c9bd] bg-[#fff4f0] px-4 py-3 text-xs font-semibold text-[#9a3b22]" role="alert">
              {error}
            </div>
          )}

          <section className={`mb-5 grid gap-4 md:grid-cols-3 transition-opacity ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
            <article className="metric-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">Total spending</p>
                  <p className="metric-number">{money(total)}</p>
                </div>
                <span className="metric-icon bg-[#e7f1ed] text-[#276858]"><Icon name="wallet" size={18} /></span>
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs">
                {change === null ? (
                  <span className="text-[#798883]">No spending in the previous period to compare</span>
                ) : (
                  <>
                    <span className={`rounded-full px-2 py-1 font-bold ${change <= 0 ? "bg-[#e5f5ed] text-[#167454]" : "bg-[#fff0e9] text-[#b4502f]"}`}>
                      {change <= 0 ? "↓" : "↑"} {Math.abs(change)}%
                    </span>
                    <span className="text-[#798883]">vs. previous period</span>
                  </>
                )}
              </div>
            </article>
            <article className="metric-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">Top category</p>
                  <p className="metric-number">{top?.name ?? "—"}</p>
                </div>
                <span className="metric-icon bg-[#f0eaff] text-[#784ccb]"><Icon name="sparkles" size={18} /></span>
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs">
                {top ? (
                  <>
                    <span className="font-bold text-[#523582]">{money(top.amount)}</span>
                    <span className="text-[#798883]">across {top.count} {top.count === 1 ? "purchase" : "purchases"}</span>
                  </>
                ) : (
                  <span className="text-[#798883]">No purchases in this period</span>
                )}
              </div>
            </article>
            <article className="metric-card overflow-hidden !bg-[#173f35] text-white">
              <div className="absolute -right-8 -top-10 size-32 rounded-full border-[18px] border-white/5" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="eyebrow !text-[#a9c5bc]">Rewards earned</p>
                  <p className="metric-number">$48.20</p>
                </div>
                <span className="metric-icon bg-white/10 text-[#dbf4e9]"><Icon name="gift" size={18} /></span>
              </div>
              <div className="relative mt-5 flex items-center gap-2 text-xs text-[#bad0c8]">
                <span className="font-bold text-[#d7f68e]">+$12.40</span>
                <span>from partner offers</span>
              </div>
            </article>
          </section>

          <section className="mb-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-title">Spending overview</p>
                  <p className="panel-subtitle">Your {data?.daily.unit === "week" ? "weekly" : "daily"} purchase activity, {periodLabel}</p>
                </div>
                <button className="text-xs font-bold text-[#41675c]">View report</button>
              </div>
              <div className="mt-7 flex gap-4">
                <div className="flex h-[200px] flex-col justify-between pb-6 text-[10px] text-[#94a09c]">
                  {[4, 3, 2, 1, 0].map((k) => (
                    <span key={k}>{money((chartMax * k) / 4, false)}</span>
                  ))}
                </div>
                <div className="chart-grid relative flex h-[200px] flex-1 items-end justify-between gap-1 px-1 pb-6 sm:gap-1.5">
                  {points.map((point, index) => (
                    <div className="group relative flex h-full flex-1 items-end" key={point.date} title={`${shortDate(point.date)}: ${money(point.amount)}`}>
                      <div
                        className={`w-full min-w-[3px] rounded-t-[4px] transition-all group-hover:opacity-75 ${index === peak && point.amount > 0 ? "bg-[#9a6bff]" : "bg-[#cfe2dc]"}`}
                        style={{ height: `${(point.amount / chartMax) * 100}%` }}
                      />
                      {index === peak && point.amount > 0 && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#293a35] px-1.5 py-1 text-[9px] font-bold text-white">{money(point.amount, false)}</span>
                      )}
                    </div>
                  ))}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-[#94a09c]">
                    {labelIndexes.map((i) => (
                      <span key={i}>{shortDate(points[i].date)}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#f4f0ff] p-3.5">
                <span className="mt-0.5 text-[#7650bd]"><Icon name="sparkles" size={17} /></span>
                <p className="text-xs leading-5 text-[#5e5472]">
                  <strong className="text-[#30283f]">Smart insight:</strong>{" "}
                  {points[peak]?.amount
                    ? `Your biggest spending ${data?.daily.unit === "week" ? "week started" : "day was"} ${longDate(points[peak].date)}, at ${money(points[peak].amount)}. You made ${data?.purchase_count} purchases ${periodLabel}.`
                    : `No purchases ${periodLabel} yet.`}
                </p>
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-title">Where your money goes</p>
                  <p className="panel-subtitle">Spending by category</p>
                </div>
                <button aria-label="More category options" className="text-lg font-bold text-[#80908a]">•••</button>
              </div>
              <div className="mt-6 flex flex-col items-center gap-7 sm:flex-row xl:flex-col 2xl:flex-row">
                <div className="donut-chart grid size-40 shrink-0 place-items-center rounded-full" style={{ background: donutGradient(categories, total) }}>
                  <div className="grid size-[104px] place-items-center rounded-full bg-white text-center shadow-[0_0_0_1px_#eef1f0]">
                    <div>
                      <p className="text-[10px] font-semibold text-[#8a9893]">Total</p>
                      <p className="text-lg font-bold tracking-[-0.04em]">{money(total, false)}</p>
                    </div>
                  </div>
                </div>
                <div className="w-full space-y-3.5">
                  {categories.length === 0 && <p className="text-xs text-[#8a9893]">No purchases in this period.</p>}
                  {categories.map((category) => {
                    const style = styleFor(category.name);
                    return (
                      <div className="flex items-center gap-3" key={category.name}>
                        <span className="grid size-7 place-items-center rounded-lg text-xs font-bold" style={{ backgroundColor: `${style.color}1f`, color: style.color }}>
                          {style.icon}
                        </span>
                        <span className="flex-1 text-xs font-semibold">{category.name}</span>
                        <span className="text-xs font-bold">{money(category.amount, false)}</span>
                        <span className="w-8 text-right text-[10px] text-[#8a9893]">{category.percent}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          </section>

          {offerVisible && offer && (
            <section className="relative mb-5 overflow-hidden rounded-[20px] bg-[#f0e8ff] p-5 sm:p-6">
              <div className="absolute -bottom-20 -right-8 size-56 rounded-full border-[32px] border-[#9a6bff]/10" />
              <button aria-label="Dismiss offer" className="absolute right-4 top-4 z-10 text-[#7c6b91] transition hover:text-[#382f43]" onClick={() => setOfferVisible(false)}>
                <Icon name="close" size={18} />
              </button>
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#7342bf] text-white shadow-lg shadow-[#7342bf]/20">
                  <Icon name="tag" size={25} />
                </div>
                <div className="flex-1 pr-5">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#6c499e]">Picked for your top category</span>
                    <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-bold text-[#6d548c]">Bank partner offer</span>
                  </div>
                  <h2 className="text-lg font-bold tracking-[-0.025em] text-[#32243f]">{offer.title}</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-[#766681]">{offer.body}</p>
                </div>
                <button
                  className={`shrink-0 rounded-xl px-5 py-3 text-xs font-bold shadow-sm transition ${offerClaimed ? "bg-white text-[#5c3a87]" : "bg-[#3f265e] text-white hover:bg-[#2f1c47]"}`}
                  onClick={() => setOfferClaimed(true)}
                >
                  {offerClaimed ? "Offer activated" : "Activate offer"}
                </button>
              </div>
            </section>
          )}

          <section className="panel !p-0">
            <div className="panel-heading px-5 py-5 sm:px-6">
              <div>
                <p className="panel-title">Recent purchases</p>
                <p className="panel-subtitle">Your latest card activity</p>
              </div>
              <button className="flex items-center gap-1 text-xs font-bold text-[#41675c]">View all <Icon name="chevron" size={14} /></button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[580px]">
                {transactions.length === 0 && (
                  <p className="border-t border-[#edf0ef] px-5 py-6 text-xs text-[#8a9893] sm:px-6">No purchases in this period.</p>
                )}
                {transactions.map((transaction) => (
                  <button className="grid w-full grid-cols-[1.8fr_1fr_0.8fr_0.7fr] items-center gap-4 border-t border-[#edf0ef] px-5 py-3.5 text-left transition hover:bg-[#fafcfb] sm:px-6" key={transaction.id}>
                    <span className="flex items-center gap-3">
                      <span className={`grid size-9 place-items-center rounded-xl text-xs font-extrabold ${styleFor(transaction.category).badge}`}>{transaction.merchant[0]}</span>
                      <span>
                        <span className="block text-xs font-bold">{transaction.merchant}</span>
                        {transaction.description && <span className="block text-[10px] text-[#8a9893]">{transaction.description}</span>}
                      </span>
                    </span>
                    <span className="text-xs text-[#6f7e79]">{transaction.category}</span>
                    <span className="text-xs text-[#6f7e79]">{shortDate(transaction.date)}</span>
                    <span className="text-right text-xs font-bold">{money(transaction.amount)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <p className="mt-5 text-center text-[10px] leading-4 text-[#8c9995]">
            Partner offers may earn Northstar a referral commission. Your transaction data is never shared with merchants.
          </p>
          </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
