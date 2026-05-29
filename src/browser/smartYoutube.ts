import type { Page } from "playwright";

/** Open first YouTube result without vision/coordinates — uses DOM only */
export async function openFirstYoutubeResult(
  page: Page,
  depth = 0
): Promise<string> {
  await page.waitForTimeout(1500);

  const selectors = [
    '#search a[href*="youtube.com/watch"]',
    'a[href*="youtube.com/watch"]',
    'a[href*="youtu.be/"]'
  ];

  for (const selector of selectors) {
    const links = page.locator(selector);
    const count = await links.count();
    for (let i = 0; i < Math.min(count, 8); i++) {
      const link = links.nth(i);
      try {
        if (!(await link.isVisible({ timeout: 2000 }))) {
          continue;
        }
        const href = await link.getAttribute("href");
        if (!href || href.includes("google.com")) {
          continue;
        }
        await link.scrollIntoViewIfNeeded();
        await link.click({ timeout: 12_000 });
        await page
          .waitForURL(/youtube\.com\/watch|youtu\.be\//, { timeout: 15_000 })
          .catch(() => page.waitForTimeout(2000));
        return `Opened YouTube: ${href.slice(0, 80)}`;
      } catch {
        // try next link
      }
    }
  }

  if (depth < 1) {
    const videosTab = page.getByRole("link", { name: /^videos$/i }).first();
    if (await videosTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await videosTab.click();
      await page.waitForTimeout(2000);
      return openFirstYoutubeResult(page, depth + 1);
    }
  }

  throw new Error(
    "Could not find a visible YouTube link. Try scrolling or use Google Videos search."
  );
}
