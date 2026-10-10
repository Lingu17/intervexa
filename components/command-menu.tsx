"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { api, Repo } from "@/lib/api";
export function CommandMenu() {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [repos, setRepos] = useState<Repo[]>([]);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, []);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      api<Repo[]>("/repositories")
        .then(setRepos)
        .catch(() => {});
    } else {
      dialog.current?.close();
    }
  }, [open]);
  const commands = [
    { name: "Workspace overview", href: "/app" },
    { name: "Repositories", href: "/app/repositories" },
    { name: "Analysis history", href: "/app/analyses" },
    { name: "Findings", href: "/app/findings" },
    { name: "Provider settings", href: "/app/settings/providers" },
    { name: "Profile and data", href: "/app/settings/account" },
    { name: "Documentation", href: "/docs" },
    ...repos.map((r) => ({
      name: "Explore " + r.full_name,
      href: `/app/repositories/${r.id}/explore`,
    })),
  ].filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <button
        ref={trigger}
        className="command-trigger"
        onClick={() => setOpen(true)}
        aria-label="Search workspace"
      >
        <Search size={14} />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        onCancel={() => setOpen(false)}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
      >
        <div className="command-head">
          <Search size={18} />
          <input
            autoFocus
            aria-label="Search pages and connected repositories"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a repository or page…"
          />
          <button onClick={() => setOpen(false)} aria-label="Close search">
            <X size={18} />
          </button>
        </div>
        <div className="command-results">
          {commands.map((c) => (
            <Link href={c.href} key={c.href} onClick={() => setOpen(false)}>
              {c.name}
              <span>↵</span>
            </Link>
          ))}
          {!commands.length && (
            <p>No matching pages or connected repositories.</p>
          )}
        </div>
      </dialog>
    </>
  );
}
