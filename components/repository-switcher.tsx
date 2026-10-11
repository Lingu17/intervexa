"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readApi, type Repo } from "@/lib/api";

export function RepositorySwitcher() {
  const [repositories, setRepositories] = useState<Repo[]>([]);
  const [error, setError] = useState(false);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    let active = true;
    void readApi<Repo[]>("/repositories").then(data => { if (active) { setRepositories(data); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [path]);
  const selected = repositories.find(r => path.startsWith(`/app/repositories/${r.id}`));
  return <label className="repository-switcher">REPOSITORY
    <select aria-label="Switch repository" value={selected?.id || ""} onChange={e => { if (e.target.value) router.push(`/app/repositories/${e.target.value}/explore`); }}>
      <option value="">{error ? "Open Repositories to retry" : repositories.length ? "Choose a repository" : "Connect a repository"}</option>
      {repositories.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
    </select>
  </label>;
}
