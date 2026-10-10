import Link from "next/link";
export default function NotFound() {
  return (
    <main className="public-content">
      <div className="eyebrow">404 / PAGE NOT FOUND</div>
      <h1>This path doesn’t connect.</h1>
      <p>The page may have moved or the address is incomplete.</p>
      <Link href="/" className="button" style={{ marginTop: 25 }}>
        Return to Intervexa
      </Link>
    </main>
  );
}
