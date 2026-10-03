"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/programmes", label: "Programmes" },
  { href: "/filing", label: "Filings" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Main navigation">
      {NAV.map(({ href, label }) => {
        const active = href === "/" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`site-nav-link${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
