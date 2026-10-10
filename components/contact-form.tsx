"use client";
import { useState } from "react";
import { api } from "@/lib/api";
export function ContactForm() {
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await api<{ message: string }>(
        "/contact",
        "POST",
        Object.fromEntries(new FormData(form)),
      );
      setStatus(result.message);
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="form-pair">
        <label>
          Name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>
      </div>
      <label>
        Topic
        <select name="topic">
          <option value="product">Product question</option>
          <option value="feedback">Feedback</option>
          <option value="early-access">Early access</option>
          <option value="support">Support</option>
          <option value="privacy">Privacy request</option>
        </select>
      </label>
      <label>
        Message
        <textarea
          name="message"
          required
          minLength={20}
          maxLength={5000}
          rows={5}
          placeholder="Tell us what you’re building and where you need help."
        />
      </label>
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className="helper">
        Submissions are stored for up to 90 days. Email delivery and response
        timing are not configured. <a href="/privacy">Privacy details</a>.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? "Recording…" : "Submit message"}
      </button>
    </form>
  );
}
