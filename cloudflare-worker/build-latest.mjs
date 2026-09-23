import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const sourcePath = resolve(root, "online", "latest.json");
const outputPath = resolve(here, "generated", "latest.js");

const parsed = JSON.parse(await readFile(sourcePath, "utf8"));
if (parsed.product !== "com.locdev.dancard" || !/^\d+\.\d+\.\d+$/.test(String(parsed.version))) {
  throw new Error("online/latest.json is not a valid DanCard update manifest.");
}

const latestJson = JSON.stringify(parsed);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `export const latestJson = ${JSON.stringify(latestJson)};\n`, "utf8");
