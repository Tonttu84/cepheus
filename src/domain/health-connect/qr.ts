type VersionSpec = readonly [
  totalCodewords: number,
  ecPerBlock: number,
  g1Blocks: number,
  g1Data: number,
  g2Blocks: number,
  g2Data: number,
  alignCenters: readonly number[],
];

// ISO/IEC 18004 ECC-L table for Versions 1..12
const VERSION_SPECS: readonly VersionSpec[] = [
  [26, 7, 1, 19, 0, 0, []],
  [44, 10, 1, 34, 0, 0, [6, 18]],
  [70, 15, 1, 55, 0, 0, [6, 22]],
  [100, 20, 1, 80, 0, 0, [6, 26]],
  [134, 26, 1, 108, 0, 0, [6, 30]],
  [172, 18, 2, 68, 0, 0, [6, 34]],
  [196, 20, 2, 78, 0, 0, [6, 22, 38]],
  [242, 24, 2, 97, 0, 0, [6, 24, 42]],
  [292, 30, 2, 116, 0, 0, [6, 26, 46]],
  [346, 18, 2, 68, 2, 69, [6, 28, 50]],
  [404, 20, 4, 81, 0, 0, [6, 30, 54]],
  [466, 24, 2, 92, 2, 93, [6, 32, 58]],
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeEcCodewords(data: readonly number[], ecCount: number): number[] {
  const gen = buildGeneratorPoly(ecCount);
  const rem = new Array<number>(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) rem[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const factor = rem[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      rem[i + j] ^= gfMul(gen[j], factor);
    }
  }
  return rem.slice(data.length);
}

function encodeUtf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

function selectVersion(byteLen: number): number {
  for (let v = 1; v <= VERSION_SPECS.length; v++) {
    const [, , g1b, g1d, g2b, g2d] = VERSION_SPECS[v - 1];
    const dataCap = g1b * g1d + g2b * g2d;
    const headerBits = 4 + (v <= 9 ? 8 : 16);
    if (headerBits + byteLen * 8 <= dataCap * 8) return v;
  }
  throw new RangeError(`QR payload too long (${byteLen} bytes, max supported ~360 bytes)`);
}

function buildDataCodewords(bytes: readonly number[], version: number): number[] {
  const [, , g1b, g1d, g2b, g2d] = VERSION_SPECS[version - 1];
  const dataCap = g1b * g1d + g2b * g2d;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = dataCap * 8;
  const term = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
    codewords.push(byte);
  }

  let padIdx = 0;
  while (codewords.length < dataCap) {
    codewords.push(padIdx % 2 === 0 ? 0xec : 0x11);
    padIdx++;
  }
  return codewords;
}

function interleaveCodewords(data: readonly number[], version: number): number[] {
  const [, ecPerBlock, g1b, g1d, g2b, g2d] = VERSION_SPECS[version - 1];
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;

  for (let i = 0; i < g1b; i++) {
    const block = data.slice(offset, offset + g1d);
    offset += g1d;
    dataBlocks.push(block);
    ecBlocks.push(computeEcCodewords(block, ecPerBlock));
  }
  for (let i = 0; i < g2b; i++) {
    const block = data.slice(offset, offset + g2d);
    offset += g2d;
    dataBlocks.push(block);
    ecBlocks.push(computeEcCodewords(block, ecPerBlock));
  }

  const out: number[] = [];
  const maxDataLen = Math.max(g1d, g2d);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) out.push(blk[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const blk of ecBlocks) out.push(blk[i]);
  }
  return out;
}

interface QrGrid {
  readonly size: number;
  readonly modules: boolean[][];
  readonly reserved: boolean[][];
}

function createGrid(size: number): QrGrid {
  return {
    size,
    modules: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    reserved: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
}

function setFunctionModule(grid: QrGrid, r: number, c: number, dark: boolean): void {
  if (r < 0 || r >= grid.size || c < 0 || c >= grid.size) return;
  grid.modules[r][c] = dark;
  grid.reserved[r][c] = true;
}

function isFinderDark(dr: number, dc: number): boolean {
  const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
  if (!inOuter) return false;
  const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
  const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
  return onBorder || inInner;
}

function placeFinderPattern(grid: QrGrid, top: number, left: number): void {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      setFunctionModule(grid, top + dr, left + dc, isFinderDark(dr, dc));
    }
  }
}

function placeSingleAlignment(grid: QrGrid, r0: number, c0: number): void {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const dark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
      setFunctionModule(grid, r0 + dr, c0 + dc, dark);
    }
  }
}

function placeAlignmentPatterns(grid: QrGrid, centers: readonly number[]): void {
  for (const r0 of centers) {
    for (const c0 of centers) {
      if (!grid.reserved[r0][c0]) placeSingleAlignment(grid, r0, c0);
    }
  }
}

function placeTimingAndDarkModule(grid: QrGrid, version: number): void {
  for (let i = 8; i < grid.size - 8; i++) {
    const dark = i % 2 === 0;
    if (!grid.reserved[6][i]) setFunctionModule(grid, 6, i, dark);
    if (!grid.reserved[i][6]) setFunctionModule(grid, i, 6, dark);
  }
  setFunctionModule(grid, 4 * version + 9, 8, true);
}

function reserveFormatAndVersion(grid: QrGrid, version: number): void {
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      grid.reserved[8][i] = true;
      grid.reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    grid.reserved[8][grid.size - 1 - i] = true;
    grid.reserved[grid.size - 1 - i][8] = true;
  }
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >> i) & 1) === 1;
      const a = grid.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(grid, a, b, dark);
      setFunctionModule(grid, b, a, dark);
    }
  }
}

function writeFormatInfo(grid: QrGrid): void {
  // ECC-L (01) + Mask 0 (000) -> 0x77c4 (bit 0 = LSB, bit 14 = MSB per ISO/IEC 18004)
  const formatBits = 0x77c4;
  for (let i = 0; i < 15; i++) {
    const dark = ((formatBits >> i) & 1) === 1;
    if (i < 6) {
      setFunctionModule(grid, i, 8, dark);
    } else if (i === 6) {
      setFunctionModule(grid, 7, 8, dark);
    } else if (i === 7) {
      setFunctionModule(grid, 8, 8, dark);
    } else if (i === 8) {
      setFunctionModule(grid, 8, 7, dark);
    } else {
      setFunctionModule(grid, 8, 14 - i, dark);
    }

    if (i < 8) {
      setFunctionModule(grid, 8, grid.size - 1 - i, dark);
    } else {
      setFunctionModule(grid, grid.size - 15 + i, 8, dark);
    }
  }
}

function placeDataModules(grid: QrGrid, codewords: readonly number[]): void {
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  const nextBit = (): boolean => {
    if (bitIdx >= totalBits) return false;
    const byte = codewords[bitIdx >> 3];
    const dark = ((byte >> (7 - (bitIdx & 7))) & 1) === 1;
    bitIdx++;
    return dark;
  };

  let upward = true;
  for (let right = grid.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < grid.size; step++) {
      const r = upward ? grid.size - 1 - step : step;
      placeDataRowPair(grid, r, right, nextBit);
    }
    upward = !upward;
  }
}

function placeDataRowPair(
  grid: QrGrid,
  r: number,
  right: number,
  nextBit: () => boolean
): void {
  for (let dx = 0; dx < 2; dx++) {
    const c = right - dx;
    if (grid.reserved[r][c]) continue;
    const dark = nextBit();
    // Apply mask 0: (r + c) % 2 === 0
    grid.modules[r][c] = (r + c) % 2 === 0 ? !dark : dark;
  }
}

/**
 * Pure TypeScript ISO/IEC 18004 QR Code matrix encoder.
 * Supports Byte mode, ECC Level L, Versions 1..12 (up to ~360 UTF-8 bytes).
 * Returns a `size x size` boolean matrix (`true` = dark module).
 */
export function encodeQrMatrix(text: string): boolean[][] {
  if (text.length === 0) {
    throw new RangeError("QR payload cannot be empty");
  }
  const bytes = encodeUtf8Bytes(text);
  const version = selectVersion(bytes.length);
  const data = buildDataCodewords(bytes, version);
  const codewords = interleaveCodewords(data, version);

  const size = 17 + 4 * version;
  const grid = createGrid(size);
  placeFinderPattern(grid, 0, 0);
  placeFinderPattern(grid, 0, size - 7);
  placeFinderPattern(grid, size - 7, 0);
  placeAlignmentPatterns(grid, VERSION_SPECS[version - 1][6]);
  placeTimingAndDarkModule(grid, version);
  reserveFormatAndVersion(grid, version);
  placeDataModules(grid, codewords);
  writeFormatInfo(grid);

  return grid.modules;
}
