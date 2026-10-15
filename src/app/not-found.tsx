import Link from "next/link";

export default function NotFound() {
  return (
    <main className="desk-container desk-not-found">
      <span className="desk-eyebrow">PAGE NOT FOUND</span>
      <h1>There is nothing here.</h1>
      <p>Open Talent Desk to review a role and your candidate pool.</p>
      <Link className="btn" href="/">
        Go to Talent Desk
      </Link>
    </main>
  );
}
