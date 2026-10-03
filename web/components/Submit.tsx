"use client";

// Every write goes through here.
//
// Stable Studionet uses its matching SDK. Preview chains use the transaction
// kit. Both use the wallet selected in the site header.

import { useEffect, useMemo, useState } from "react";
import type { SubmitInput, TrackedStatus } from "@genlayer/transaction-kit";
import { GenLayerTransactionPanel } from "@genlayer/transaction-kit-react";
import "@genlayer/transaction-kit-react/styles.css";

import { CHAIN_ID, CONTRACT_SET, NETWORK_NAME, USING_FIXTURES } from "@/lib/chain";
import { transactionKit } from "@/lib/episode";
import { useWallet } from "@/lib/wallet";
import { StableSubmit } from "./StableSubmit";

export type SubmitProps = {
  /** What is about to happen, in the user's words, not the method's. */
  title: string;
  /** The call itself. */
  tx: SubmitInput | null;
  /** Value to attach, in wei. A bond or a reserve. */
  value?: bigint;
  /** Why the button is not available yet. */
  blocked?: string | undefined;
  onDone?: (status: TrackedStatus) => void;
  label?: string;
  /** Secondary, so it does not outrank the primary action beside it. */
  tone?: "primary" | "plain";
  /** Sitting in a row of buttons rather than at the end of a block. */
  inline?: boolean;
};

export function Submit(props: SubmitProps) {
  if (!USING_FIXTURES && CHAIN_ID === 61999) return <StableSubmit {...props} />;
  return <PreviewSubmit {...props} />;
}

function PreviewSubmit({
  title,
  tx,
  value = 0n,
  blocked,
  onDone,
  label = "sign and send",
  tone = "primary",
  inline = false,
}: SubmitProps) {
  const [open, setOpen] = useState(false);
  const [waitingForWallet, setWaitingForWallet] = useState(false);
  const { address, provider, openPicker } = useWallet();

  const kit = useMemo(() => transactionKit(address ?? undefined, provider), [address, provider]);

  useEffect(() => {
    if (waitingForWallet && address) {
      setOpen(true);
      setWaitingForWallet(false);
    }
  }, [waitingForWallet, address]);

  function showSubmit() {
    if (USING_FIXTURES) {
      setOpen(true);
      return;
    }
    if (address) {
      setOpen(true);
    } else {
      setWaitingForWallet(true);
      openPicker();
    }
  }

  const gap = inline ? "" : "mt-4";

  if (!CONTRACT_SET && !USING_FIXTURES) {
    return (
      <p className={`inset px-3 py-2 text-sm text-bone-dim ${inline ? "" : "mt-4"}`}>
        <span className="ruleid">no contract</span>
        <span className="ml-2">
          Set NEXT_PUBLIC_EPISODE_CONTRACT to a deployed Episode on{" "}
          {NETWORK_NAME} before sending anything.
        </span>
      </p>
    );
  }

  if (blocked) {
    return (
      <div className={gap}>
        <button type="button" className="press" disabled>
          {label}
        </button>
        <p className="mt-2 text-xs text-bone-ghost">{blocked}</p>
      </div>
    );
  }

  if (!open || !kit || !tx) {
    return (
      <div className={gap}>
        <button
          type="button"
          className={tone === "plain" ? "press" : "press press-filled"}
          onClick={showSubmit}
        >
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className={`kit sheet p-4 ${gap}`}>
      <p className="marginal mb-3">{title}</p>
      <GenLayerTransactionPanel
        kit={kit}
        tx={tx}
        userValue={value}
        network={NETWORK_NAME}
        theme="dark"
        trackUntil="decided"
        onDone={(status) => {
          onDone?.(status);
          if (status.successful) setOpen(false);
        }}
      />
      <button
        type="button"
        className="press mt-3"
        onClick={() => setOpen(false)}
      >
        close
      </button>
    </div>
  );
}
