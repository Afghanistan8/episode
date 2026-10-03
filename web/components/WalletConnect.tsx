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
        title={`${address} · ${networkReady ? "Studionet" : "wrong network"}`}
        onClick={openPicker}
      >
        <span className={`wallet-indicator${networkReady ? " is-ready" : ""}`} />
        {shortAddress(address)}
        {!networkReady && <span className="wallet-network-alert">wrong network</span>}
      </button>
      <button type="button" className="wallet-disconnect" onClick={disconnect} aria-label="Disconnect wallet from Episode">×</button>
    </> : <button type="button" className="wallet-trigger" onClick={openPicker} disabled={connecting}>
      {connecting ? "connecting…" : "connect"}
    </button>}
  </div>;
}

export function WalletIdentity() {
  const { address, openPicker } = useWallet();
  return <div className="mt-4 text-sm text-bone-faint">
    <span className="marginal mr-3">signing account</span>
    {address ? <span className="tabular" title={address}>{shortAddress(address)}</span>
      : <button type="button" className="link" onClick={openPicker}>connect a wallet</button>}
  </div>;
}
