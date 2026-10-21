import fs from "fs";
import zlib from "zlib";

// Read public/favicon.png
const buf = fs.readFileSync("public/favicon.png");
let offset = 8;
const idatChunks = [];
while (offset < buf.length) {
  const len = buf.readUInt32BE(offset);
  const type = buf.toString("ascii", offset + 4, offset + 8);
  if (type === "IDAT") idatChunks.push(buf.subarray(offset + 8, offset + 8 + len));
  offset += 12 + len;
}
const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));

const cropW = 504;
const cropH = 304;
const cropRows = [];

for (let y = 104; y <= 407; y++) {
  const rowStart = y * (1 + 512 * 4);
  const rowBuf = Buffer.alloc(1 + cropW * 4);
  rowBuf[0] = 0;
  for (let x = 0; x < cropW; x++) {
    const srcPx = rowStart + 1 + (x + 4) * 4;
    const dstPx = 1 + x * 4;
    rowBuf[dstPx] = decompressed[srcPx];
    rowBuf[dstPx + 1] = decompressed[srcPx + 1];
    rowBuf[dstPx + 2] = decompressed[srcPx + 2];
    rowBuf[dstPx + 3] = decompressed[srcPx + 3];
  }
  cropRows.push(rowBuf);
}

const cropDecompressed = Buffer.concat(cropRows);
const cropCompressed = zlib.deflateSync(cropDecompressed, { level: 9 });

function makePng(width, height, compressedData) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  
  function makeChunk(type, data) {
    const len = data.length;
    const b = Buffer.alloc(8 + len + 4);
    b.writeUInt32BE(len, 0);
    b.write(type, 4, 4, "ascii");
    data.copy(b, 8);
    const crc = zlib.crc32(b.subarray(4, 8 + len));
    b.writeUInt32BE(crc >>> 0, 8 + len);
    return b;
  }
  
  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressedData),
    makeChunk("IEND", Buffer.alloc(0))
  ]);
}

const tightPng = makePng(cropW, cropH, cropCompressed);
fs.writeFileSync("public/nacif-electric-symbol.png", tightPng);
fs.writeFileSync("src/assets/nacif-electric-symbol.png", tightPng);
console.log("Saved public/nacif-electric-symbol.png & src/assets/nacif-electric-symbol.png, size:", tightPng.length);

const base64Tight = "data:image/png;base64," + tightPng.toString("base64");
const base64Favicon = "data:image/png;base64," + buf.toString("base64");

const fileContent = `/**
 * Símbolo Oficial da Identidade Visual NACIF ELECTRIC
 * Baseado na imagem favicon.png oficial fornecida com transparência preservada.
 */

export const NACIF_SYMBOL_URL = "/nacif-electric-symbol.png";
export const NACIF_FAVICON_URL = "/favicon.png";

// Base64 embutido para renderização síncrona e ultrarrápida em jsPDF e visualizações HTML/Print:
export const NACIF_SYMBOL_BASE64 = "${base64Tight}";
export const NACIF_FAVICON_BASE64 = "${base64Favicon}";

export const NACIF_BRAND_NAME = "NACIF ELECTRIC";
export const NACIF_BRAND_SLOGAN = "DA PLANTA AO SOL - TUDO EM UM SÓ LUGAR";
export const NACIF_BRAND_TEAL = [0, 216, 184]; // #00d8b8 (verde-turquesa oficial)
export const NACIF_BRAND_DARK = [14, 23, 38];  // #0e1726 (fundo azul-marinho escuro)
`;

fs.writeFileSync("src/lib/solarLogoAsset.js", fileContent);
console.log("Created src/lib/solarLogoAsset.js");
