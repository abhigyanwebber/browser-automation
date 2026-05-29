import fs from "node:fs";
import path from "node:path";

export function findChromeExecutable(): string {
  const candidates = [
    process.env.CHROME_PATH,
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe"
    ),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Google Chrome not found. Install Chrome or set CHROME_PATH in .env"
  );
}
