"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { api, setCsrf, readApi } from "@/lib/api";
import { Logo } from "./logo";
import { Graph } from "./graph";
const schema = z.object({
  email: z.email(),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
  name: z.string().max(100),
});
export function Auth({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [social, setSocial] = useState<{ google: boolean; github: boolean }>();
  const [connectionError, setConnectionError] = useState(false);
  useEffect(() => {
    readApi<{ google: boolean; github: boolean }>("/auth/capabilities")
      .then(setSocial)
      .catch(() => setConnectionError(true));
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    const result = schema.safeParse({
      email: data.get("email"),
      password: data.get("password"),
      name: data.get("name") || "",
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const response = await api<{ csrf: string }>(
        "/auth/" + (register ? "register" : "login"),
        "POST",
        result.data,
      );
      setCsrf(response.csrf);
      void readApi("/me", true).catch(() => {});
      router.push("/app");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link href="/">
          <Logo />
        </Link>
        <div>
          <div className="eyebrow">
            EVERY CHANGE. EVERY INTERACTION. VERIFIED.
          </div>
          <h1>
            See what happens
            <br />
            between the changes.
          </h1>
          <p>
            A shared workspace for your repositories, integration hypotheses,
            and reproduction evidence.
          </p>
          <Graph />
        </div>
        <p className="helper">
          Your source stays scoped to your workspace. Provider keys are never
          stored.
        </p>
      </section>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <div className="eyebrow">YOUR ENGINEERING WORKSPACE</div>
          <h2 style={{ marginTop: 18 }}>
            {register ? "Start with Intervexa" : "Welcome back"}
          </h2>
          <p>
            {register
              ? "Create your account, then connect your first repository."
              : "Sign in to inspect your repository interactions."}
          </p>
          <div className="social-buttons">
            {(["google", "github"] as const).map((provider) => (
              <button
                key={provider}
                className="button secondary"
                disabled={social !== undefined && !social[provider]}
                onClick={() => {
                  window.location.href = `/api/auth/oauth/${provider}?origin=${encodeURIComponent(window.location.origin)}`;
                }}
              >
                Continue with {provider === "google" ? "Google" : "GitHub"}
              </button>
            ))}
          </div>
          {connectionError && (
            <p className="helper">
              The service is waking up. You can still continue with Google or
              GitHub.
            </p>
          )}
          {social && (!social.google || !social.github) && (
            <p className="helper">
              Unavailable social providers need owner setup.{" "}
              <Link href="/docs#oauth">Configuration guide →</Link>
            </p>
          )}
          <form onSubmit={submit}>
            {register && (
              <label>
                Full name
                <input
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  maxLength={100}
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@gmail.com"
                maxLength={254}
              />
            </label>
            <label>
              Password
              <div className="key-field">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder="At least 12 characters"
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <button className="button" disabled={busy}>
              {busy ? "Connecting…" : register ? "Create workspace" : "Sign in"}{" "}
              <ArrowRight size={15} />
            </button>
          </form>
          <div className="auth-foot">
            {register ? "Already have an account?" : "New to Intervexa?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create a workspace"}
            </Link>
          </div>
          <p className="helper" style={{ textAlign: "center", marginTop: 25 }}>
            Personal email is welcome.{" "}
            <Link href="/forgot-password">Password recovery status</Link>. Use a
            unique password.
          </p>
        </div>
      </div>
    </div>
  );
}
