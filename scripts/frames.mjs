// A real PNG, built here, so the seeded demo file carries actual scene frames.
//
// Episode decides what an exhibit is from its bytes, so a placeholder that is
// not a PNG would be filed as paperwork and would ground nothing. Rather than
// pull in an image library for three coloured rectangles, the encoder is
// written out: IHDR, one deflated IDAT, IEND.

import { deflateSync } from "node:zlib";

const CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(kind, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const tagged = Buffer.concat([Buffer.from(kind, "ascii"), body]);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(tagged));
  return Buffer.concat([length, tagged, check]);
}

/**
 * A width x height truecolour PNG. `shade(x, y)` returns [r, g, b], so a frame
 * can carry a little structure rather than being one flat colour -- a flat
 * frame is a frame a model has nothing to say about.
 */
export function png(width, height, shade) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = shade(x, y);
      row[1 + x * 3] = r & 0xff;
      row[2 + x * 3] = g & 0xff;
      row[3 + x * 3] = b & 0xff;
    }
    rows.push(row);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A wide shot: a dark floor with a lighter band where the water line sits. */
export function wideFrame(seed = 0) {
  return png(96, 64, (x, y) => {
    const water = y > 38 && y < 46;
    const grain = ((x * 7 + y * 13 + seed * 29) % 11) - 5;
    if (water) return [120 + grain, 134 + grain, 146 + grain];
    if (y >= 46) return [38 + grain, 44 + grain, 52 + grain];
    return [22 + grain, 24 + grain, 28 + grain];
  });
}

/** A detail shot: close on the tide line, with a vertical edge for scale. */
export function detailFrame(seed = 0) {
  return png(64, 64, (x, y) => {
    const edge = x > 44 && x < 48;
    const grain = ((x * 11 + y * 5 + seed * 17) % 9) - 4;
    if (edge) return [200 + grain, 196 + grain, 186 + grain];
    if (y > 30) return [96 + grain, 108 + grain, 118 + grain];
    return [60 + grain, 56 + grain, 54 + grain];
  });
}

/** An identifier shot: a plate-shaped light block on a dark ground. */
export function identifierFrame(seed = 0) {
  return png(64, 40, (x, y) => {
    const plate = x > 10 && x < 54 && y > 12 && y < 28;
    const grain = ((x * 3 + y * 19 + seed * 23) % 7) - 3;
    return plate
      ? [214 + grain, 212 + grain, 204 + grain]
      : [30 + grain, 32 + grain, 36 + grain];
  });
}
