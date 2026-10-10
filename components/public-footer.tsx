import Link from "next/link";
import { Logo } from "./logo";
export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Logo />
        <p>Every change. Every interaction. Verified.</p>
        <small>© {new Date().getFullYear()} Intervexa · Early access</small>
      </div>
      {Object.entries({
        Product: [
          ["Overview", "/product"],
          ["Repository intelligence", "/repository-intelligence"],
          ["PR analysis", "/pr-analysis"],
          ["Architecture", "/architecture"],
          ["Pricing", "/pricing"],
        ],
        Resources: [
          ["Documentation", "/docs"],
          ["How it works", "/how-it-works"],
          ["Supported scope", "/supported"],
          ["FAQ", "/faq"],
          ["Status & support", "/status"],
          ["Contact", "/contact"],
        ],
        Trust: [
          ["Security", "/security"],
          ["Privacy", "/privacy"],
          ["Terms", "/terms"],
          ["Acceptable use", "/acceptable-use"],
        ],
      }).map(([title, links]) => (
        <div key={title}>
          <strong>{title}</strong>
          {links.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
      ))}
    </footer>
  );
}
