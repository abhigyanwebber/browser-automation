import "dotenv/config";
import path from "node:path";

const port = Number(process.env.PORT ?? 3000);
const routerConfidenceThreshold = Number(
  process.env.ROUTER_CONFIDENCE_THRESHOLD ?? 0.75
);

if (Number.isNaN(port)) {
  throw new Error("PORT must be a number");
}

if (Number.isNaN(routerConfidenceThreshold)) {
  throw new Error("ROUTER_CONFIDENCE_THRESHOLD must be a number");
}

const geminiMaxRequestsPerMinute = Number(
  process.env.GEMINI_MAX_REQUESTS_PER_MINUTE ?? 8
);
const geminiCooldownMs = Number(process.env.GEMINI_COOLDOWN_MS ?? 60_000);

if (Number.isNaN(geminiMaxRequestsPerMinute) || geminiMaxRequestsPerMinute < 1) {
  throw new Error("GEMINI_MAX_REQUESTS_PER_MINUTE must be a positive number");
}

if (Number.isNaN(geminiCooldownMs) || geminiCooldownMs < 1000) {
  throw new Error("GEMINI_COOLDOWN_MS must be at least 1000");
}

export const config = {
  port,
  headless: (process.env.HEADLESS ?? "false").toLowerCase() === "true",
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  defaultModel: process.env.DEFAULT_MODEL ?? "dummy",
  routerConfidenceThreshold,
  orchestratorModelId: process.env.ORCHESTRATOR_MODEL ?? "gemini-2.0-flash",
  useGeminiOrchestrator:
    (process.env.USE_GEMINI_ORCHESTRATOR ?? "true").toLowerCase() === "true",
  geminiMaxRequestsPerMinute,
  geminiCooldownMs,
  geminiApiKey: process.env.GEMINI_API_KEY,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  /** Delay between browser steps (reduces bot-like bursts) */
  stepDelayMs: Number(process.env.STEP_DELAY_MS ?? 1500),
  /** Reuse cookies/login state across runs (fewer captchas) */
  browserUserDataDir: process.env.BROWSER_USER_DATA_DIR
    ? path.resolve(process.env.BROWSER_USER_DATA_DIR)
    : path.resolve(process.env.DATA_DIR ?? "./data", "browser-profile"),
  /** Use installed Google Chrome instead of Playwright Chromium (often more trusted) */
  useSystemChrome:
    (process.env.USE_SYSTEM_CHROME ?? "true").toLowerCase() === "true",
  /** Connect to real Chrome via CDP (required for Gmail login — run npm run chrome) */
  useBrowserCdp:
    (process.env.USE_BROWSER_CDP ?? "true").toLowerCase() === "true",
  browserCdpPort: Number(process.env.BROWSER_CDP_PORT ?? 9222),
  browserCdpUrl:
    process.env.BROWSER_CDP_URL ??
    `http://127.0.0.1:${Number(process.env.BROWSER_CDP_PORT ?? 9222)}`,
  /** Screenshot + vision model to find click targets */
  useVisionClick:
    (process.env.USE_VISION_CLICK ?? "true").toLowerCase() === "true",
  logPlannerIo: (process.env.LOG_PLANNER_IO ?? "false").toLowerCase() === "true"
};
