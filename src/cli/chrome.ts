import { spawn } from "node:child_process";
import { config } from "../config.js";
import { findChromeExecutable } from "../browser/chromePaths.js";
import { getBrowserProfileDir } from "../browser/profile.js";

const profileDir = getBrowserProfileDir();
const port = config.browserCdpPort;
const chrome = findChromeExecutable();

const args = [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  "https://accounts.google.com/"
];

console.log("\n=== Launching real Google Chrome (safe for Gmail login) ===\n");
console.log(`Profile: ${profileDir}`);
console.log(`Debug port: ${port}`);
console.log(`Executable: ${chrome}\n`);
console.log("Log into Gmail in the window that opens.");
console.log("Leave Chrome running, then use:");
console.log("  npm run dev");
console.log('  npm run task -- "your command"\n');
console.log(
  "Important: close other Chrome windows using this profile, or use a fresh profile folder.\n"
);

const child = spawn(chrome, args, {
  detached: true,
  stdio: "ignore",
  windowsHide: false
});

child.unref();
