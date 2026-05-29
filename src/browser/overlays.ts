import type { Page } from "playwright";

/** Dismiss cookie/consent banners that block the search box */
export async function dismissCommonOverlays(page: Page): Promise<void> {
  const candidates = [
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("I agree")',
    'button:has-text("Reject all")',
    'button:has-text("Reject All")',
    '#L2AGLb',
    'button[aria-label="Accept all"]'
  ];

  for (const selector of candidates) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 1500 })) {
        await button.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // try next selector
    }
  }
}
