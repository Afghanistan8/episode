"use client";

import { useEffect, useState } from "react";
import { createClient } from "genlayer-js-stable";
import { studionet } from "genlayer-js-stable/chains";
import { TransactionStatus } from "genlayer-js-stable/types";

import { CONTRACT_SET, NETWORK_NAME, RPC_URL } from "@/lib/chain";
import { describeRefusal } from "@/lib/episode";
import { gen } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

import type { SubmitProps } from "./Submit";

const reader = createClient({ chain: studionet, endpoint: RPC_URL });

type StudioTransaction = {
  statusName?: string;
  result_name?: string;
  resultName?: string;
  consensus_data?: {
    leader_receipt?: Array<{
      execution_result?: string;
      result?: { status?: string };
    }>;
  };
};

function successful(transaction: StudioTransaction): boolean {
  const receipt = transaction.consensus_data?.leader_receipt;
  const leader = Array.isArray(receipt) ? receipt[0] : receipt;
  return transaction.statusName === "FINALIZED" &&
    (transaction.result_name ?? transaction.resultName) === "MAJORITY_AGREE" &&
    leader?.execution_result === "SUCCESS" &&
    leader?.result?.status === "return";
}

export function StableSubmit({
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
  const { address: account, provider, openPicker, ensureNetwork } = useWallet();
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [working, setWorking] = useState(false);
  const [finished, setFinished] = useState(false);
  const [trouble, setTrouble] = useState("");
  const gap = inline ? "" : "mt-4";

  useEffect(() => {
    if (waitingForWallet && account) {
      setOpen(true);
      setWaitingForWallet(false);
    }
  }, [waitingForWallet, account]);

  function showSubmit() {
    setTrouble("");
    if (account) setOpen(true);
    else {
      setWaitingForWallet(true);
      openPicker();
    }
  }

  async function track(txHash: `0x${string}`) {
    setWorking(true);
    setTrouble("");
    try {
      await reader.waitForTransactionReceipt({
        hash: txHash as Parameters<typeof reader.waitForTransactionReceipt>[0]["hash"],
        status: TransactionStatus.FINALIZED,
        retries: 120,
      });
      const transaction = await reader.getTransaction({
        hash: txHash as Parameters<typeof reader.getTransaction>[0]["hash"],
      });
      const studio = transaction as unknown as StudioTransaction;
      if (!successful(studio)) {
        throw new Error(`Studionet finalized the transaction as ${studio.result_name ?? studio.resultName ?? "unknown"}.`);
      }
      setFinished(true);
      onDone?.({
        phase: "finalized",
        statusName: studio.statusName,
        executionResultName: "FINISHED_WITH_RETURN",
        successful: true,
        genlayerTxId: txHash,
      });
    } catch (error) {
      setTrouble(`${describeRefusal(error)} The transaction ID is saved here; check its status before sending again.`);
    } finally {
      setWorking(false);
    }
  }

  async function submit() {
    if (hash || !account || !provider || !tx || tx.kind !== "write") return;
    setWorking(true);
    setTrouble("");
    try {
      await ensureNetwork();
      const wallet = createClient({ chain: studionet, endpoint: RPC_URL, provider, account });
      const txHash = await wallet.writeContract({
        address: tx.address,
        functionName: tx.method,
        args: tx.args as Parameters<typeof wallet.writeContract>[0]["args"],
        value,
      });
      setHash(txHash);
      setWorking(false);
      await track(txHash);
    } catch (error) {
      setTrouble(describeRefusal(error));
      setWorking(false);
    }
  }

  if (!CONTRACT_SET) {
    return <p className={`inset px-3 py-2 text-sm text-bone-dim ${gap}`}>
      Set NEXT_PUBLIC_EPISODE_CONTRACT to the deployed Episode address before sending.
    </p>;
  }
  if (blocked) {
    return <div className={gap}>
      <button type="button" className="press" disabled>{label}</button>
      <p className="mt-2 text-xs text-bone-ghost">{blocked}</p>
    </div>;
  }
  if (!open || !tx || !account) {
    return <div className={gap}>
      <button type="button" className={tone === "plain" ? "press" : "press press-filled"} onClick={showSubmit}>{label}</button>
      {trouble && <p className="mt-2 text-xs text-refused">{trouble}</p>}
    </div>;
  }

  return <div className={`kit sheet p-4 ${gap}`}>
    <p className="marginal mb-3">{title}</p>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-bone-faint">network</dt><dd>{NETWORK_NAME}</dd></div>
      <div><dt className="text-bone-faint">method</dt><dd className="tabular">{tx.kind === "write" ? tx.method : "deploy"}</dd></div>
      <div><dt className="text-bone-faint">wallet</dt><dd className="tabular break-all">{account}</dd></div>
      <div><dt className="text-bone-faint">value sent</dt><dd className="tabular">{gen(value.toString())} GEN</dd></div>
    </dl>
    {hash && <p className="mt-4 break-all text-xs text-bone-faint">
      Transaction: <a className="text-seal underline" href={`https://explorer-studio.genlayer.com/tx/${hash}`} target="_blank" rel="noreferrer">{hash}</a>
    </p>}
    {trouble && <p className="mt-4 text-sm text-refused" role="alert">{trouble}</p>}
    {finished && <p className="mt-4 text-sm text-established" role="status">Finalized successfully on Studionet.</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      {!hash && <button type="button" className="press press-filled" disabled={working || tx.kind !== "write"} onClick={submit}>
        {working ? "waiting for wallet…" : "confirm in wallet"}
      </button>}
      {hash && !finished && <button type="button" className="press press-filled" disabled={working} onClick={() => track(hash)}>
        {working ? "waiting for finalization…" : "check transaction status"}
      </button>}
      <button type="button" className="press" onClick={() => setOpen(false)}>close</button>
    </div>
  </div>;
}
