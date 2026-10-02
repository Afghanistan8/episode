import Link from "next/link";

import { CONTRACT_ADDRESS, CONTRACT_SET, NETWORK_NAME, USING_FIXTURES } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

import { Mark } from "./Mark";

const NAV = [
  { href: "/", label: "Episode" },
  { href: "/programmes", label: "Programmes" },
  { href: "/filing", label: "Filings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      {USING_FIXTURES && (
        <div className="bg-ochre/15 border-b border-ochre/30 px-4 py-1.5 text-center">
          <span className="marginal text-ochre">
            fixture mode — these pages are reading a file held in memory, not a chain
          </span>
        </div>
      )}

      <header className="border-b border-rule">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
            <Link href="/" className="flex items-center gap-2.5 text-bone">
              <span className="text-seal">
                <Mark />
              </span>
              <span className="display text-[1.3rem]">Episode</span>
            </Link>

            <nav className="flex items-center gap-5">
              {NAV.slice(1).map((item) => (
                <Link key={item.href} href={item.href} className="marginal hover:text-seal">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-4">
              <span className="marginal">{NETWORK_NAME}</span>
              <span className="tabular text-bone-ghost" title={CONTRACT_ADDRESS}>
                {CONTRACT_SET ? shortAddress(CONTRACT_ADDRESS) : "not deployed"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 border-t border-rule">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <p className="measure text-sm text-bone-faint">
            Did it happen? The file decides, and no single party reads it.
          </p>
          <p className="marginal mt-4">
            Only events that have to be seen. A rating stands on a photograph the
            validators actually saw, or on an independent assessor&rsquo;s
            observation — never on paperwork alone.
          </p>
        </div>
      </footer>
    </div>
  );
}
