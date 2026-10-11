"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Clock,
  GitBranch,
  GitPullRequest,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Play,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
  Terminal,
  X,
} from "lucide-react";
import {
  api,
  readApi,
  cachedValue,
  ApiError,
  setCsrf,
  type Me,
  type Repo,
  type Analysis,
  type Finding,
  type Detail,
  type TestResult,
} from "@/lib/api";
import { Logo } from "./logo";
import { ProviderSettings, FindingTest } from "./provider-settings";
import { RepositoryExplorer } from "./repository-explorer";
import { AccountSettings } from "./account-settings";
import { CommandMenu } from "./command-menu";
import { UsagePage } from "./usage";
import { WorkspaceAtlas } from "./workspace-atlas";

function useData<T>(path: string) {
  const [data, setData] = useState<T | undefined>(() => cachedValue<T>(path));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => cachedValue(path) === undefined);
  const reload = useCallback(
    async (refresh = true) => {
      setError("");
      try {
        setData(await readApi<T>(path, refresh));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [path],
  );
  useEffect(() => {
    const cached = cachedValue<T>(path);
    setLoading(cached === undefined);
    setData(cached);
    void reload(false);
  }, [reload, path]);
  return { data, error, loading, reload: () => reload(true) };
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={"badge " + value}>
      {value === "suspected" ? "hypothesis" : value.replaceAll("-", " ")}
    </span>
  );
}
export function Empty({
  title,
  text,
  href,
  label,
  icon: Icon = GitBranch,
}: {
  title: string;
  text: string;
  href?: string;
  label?: string;
  icon?: typeof GitBranch;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={21} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {href && (
        <Link href={href} className="button small">
          {label} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <div className="notice error" role="alert">
      {error}
    </div>
  ) : null;
}
function DateLabel({ value }: { value: number }) {
  return (
    <span>
      {new Date(value * 1000).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  );
}
function PageTitle({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
const navigation = [
  { href: "/app", title: "Overview", icon: LayoutDashboard },
  { href: "/app/repositories", title: "Repositories", icon: GitBranch },
  { href: "/app/interactions", title: "Interaction explorer", icon: Network },
  { href: "/app/analyses", title: "Analysis history", icon: Activity },
  { href: "/app/findings", title: "Findings", icon: ShieldCheck },
  { href: "/app/tests", title: "Test results", icon: Terminal },
  { href: "/app/usage", title: "Usage & limits", icon: Activity },
];
export function Workspace() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(() => cachedValue<Me>("/me"));
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [light, setLight] = useState(false);
  const [slow, setSlow] = useState(false);
  const connect = useCallback(() => {
    setError("");
    void readApi<Me>("/me", true)
      .then((m) => {
        setCsrf(m.csrf);
        setMe(m);
        setLight(m.preferences?.theme === "light");
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else
          setError(e.message || "Could not reach your workspace. Try again.");
      });
  }, [router]);
  useEffect(() => {
    connect();
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [connect]);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  const segments = path.slice(5).split("/").filter(Boolean);
  const section = segments[0] || "overview";
  const selected = navigation.find(
    (n) => n.href === path || (n.href !== "/app" && path.startsWith(n.href)),
  );
  async function logout() {
    try {
      await api("/auth/logout", "POST");
      setCsrf("");
      router.replace("/login");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function toggleTheme() {
    try {
      await api("/settings/preferences", "PATCH", {
        theme: light ? "dark" : "light",
      });
      setLight(!light);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className={"app-shell" + (light ? " light" : "")}>
      <aside
        id="workspace-navigation"
        className={"sidebar" + (open ? " open" : "")}
      >
        <Link href="/" className="sidebar-logo" aria-label="Intervexa home">
          <Logo compact light={light} />
        </Link>
        <div className="workspace-switch">
          <span className="workspace-icon">
            {me?.organization.name[0].toUpperCase() || "I"}
          </span>
          <div>
            <strong>{me?.organization.name || "Your workspace"}</strong>
            <small>Repository intelligence</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navigation.map(({ href, title, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={selected?.href === href ? "active" : ""}
            >
              <Icon size={16} />
              {title}
            </Link>
          ))}
        </nav>
        <div className="nav-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          <Link
            href="/app/settings/providers"
            className={section === "settings" ? "active" : ""}
          >
            <Settings size={16} />
            Settings
          </Link>
          <Link href="/architecture">
            <BookOpen size={16} />
            Architecture & coverage
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="status-dot" />
            Advisory analysis
            <br />
            Evidence before enforcement.
          </div>
          <div className="user-row">
            <span className="avatar">
              {me?.user.name.slice(0, 2).toUpperCase() || "—"}
            </span>
            <div>
              {me?.user.name || "Connecting securely"}
              <p>Workspace owner</p>
            </div>
            <button aria-label="Sign out" onClick={logout} disabled={!me}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu"
              aria-expanded={open}
              aria-controls="workspace-navigation"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={16} /> : <Menu size={16} />}
            </button>
            <span>Workspace</span>
            <ChevronRight size={12} />
            <span className="crumb">{selected?.title || "Settings"}</span>
          </div>
          <div>
            <span className="eyebrow">
              <span className="status-dot" /> ADVISORY MODE
            </span>
            <CommandMenu />
            <button
              aria-label="Toggle light theme"
              onClick={toggleTheme}
              disabled={!me}
            >
              <Sun size={15} />
            </button>
            <Link href="/app/settings/security" aria-label="Security settings">
              <ShieldCheck size={16} />
            </Link>
          </div>
        </header>
        <main className="app-content">
          <ErrorNotice error={error} />
          {!me ? (
            <section
              className="workspace-boot"
              aria-label="Workspace connection"
            >
              <div className="boot-copy">
                <div className="eyebrow">INTERVEXA / CODE INTELLIGENCE</div>
                <h1>
                  Your code.
                  <br />
                  <span>In perspective.</span>
                </h1>
                <p>
                  Explore your architecture, trace changes and inspect the
                  evidence in one workspace.
                </p>
                <div className="connection-state" role="status">
                  <span className="status-dot" />
                  {error
                    ? "Connection interrupted"
                    : slow
                      ? "The free server is waking up. Your workspace will appear here."
                      : "Connecting to your secure workspace"}
                </div>
                {(error || slow) && (
                  <button className="button secondary" onClick={connect}>
                    <RefreshCw size={14} />
                    Retry connection
                  </button>
                )}
                <Link href="/docs" className="text-link">
                  Explore the guide <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="boot-model" aria-hidden="true">
                <div className="model-grid" />
                <div className="code-cube">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <i className="model-orbit orbit-a" />
                <i className="model-orbit orbit-b" />
                <div className="model-caption">
                  SOURCE → STRUCTURE → EVIDENCE
                </div>
              </div>
            </section>
          ) : section === "overview" ? (
            <Dashboard me={me} />
          ) : section === "repositories" ? (
            segments[1] ? (
              segments[2] === "explore" ? (
                <RepositoryExplorer key={segments[1]} id={segments[1]} />
              ) : (
                <RepositoryDetail id={segments[1]} />
              )
            ) : (
              <Repositories me={me} />
            )
          ) : section === "analyses" ? (
            segments[1] ? (
              <AnalysisDetail id={segments[1]} />
            ) : (
              <AnalysisHistory />
            )
          ) : section === "findings" ? (
            segments[1] ? (
              <FindingDetail id={segments[1]} me={me} />
            ) : (
              <Findings />
            )
          ) : section === "interactions" ? (
            <Interactions />
          ) : section === "usage" ? (
            <UsagePage />
          ) : section === "tests" ? (
            <Tests />
          ) : section === "settings" ? (
            <SettingsPage tab={segments[1] || "providers"} me={me} />
          ) : (
            <Empty
              title="Page not found"
              text="Choose a workspace section to continue."
              href="/app"
              label="Open overview"
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Dashboard({ me }: { me: Me }) {
  const repos = useData<Repo[]>("/repositories");
  const analyses = useData<Analysis[]>("/analyses");
  const findings = useData<Finding[]>("/findings");
  const runs = analyses.data || [];
  const risks = findings.data || [];
  if (!repos.loading && repos.data?.length === 0)
    return (
      <>
        <PageTitle
          title={`Your workspace, ${me.user.name.split(" ")[0]}`}
          description="Start with source. Follow dependencies. Verify how changes interact."
        />
        <ErrorNotice error={repos.error || analyses.error || findings.error} />
        <section className="setup-editorial">
          <div className="eyebrow">FIRST REPOSITORY / SETUP</div>
          <h2>Bring a codebase into focus.</h2>
          <p>
            Your personal workspace is ready. Connect an authorized GitHub
            repository to explore its source and analyze pending changes.
          </p>
          <Link className="button" href="/app/repositories">
            Connect GitHub <ArrowRight size={16} />
          </Link>
          <div className="setup-status">
            <span className="status-dot" />
            {me.github_configured
              ? "GitHub App configured · authorization required"
              : "GitHub App needs owner configuration"}
          </div>
        </section>
        <div className="workspace-getting-started">
          {[
            [
              "01",
              "Understand the repository",
              "Index a branch, search symbols and inspect Python import dependencies.",
              "/docs",
            ],
            [
              "02",
              "Choose pending changes",
              "Sync real pull requests and select two or more exact revisions.",
              "/pr-analysis",
            ],
            [
              "03",
              "Review the evidence",
              "Static analysis works without AI. Verification requires a separate supported runner.",
              "/supported",
            ],
          ].map(([n, title, text, href]) => (
            <Link key={n} href={href}>
              <code>{n}</code>
              <h3>{title}</h3>
              <p>{text}</p>
              <span>Read guide →</span>
            </Link>
          ))}
        </div>
        <div className="readiness-bar">
          <span>Personal account / ready</span>
          <Link href="/app/settings/providers">
            Optional AI / bring your key →
          </Link>
          <span>
            Isolated runner /{" "}
            {me.runner_configured ? "configured" : "unavailable"}
          </span>
          <Link href="/app/settings/account">Profile & account →</Link>
        </div>
      </>
    );
  return (
    <>
      <PageTitle
        title={`Welcome${me.user.name ? ", " + me.user.name.split(" ")[0] : ""}`}
        description="Your changes, their interactions, and the evidence that connects them."
      >
        <Link href="/app/repositories" className="button small">
          <Plus size={14} />
          Connect repository
        </Link>
      </PageTitle>
      <ErrorNotice error={repos.error || analyses.error || findings.error} />
      <WorkspaceAtlas repositories={repos.data} />
      <div className="stats-grid">
        {[
          {
            label: "Connected repositories",
            value: repos.data?.length || 0,
            note: "Authorized GitHub installations",
            icon: GitBranch,
          },
          {
            label: "Open pull requests",
            value: repos.data?.reduce((n, r) => n + r.pull_requests, 0) || 0,
            note: "Last synchronized revision",
            icon: GitPullRequest,
          },
          {
            label: "Analysis runs",
            value: runs.length,
            note: "Latest 30 runs",
            icon: Activity,
          },
          {
            label: "Reproduced findings",
            value: risks.filter(
              (f) => f.status === "reproduced" && f.analysis_state !== "stale",
            ).length,
            note: "Confirmed combined-state failures",
            icon: ShieldCheck,
          },
        ].map(({ label, value, note, icon: Icon }) => (
          <div className="stat" key={label}>
            <div className="stat-label">
              {label}
              <Icon size={14} />
            </div>
            <div className="stat-value">{repos.loading ? "—" : value}</div>
            <div className="stat-note">{note}</div>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-header">
            <h2>Recent analyses</h2>
            <Link href="/app/analyses">
              View history <ArrowUpRight size={11} />
            </Link>
          </div>
          {analyses.loading ? (
            <div className="panel-body">
              <div className="skeleton" />
            </div>
          ) : runs.length ? (
            runs.slice(0, 5).map((r) => <AnalysisRow key={r.id} run={r} />)
          ) : (
            <Empty
              title="Your first interaction starts here"
              text="Connect a repository, synchronize its open pull requests, and analyze the changes together."
              href="/app/repositories"
              label="Connect a repository"
              icon={Network}
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Workspace readiness</h2>
            <Badge value="early access" />
          </div>
          <div className="panel-body onboarding">
            {[
              {
                title: "Workspace created",
                text: "Your account and organization are ready.",
                href: "/app/settings/team",
                label: "View account",
                done: true,
              },
              {
                title: "Connect GitHub",
                text: me.github_configured
                  ? "Authorize your account and install the Intervexa GitHub App."
                  : "The workspace owner needs to configure a GitHub App on the backend.",
                href: "/app/repositories",
                label: "Repository setup",
                done: !!repos.data?.length,
              },
              {
                title: "Choose your AI provider",
                text: "Optional: bring a key for targeted test generation. Static analysis does not use inference.",
                href: "/app/settings/providers",
                label: "Provider settings",
                done: false,
              },
              {
                title: "Configure isolated execution",
                text: me.runner_configured
                  ? "A separate runner endpoint is configured. Verify a reviewed test from a finding."
                  : "Execution is unavailable until a separate Linux runner is configured.",
                href: "/architecture",
                label: "Runner requirements",
                done: me.runner_configured,
              },
            ].map((s, i) => (
              <div className="onboarding-step" key={s.title}>
                <span className="step-number">{s.done ? "✓" : i + 1}</span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                  <Link href={s.href}>{s.label} →</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel wide-panel">
        <div className="panel-header">
          <h2>Interaction findings</h2>
          <Link href="/app/findings">
            View findings <ArrowUpRight size={11} />
          </Link>
        </div>
        {risks.length ? (
          risks.slice(0, 3).map((f) => <FindingRow key={f.id} finding={f} />)
        ) : (
          <Empty
            title="No findings yet"
            text="Findings will appear after an analysis. An empty workspace does not imply that your integrations are safe."
            icon={ShieldCheck}
          />
        )}
      </section>
    </>
  );
}
function AnalysisRow({ run }: { run: Analysis }) {
  return (
    <Link href={"/app/analyses/" + run.id} className="row">
      <Activity size={16} color="#9b92bd" />
      <div className="row-main">
        <strong>{run.repository}</strong>
        <small>
          <DateLabel value={run.created_at} /> · {run.findings} findings ·{" "}
          {run.id.slice(0, 8)}
        </small>
      </div>
      <Badge value={run.state} />
      <ChevronRight size={14} color="#798297" />
    </Link>
  );
}
function FindingRow({ finding: f }: { finding: Finding }) {
  return (
    <Link href={"/app/findings/" + f.id} className="row">
      <Network size={16} color="#a499bf" />
      <div className="row-main">
        <strong>{f.title}</strong>
        <small>
          {f.repository} · {f.category} · Risk {f.risk}/100{" "}
          {f.analysis_state === "stale" ? "· STALE REVISIONS" : ""}
        </small>
      </div>
      <Badge value={f.status} />
      <ChevronRight size={14} color="#798297" />
    </Link>
  );
}
function Repositories({ me }: { me: Me }) {
  const { data, error, loading, reload } = useData<Repo[]>("/repositories");
  const [available, setAvailable] = useState<
    { full_name: string; installation_id: number; default_branch: string }[]
  >([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function discover() {
    setBusy(true);
    setMessage("");
    try {
      const list = await api<typeof available>("/github/available");
      setAvailable(list);
      if (!list.length)
        setMessage(
          "No authorized installations found. Install the GitHub App, then authorize your account again.",
        );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function add(r: (typeof available)[number]) {
    setBusy(true);
    try {
      await api("/repositories", "POST", {
        full_name: r.full_name,
        installation_id: r.installation_id,
      });
      await reload();
      setAvailable(available.filter((a) => a.full_name !== r.full_name));
      setMessage("Repository connected. Open it to synchronize pull requests.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Repositories"
        description="Connect repositories through an authorized GitHub App installation."
      >
        <button className="button secondary small" onClick={reload}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </PageTitle>
      <ErrorNotice error={error} />
      <section className="panel">
        <div className="panel-header">
          <h2>GitHub connection</h2>
          <Badge value={me.github_configured ? "configured" : "disconnected"} />
        </div>
        <div className="panel-body">
          {me.github_missing?.length ? (
            <p className="notice">
              Missing backend configuration:{" "}
              <code>{me.github_missing.join(", ")}</code>.{" "}
              <Link href="/docs#github">GitHub App setup →</Link>
            </p>
          ) : null}
          <p style={{ fontSize: 12, marginBottom: 18 }}>
            Install the app with access to selected repositories, then authorize
            your GitHub account to confirm installation access. Required
            permissions: metadata, contents and pull requests (read), and
            organization membership (read) for organization installations.
            Checks write access is optional and only needed when publishing
            advisory checks is explicitly enabled.
          </p>
          <div className="inline-actions">
            {me.github_configured ? (
              <>
                <a className="button small" href="/api/github/install">
                  Install GitHub App <ArrowUpRight size={13} />
                </a>
                <a
                  className="button secondary small"
                  href="/api/github/connect"
                >
                  Authorize GitHub account <ArrowUpRight size={13} />
                </a>
                <button
                  className="button secondary small"
                  onClick={discover}
                  disabled={busy}
                >
                  Discover repositories
                </button>
              </>
            ) : (
              <div className="notice">
                GitHub App credentials are not configured. Follow the GitHub
                setup guide in the repository README before connecting.
              </div>
            )}
          </div>
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          {available
            .filter((a) => !data?.some((r) => r.full_name === a.full_name))
            .map((r) => (
              <div className="row" key={r.full_name}>
                <GitBranch size={16} />
                <span className="row-main">{r.full_name}</span>
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => add(r)}
                >
                  Connect
                </button>
              </div>
            ))}
        </div>
      </section>
      {loading ? (
        <div className="skeleton" />
      ) : data?.length ? (
        <div className="repo-grid wide-panel">
          {data.map((r) => (
            <Link
              key={r.id}
              className="repo-card"
              href={"/app/repositories/" + r.id}
            >
              <GitBranch size={20} color="#b5a5e0" />
              <h3>{r.full_name}</h3>
              <p>
                {r.pull_requests} open PRs · {r.default_branch} · Advisory
              </p>
              <span className="text-link">
                Open repository <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="panel wide-panel">
          <Empty
            title="Connect your first repository"
            text="Only repositories granted to your installation can be selected. No repository data is loaded before authorization."
          />
        </section>
      )}
    </>
  );
}
function RepositoryDetail({ id }: { id: string }) {
  const {
    data: r,
    error,
    loading,
    reload,
  } = useData<Repo>("/repositories/" + id);
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [selectedPulls, setSelectedPulls] = useState<number[]>([]);
  async function action(kind: "sync" | "analyze" | "disconnect") {
    setBusy(true);
    setMessage("");
    try {
      if (kind === "sync") {
        const result = await api<{ count: number }>(
          "/repositories/" + id + "/sync",
          "POST",
        );
        setMessage(`Synchronized ${result.count} open pull requests.`);
        await reload();
      } else if (kind === "analyze") {
        const result = await api<{ id: string }>(
          "/repositories/" + id + "/analyses",
          "POST",
          { pull_numbers: selectedPulls },
        );
        router.push("/app/analyses/" + result.id);
      } else {
        await api("/repositories/" + id, "DELETE");
        router.push("/app/repositories");
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <div className="skeleton" />;
  if (!r) return <ErrorNotice error={error} />;
  return (
    <>
      <PageTitle
        title={r.full_name}
        description={`Default branch: ${r.default_branch} · Exact revisions are captured at synchronization.`}
      >
        <div className="inline-actions">
          <button
            className="button secondary small"
            onClick={() => action("sync")}
            disabled={busy}
          >
            <RefreshCw size={13} />
            Sync PRs
          </button>
          <button
            className="button small"
            onClick={() => action("analyze")}
            disabled={
              busy || selectedPulls.length < 2 || selectedPulls.length > 10
            }
          >
            <Play size={13} />
            Analyze selected ({selectedPulls.length})
          </button>
        </div>
      </PageTitle>
      <ErrorNotice error={error} />
      <div className="repository-context">
        <Link
          className="button secondary small"
          href={`/app/repositories/${id}/explore`}
        >
          Explore code & architecture →
        </Link>
        <span>
          Choose 2–10 PRs below. Verification currently supports pairs with a
          shared base.
        </span>
      </div>
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <section className="panel">
        <div className="panel-header">
          <h2>Open pull requests</h2>
          <span className="muted" style={{ fontSize: 10 }}>
            {r.pulls?.length || 0} synchronized
          </span>
        </div>
        {r.pulls?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pull request</th>
                  <th>Base</th>
                  <th>Head</th>
                  <th>Changed files</th>
                </tr>
              </thead>
              <tbody>
                {r.pulls.map((p) => (
                  <tr key={p.number}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select PR ${p.number}`}
                        checked={selectedPulls.includes(p.number)}
                        onChange={(e) =>
                          setSelectedPulls((current) =>
                            e.target.checked
                              ? [...current, p.number]
                              : current.filter((n) => n !== p.number),
                          )
                        }
                      />{" "}
                      <a
                        href={`https://github.com/${r.full_name}/pull/${p.number}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        #{p.number} {p.title} <ArrowUpRight size={11} />
                      </a>
                    </td>
                    <td>
                      <code className="revision" title={p.base_sha}>
                        {p.base_sha.slice(0, 9)}
                      </code>
                    </td>
                    <td>
                      <code className="revision" title={p.head_sha}>
                        {p.head_sha.slice(0, 9)}
                      </code>
                    </td>
                    <td>{p.files.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No synchronized pull requests"
            text="Synchronize this repository to capture the current open PRs and their exact revisions."
            icon={GitPullRequest}
          />
        )}
      </section>
      <section className="panel wide-panel">
        <div className="panel-header">
          <h2>Repository analysis policy</h2>
        </div>
        <div className="panel-body">
          <PolicyForm repo={r} onSave={reload} />
        </div>
      </section>
      <section className="panel wide-panel">
        <div className="panel-header">
          <h2>Pull-request impact evidence</h2>
        </div>
        <div className="panel-body">
          {r.pulls?.length ? (
            r.pulls.map((p) => (
              <details className="pr-impact" key={p.number}>
                <summary>
                  #{p.number} · {p.title} · {p.files.length} changed files
                </summary>
                <p className="helper">
                  Pinned diff metadata. Related changes share a filename; this
                  is an overlap signal, not a resolved runtime dependency.
                </p>
                {p.files.map((f) => (
                  <div key={f.filename}>
                    <code>
                      {f.status} / {f.filename}
                    </code>
                    <p className="helper">
                      Other PRs touching this path:{" "}
                      {r.pulls
                        ?.filter(
                          (other) =>
                            other.number !== p.number &&
                            other.files.some(
                              (changed) => changed.filename === f.filename,
                            ),
                        )
                        .map((other) => `#${other.number}`)
                        .join(", ") || "none in this snapshot"}
                    </p>
                    {f.patch && <pre>{f.patch}</pre>}
                  </div>
                ))}
              </details>
            ))
          ) : (
            <p>No synchronized PR diff evidence. Use Sync PRs above.</p>
          )}
        </div>
      </section>
      <section className="panel wide-panel">
        <div className="panel-header">
          <h2>Disconnect repository</h2>
        </div>
        <div className="panel-body">
          <p className="helper">
            This removes this repository’s local pull requests, analyses, and
            findings. GitHub content is unaffected.
          </p>
          {confirm ? (
            <div className="notice">
              <p>Remove all local data for {r.full_name}?</p>
              <div className="inline-actions" style={{ marginTop: 12 }}>
                <button
                  className="button danger small"
                  onClick={() => action("disconnect")}
                  disabled={busy}
                >
                  Confirm disconnection
                </button>
                <button
                  className="button secondary small"
                  onClick={() => setConfirm(false)}
                >
                  Keep repository
                </button>
              </div>
            </div>
          ) : (
            <button
              className="button danger small"
              style={{ marginTop: 15 }}
              onClick={() => setConfirm(true)}
            >
              Disconnect repository
            </button>
          )}
        </div>
      </section>
    </>
  );
}
function PolicyForm({ repo, onSave }: { repo: Repo; onSave: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      await api("/repositories/" + repo.id + "/policy", "PATCH", {
        max_pairs: Number(form.get("pairs")),
        retention_days: Number(form.get("retention")),
        advisory: true,
        publish_checks: form.get("publish_checks") === "on",
      });
      setMessage("Policy saved. Applies to future analysis snapshots.");
      onSave();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        Maximum candidate pairs
        <input
          name="pairs"
          type="number"
          min={1}
          max={20}
          defaultValue={repo.policy.max_pairs}
        />
        <span className="helper">
          Rank shared-file and identifier relationships before selecting pairs.
        </span>
      </label>
      <label>
        Analysis retention (days)
        <input
          name="retention"
          type="number"
          min={1}
          max={90}
          defaultValue={repo.policy.retention_days}
        />
        <span className="helper">
          The worker removes finished analyses after the configured retention
          period.
        </span>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          name="publish_checks"
          defaultChecked={!!repo.policy.publish_checks}
        />
        Opt in to publishing advisory GitHub Checks
      </label>
      <div className="notice">
        Checks also require backend GITHUB_PUBLISH_CHECKS=true and checks/write
        permission. They always remain advisory.
      </div>
      <button className="button small" disabled={busy}>
        Save policy
      </button>
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
    </form>
  );
}
function AnalysisHistory() {
  const { data, error, loading, reload } = useData<Analysis[]>("/analyses");
  const [filter, setFilter] = useState("");
  const [state, setState] = useState("");
  return (
    <>
      <PageTitle
        title="Analysis history"
        description="A revision-aware record of your integration analysis runs."
      >
        <button className="button secondary small" onClick={reload}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </PageTitle>
      <ErrorNotice error={error} />
      <div className="index-toolbar">
        <input
          aria-label="Filter analyses by repository"
          placeholder="Filter repositories…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          aria-label="Filter analysis state"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">All states</option>
          {[
            "queued",
            "collecting",
            "analyzing",
            "completed",
            "inconclusive",
            "failed",
            "cancelled",
            "stale",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <section className="panel">
        {loading ? (
          <div className="panel-body">
            <div className="skeleton" />
          </div>
        ) : data?.length ? (
          <>
            {data
              .filter(
                (r) =>
                  r.repository.toLowerCase().includes(filter.toLowerCase()) &&
                  (!state || r.state === state),
              )
              .map((r) => (
                <AnalysisRow key={r.id} run={r} />
              ))}
            {!data.some(
              (r) =>
                r.repository.toLowerCase().includes(filter.toLowerCase()) &&
                (!state || r.state === state),
            ) && <p className="panel-body">No runs match these filters.</p>}
          </>
        ) : (
          <Empty
            title="No analyses yet"
            text="Create an analysis from a repository with at least two synchronized open pull requests."
            href="/app/repositories"
            label="Open repositories"
            icon={Activity}
          />
        )}
      </section>
    </>
  );
}
function AnalysisDetail({ id }: { id: string }) {
  const {
    data: r,
    error,
    loading,
    reload,
  } = useData<Detail>("/analyses/" + id);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (
      !r ||
      !["queued", "collecting", "analyzing", "testing"].includes(r.state)
    )
      return;
    const timer = setInterval(() => void reload(), 2500);
    return () => clearInterval(timer);
  }, [r, reload]);
  async function cancel() {
    try {
      await api("/analyses/" + id + "/cancel", "POST");
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  if (loading) return <div className="skeleton" />;
  if (!r) return <ErrorNotice error={error} />;
  const coverage = { ...r.coverage };
  delete coverage.snippets;
  return (
    <>
      <PageTitle
        title="Integration analysis"
        description={`${r.snapshot.repository} · Run ${id.slice(0, 8)}`}
      >
        <div className="inline-actions">
          <Badge value={r.state} />
          {["queued", "collecting", "analyzing", "testing"].includes(
            r.state,
          ) && (
            <button className="button secondary small" onClick={cancel}>
              Cancel analysis
            </button>
          )}
        </div>
      </PageTitle>
      <ErrorNotice error={error || message || r.error || ""} />
      <section className="panel">
        <div className="timeline">
          {["queued", "collecting", "analyzing", "testing", "completed"].map(
            (s, i) => (
              <span key={s} className={r.state === s ? "current" : ""}>
                {i + 1} · {s}
              </span>
            ),
          )}
        </div>
      </section>
      {r.state === "stale" && (
        <div className="notice error">
          Source revisions have changed. These results apply only to the
          recorded snapshot; synchronize and create a new analysis.
        </div>
      )}
      <div className="split wide-panel">
        <section className="panel">
          <div className="panel-header">
            <h2>Interaction findings</h2>
            <span className="muted" style={{ fontSize: 10 }}>
              {r.findings.length} candidates
            </span>
          </div>
          {r.findings.length ? (
            r.findings.map((f) => (
              <FindingRow
                key={f.id}
                finding={{
                  ...f,
                  repository: r.snapshot.repository,
                  analysis_state: r.state,
                  analysis_id: r.id,
                }}
              />
            ))
          ) : (
            <Empty
              title={
                ["completed", "inconclusive"].includes(r.state)
                  ? "No candidates in supported coverage"
                  : "Collecting interaction evidence"
              }
              text="Only supported, concrete relationships are analyzed. Missing candidates do not prove integration safety."
              icon={Network}
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Immutable source snapshot</h2>
          </div>
          <div className="panel-body">
            {r.snapshot.pulls?.map((p) => (
              <div key={p.number} style={{ marginBottom: 18 }}>
                <a
                  className="text-link"
                  href={`https://github.com/${r.snapshot.repository}/pull/${p.number}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  #{p.number} {p.title} <ArrowUpRight size={12} />
                </a>
                <div className="metadata-list" style={{ marginTop: 12 }}>
                  <dt>Base SHA</dt>
                  <dd>
                    <code>{p.base_sha}</code>
                  </dd>
                  <dt>Head SHA</dt>
                  <dd>
                    <code>{p.head_sha}</code>
                  </dd>
                </div>
              </div>
            ))}
            <p className="helper">
              {r.snapshot.merge_strategy ||
                "Current revisions will be pinned during collection."}
            </p>
          </div>
        </section>
      </div>
      <section className="panel wide-panel">
        <div className="panel-header">
          <h2>Coverage and execution evidence</h2>
        </div>
        <div className="panel-body">
          <pre>{JSON.stringify(coverage, null, 2)}</pre>
          {r.tests.map((test, i) => (
            <TestEvidence key={test.id || i} test={test} />
          ))}
        </div>
      </section>
    </>
  );
}
function Findings() {
  const { data, error, loading } = useData<Finding[]>("/findings");
  const [filter, setFilter] = useState("all");
  const rows = (data || []).filter(
    (f) => filter === "all" || f.status === filter,
  );
  return (
    <>
      <PageTitle
        title="Findings"
        description="Keep static hypotheses separate from reproduced integration failures."
      >
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 180 }}
          aria-label="Filter verification status"
        >
          {[
            "all",
            "suspected",
            "reproduced",
            "inconclusive",
            "not-reproduced",
          ].map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
      </PageTitle>
      <ErrorNotice error={error} />
      <section className="panel">
        {loading ? (
          <div className="panel-body">
            <div className="skeleton" />
          </div>
        ) : rows.length ? (
          rows.map((f) => <FindingRow key={f.id} finding={f} />)
        ) : (
          <Empty
            title="No matching findings"
            text="Run an analysis to inspect interaction hypotheses, or choose a different verification filter."
            href="/app/repositories"
            label="Open repositories"
            icon={ShieldCheck}
          />
        )}
      </section>
    </>
  );
}
function FindingDetail({ id, me }: { id: string; me: Me }) {
  const {
    data: f,
    error,
    loading,
    reload,
  } = useData<Finding>("/findings/" + id);
  if (loading) return <div className="skeleton" />;
  if (!f) return <ErrorNotice error={error} />;
  return (
    <>
      <PageTitle
        title={f.title}
        description={`${f.repository} · ${f.category} · Risk ${f.risk}/100`}
      >
        <Badge value={f.status} />
      </PageTitle>
      <ErrorNotice error={error} />
      {f.analysis_state === "stale" && (
        <div className="notice error">
          This finding belongs to stale revisions. Verification is disabled.
        </div>
      )}
      <div className="split">
        <section className="panel">
          {[
            { title: "Shared assumption", text: f.explanation },
            { title: "Expected behavior", text: f.expected },
            { title: "Observed behavior", text: f.actual },
            { title: "Reproduction protocol", text: f.reproduction },
            { title: "Suggested investigation", text: f.suggested_fix },
          ].map((s) => (
            <div className="detail-section" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="detail-section">
            <h3>Verification and risk</h3>
            <dl className="metadata-list">
              <dt>Verification</dt>
              <dd>
                <Badge value={f.status} />
              </dd>
              <dt>Severity</dt>
              <dd>{f.severity}</dd>
              <dt>Confidence</dt>
              <dd>{f.confidence}</dd>
              <dt>Risk heuristic</dt>
              <dd>35 + 20 per distinct signal, capped at 95</dd>
            </dl>
            <p className="helper" style={{ marginTop: 18 }}>
              {f.verification_reason}
            </p>
            <ul className="helper">
              {f.rationale.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="detail-section">
            <h3>Affected revisions</h3>
            {f.revisions.map((r) => (
              <div key={r.pr} style={{ marginBottom: 16 }}>
                <a
                  className="text-link"
                  href={`https://github.com/${f.repository}/pull/${r.pr}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  PR #{r.pr}
                  <ArrowUpRight size={12} />
                </a>
                <p className="helper">
                  Base <code>{r.base.slice(0, 12)}</code>
                  <br />
                  Head <code>{r.head.slice(0, 12)}</code>
                </p>
              </div>
            ))}
            <Link className="text-link" href={"/app/analyses/" + f.analysis_id}>
              View full analysis <ArrowRight size={13} />
            </Link>
          </div>
        </section>
      </div>
      <section className="panel wide-panel">
        <div className="panel-header">
          <h2>Source references and contract evidence</h2>
        </div>
        <div className="panel-body">
          {f.references.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PR</th>
                    <th>Source</th>
                    <th>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {f.references.map((ref, i) => {
                    const rev = f.revisions.find((r) => r.pr === ref.pr);
                    return (
                      <tr key={i}>
                        <td>#{ref.pr}</td>
                        <td>
                          <a
                            href={`https://github.com/${f.repository}/blob/${rev?.head}/${ref.path}#L${ref.line}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {ref.path}:{ref.line} <ArrowUpRight size={11} />
                          </a>
                        </td>
                        <td>
                          {ref.kind} · <code>{ref.name}</code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="helper">
              No supported Python entity references. Review changed files:{" "}
              {f.shared_files.join(", ") || "shared identifiers only"}.
            </p>
          )}
          {f.contract_changes.length > 0 && (
            <pre>{JSON.stringify(f.contract_changes, null, 2)}</pre>
          )}
        </div>
      </section>
      <section className="panel wide-panel">
        <div className="panel-header">
          <h2>Targeted regression test</h2>
          <span className="muted" style={{ fontSize: 10 }}>
            Python unittest
          </span>
        </div>
        <div className="panel-body">
          <FindingTest
            finding={f}
            runner={me.runner_configured}
            onVerified={reload}
          />
          {f.test_result && <TestEvidence test={f.test_result} />}
        </div>
      </section>
    </>
  );
}
export function TestEvidence({ test }: { test: TestResult }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div className="inline-actions">
        <Badge value={test.status || "execution evidence"} />
        <span className="helper">{test.reason}</span>
      </div>
      {test.artifact_identity && (
        <p className="helper" style={{ marginTop: 12 }}>
          Candidate identity: <code>{test.artifact_identity}</code>
        </p>
      )}
      {test.cases?.map((c) => (
        <details key={c.name} style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 12 }}>
            {c.name} · exit {c.exit_code} · {c.test_count} tests
            {c.timeout ? " · TIMED OUT" : ""}
          </summary>
          <p className="helper">Commit: {c.commit || "not recorded"}</p>
          <pre>{c.stdout || c.stderr || "No output captured."}</pre>
        </details>
      ))}
    </div>
  );
}
function Interactions() {
  const { data, error, loading } = useData<Finding[]>("/findings");
  return (
    <>
      <PageTitle
        title="Interaction explorer"
        description="Inspect concrete shared-file and changed-identifier relationships between pull requests."
      />
      <ErrorNotice error={error} />
      {loading ? (
        <div className="skeleton" />
      ) : data?.length ? (
        data.map((f) => (
          <section key={f.id} className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <h2>{f.repository}</h2>
              <Badge value={f.status} />
            </div>
            <div className="panel-body">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  flexWrap: "wrap",
                }}
              >
                <span className="revision">
                  <GitPullRequest size={13} />
                  PR #{f.prs[0]}
                </span>
                <span className="muted">↔</span>
                <span className="revision">
                  <GitPullRequest size={13} />
                  PR #{f.prs[1]}
                </span>
                <span className="helper">
                  {f.category} · Risk {f.risk}
                </span>
              </div>
              <p className="helper" style={{ marginTop: 20 }}>
                Shared files: {f.shared_files.join(", ") || "None"}
              </p>
              <p className="helper">
                Shared changed identifiers: {f.identifiers.join(", ") || "None"}
              </p>
              <p className="helper">
                Relationships are heuristic and may be unresolved.{" "}
                {f.analysis_state === "stale"
                  ? "These revisions are stale."
                  : ""}
              </p>
              <Link
                className="text-link"
                style={{ marginTop: 18 }}
                href={"/app/findings/" + f.id}
              >
                Inspect evidence <ArrowRight size={13} />
              </Link>
            </div>
          </section>
        ))
      ) : (
        <section className="panel">
          <Empty
            title="Your interaction map is empty"
            text="Analyze synchronized pull requests to identify shared files and changed assumptions."
            href="/app/repositories"
            label="Open repositories"
            icon={Network}
          />
        </section>
      )}
    </>
  );
}
function Tests() {
  const { data, error, loading } = useData<Finding[]>("/findings");
  const rows = data?.filter((f) => f.test_result) || [];
  return (
    <>
      <PageTitle
        title="Test results"
        description="Baseline, individual PR, and repeated combined-state comparisons."
      />
      <ErrorNotice error={error} />
      {loading ? (
        <div className="skeleton" />
      ) : rows.length ? (
        rows.map((f) => (
          <section key={f.id} className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <h2>
                <Link href={"/app/findings/" + f.id}>{f.title}</Link>
              </h2>
              <Badge value={f.status} />
            </div>
            <div className="panel-body">
              <TestEvidence test={f.test_result!} />
            </div>
          </section>
        ))
      ) : (
        <section className="panel">
          <Empty
            title="No isolated test results"
            text="Open a finding, review a targeted regression test, and verify it on a configured separate runner. Tests never run inside the API server."
            href="/app/findings"
            label="Open findings"
            icon={Terminal}
          />
        </section>
      )}
    </>
  );
}
function SettingsPage({ tab, me }: { tab: string; me: Me }) {
  return (
    <>
      <PageTitle
        title="Workspace settings"
        description="Configure your provider, repository policies, account access, and security."
      />
      <nav className="tabs">
        {[
          ["providers", "AI providers"],
          ["policies", "Policies"],
          ["team", "Team & account"],
          ["account", "Profile & data"],
          ["security", "Security"],
          ["audit", "Audit log"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={"/app/settings/" + key}
            className={tab === key ? "active" : ""}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "providers" ? (
        <ProviderSettings />
      ) : tab === "policies" ? (
        <Policies />
      ) : tab === "account" ? (
        <AccountSettings me={me} />
      ) : tab === "team" ? (
        <Team me={me} />
      ) : tab === "security" ? (
        <Security />
      ) : tab === "audit" ? (
        <AuditLog />
      ) : (
        <Empty title="Setting not found" text="Choose a settings tab." />
      )}
    </>
  );
}
function Policies() {
  const { data, error, loading } = useData<Repo[]>("/repositories");
  return (
    <>
      <ErrorNotice error={error} />
      {loading ? (
        <div className="skeleton" />
      ) : data?.length ? (
        data.map((r) => (
          <section key={r.id} className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <h2>{r.full_name}</h2>
            </div>
            <div className="panel-body">
              <PolicyForm repo={r} onSave={() => {}} />
            </div>
          </section>
        ))
      ) : (
        <section className="panel">
          <Empty
            title="No repository policies yet"
            text="Connect a repository to set its pair limit and data retention window."
            href="/app/repositories"
            label="Connect repository"
          />
        </section>
      )}
    </>
  );
}
function Team({ me }: { me: Me }) {
  const { data, error } =
    useData<{ name: string; email: string; role: string }[]>("/settings/team");
  return (
    <>
      <ErrorNotice error={error} />
      <section className="panel">
        <div className="panel-header">
          <h2>{me.organization.name}</h2>
          <Badge value="owner-managed" />
        </div>
        {data?.map((m) => (
          <div className="row" key={m.email}>
            <span className="avatar">{m.name.slice(0, 2).toUpperCase()}</span>
            <div className="row-main">
              <strong>{m.name}</strong>
              <small>{m.email}</small>
            </div>
            <Badge value={m.role} />
          </div>
        ))}
        <div className="panel-body">
          <p className="helper">
            This release supports one owner per workspace. Team invitations,
            SSO, email verification, and password recovery are not available
            yet.
          </p>
        </div>
      </section>
    </>
  );
}
function Security() {
  const { data, error, reload } =
    useData<{ current: boolean; expires: number }[]>("/settings/sessions");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function revoke() {
    try {
      await api("/settings/revoke-sessions", "POST");
      setMessage("Other account sessions revoked.");
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function disconnect() {
    try {
      const result = await api<{ notice: string }>(
        "/github/connection",
        "DELETE",
      );
      setMessage(result.notice);
      setConfirm(false);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <ErrorNotice error={error} />
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Account sessions</h2>
          </div>
          <div className="panel-body">
            {data?.map((s, i) => (
              <div className="row" key={i}>
                <Clock size={16} />
                <div className="row-main">
                  <strong>
                    {s.current ? "Current session" : "Other session"}
                  </strong>
                  <small>
                    Expires <DateLabel value={s.expires} />
                  </small>
                </div>
              </div>
            ))}
            <button
              className="button secondary small"
              style={{ marginTop: 20 }}
              onClick={revoke}
            >
              Revoke other sessions
            </button>
            <p className="helper" style={{ marginTop: 15 }}>
              Sessions are stored as hashes. Authentication cookies are
              HTTP-only, SameSite=Lax, and Secure in production.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>GitHub disconnection</h2>
          </div>
          <div className="panel-body">
            <p className="helper">
              Remove all local installation records and their repositories,
              analyses, and findings. Revoke the installation on GitHub to stop
              its access.
            </p>
            {confirm ? (
              <div className="notice">
                <p>Remove all connected repository data from this workspace?</p>
                <div className="inline-actions" style={{ marginTop: 12 }}>
                  <button className="button danger small" onClick={disconnect}>
                    Confirm disconnection
                  </button>
                  <button
                    className="button secondary small"
                    onClick={() => setConfirm(false)}
                  >
                    Keep connection
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="button danger small"
                style={{ marginTop: 18 }}
                onClick={() => setConfirm(true)}
              >
                Disconnect local GitHub data
              </button>
            )}
            <a
              className="text-link"
              style={{ marginTop: 20, display: "flex" }}
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noreferrer"
            >
              Manage GitHub installation <ArrowUpRight size={13} />
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
function AuditLog() {
  const { data, error, loading } =
    useData<
      { id: string; actor: string; action: string; created_at: number }[]
    >("/settings/audit");
  return (
    <>
      <ErrorNotice error={error} />
      <section className="panel">
        <div className="panel-header">
          <h2>Workspace audit events</h2>
          <span className="helper">Latest 100 events</span>
        </div>
        {loading ? (
          <div className="skeleton" />
        ) : data?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <code>{e.action}</code>
                    </td>
                    <td>{e.actor}</td>
                    <td>
                      <DateLabel value={e.created_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No audit events"
            text="Account and integration actions will be recorded here."
            icon={ShieldCheck}
          />
        )}
      </section>
    </>
  );
}
