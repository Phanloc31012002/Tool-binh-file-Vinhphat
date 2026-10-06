// Các assert JPEG chỉ đọc, dùng chung cho các test xuất file trong Illustrator thật; không ghi lại ảnh.
const fs = require("node:fs");
function metadata(path) {
  const b = fs.readFileSync(path),
    result = { iccChunks: [], quantization: [] };
  if (b.readUInt16BE(0) !== 0xffd8) throw Error("Not a JPEG");
  let p = 2;
  while (p < b.length && b[p] === 255) {
    const marker = b[p + 1];
    if (marker === 0xda) break;
    const length = b.readUInt16BE(p + 2),
      s = b.subarray(p + 4, p + 2 + length);
    if (marker === 0xc0 || marker === 0xc2)
      result.sof = {
        baseline: marker === 0xc0,
        width: s.readUInt16BE(3),
        height: s.readUInt16BE(1),
        components: s[5],
      };
    if (marker === 0xe0 && s.toString("ascii", 0, 5) === "JFIF\0")
      result.jfif = {
        units: s[7],
        x: s.readUInt16BE(8),
        y: s.readUInt16BE(10),
      };
    if (marker === 0xe1 && s.toString("ascii", 0, 6) === "Exif\0\0") {
      const t = s.subarray(6),
        le = t.toString("ascii", 0, 2) === "II";
      const u16 = (p) => (le ? t.readUInt16LE(p) : t.readUInt16BE(p)),
        u32 = (p) => (le ? t.readUInt32LE(p) : t.readUInt32BE(p));
      const offset = u32(4),
        n = u16(offset);
      result.exif = {};
      for (let i = 0; i < n; i++) {
        const entry = offset + 2 + i * 12,
          tag = u16(entry),
          value = u32(entry + 8);
        if (tag === 0x11a || tag === 0x11b)
          result.exif[tag === 0x11a ? "x" : "y"] = u32(value) / u32(value + 4);
        if (tag === 0x128) result.exif.units = u16(entry + 8);
      }
    }
    if (marker === 0xe2 && s.toString("ascii", 0, 12) === "ICC_PROFILE\0")
      result.iccChunks.push({ index: s[12], bytes: s.subarray(14) });
    if (marker === 0xed && s.toString("ascii", 0, 14) === "Photoshop 3.0\0") {
      let r = 14;
      while (r + 12 <= s.length && s.toString("ascii", r, r + 4) === "8BIM") {
        const id = s.readUInt16BE(r + 4),
          n = s[r + 6];
        const sizePos = r + 6 + (n + 2 - (n % 2)),
          size = s.readUInt32BE(sizePos),
          start = sizePos + 4;
        if (id === 1005 && size >= 16)
          result.resolution = {
            x: s.readUInt32BE(start) / 65536,
            y: s.readUInt32BE(start + 8) / 65536,
            units: s.readUInt16BE(start + 4),
          };
        r = start + size + (size % 2);
      }
    }
    if (marker === 0xdb) result.quantization.push(Array.from(s.subarray(1, 9)));
    p += 2 + length;
  }
  const icc = Buffer.concat(
    result.iccChunks.sort((a, b) => a.index - b.index).map((c) => c.bytes),
  );
  result.iccBytes = icc.length;
  result.swop =
    icc.toString("ascii").includes("SWOP") ||
    icc.toString("utf16le").includes("SWOP");
  delete result.iccChunks;
  return result;
}
module.exports = metadata;
if (require.main === module)
  console.log(JSON.stringify(metadata(process.argv[2]), null, 2));
