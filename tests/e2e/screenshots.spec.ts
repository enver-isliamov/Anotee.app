import { test, expect } from '@playwright/test';
import { resetMockData } from './support';
import * as fs from 'fs';
import * as path from 'path';

// T-128: скриншоты ключевых экранов (desktop + mobile) для визуального подтверждения вёрстки.
// Артефакты пишутся в uploads-каталог Playwright (test-results), затем копируются в DELIVERY.
const OUT = process.env.SCREENSHOT_DIR || 'test-results/screens';

const shoot = async (page: any, name: string) => {
  try {
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
  } catch (e) { /* ignore */ }
};

test.describe('Screenshots', () => {
  test('desktop: dashboard, profile (storage + cf modal), pricing, ai-features', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    resetMockData(page);
    await page.goto('/');
    await page.waitForTimeout(1500);
    await shoot(page, 'desktop-01-dashboard');

    await page.goto('/profile');
    await page.waitForTimeout(1500);
    await shoot(page, 'desktop-02-profile');

    const cf = page.getByTestId('cf-token-open');
    if (await cf.count()) {
      await cf.first().click();
      await page.waitForTimeout(700);
      await shoot(page, 'desktop-03-cf-token-modal');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    await page.goto('/pricing');
    await page.waitForTimeout(1200);
    await shoot(page, 'desktop-04-pricing');
    await page.goto('/ai-features');
    await page.waitForTimeout(1200);
    await shoot(page, 'desktop-05-ai-features');

    // ProjectView: плитки и превью
    await page.goto('/');
    await page.waitForTimeout(1200);
    await page.getByText('Anotee – Commercial Spot X').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await shoot(page, 'desktop-06-projectview');
  });

  test('mobile: dashboard, profile, pricing, ai-features, bottom nav', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    resetMockData(page);
    await page.goto('/');
    await page.waitForTimeout(1500);
    await shoot(page, 'mobile-01-dashboard');

    await page.goto('/profile');
    await page.waitForTimeout(1500);
    await shoot(page, 'mobile-02-profile');
    const cf = page.getByTestId('cf-token-open');
    if (await cf.count()) {
      await cf.first().click();
      await page.waitForTimeout(700);
      await shoot(page, 'mobile-03-cf-token-modal');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    await page.goto('/pricing');
    await page.waitForTimeout(1200);
    await shoot(page, 'mobile-04-pricing');
    await page.goto('/ai-features');
    await page.waitForTimeout(1200);
    await shoot(page, 'mobile-05-ai-features');

    // ProjectView на мобиле
    await page.goto('/');
    await page.waitForTimeout(1200);
    await page.getByText('Anotee – Commercial Spot X').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await shoot(page, 'mobile-07-projectview');

    // таб-бар крупным планом
    await page.goto('/');
    await page.waitForTimeout(1200);
    const nav = page.getByTestId('bottom-nav');
    if (await nav.count()) { await nav.screenshot({ path: path.join(OUT, 'mobile-06-bottom-nav.png') }).catch(() => {}); }
  });
});
