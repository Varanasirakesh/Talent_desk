import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "@/styles/app.css";
import "@/styles/hr.css";
import "@/styles/portal.css";

export const metadata: Metadata = {
  title: "Talent Desk · nFinity",
  description:
    "A private, browser-based workspace for reviewing resume evidence and planning onboarding.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="desk-header">
          <div className="desk-container desk-header-inner">
            <Link className="desk-brand" href="/" aria-label="Talent Desk home">
              <span className="desk-brand-mark" aria-hidden="true">
                T
              </span>
              <span>
                <strong>Talent Desk</strong>
                <small>by nFinity</small>
              </span>
            </Link>
            <div className="desk-header-right">
              <span className="desk-session">
                <span aria-hidden="true" /> Private browser session
              </span>
            </div>
          </div>
        </header>
        {children}
        <footer className="desk-footer">
          <div className="desk-container">
            <strong>Talent Desk</strong>
            <span>
              Resume evidence supports a human decision. Your session resets on
              refresh; export anything you need to keep.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
