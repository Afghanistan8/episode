"use client";

// One hook for reading the contract, so every page handles a refusal the same
// way: the contract's own sentence, shown where the thing would have been.

import { useCallback, useEffect, useState } from "react";
import type { CalldataEncodable } from "genlayer-js/types";

import { describeRefusal, read } from "./episode";

export type Reading<T> = {
  value: T | null;
  busy: boolean;
  error: string;
  reload: () => void;
};

export function useRead<T>(
  functionName: string | null,
  args: CalldataEncodable[] = [],
): Reading<T> {
  const [value, setValue] = useState<T | null>(null);
  const [busy, setBusy] = useState(functionName !== null);
  const [error, setError] = useState("");
  const [turn, setTurn] = useState(0);
  const key = JSON.stringify(args, (_, held) =>
    typeof held === "bigint" ? held.toString() : held,
  );

  useEffect(() => {
    if (functionName === null) {
      setBusy(false);
      return;
    }
    let live = true;
    setBusy(true);
    setError("");
    read<T>(functionName, JSON.parse(key) as CalldataEncodable[])
      .then((held) => {
        if (live) setValue(held);
      })
      .catch((trouble) => {
        if (live) {
          setValue(null);
          setError(describeRefusal(trouble));
        }
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [functionName, key, turn]);

  const reload = useCallback(() => setTurn((n) => n + 1), []);
  return { value, busy, error, reload };
}

/** A count, then one read per index. Used for the programme and filing lists. */
export function useList<T>(
  countFn: string,
  itemFn: string,
  reloadKey = 0,
): { rows: T[]; busy: boolean; error: string; reload: () => void } {
  const [rows, setRows] = useState<T[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    (async () => {
      const count = Number(await read<number | string>(countFn, []));
      const wanted = Number.isFinite(count) ? count : 0;
      const held = await Promise.all(
        Array.from({ length: wanted }, (_, index) => read<T>(itemFn, [index])),
      );
      if (live) setRows(held);
    })()
      .catch((trouble) => {
        if (live) {
          setRows([]);
          setError(describeRefusal(trouble));
        }
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [countFn, itemFn, turn, reloadKey]);

  const reload = useCallback(() => setTurn((n) => n + 1), []);
  return { rows, busy, error, reload };
}
