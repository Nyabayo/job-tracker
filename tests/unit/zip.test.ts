import { describe, expect, it } from "vitest";
import { crc32 } from "node:zlib";
import { safeZipName, zipStream } from "@/lib/zip";

async function bytes(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

/** Reads entries back through the central directory, as unzip tools do. */
function readZip(buf: Buffer): { name: string; data: Buffer }[] {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    expect(buf.readUInt32LE(local)).toBe(0x04034b50);
    const start = local + 30 + buf.readUInt16LE(local + 26);
    const data = buf.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    out.push({ name, data });
    p += 46 + nameLen;
  }
  return out;
}

describe("A6: ZIP export", () => {
  it("writes a valid archive that reads back exactly", async () => {
    const files = [
      { name: "data.json", data: Buffer.from('{"ok":true}') },
      { name: "files/CV – Wanjiru.pdf", data: Buffer.from("%PDF-1.7 test") },
      { name: "empty.txt", data: Buffer.alloc(0) },
    ];
    const zip = await bytes(zipStream(files));
    expect(readZip(zip)).toEqual(files.map((f) => ({ name: f.name, data: Buffer.from(f.data) })));
  });

  it("can't write files outside the folder it is unzipped into", () => {
    expect(safeZipName("../../etc/passwd")).toBe("etc/passwd");
    expect(safeZipName("/abs/path.pdf")).toBe("abs/path.pdf");
    expect(safeZipName("files\\..\\..\\x.pdf")).toBe("files/x.pdf");
    expect(safeZipName("..")).toBe("file");
  });
});
