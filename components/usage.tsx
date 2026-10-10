"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
type Usage = {
  repositories: number;
  analyses: number;
  limits: Record<string, number>;
  notice: string;
};
export function UsagePage() {
  const [data, setData] = useState<Usage>(),
    [error, setError] = useState("");
  useEffect(() => {
    api<Usage>("/settings/usage")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Usage & limits</h1>
          <p>Retained workspace records and explicit processing bounds.</p>
        </div>
        <Link className="button secondary small" href="/app/settings/providers">
          Provider settings →
        </Link>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {data ? (
        <>
          <div className="readiness-bar">
            <span>{data.repositories} connected repositories</span>
            <span>{data.analyses} retained analyses</span>
          </div>
          <section className="panel">
            {Object.entries(data.limits).map(([label, value]) => (
              <div className="row" key={label}>
                <span className="row-main">{label}</span>
                <code>{value}</code>
              </div>
            ))}
          </section>
          <p className="notice">{data.notice}</p>
          <Link href="/supported" className="text-link">
            Execution and language limitations →
          </Link>
        </>
      ) : (
        !error && <div className="skeleton" />
      )}
    </>
  );
}
