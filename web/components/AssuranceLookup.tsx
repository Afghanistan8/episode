"use client";

import { useState } from "react";

import {
  CAPITAL_POOL_CONTRACT,
  INTEGRITY_CONTRACT,
  MILESTONE_SET,
  POLICY_GUARD_CONTRACT,
  TRUTH_CONTRACT,
} from "@/lib/chain";
import { read, readAt } from "@/lib/episode";
import type { IntegritySignal, PolicyReview, Receipt, SupplementalPool, TruthFinding } from "@/lib/types";

type Report = {
  truth: TruthFinding;
  integrity: IntegritySignal;
  policy: PolicyReview;
  pool: SupplementalPool;
};

function State({ label, value }: { label: string; value: string }) {
  const tone = value === "CLEAR" || value === "PASS" || value === "CORROBORATED"
    ? "text-established" : value === "NONE" ? "text-bone-ghost" : "text-ochre";
  return <div><p className="marginal">{label}</p><p className={`mt-1 text-lg ${tone}`}>{value}</p></div>;
}

export function AssuranceLookup() {
  const [filing, setFiling] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [trouble, setTrouble] = useState("");
  const [busy, setBusy] = useState(false);

  async function inspect(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d+$/.test(filing.trim())) {
      setTrouble("Enter a whole Episode filing number.");
      return;
    }
    setBusy(true);
    setTrouble("");
    try {
      const filingId = Number(filing);
      const receipt = await read<Receipt>("receipt", [filingId]);
      const programme = Number(receipt.programme);
      const version = Number(receipt.version);
      const [truth, integrity, policy, pool] = await Promise.all([
        readAt<TruthFinding>(TRUTH_CONTRACT, "finding", [filingId]),
        readAt<IntegritySignal>(INTEGRITY_CONTRACT, "signal", [filingId]),
        readAt<PolicyReview>(POLICY_GUARD_CONTRACT, "review_of", [programme, version]),
        readAt<SupplementalPool>(CAPITAL_POOL_CONTRACT, "pool", [programme]),
      ]);
      setReport({ truth, integrity, policy, pool });
    } catch (error) {
      setReport(null);
      setTrouble(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  if (!MILESTONE_SET) {
    return (
      <div className="inset mt-6 p-5">
        <p className="marginal">companion deployment pending</p>
        <p className="measure mt-2 text-sm text-bone-faint">
          Episode&apos;s live contract remains unchanged. This assurance surface activates after the four companion addresses are supplied to the deployment environment.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <form onSubmit={inspect} className="flex flex-wrap items-end gap-3">
        <label className="block"><span className="marginal">filing number</span>
          <input className="field mt-1.5 w-40 tabular" inputMode="numeric" value={filing} onChange={(event) => setFiling(event.target.value)} placeholder="0" />
        </label>
        <button type="submit" className="press" disabled={busy}>{busy ? "reading" : "read assurance"}</button>
      </form>
      {trouble && <p className="mt-3 text-sm text-refused">{trouble}</p>}
      {report && <div className="sheet mt-5 grid gap-5 p-5 sm:grid-cols-2">
        <State label="trusted-source truth" value={report.truth.status} />
        <State label="integrity graph" value={report.integrity.status} />
        <State label="policy guard" value={report.policy.status} />
        <State label="supplemental pool" value={report.pool.active ? "ACTIVE" : "NONE"} />
        <div><p className="marginal">source matches</p><p className="mt-1 tabular text-lg">{report.truth.matches} / {report.truth.checked}</p></div>
        <div><p className="marginal">integrity reason</p><p className="mt-1 text-lg text-bone-dim">{report.integrity.reason || "none"}</p></div>
        <div><p className="marginal">pool benefit, wei</p><p className="mt-1 tabular text-lg">{report.pool.benefit}</p></div>
        {report.policy.flags.length > 0 && <div className="sm:col-span-2"><p className="marginal">policy review notes</p><ul className="mt-2 space-y-1 text-sm text-bone-dim">{report.policy.flags.map((flag) => <li key={flag}>— {flag}</li>)}</ul></div>}
        {report.integrity.related_filing && <div><p className="marginal">related filing</p><p className="mt-1 tabular text-lg">{report.integrity.related_filing}</p></div>}
      </div>}
    </div>
  );
}
