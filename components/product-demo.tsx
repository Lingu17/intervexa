"use client";
import { useState } from "react";
const samples = [
  {
    label: "Baseline",
    code: 'def create_session():\n    return {"token": "abc"}\n\ndef original_client():\n    return create_session()  # no token lookup',
    result: "PASS · original behavior",
  },
  {
    label: "PR A only",
    code: 'def create_session():\n    return {"session_id": "abc"}\n\ndef original_client():\n    return create_session()  # still valid',
    result: "PASS · producer changes alone",
  },
  {
    label: "PR B only",
    code: 'def create_session():\n    return {"token": "abc"}\n\ndef new_client():\n    return create_session()["token"]',
    result: "PASS · consumer changes alone",
  },
  {
    label: "A + B",
    code: 'def create_session():\n    return {"session_id": "abc"}\n\ndef new_client():\n    return create_session()["token"]\n    # KeyError: token',
    result: "FAIL · incompatible combined contract",
  },
];
export function ProductDemo() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="product-demo">
      <div className="demo-toolbar">
        <span>CONTRACT EXAMPLE / DEMO DATA</span>
        <span>Python · unittest</span>
      </div>
      <div
        className="tabs"
        role="tablist"
        aria-label="Compare example change states"
      >
        {samples.map((s, i) => (
          <button
            role="tab"
            id={`demo-tab-${i}`}
            aria-selected={selected === i}
            aria-controls="demo-code"
            tabIndex={selected === i ? 0 : -1}
            key={s.label}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => {
              if (
                ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? samples.length - 1
                      : (i +
                          (event.key === "ArrowRight" ? 1 : -1) +
                          samples.length) %
                        samples.length;
                setSelected(next);
                document.getElementById(`demo-tab-${next}`)?.focus();
              }
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <pre
        id="demo-code"
        role="tabpanel"
        aria-labelledby={`demo-tab-${selected}`}
      >
        <code>{samples[selected].code}</code>
      </pre>
      <div
        className={"demo-result " + (selected === 3 ? "failure" : "")}
        aria-live="polite"
      >
        {samples[selected].result}
      </div>
      <p className="helper">
        Illustrative source. Controlled local Git fixtures test this class of
        interaction; this preview does not execute code or report a customer
        finding.
      </p>
    </div>
  );
}
