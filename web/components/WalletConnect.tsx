"use client";

import { shortAddress } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

export function WalletConnect() {
  const { address, networkReady, connecting, openPicker, disconnect } = useWallet();

  return <div className="wallet-header">
    {address ? <>
      <button
        type="button"
        className="wallet-trigger wallet-trigger-connected"
        title={address}
        onClick={openPicker}
      >
        <span className={`wallet-indicator${networkReady ? " is-ready" : ""}`} />
        {shortAddress(address)}
      </button>
      <button type="button" className="wallet-disconnect" onClick={disconnect} aria-label="Disconnect wallet">×</button>
    </> : <button type="button" className="wallet-trigger" onClick={openPicker} disabled={connecting}>
      {connecting ? "connecting…" : "connect wallet"}
    </button>}
  </div>;
}
