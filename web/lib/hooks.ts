"use client";

// One hook for reading the contract, so every page handles a refusal the same
// way: the contract's own sentence, shown where the thing would have been.

import { useCallback, useEffect, useState } from "react";
import type { CalldataEncodable } from "genlayer-js/types";

import { read, readDiagnostic } from "./episode";
import { withReadDeadline } from "./read-deadline";

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
  const [turn, setTurn] = useState(0);
  const key = JSON.stringify(args, (_, held) =>
    typeof held === "bigint" ? held.toString() : held,
  );
  const requestKey = `${functionName ?? ""}:${key}:${turn}`;
  const [reading, setReading] = useState({
    key: requestKey,
    value: null as T | null,
    busy: functionName !== null,
    error: "",
  });

  useEffect(() => {
    if (functionName === null) {
      setReading({ key: requestKey, value: null, busy: false, error: "" });
      return;
    }
    let live = true;
    setReading({ key: requestKey, value: null, busy: true, error: "" });
    read<T>(functionName, JSON.parse(key) as CalldataEncodable[])
      .then((held) => {
        if (live) setReading({ key: requestKey, value: held, busy: false, error: "" });
      })
      .catch((trouble) => {
        if (live) {
          setReading({ key: requestKey, value: null, busy: false, error: readDiagnostic(trouble) });
        }
      });
    return () => {
      live = false;
    };
  }, [functionName, key, requestKey]);

  const reload = useCallback(() => setTurn((n) => n + 1), []);
  const current = reading.key === requestKey
    ? reading
    : { value: null, busy: functionName !== null, error: "" };
  return { value: current.value, busy: current.busy, error: current.error, reload };
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
    withReadDeadline(async () => {
      const count = Number(await read<number | string>(countFn, []));
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(`${countFn} returned an invalid count.`);
      }
      return Promise.all(
        Array.from({ length: count }, (_, index) => read<T>(itemFn, [index])),
      );
    }, `${itemFn} list`)
      .then((held) => {
        if (live) setRows(held);
      })
      .catch((trouble) => {
        if (live) {
          setRows([]);
          setError(readDiagnostic(trouble));
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
