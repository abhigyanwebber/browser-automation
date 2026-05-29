import type { Page } from "playwright";

/** Detect Google / reCAPTCHA challenge pages */
export async function detectCaptcha(page: Page): Promise<boolean> {
  const url = page.url();
  if (
    /google\.com\/sorry|\/recaptcha|challenge|captcha/i.test(url)
  ) {
    return true;
  }

  const selectors = [
    'iframe[src*="recaptcha"]',
    "#recaptcha",
    'form[action*="sorry"]',
    "text=unusual traffic",
    "text=not a robot"
  ];

  for (const selector of selectors) {
    try {
      if (await page.locator(selector).first().isVisible({ timeout: 500 })) {
        return true;
      }
    } catch {
      // not visible
    }
  }

  return false;
}
