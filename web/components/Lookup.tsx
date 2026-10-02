"use client";

// Receipt lookup. Type a filing number, read the finding. No wallet, no
// signing: a receipt is a read, and anyone holding the number can take it.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { describeRefusal, read } from "@/lib/episode";
import type { Receipt } from "@/lib/types";
import { Outcome } from "@/components/ui";

export function Lookup() {
  const router = useRouter();
  const [wanted, setWanted] = useState("");
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState("");
  const [found, setFound] = useState<Receipt | null>(null);

  async function look(event: React.FormEvent) {
    event.preventDefault();
    const id = wanted.trim();
    if (!/^\d+$/.test(id)) {
      setTrouble("A filing number is a whole number, as it appears on the receipt.");
      setFound(null);
      return;
    }
    setBusy(true);
    setTrouble("");
    try {
      setFound(await read<Receipt>("receipt", [Number(id)]));
    } catch (error) {
      setFound(null);
      setTrouble(describeRefusal(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={look} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="marginal">filing number</span>
          <input
            className="field mt-1.5 w-40 tabular"
            inputMode="numeric"
            placeholder="0"
            value={wanted}
            onChange={(event) => setWanted(event.target.value)}
            aria-invalid={trouble ? "true" : undefined}
          />
        </label>
        <button type="submit" className="press" disabled={busy}>
          {busy ? "reading" : "read the receipt"}
        </button>
      </form>

      {trouble && <p className="mt-3 text-sm text-refused">{trouble}</p>}

      {found && (
        <div className="sheet mt-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="marginal">
                filing {found.filing} · {found.kind} · version {found.version}
              </p>
              <p className="display mt-1.5 text-xl">{found.subject}</p>
              <p className="tabular mt-1 text-bone-faint">{found.identifier}</p>
            </div>
            <Outcome outcome={found.outcome} rule={found.rule} />
          </div>
          <div className="hairline mt-4 pt-4">
            <button
              type="button"
              className="press"
              onClick={() => router.push(`/receipt/${found.filing}`)}
            >
              open the receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
