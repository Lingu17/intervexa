import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "./logo";
export function PublicNav() {
  return (
    <header className="public-nav">
      <Link href="/" aria-label="Intervexa home">
        <Logo />
      </Link>
      <nav>
        <Link href="/product">Product</Link>
        <Link href="/#how-to-use">How to use</Link>
        <Link href="/architecture">Architecture</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/docs">Docs</Link>
      </nav>
      <div className="nav-actions">
        <Link href="/login">Sign in</Link>
        <Link href="/register" className="button small">
          Get started <ArrowUpRight size={14} />
        </Link>
      </div>
    </header>
  );
}
