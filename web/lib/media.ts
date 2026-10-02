// What bytes are, read off the bytes. Mirrored from `sniff_media`. R-EXH-1.
//
// The app sniffs a file before it is sent so the filer learns, while they can
// still do something about it, that their Exif JPEG will be filed as
// paperwork. The contract sniffs it again on the way in, and again when the
// panel sits, and only the contract's reading counts.

export type Media = "png" | "jpeg" | "other";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JFIF = [0x4a, 0x46, 0x49, 0x46]; // "JFIF"

function matches(bytes: Uint8Array, at: number, want: readonly number[]): boolean {
  if (bytes.byteLength < at + want.length) return false;
  for (let n = 0; n < want.length; n += 1) {
    if (bytes[at + n] !== want[n]) return false;
  }
  return true;
}

/**
 * A scene photograph is a PNG carrying the full eight-byte signature, or a
 * JPEG carrying a JFIF header at offset six. Everything else is paperwork --
 * a photograph of a bill of lading included, and an Exif JPEG included.
 */
export function sniffMedia(bytes: Uint8Array): Media {
  if (matches(bytes, 0, PNG_SIGNATURE)) return "png";
  if (matches(bytes, 0, [0xff, 0xd8, 0xff]) && matches(bytes, 6, JFIF)) return "jpeg";
  return "other";
}

export function isSceneFrame(bytes: Uint8Array): boolean {
  const media = sniffMedia(bytes);
  return media === "png" || media === "jpeg";
}

/** The sha256 the contract will store, so a duplicate can be caught early. */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const hashed = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hashed)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
