import readline from "node:readline";
import { chromium } from "playwright";
import { config } from "../config.js";

console.log("\n=== AI Browser — Gmail login (real Chrome) ===\n");
console.log(
  "Google blocks sign-in inside automated Playwright windows.\n" +
    "Use a normal Chrome window with remote debugging instead.\n"
);
console.log("Steps:\n");
console.log("  1. Close ALL Chrome windows completely.\n");
console.log("  2. In another terminal, run:\n");
console.log("       npm run chrome\n");
console.log("  3. Sign into Gmail in that Chrome window.\n");
console.log("  4. Come back here and press Enter to verify the connection.\n");
console.log(`Expected CDP URL: ${config.browserCdpUrl}\n`);

await waitForEnter("Press Enter after you have logged into Gmail...");

try {
  const browser = await chromium.connectOverCDP(config.browserCdpUrl);
  const context = browser.contexts()[0];
  const page = context?.pages()[0];
  const url = page?.url() ?? "(no page)";
  console.log(`\nConnected to Chrome. Active page: ${url}`);
  await browser.close();
  console.log("\nSuccess. Keep Chrome running and start the agent with npm run dev.\n");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("\nCould not connect to Chrome.");
  console.error(message);
  console.error("\nMake sure you ran: npm run chrome");
  console.error("and that no other Chrome is using the same profile.\n");
  process.exit(1);
}

function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}
