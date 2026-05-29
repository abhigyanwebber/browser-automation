import fs from "node:fs";
import { config } from "../config.js";

export function getBrowserProfileDir(): string {
  const dir = config.browserUserDataDir;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Playwright-launched profile (Google login often blocked here) */
export function persistentContextOptions(headless = config.headless) {
  return {
    headless,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    ignoreDefaultArgs: ["--enable-automation", "--no-sandbox"],
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check"
    ],
    ...(config.useSystemChrome ? { channel: "chrome" as const } : {})
  };
}
