"use client";
import { useEffect, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import {
  api,
  type ProviderModel,
  type Finding,
  type TestResult,
} from "@/lib/api";
type Provider = "openai" | "openrouter";
type Preference = { provider: Provider; model: string; max_tokens: number };
export function useProvider() {
  const [provider, setProvider] = useState<Provider>("openai");
  const [key, setKey] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [model, setModel] = useState("");
  const [tokens, setTokens] = useState(1000);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Preference | null>("/providers/preference")
      .then((p) => {
        if (p) {
          setProvider(p.provider);
          setModel(p.model);
          setTokens(p.max_tokens);
        }
      })
      .catch(() => {});
  }, []);
  function changeProvider(p: Provider) {
    setProvider(p);
    setKey("");
    setModels([]);
    setModel("");
    setConnected(false);
    setStatus("");
  }
  function changeKey(value: string) {
    setKey(value);
    setConnected(false);
    setModels([]);
  }
  async function test() {
    setBusy(true);
    setStatus("");
    setConnected(false);
    try {
      const response = await api<{
        connected: boolean;
        models: ProviderModel[];
        message: string;
      }>("/providers/test", "POST", { provider, api_key: key });
      setModels(response.models);
      setConnected(response.connected);
      setStatus(response.message);
      setModel((current) =>
        response.models.some((m) => m.id === current)
          ? current
          : response.models[0]?.id || "",
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return {
    provider,
    key,
    models,
    model,
    tokens,
    show,
    status,
    connected,
    busy,
    setModel,
    setTokens,
    setShow,
    setStatus,
    setBusy,
    changeProvider,
    changeKey,
    test,
  };
}
type ProviderState = ReturnType<typeof useProvider>;
export function ProviderFormFields({ p }: { p: ProviderState }) {
  return (
    <>
      <label>
        Provider
        <select
          value={p.provider}
          onChange={(e) => p.changeProvider(e.target.value as Provider)}
        >
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </label>
      <label>
        API key
        <div className="key-field">
          <input
            aria-label="API key"
            type={p.show ? "text" : "password"}
            value={p.key}
            onChange={(e) => p.changeKey(e.target.value)}
            placeholder="Paste your personal provider key"
            maxLength={512}
            autoComplete="off"
            spellCheck={false}
            data-lpignore="true"
          />
          <button
            aria-label={p.show ? "Hide API key" : "Show API key"}
            type="button"
            onClick={() => p.setShow(!p.show)}
          >
            {p.show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <span className="helper">
          Held in this page’s memory only. Never saved to browser storage or the
          database.
        </span>
      </label>
      <div className="inline-actions">
        <button
          className="button secondary small"
          type="button"
          disabled={p.busy || p.key.length < 10}
          onClick={p.test}
        >
          <Zap size={13} />
          {p.busy ? "Checking provider…" : "Test connection & load models"}
        </button>
        {p.connected && (
          <span
            style={{
              color: "var(--green)",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Check size={13} />
            Credential accepted
          </span>
        )}
      </div>
      <label>
        Model
        <select
          aria-label="Model"
          value={p.model}
          onChange={(e) => p.setModel(e.target.value)}
          disabled={!p.connected || !p.models.length}
        >
          <option value="">
            {p.connected
              ? "Choose a model"
              : "Test connection to load verified metadata"}
          </option>
          {p.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.id})
            </option>
          ))}
        </select>
        <span className="helper">
          Listing a model does not guarantee text-generation capability,
          inference access, or remaining quota. Provider errors will be shown
          without automatic switching.
        </span>
      </label>
      <label>
        Maximum output tokens
        <input
          aria-label="Maximum output tokens"
          type="number"
          value={p.tokens}
          onChange={(e) => p.setTokens(Number(e.target.value))}
          min={256}
          max={3000}
        />
        <span className="helper">
          256–3,000 output tokens per generation request. This limits output,
          not total provider cost.
        </span>
      </label>
      {p.status && (
        <div
          className={"notice" + (p.connected ? " success" : "")}
          role="status"
        >
          {p.status}
        </div>
      )}
    </>
  );
}
export function ProviderSettings() {
  const p = useProvider();
  const [message, setMessage] = useState("");
  async function save() {
    p.setBusy(true);
    try {
      await api("/providers/preference", "POST", {
        provider: p.provider,
        model: p.model,
        max_tokens: p.tokens,
      });
      setMessage(
        "Default provider and model saved. Your API key was not persisted.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      p.setBusy(false);
    }
  }
  async function remove() {
    p.changeKey("");
    p.setModel("");
    p.setStatus("");
    try {
      await api("/providers/preference", "DELETE");
      setMessage(
        "Provider preferences removed. The key was cleared from page memory.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const current = p.models.find((m) => m.id === p.model);
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-header">
          <h2 style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <KeyRound size={16} />
            Your AI provider
          </h2>
          <span className="pill">BYOK</span>
        </div>
        <div className="panel-body">
          <div className="settings-form">
            <ProviderFormFields p={p} />
            <div className="inline-actions">
              <button
                className="button small"
                onClick={save}
                disabled={p.busy || !p.connected || !p.model}
              >
                Save default preference
              </button>
              <button
                className="button secondary small"
                onClick={remove}
                disabled={p.busy}
              >
                <Trash2 size={13} />
                Clear & disconnect
              </button>
            </div>
            {message && (
              <div className="notice" role="status">
                {message}
              </div>
            )}
            {current && (
              <details>
                <summary style={{ fontSize: 11, cursor: "pointer" }}>
                  Verified model metadata
                </summary>
                <pre>{JSON.stringify(current, null, 2)}</pre>
              </details>
            )}
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h2>Keys stay yours</h2>
          <ShieldCheck size={15} />
        </div>
        <div className="panel-body info-list">
          <div>
            <h3>Ephemeral by default</h3>
            <p>
              Your key is sent to the authenticated backend for each requested
              operation, then used only for your selected provider. Refreshing
              or leaving this page clears it.
            </p>
          </div>
          <div>
            <h3>No automatic paid inference</h3>
            <p>
              The connection test performs authenticated metadata requests. AI
              test generation is a separate action requiring consent from a
              finding page.
            </p>
          </div>
          <div>
            <h3>Provider terms apply</h3>
            <p>
              Code excerpts sent for generation are processed under the selected
              provider’s terms and data handling policies. Review your
              repository’s policy before sending source.
            </p>
          </div>
          <div>
            <h3>Choose deliberately</h3>
            <p>
              No provider switching, shared API account, or promise of unlimited
              free inference. Static analysis runs without AI credentials.
            </p>
          </div>
          <div className="notice">
            Live integration validation requires a real owner-supplied key.
            Adapter tests use controlled HTTP responses.
          </div>
        </div>
      </section>
    </div>
  );
}
export function FindingTest({
  finding,
  runner,
  onVerified,
}: {
  finding: Finding;
  runner: boolean;
  onVerified: () => void;
}) {
  const p = useProvider();
  const [source, setSource] = useState(finding.test_source || "");
  const [consent, setConsent] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const invalid = ["stale", "cancelled", "failed"].includes(
    finding.analysis_state,
  );
  async function generate() {
    setWorking(true);
    setMessage("");
    try {
      const result = await api<{
        source: string;
        usage: unknown;
        notice: string;
      }>("/findings/" + finding.id + "/generate-test", "POST", {
        provider: p.provider,
        api_key: p.key,
        model: p.model,
        max_tokens: p.tokens,
        consent,
      });
      setSource(result.source);
      setReviewed(false);
      setMessage(
        result.notice + "\nReported usage: " + JSON.stringify(result.usage),
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function verify() {
    setWorking(true);
    setMessage("");
    try {
      const result = await api<{ status: string; result: TestResult }>(
        "/findings/" + finding.id + "/verify",
        "POST",
        { source, reviewed: true },
      );
      setMessage("Verification finished: " + result.status + ".");
      onVerified();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="settings-form" style={{ maxWidth: "none" }}>
      <p className="helper">
        Supply a deterministic Python unittest that uses this repository’s
        actual imports, or generate a draft from the pinned code evidence. The
        identical test is compared across all five execution states.
      </p>
      <button
        className="button secondary small"
        type="button"
        onClick={() => setGenerateOpen(!generateOpen)}
        disabled={invalid}
      >
        <Zap size={13} />
        {generateOpen
          ? "Close AI generation"
          : "Generate a draft with your provider"}
      </button>
      {generateOpen && (
        <div
          className="settings-form"
          style={{
            padding: 20,
            border: "1px solid var(--border)",
            borderRadius: 6,
          }}
        >
          <ProviderFormFields p={p} />
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I authorize sending bounded source excerpts to this provider and
              accept any provider usage charges for this request.
            </span>
          </label>
          <button
            className="button small"
            onClick={generate}
            disabled={
              !consent || !p.connected || !p.model || working || invalid
            }
          >
            {working ? "Request in progress…" : "Generate one regression test"}
          </button>
        </div>
      )}
      <label>
        Reviewed test source
        <textarea
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setReviewed(false);
          }}
          placeholder={
            "import unittest\n\nclass IntegrationContractTest(unittest.TestCase):\n    def test_shared_contract(self):\n        # Import actual repository modules and assert expected behavior."
          }
          spellCheck={false}
          style={{
            minHeight: 240,
            fontFamily: "Consolas,monospace",
            fontSize: 12,
          }}
          maxLength={30000}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        <span>
          I reviewed this test’s imports, expected behavior, and relevance to
          the selected interaction.
        </span>
      </label>
      <div className="inline-actions">
        <button
          className="button small"
          onClick={verify}
          disabled={
            !reviewed || !source.trim() || !runner || invalid || working
          }
        >
          <Terminal size={14} />
          {working ? "Waiting for evidence…" : "Run isolated comparison"}
        </button>
        <span className="helper">
          {runner
            ? "Separate runner · network disabled · bounded execution"
            : "Isolated runner not configured. Execution is unavailable."}
        </span>
      </div>
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
