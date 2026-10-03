"use client";

// Every write goes through here, and through the GenLayer transaction kit.
//
// The kit quotes the fee, shows what is being signed, takes the approval and
// tracks the round to a decision. The app does not sign, does not guess at a
// fee, and does not tell anyone a transaction succeeded before the kit says
// a round decided.

import { useCallback, useMemo, useState } from "react";
import type { SubmitInput, TrackedStatus } from "@genlayer/transaction-kit";
import { GenLayerTransactionPanel } from "@genlayer/transaction-kit-react";
import "@genlayer/transaction-kit-react/styles.css";

import { CHAIN_ID, CONTRACT_SET, NETWORK_NAME, USING_FIXTURES } from "@/lib/chain";
import { browserProvider, transactionKit } from "@/lib/episode";
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
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [trouble, setTrouble] = useState("");

  const kit = useMemo(() => transactionKit(account ?? undefined), [account]);

  const connect = useCallback(async () => {
    setTrouble("");
    if (USING_FIXTURES) {
      setOpen(true);
      return;
    }
    const provider = browserProvider();
    if (!provider) {
      setTrouble(
        "No wallet is injected in this browser. Install a GenLayer-capable " +
          "wallet, or set NEXT_PUBLIC_EPISODE_FIXTURES=1 to work on the pages.",
      );
      return;
    }
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const first = accounts[0];
      if (!first) {
        setTrouble("The wallet returned no account.");
        return;
      }
      setAccount(first as `0x${string}`);
      setOpen(true);
    } catch (error) {
      setTrouble(error instanceof Error ? error.message : "the wallet refused");
    }
  }, []);

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
          onClick={connect}
        >
          {label}
        </button>
        {trouble && <p className="mt-2 text-xs text-refused">{trouble}</p>}
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
