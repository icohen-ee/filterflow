/**
 * Lightweight, zero-dependency pure JavaScript QR Code Generator (SVG & Matrix).
 * Implements ISO/IEC 18004 QR Code specification (Byte mode, Error Correction Levels L/M, Versions 1-6).
 */

// Galois Field GF(256) math with primitive polynomial 0x11d (x^8 + x^4 + x^3 + x^2 + 1)
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const factor = [1, EXP_TABLE[i]];
    const newPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      for (let k = 0; k < factor.length; k++) {
        newPoly[j + k] ^= gfMul(poly[j], factor[k]);
      }
    }
    poly = newPoly;
  }
  return poly;
}

function rsCompute(data, numEcBytes) {
  const gen = rsGeneratorPoly(numEcBytes);
  const remainder = new Array(numEcBytes).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    for (let i = 0; i < numEcBytes - 1; i++) {
      remainder[i] = remainder[i + 1] ^ gfMul(gen[i + 1], factor);
    }
    remainder[numEcBytes - 1] = gfMul(gen[numEcBytes], factor);
  }
  return remainder;
}

// Version capacities (bytes in Byte Mode) for EC level L and M
// [version, size, totalBytes, ecBytesL, ecBytesM]
const QR_VERSION_INFO = [
  null,
  { version: 1, size: 21, totalBytes: 26, ecBytesL: 7, ecBytesM: 10, align: [] },
  { version: 2, size: 25, totalBytes: 44, ecBytesL: 10, ecBytesM: 16, align: [6, 18] },
  { version: 3, size: 29, totalBytes: 70, ecBytesL: 15, ecBytesM: 26, align: [6, 22] },
  { version: 4, size: 33, totalBytes: 100, ecBytesL: 20, ecBytesM: 36, align: [6, 26] },
  { version: 5, size: 37, totalBytes: 134, ecBytesL: 26, ecBytesM: 48, align: [6, 30] },
  { version: 6, size: 41, totalBytes: 172, ecBytesL: 36, ecBytesM: 64, align: [6, 34] }
];

export function encodeQrCode(text, ecLevel = 'M') {
  const encoder = new TextEncoder();
  const utf8 = encoder.encode(text);
  const dataLen = utf8.length;

  let info = null;
  for (let v = 1; v <= 6; v++) {
    const candidate = QR_VERSION_INFO[v];
    const ecBytes = ecLevel === 'L' ? candidate.ecBytesL : candidate.ecBytesM;
    const capacity = candidate.totalBytes - ecBytes - 2; // 4 bit mode + 8 bit count
    if (dataLen <= capacity) {
      info = { ...candidate, ecBytes };
      break;
    }
  }

  if (!info) {
    throw new Error(`Data too long for compact QR generator (${dataLen} bytes). Max 106 bytes.`);
  }

  const dataCapacity = info.totalBytes - info.ecBytes;

  // Bit buffer construction: Byte mode indicator (0100) + Char count (8 bits) + UTF8 data
  let bitStr = '0100';
  bitStr += dataLen.toString(2).padStart(8, '0');
  for (const byte of utf8) {
    bitStr += byte.toString(2).padStart(8, '0');
  }

  // Terminator
  bitStr = bitStr.padEnd(Math.min(bitStr.length + 4, dataCapacity * 8), '0');
  // Pad to multiple of 8
  while (bitStr.length % 8 !== 0) bitStr += '0';

  // Pad bytes: 0xEC and 0x11
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bitStr.length < dataCapacity * 8) {
    bitStr += padBytes[padIdx % 2].toString(2).padStart(8, '0');
    padIdx++;
  }

  // Convert bits to data bytes
  const dataBytes = [];
  for (let i = 0; i < bitStr.length; i += 8) {
    dataBytes.push(parseInt(bitStr.slice(i, i + 8), 2));
  }

  // Calculate Error Correction Codewords
  const ecCodewords = rsCompute(dataBytes, info.ecBytes);
  const allCodewords = dataBytes.concat(ecCodewords);

  // Initialize Matrix
  const size = info.size;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  function setModule(r, c, val) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      reserved[r][c] = true;
    }
  }

  // Finder Patterns (7x7) + Separators (8x8)
  function placeFinder(top, left) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setModule(row, col, isBlack ? 1 : 0);
        } else {
          setModule(row, col, 0); // Separator
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(6, i, i % 2 === 0 ? 1 : 0);
    if (!reserved[i][6]) setModule(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Alignment Pattern (if version >= 2)
  if (info.align.length >= 2) {
    for (const r of info.align) {
      for (const c of info.align) {
        if (reserved[r][c]) continue; // Skip if overlaps finder
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
            setModule(r + dr, c + dc, isBlack ? 1 : 0);
          }
        }
      }
    }
  }

  // Dark module
  setModule(4 * info.version + 9, 8, 1);

  // Reserve format information areas
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      if (i < size) reserved[8][i] = true;
      if (i < size) reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // Place data bits in zig-zag pattern
  const dataBitStr = allCodewords.map(b => b.toString(2).padStart(8, '0')).join('');
  let bitIdx = 0;
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const left = right - 1;
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, left]) {
        if (!reserved[r][c]) {
          const bitVal = bitIdx < dataBitStr.length ? parseInt(dataBitStr[bitIdx++], 2) : 0;
          // Apply mask 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = mask ? bitVal ^ 1 : bitVal;
        }
      }
    }
    upward = !upward;
  }

  // Format information bits for Mask 0, EC level M (00) or L (01)
  // Format bit string with BCH (15, 5) code XOR 0x5412
  // EC Level M (00) + Mask 0 (000) = 00000 -> BCH code = 0000000000 -> XOR 101010000010010 = 101010000010010
  // EC Level L (01) + Mask 0 (000) = 01000 -> BCH code = 010001000100101 -> XOR 101010000010010 = 111011000110111
  const formatBits = ecLevel === 'L' ? '111011000110111' : '101010000010010';

  // Top-left format bits
  for (let i = 0; i <= 5; i++) matrix[8][i] = parseInt(formatBits[i], 2);
  matrix[8][7] = parseInt(formatBits[6], 2);
  matrix[8][8] = parseInt(formatBits[7], 2);
  matrix[7][8] = parseInt(formatBits[8], 2);
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = parseInt(formatBits[i], 2);

  // Bottom & Right format bits
  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = parseInt(formatBits[i], 2);
  for (let i = 7; i < 15; i++) matrix[8][size - 15 + i] = parseInt(formatBits[i], 2);

  return { matrix, size };
}

export function generateQrSvg(text, options = {}) {
  const { size: targetPx = 240, margin = 3, ecLevel = 'M', color = '#ffffff', background = '#161b22' } = options;
  const { matrix, size } = encodeQrCode(text, ecLevel);
  const totalCells = size + margin * 2;
  const cellSize = targetPx / totalCells;

  let pathD = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        pathD += `M${x.toFixed(1)},${y.toFixed(1)}h${cellSize.toFixed(1)}v${cellSize.toFixed(1)}h-${cellSize.toFixed(1)}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${targetPx} ${targetPx}" width="${targetPx}" height="${targetPx}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="${background}" rx="8"/>
  <path d="${pathD.trim()}" fill="${color}"/>
</svg>`;
}
