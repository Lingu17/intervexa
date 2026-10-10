"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="public-content">
      <h1>This page couldn’t load.</h1>
      <p>Retry the page to reconnect to your workspace.</p>
      <button className="button" onClick={reset} style={{ marginTop: 24 }}>
        Try again
      </button>
    </main>
  );
}
