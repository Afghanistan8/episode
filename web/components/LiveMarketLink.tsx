"use client";

import Link from "next/link";

import { useList } from "@/lib/hooks";
import type { Programme } from "@/lib/types";

const LIVE_KIND = "gala-venue-water";

export function LiveMarketLink() {
  const programmes = useList<Programme>("programme_count", "programme");
  const gala = programmes.rows.find((programme) => programme.kind === LIVE_KIND);

  if (programmes.busy) {
    return <p className="marginal mt-3">Reading the live market…</p>;
  }
  if (!gala) {
    return <p className="marginal mt-3">The live gala venue programme is unavailable.</p>;
  }
  return (
    <p className="marginal mt-3">
      Live market ·{" "}
      <Link className="link" href={`/filing?programme=${gala.programme}`}>
        {gala.kind} · programme {gala.programme} · version {gala.current_version}
      </Link>
    </p>
  );
}
