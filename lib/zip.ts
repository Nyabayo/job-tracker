import { crc32 } from "node:zlib";

// A6: a minimal streaming ZIP writer (stored, no compression). PDFs, images
// and DOCX files are already compressed, so deflating again gains little.
// Each file is written as soon as it is read, so memory holds one file at a
// time. No ZIP64: callers keep the total under MAX_ZIP_BYTES.

export const MAX_ZIP_BYTES = 3_500_000_000;

export type ZipEntry = { name: string; data: Uint8Array };

/** Folder-safe names only: no absolute paths, "..", backslashes or control characters. */
export function safeZipName(name: string): string {
  const parts = name
    .split(/[\\/]+/)
    .map((p) => p.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "").trim())
    .filter((p) => p && p !== "." && p !== "..");
  return parts.join("/") || "file";
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(d.getUTCFullYear(), 1980);
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

const UTF8_FLAG = 0x0800;

export function zipStream(entries: AsyncIterable<ZipEntry> | Iterable<ZipEntry>, modified = new Date()): ReadableStream<Uint8Array> {
  const { time, date } = dosDateTime(modified);
  const central: Buffer[] = [];
  let offset = 0;
  let count = 0;
  const iterator = (async function* () {
    yield* entries;
  })();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();
      if (!next.done) {
        const name = Buffer.from(safeZipName(next.value.name), "utf8");
        const data = next.value.data;
        const crc = crc32(data);
        if (offset + 30 + name.length + data.length > MAX_ZIP_BYTES) throw new Error("Export too large");

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(UTF8_FLAG, 6);
        local.writeUInt16LE(0, 8); // stored
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);

        const header = Buffer.alloc(46);
        header.writeUInt32LE(0x02014b50, 0);
        header.writeUInt16LE(20, 4); // made by
        header.writeUInt16LE(20, 6);
        header.writeUInt16LE(UTF8_FLAG, 8);
        header.writeUInt16LE(0, 10);
        header.writeUInt16LE(time, 12);
        header.writeUInt16LE(date, 14);
        header.writeUInt32LE(crc, 16);
        header.writeUInt32LE(data.length, 20);
        header.writeUInt32LE(data.length, 24);
        header.writeUInt16LE(name.length, 28);
        header.writeUInt32LE(offset, 42);
        central.push(header, name);

        controller.enqueue(new Uint8Array(Buffer.concat([local, name])));
        controller.enqueue(data);
        offset += local.length + name.length + data.length;
        count += 1;
        return;
      }

      const dir = Buffer.concat(central);
      const end = Buffer.alloc(22);
      end.writeUInt32LE(0x06054b50, 0);
      end.writeUInt16LE(count, 8);
      end.writeUInt16LE(count, 10);
      end.writeUInt32LE(dir.length, 12);
      end.writeUInt32LE(offset, 16);
      controller.enqueue(new Uint8Array(Buffer.concat([dir, end])));
      controller.close();
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });
}
