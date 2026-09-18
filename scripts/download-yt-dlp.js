import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const binaryDir = path.join(projectDir, "node_modules", "yt-dlp-exec", "bin");
const binaryPath = path.join(binaryDir, "yt-dlp_linux");
const response = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux");

if (!response.ok) {
  throw new Error(`Could not download yt-dlp_linux: ${response.status} ${response.statusText}`);
}

await mkdir(binaryDir, { recursive: true });
await writeFile(binaryPath, Buffer.from(await response.arrayBuffer()));
await chmod(binaryPath, 0o755);
console.log(`Installed ${binaryPath}`);
