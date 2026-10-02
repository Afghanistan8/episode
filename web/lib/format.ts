// Turning the contract's decimal strings into something readable.

const GEN_DECIMALS = 18n;
const SCALE = 10n ** GEN_DECIMALS;

/** GEN from wei, trimmed, never rounded up into a number that isn't there. */
export function gen(wei: string | bigint, places = 4): string {
  let held: bigint;
  try {
    held = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  } catch {
    return "—";
  }
  const negative = held < 0n;
  if (negative) held = -held;
  const whole = held / SCALE;
  const part = held % SCALE;
  if (part === 0n) return `${negative ? "-" : ""}${group(whole.toString())}`;
  const written = part.toString().padStart(Number(GEN_DECIMALS), "0");
  const shown = written.slice(0, places).replace(/0+$/, "");
  const tail = shown ? `.${shown}` : "";
  return `${negative ? "-" : ""}${group(whole.toString())}${tail}`;
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function wei(value: string): string {
  try {
    return group(BigInt(value || "0").toString());
  } catch {
    return value;
  }
}

/** A window in seconds, as a person would say it. */
export function span(seconds: string | number): string {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "—";
  const day = 24 * 60 * 60;
  if (total % day === 0) {
    const days = total / day;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (total % 3600 === 0) {
    const hours = total / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const minutes = Math.round(total / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function moment(epoch: string | number): string {
  const seconds = Number(epoch);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  return new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 16);
}

/** How long until a deadline, from the contract's own clock. */
export function until(deadline: string | number, now: string | number): string {
  const left = Number(deadline) - Number(now);
  if (!Number.isFinite(left)) return "—";
  if (left <= 0) return "shut";
  return `${span(left)} left`;
}

export function shortAddress(value: string): string {
  if (!value || value.length < 12) return value || "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function shortHash(value: string, head = 10): string {
  if (!value) return "—";
  return value.length <= head + 4 ? value : `${value.slice(0, head)}…`;
}
