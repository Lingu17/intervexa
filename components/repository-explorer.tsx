"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, readApi, cachedValue } from "@/lib/api";
import { Graph } from "./graph";
import { ArchitectureNode, ArchitectureEdge } from "@/lib/architecture";
import { ProviderFormFields, useProvider } from "./provider-settings";
type SourceFile = {
  path: string;
  source: string;
  sha: string;
  symbols: { name: string; kind: string; line: number }[];
  imports: { module: string; line: number }[];
  issues: string[];
};
type Index = {
  sha: string;
  branch: string;
  created_at: number;
  coverage: Record<string, string | number | boolean>;
  files: SourceFile[];
  graph: {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
    notice: string;
  };
};
type Result = {
  path: string;
  line: number;
  end_line: number;
  excerpt: string;
  sha: string;
  score: number;
};
export function RepositoryExplorer({ id }: { id: string }) {
  const params = useSearchParams();
  const root = "/repositories/" + id;
  const [index, setIndex] = useState<Index | undefined>(() =>
      cachedValue<Index>(root + "/intelligence"),
    ),
    [tab, setTab] = useState(
      params.get("view") === "search" ? "search" : "architecture",
    ),
    [file, setFile] = useState<SourceFile>();
  const [branches, setBranches] = useState<{ name: string; sha: string }[]>([]),
    [branch, setBranch] = useState("");
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(
      () => !cachedValue(root + "/intelligence"),
    );
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Result[]>([]),
    [answer, setAnswer] = useState(""),
    [consent, setConsent] = useState(false),
    [semantic, setSemantic] = useState(false),
    [filter, setFilter] = useState("");
  const p = useProvider();
  const reload = useCallback(async () => {
    try {
      const data = await readApi<Index>(root + "/intelligence");
      setIndex(data);
      setBranch(data.branch);
      setStatus("");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [root]);
  useEffect(() => {
    void reload();
  }, [reload]);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }
  function openFile(path: string) {
    void act(async () => {
      setFile(
        await api<SourceFile>(root + "/file?path=" + encodeURIComponent(path)),
      );
      setTab("files");
    });
  }
  async function search(event: React.FormEvent) {
    event.preventDefault();
    setAnswer("");
    setResults([]);
    await act(async () => {
      if (tab === "questions") {
        const response = await api<{
          answer: string;
          sources: Result[];
          notice?: string;
          provider?: string;
          model?: string;
          usage?: Record<string, unknown>;
        }>(root + "/question", "POST", {
          provider: p.provider,
          api_key: p.key,
          model: p.model,
          max_tokens: p.tokens,
          consent,
          question: query,
        });
        setAnswer(response.answer);
        setResults(response.sources);
        setStatus(
          response.provider
            ? `${response.provider} / ${response.model} · reported usage ${JSON.stringify(response.usage || {})}. ${response.notice || ""}`
            : response.notice || "No inference was performed.",
        );
      } else {
        const response = semantic
          ? await api<{ results: Result[]; notice: string }>(
              root + "/semantic-search",
              "POST",
              { provider: p.provider, api_key: p.key, consent, query },
            )
          : await api<{ results: Result[]; notice: string }>(
              root + "/search?q=" + encodeURIComponent(query),
            );
        setResults(response.results);
        setStatus(response.notice);
        if (!response.results.length)
          setAnswer(
            "No matching evidence in the indexed scope. Try a filename or symbol, or refresh the index.",
          );
      }
    });
  }
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">
            <Link href={`/app/repositories/${id}`}>REPOSITORY</Link> /
            INTELLIGENCE
          </div>
          <h1>Explore the codebase</h1>
          <p>Source, dependencies and changes share one exact revision.</p>
        </div>
        <Link
          href={`/app/repositories/${id}`}
          className="button secondary small"
        >
          Pull requests & analysis →
        </Link>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="index-toolbar">
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const data = await api<{ name: string; sha: string }[]>(
                root + "/branches",
              );
              setBranches(data);
              if (!branch) setBranch(data[0]?.name || "");
            })
          }
        >
          Load authorized branches
        </button>
        {branches.length ? (
          <select
            aria-label="Branch to index"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.name}>{b.name}</option>
            ))}
          </select>
        ) : (
          <input
            aria-label="Branch to index"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Branch name, e.g. main"
            maxLength={100}
          />
        )}
        <button
          className="button small"
          disabled={busy || !branch}
          onClick={() =>
            void act(async () => {
              setStatus("Indexing exact revision…");
              await api(root + "/index", "POST", { branch });
              setFile(undefined);
              setResults([]);
              await reload();
            })
          }
        >
          {busy ? "Working…" : index ? "Refresh pinned index" : "Index branch"}
        </button>
      </div>
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
      {loading ? (
        <div className="skeleton" />
      ) : !index ? (
        <div className="setup-editorial">
          <h2>Start with a pinned branch.</h2>
          <p>
            Load authorized branches and index one. Source is bounded to 60
            files and 500 KB. No repository code is executed and no AI key is
            required.
          </p>
          <Link href="/docs">Indexing scope & setup →</Link>
        </div>
      ) : (
        <>
          <div className="revision-strip">
            <code>{index.sha}</code>
            <span>
              {index.branch} · {index.files.length} files ·{" "}
              {new Date(index.created_at * 1000).toLocaleString()}
            </span>
          </div>
          <nav className="tabs">
            {[
              "files",
              "search",
              "questions",
              "architecture",
              "dependencies",
              "coverage",
            ].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => {
                  setTab(t);
                  setResults([]);
                  setAnswer("");
                }}
              >
                {t === "questions"
                  ? "Repository Q&A"
                  : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
          {tab === "files" ? (
            <div className="code-explorer">
              <aside>
                <label className="helper">
                  Filter indexed paths
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filename or folder"
                  />
                </label>
                {index.files
                  .filter((f) =>
                    f.path.toLowerCase().includes(filter.toLowerCase()),
                  )
                  .map((f) => (
                    <button
                      className={file?.path === f.path ? "active" : ""}
                      key={f.path}
                      onClick={() => openFile(f.path)}
                    >
                      <code>{f.path}</code>
                      <small>{f.symbols.length} symbols</small>
                    </button>
                  ))}
              </aside>
              <section>
                {file ? (
                  <>
                    <div className="code-header">
                      <strong>{file.path}</strong>
                      <code>{file.sha.slice(0, 12)}</code>
                    </div>
                    {file.issues.map((issue) => (
                      <p className="notice" key={issue}>
                        {issue}
                      </p>
                    ))}
                    <div className="symbol-strip">
                      {file.symbols.map((s) => (
                        <a key={`${s.name}:${s.line}`} href={`#line-${s.line}`}>
                          {s.name}:{s.line}
                        </a>
                      ))}
                    </div>
                    <pre className="source-code">
                      {file.source
                        .split("\n")
                        .slice(0, 2000)
                        .map((line, i) => (
                          <span id={`line-${i + 1}`} key={i}>
                            <a
                              href={`#line-${i + 1}`}
                              aria-label={`Line ${i + 1}`}
                            >
                              {i + 1}
                            </a>
                            <code>{line || " "}</code>
                          </span>
                        ))}
                    </pre>
                    {file.source.split("\n").length > 2000 && (
                      <p className="helper">Rendering the first 2,000 lines.</p>
                    )}
                  </>
                ) : (
                  <div className="source-prompt">
                    <h3>Select a file.</h3>
                    <p>
                      Line numbers, symbols and source are pinned to{" "}
                      {index.sha.slice(0, 12)}. This is the indexed subset, not
                      a complete tree.
                    </p>
                  </div>
                )}
              </section>
            </div>
          ) : tab === "architecture" ? (
            <Graph
              nodes={index.graph.nodes}
              edges={index.graph.edges}
              conceptual={false}
            />
          ) : tab === "dependencies" ? (
            <section className="panel">
              <p className="notice">{index.graph.notice}</p>
              {index.graph.edges.filter((e) => e.kind === "import").length ? (
                index.graph.edges
                  .filter((e) => e.kind === "import")
                  .map((e, i) => (
                    <div className="row" key={i}>
                      <button
                        className="text-link"
                        onClick={() => openFile(e.source)}
                      >
                        {e.source}
                      </button>
                      <span>imports →</span>
                      <button
                        className="text-link"
                        onClick={() => openFile(e.target)}
                      >
                        {e.target}
                      </button>
                    </div>
                  ))
              ) : (
                <p className="panel-body">
                  No internal Python imports resolved in this indexed subset.
                  That does not imply the repository has no dependencies.
                </p>
              )}
            </section>
          ) : tab === "coverage" ? (
            <section className="panel">
              <div className="panel-header">
                <h2>Coverage, not a health score</h2>
              </div>
              {Object.entries(index.coverage).map(([k, v]) => (
                <div className="row" key={k}>
                  <strong>{k.replaceAll("_", " ")}</strong>
                  <span>{String(v)}</span>
                </div>
              ))}
            </section>
          ) : (
            <section className="search-workflow">
              <form onSubmit={search}>
                <label>
                  {tab === "questions"
                    ? "Ask about a path, symbol or behavior"
                    : "Search filenames, symbols and identifiers"}
                  <div className="search-input">
                    <input
                      required
                      minLength={2}
                      maxLength={tab === "questions" ? 1000 : 300}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="create_session, auth, API…"
                    />
                    <button
                      className="button small"
                      disabled={
                        busy ||
                        ((tab === "questions" || semantic) &&
                          (!consent || !p.connected))
                      }
                    >
                      {busy
                        ? "Retrieving…"
                        : tab === "questions"
                          ? "Ask with sources"
                          : "Search"}
                    </button>
                  </div>
                </label>
                {tab === "search" && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={semantic}
                      onChange={(e) => setSemantic(e.target.checked)}
                    />
                    Semantic retrieval · OpenAI embeddings · paid
                  </label>
                )}
              </form>
              {(tab === "questions" || semantic) && (
                <div className="panel panel-body">
                  <h3>Request-scoped provider credentials</h3>
                  <ProviderFormFields p={p} />
                  <p className="helper">
                    Model listing confirms metadata access only. Keys stay in
                    memory and disappear on refresh.
                  </p>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I approve sending bounded code or queries to this provider
                    and incurring API charges.
                  </label>
                  {semantic && (
                    <button
                      className="button secondary small"
                      disabled={
                        busy ||
                        !consent ||
                        !p.connected ||
                        p.provider !== "openai"
                      }
                      onClick={() =>
                        void act(async () => {
                          const data = await api<{ notice: string }>(
                            root + "/embeddings",
                            "POST",
                            { provider: p.provider, api_key: p.key, consent },
                          );
                          setStatus(data.notice);
                        })
                      }
                    >
                      Create / replace embedding index (paid)
                    </button>
                  )}
                </div>
              )}
              {answer && (
                <div className="answer-panel" aria-live="polite">
                  <h3>
                    {tab === "questions"
                      ? "Source-grounded interpretation"
                      : "Retrieval result"}
                  </h3>
                  <p>{answer}</p>
                </div>
              )}
              {results.map((r, i) => (
                <article className="search-result" key={`${r.path}:${i}`}>
                  <button
                    className="text-link"
                    onClick={() => openFile(r.path)}
                  >
                    {r.path}:{r.line}–{r.end_line}
                  </button>
                  <code>
                    {r.sha.slice(0, 12)} ·{" "}
                    {semantic ? "similarity" : "match score"}{" "}
                    {r.score?.toFixed(2)}
                  </code>
                  <pre>{r.excerpt}</pre>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
