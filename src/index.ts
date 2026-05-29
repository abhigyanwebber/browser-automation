import fs from "node:fs";
import path from "node:path";
import { BrowserSessionManager } from "./browser/session.js";
import { config } from "./config.js";
import { createModelRegistry } from "./models/registry.js";
import { createServer } from "./server.js";
import { TaskStorage } from "./storage.js";
import { TaskRunner } from "./taskRunner.js";

async function main(): Promise<void> {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(path.join(config.dataDir, "screenshots"), { recursive: true });

  const storage = new TaskStorage(config.dataDir);
  const browser = new BrowserSessionManager({
    dataDir: config.dataDir,
    headless: config.headless,
    userDataDir: config.browserUserDataDir
  });
  const { adapters } = createModelRegistry();
  const taskRunner = new TaskRunner(storage, browser, adapters);
  const app = createServer(taskRunner);

  app.listen(config.port, () => {
    console.log(`AI Browser agent listening on http://localhost:${config.port}`);
    console.log("POST /tasks { command, model? }");
    console.log("POST /tasks/:id/resume { reason: 'captcha_solved' }");
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
