import "server-only";
import { Socket } from "node:net";
import { env } from "@/lib/env";

// Malware scanning with ClamAV (clamd INSTREAM over TCP). Fails closed: if
// the scanner can't be reached, the file is treated as not scanned.

export type ScanResult = { status: "CLEAN" } | { status: "INFECTED"; signature: string } | { status: "FAILED" };

const CHUNK = 64 * 1024;

export function scanBuffer(data: Uint8Array, timeoutMs = 30_000): Promise<ScanResult> {
  const { CLAMAV_HOST, CLAMAV_PORT } = env();
  return new Promise((resolve) => {
    const socket = new Socket();
    let reply = "";
    let settled = false;
    const done = (r: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(r);
    };
    socket.setTimeout(timeoutMs, () => done({ status: "FAILED" }));
    socket.on("error", () => done({ status: "FAILED" }));
    socket.on("data", (chunk) => {
      reply += chunk.toString("utf8");
    });
    socket.on("close", () => {
      const text = reply.replace(/\0/g, "").trim();
      if (/: OK$/.test(text)) done({ status: "CLEAN" });
      else if (/ FOUND$/.test(text)) done({ status: "INFECTED", signature: text.replace(/^stream: /, "").replace(/ FOUND$/, "").slice(0, 200) });
      else done({ status: "FAILED" });
    });
    socket.connect(CLAMAV_PORT, CLAMAV_HOST, () => {
      socket.write("zINSTREAM\0");
      for (let i = 0; i < data.length; i += CHUNK) {
        const part = data.subarray(i, i + CHUNK);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(part.length, 0);
        socket.write(size);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4)); // zero length: end of stream
    });
  });
}
