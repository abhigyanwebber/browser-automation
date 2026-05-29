import type { Page } from "playwright";
import { openFirstYoutubeResult } from "./smartYoutube.js";
import { resolveVisionModel } from "../providers/vision.js";

const VISION_PROMPT = `You analyze a browser screenshot for automation.
Return ONLY JSON — prefer link targets, NOT pixel coordinates:
{"hrefContains":"youtube.com/watch","linkText":"optional short label","reason":"why"}
If you must use coordinates, also include hrefContains when possible.
Do NOT guess x,y unless no link is visible.`;

export async function visionGuidedClick(
  page: Page,
  intent: string
): Promise<string> {
  const binding = resolveVisionModel();
  if (!binding) {
    throw new Error("No vision model available");
  }

  const screenshot = await page.screenshot({ type: "png" });
  const imageBase64 = screenshot.toString("base64");

  let raw: string;
  try {
    raw = await binding.client.chat({
      model: binding.modelId,
      jsonMode: binding.client.provider !== "gemini",
      messages: [
        { role: "system", content: VISION_PROMPT },
        { role: "user", content: `Task: ${intent}` }
      ],
      imageBase64,
      imageMimeType: "image/png"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/youtube/i.test(intent)) {
      return openFirstYoutubeResult(page);
    }
    throw new Error(`Vision failed (${message}); DOM fallback unavailable`);
  }

  const parsed = JSON.parse(raw) as {
    hrefContains?: string;
    linkText?: string;
    x?: number;
    y?: number;
    reason?: string;
  };

  if (parsed.hrefContains) {
    const selector = `a[href*="${parsed.hrefContains.replace(/"/g, "")}"]`;
    const link = page.locator(selector).first();
    await link.waitFor({ state: "visible", timeout: 12_000 });
    await link.scrollIntoViewIfNeeded();
    await link.click({ timeout: 12_000 });
    return `Vision picked link (${parsed.hrefContains}): ${parsed.reason ?? intent}`;
  }

  if (parsed.linkText?.trim()) {
    const link = page.getByRole("link", {
      name: new RegExp(parsed.linkText.slice(0, 40), "i")
    }).first();
    await link.click({ timeout: 12_000 });
    return `Vision picked link by text "${parsed.linkText}"`;
  }

  if (typeof parsed.x === "number" && typeof parsed.y === "number") {
    const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
    const x =
      parsed.x <= 1 ? Math.round(parsed.x * viewport.width) : Math.round(parsed.x);
    const y =
      parsed.y <= 1 ? Math.round(parsed.y * viewport.height) : Math.round(parsed.y);
    await page.mouse.click(x, y);
    await page.waitForTimeout(1000);
    return `Vision coordinate click (${x}, ${y}) — less reliable`;
  }

  if (/youtube/i.test(intent)) {
    return openFirstYoutubeResult(page);
  }

  throw new Error(`Vision could not identify a click target: ${raw}`);
}

export async function visionClickAndExecute(
  page: Page,
  intent: string
): Promise<string> {
  if (/youtube/i.test(intent)) {
    try {
      return await openFirstYoutubeResult(page);
    } catch {
      return visionGuidedClick(page, intent);
    }
  }
  return visionGuidedClick(page, intent);
}
