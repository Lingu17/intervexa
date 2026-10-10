"use client";
import { useState } from "react";
import { api, Me } from "@/lib/api";
export function AccountSettings({ me }: { me: Me }) {
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState("");
  async function action(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-layout">
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
      <section className="panel panel-body">
        <div className="profile-summary">
          <span className="avatar">
            {me.user.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h3>{me.user.name}</h3>
            <p>{me.user.email} · Personal workspace owner</p>
          </div>
        </div>
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            void action(async () => {
              await api("/settings/profile", "PATCH", values);
              setStatus(
                "Profile saved. Reload the workspace to update navigation.",
              );
            });
          }}
        >
          <label>
            Display name
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={me.user.name}
            />
          </label>
          <label>
            Workspace name
            <input
              name="workspace_name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={me.organization.name}
            />
          </label>
          <button className="button small" disabled={busy}>
            Save profile
          </button>
        </form>
      </section>
      <section className="panel panel-body">
        <h3>Link a social identity</h3>
        <p>
          Authenticate with Google or GitHub while signed into this account.
          Matching email addresses alone never link accounts.
        </p>
        <div className="inline-actions">
          {["google", "github"].map((provider) => (
            <button
              className="button secondary small"
              key={provider}
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const caps =
                    await api<Record<string, boolean>>("/auth/capabilities");
                  if (!caps[provider])
                    throw new Error(
                      `${provider} OAuth is not configured. See Documentation → OAuth.`,
                    );
                  window.location.href = `/api/auth/oauth/${provider}?link=true&origin=${encodeURIComponent(window.location.origin)}`;
                })
              }
            >
              Link {provider}
            </button>
          ))}
        </div>
      </section>
      <section className="panel panel-body">
        <h3>Export your workspace</h3>
        <p>
          Download account, repository policies and the latest 500 analyses,
          findings and test evidence. Credentials and sessions are excluded.
        </p>
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const data = await api("/settings/export");
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "intervexa-workspace.json";
              a.click();
              URL.revokeObjectURL(url);
              setStatus("Export downloaded.");
            })
          }
        >
          Download JSON export
        </button>
      </section>
      <section className="panel panel-body">
        <h3>Delete this personal account</h3>
        <p>
          Removes the local account, workspace, repository indexes and analysis
          evidence. Revoke GitHub grants separately. This cannot be undone.
        </p>
        <label>
          Type your exact email to confirm
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="button danger small"
          disabled={busy || confirmation !== me.user.email}
          onClick={() =>
            void action(async () => {
              await api("/settings/account", "DELETE", { confirmation });
              window.location.href = "/login";
            })
          }
        >
          Delete account and workspace
        </button>
      </section>
    </div>
  );
}
