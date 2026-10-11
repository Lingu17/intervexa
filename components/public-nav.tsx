"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "./logo";
export function PublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-nav">
      <Link href="/" aria-label="Intervexa home">
        <Logo />
      </Link>
      <button className="public-menu" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>{open ? <X size={18}/> : <Menu size={18}/>}</button>
      <nav id="public-navigation" className={open ? "is-open" : ""} onClick={() => setOpen(false)}>
        <Link href="/product">Product</Link>
        <a href="/#how-to-use">How it works</a>
        <Link href="/architecture">Architecture</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/docs">Docs</Link>
      </nav>
      <div className="nav-actions">
        <Link href="/login">Sign in</Link>
        <Link href="/register" className="button small">
          Create workspace <ArrowUpRight size={14} />
        </Link>
      </div>
    </header>
  );
}
