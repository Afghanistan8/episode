export const READ_TIMEOUT_MS = 12_000;

/** Bound the visible wait even when the RPC or SDK never settles a request. */
export function withReadDeadline<T>(
  work: () => Promise<T>,
  label: string,
  milliseconds = READ_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(milliseconds / 1000)} seconds.`)),
      milliseconds,
    );
    Promise.resolve().then(work).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
