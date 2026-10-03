import Link from "next/link";

import { CONTRACT_ADDRESS, CONTRACT_SET, NETWORK_NAME, USING_FIXTURES } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

import { Mark } from "./Mark";
import { NavLinks } from "./NavLinks";
import { WalletConnect } from "./WalletConnect";

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

      <header className="site-header">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="site-header-inner">
            <Link href="/" className="site-brand" aria-label="Episode home">
              <span className="site-brand-mark">
                <Mark />
              </span>
              <span className="site-brand-name">Episode</span>
              <span className="site-brand-caption">Evidence in view</span>
            </Link>

            <NavLinks />

            <div className="site-status" title={CONTRACT_ADDRESS}>
              <span className={`site-status-dot${CONTRACT_SET ? " is-live" : ""}`} />
              <span className="site-status-network">{NETWORK_NAME}</span>
              <span className="site-status-detail">
                {CONTRACT_SET ? shortAddress(CONTRACT_ADDRESS) : "Contract pending"}
              </span>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {!USING_FIXTURES && !CONTRACT_SET && (
        <div className="deployment-note" role="status">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            Episode is in preview. Live programme and filing actions will be available after the Studionet contract is deployed.
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="site-footer">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-9 sm:px-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="site-footer-title">Episode</p>
            <p className="mt-2 max-w-xl text-sm text-bone-faint">
              A traceable finding for visible loss and disruption.
            </p>
          </div>
          <div className="site-footer-links">
            <Link href="/programmes">Programmes</Link>
            <Link href="/filing">Filings</Link>
            <span>{NETWORK_NAME}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
