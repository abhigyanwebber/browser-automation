import fs from "node:fs";
import path from "node:path";
import {
  chromium,
  type BrowserContext,
  type ChromiumBrowser,
  type Page
} from "playwright";
import type { TaskStep } from "../types.js";
import { detectCaptcha } from "./captchaDetect.js";
import { dismissCommonOverlays } from "./overlays.js";
import { openFirstYoutubeResult } from "./smartYoutube.js";
import { visionClickAndExecute } from "./visionClick.js";
import { config } from "../config.js";
import { getBrowserProfileDir, persistentContextOptions } from "./profile.js";

interface SessionOptions {
  dataDir: string;
  headless: boolean;
  userDataDir?: string;
}

export class BrowserSessionManager {
  private browser: ChromiumBrowser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly dataDir: string;
  private readonly headless: boolean;
  private readonly userDataDir?: string;

  constructor(options: SessionOptions) {
    this.dataDir = options.dataDir;
    this.headless = options.headless;
    this.userDataDir = options.userDataDir;
  }

  async init(): Promise<void> {
    if (this.page) {
      return;
    }

    fs.mkdirSync(this.dataDir, { recursive: true });

    if (config.useBrowserCdp) {
      try {
        this.browser = await chromium.connectOverCDP(config.browserCdpUrl);
        this.context =
          this.browser.contexts()[0] ?? (await this.browser.newContext());
        this.page =
          this.context.pages()[0] ?? (await this.context.newPage());
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Cannot connect to Chrome at ${config.browserCdpUrl}. ` +
            `Run "npm run chrome" first and log into Gmail. (${message})`
        );
      }
    }

    if (this.userDataDir) {
      const profileDir = this.userDataDir ?? getBrowserProfileDir();
      fs.mkdirSync(profileDir, { recursive: true });
      this.context = await chromium.launchPersistentContext(
        profileDir,
        persistentContextOptions(this.headless)
      );
      this.page = this.context.pages()[0] ?? (await this.context.newPage());
      return;
    }

    this.browser = await chromium.launch({ headless: this.headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    this.page = await this.context.newPage();
  }

  async isCaptchaVisible(): Promise<boolean> {
    return detectCaptcha(this.getPage());
  }

  async pauseBetweenSteps(ms: number): Promise<void> {
    if (ms > 0) {
      await this.getPage().waitForTimeout(ms);
    }
  }

  async executeStep(
    taskId: string,
    stepIndex: number,
    step: TaskStep
  ): Promise<string | undefined> {
    const page = this.getPage();

    switch (step.type) {
      case "goto":
        if (!step.url) {
          throw new Error("goto step missing url");
        }
        await page.goto(step.url, { waitUntil: "domcontentloaded" });
        await dismissCommonOverlays(page);
        await this.capture(taskId, stepIndex, "goto");
        return `Navigated to ${step.url}`;
      case "click":
        if (!step.selector) {
          throw new Error("click step missing selector");
        }
        await dismissCommonOverlays(page);
        await page.locator(step.selector).first().click({ timeout: 15_000 });
        await this.capture(taskId, stepIndex, "click");
        return `Clicked ${step.selector}`;
      case "click_href": {
        const hrefPart = step.value ?? "youtube.com/watch";
        await dismissCommonOverlays(page);
        await page.waitForTimeout(1500);
        if (hrefPart.includes("youtube")) {
          try {
            const result = await openFirstYoutubeResult(page);
            await this.capture(taskId, stepIndex, "youtube-link");
            return result;
          } catch {
            // fall through to generic href matching
          }
        }
        const selectors = [
          `#search a[href*="${hrefPart}"]`,
          `a[href*="${hrefPart}"]`
        ];
        for (const selector of selectors) {
          const link = page.locator(selector).first();
          try {
            await link.waitFor({ state: "visible", timeout: 12_000 });
            await link.scrollIntoViewIfNeeded();
            await link.click({ timeout: 10_000 });
            await this.capture(taskId, stepIndex, "click-link");
            return `Opened first link matching "${hrefPart}" (${selector})`;
          } catch {
            // try next selector
          }
        }
        if (config.useVisionClick && !hrefPart.includes("youtube")) {
          const visionResult = await visionClickAndExecute(
            page,
            `Click the first search result link containing ${hrefPart}`
          );
          await this.capture(taskId, stepIndex, "vision-click");
          return visionResult;
        }
        if (hrefPart.includes("youtube")) {
          throw new Error(
            `No YouTube link found. Try: npm run chrome (logged in), wait for results to load.`
          );
        }
        throw new Error(`No visible link found for href containing "${hrefPart}"`);
      }
      case "open_first_youtube": {
        await dismissCommonOverlays(page);
        const result = await openFirstYoutubeResult(page);
        await this.capture(taskId, stepIndex, "youtube-link");
        return result;
      }
      case "vision_click": {
        const intent = step.value ?? "Click the correct element for the current task";
        await dismissCommonOverlays(page);
        await page.waitForTimeout(1000);
        const visionResult = await visionClickAndExecute(page, intent);
        await this.capture(taskId, stepIndex, "vision-click");
        return visionResult;
      }
      case "type":
        if (!step.selector || typeof step.value !== "string") {
          throw new Error("type step missing selector/value");
        }
        await dismissCommonOverlays(page);
        const field = page.locator(step.selector).first();
        await field.waitFor({ state: "visible", timeout: 15_000 });
        await field.click();
        await field.fill(step.value);
        await this.capture(taskId, stepIndex, "type");
        return `Typed "${step.value}" into ${step.selector}`;
      case "press_key":
        if (!step.value) {
          throw new Error("press_key step missing value");
        }
        if (step.selector) {
          const target = page.locator(step.selector).first();
          await target.waitFor({ state: "visible", timeout: 10_000 });
          await target.press(step.value);
        } else {
          await page.keyboard.press(step.value);
        }
        if (step.value === "Enter") {
          await page
            .waitForURL(/google\.com\/search|\/search\?/, { timeout: 12_000 })
            .catch(() => page.waitForTimeout(2000));
        } else {
          await page.waitForTimeout(800);
        }
        await this.capture(taskId, stepIndex, "press");
        return step.selector
          ? `Pressed ${step.value} on ${step.selector}`
          : `Pressed ${step.value}`;
      case "wait":
        await page.waitForTimeout(step.timeoutMs ?? 1000);
        return "Waited";
      case "extract_text":
        if (!step.selector) {
          throw new Error("extract_text step missing selector");
        }
        await page.waitForSelector(step.selector, { timeout: 15_000 });
        const text = await page.textContent(step.selector);
        await this.capture(taskId, stepIndex, "extract");
        return text?.trim() ?? "";
      case "captcha_checkpoint":
        return step.value ?? "Manual captcha checkpoint";
      default:
        throw new Error(`Unsupported step type: ${(step as TaskStep).type}`);
    }
  }

  async capture(
    taskId: string,
    stepIndex: number,
    label: string
  ): Promise<string> {
    const page = this.getPage();
    const shotsDir = path.join(this.dataDir, "screenshots", taskId);
    fs.mkdirSync(shotsDir, { recursive: true });
    const file = path.join(
      shotsDir,
      `${String(stepIndex).padStart(3, "0")}-${label}.png`
    );
    await page.screenshot({ path: file, fullPage: true });
    return file;
  }

  private getPage(): Page {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }
    return this.page;
  }
}
