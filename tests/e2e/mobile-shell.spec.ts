import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

// T-125/T-124: мобильная оболочка — нижняя навигация пользователя, отсутствие «съезжания», вход в Cloudflare-модалку
test.describe('Мобильная оболочка (PWA)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('нижний таб-бар: пользовательские разделы, нет «Диагностики», страницы не съезжают', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);
    await page.goto('/');
    await page.waitForTimeout(1500);

    const nav = page.getByTestId('bottom-nav');
    await expect(nav).toBeVisible();

    // «Диагностика» в пользовательской навигации быть не должно
    await expect(nav.getByText('Диагностика')).toHaveCount(0);

    const tabs = ['bottom-nav-dashboard', 'bottom-nav-pricing', 'bottom-nav-profile'];
    for (const t of tabs) {
      const btn = page.getByTestId(t);
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(900);
        const metrics = await page.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          textLen: (document.body.innerText || '').length
        }));
        // нет горизонтального «съезжания» и страница не пустая
        expect(metrics.scrollW, `${t}: горизонтальный overflow`).toBeLessThanOrEqual(metrics.clientW + 2);
        expect(metrics.textLen, `${t}: пустая страница`).toBeGreaterThan(50);
      }
    }
  });

  test('Cloudflare-токен: кнопка доступна вне вкладок и открывает модалку с Account ID', async ({ page }) => {
    test.setTimeout(120_000);
    resetMockData(page);
    await page.goto('/');
    await page.waitForTimeout(1200);
    const profileBtn = page.locator('[data-testid="tour-profile-btn"], [title*="рофил"], [title*="Profile"]');
    if (await profileBtn.count()) { await profileBtn.first().click(); } else { await page.goto('/profile'); }
    await page.waitForTimeout(1000);

    const openBtn = page.getByTestId('cf-token-open');
    await expect(openBtn).toBeVisible();
    await openBtn.click();
    await expect(page.getByTestId('cf-token-modal')).toBeVisible();
    await expect(page.getByTestId('cf-account-id')).toBeVisible();

    await page.locator('input[placeholder="Вставьте токен"]').fill('cfat_abcdefghijklmnopqrstuvwxyz1234567890');
    await expect(page.getByText(/обязательно укажите Account ID/i)).toBeVisible();
  });

  test('все основные страницы без горизонтального overflow', async ({ page }) => {
    test.setTimeout(180_000);
    resetMockData(page);
    const routes = ['/', '/profile', '/pricing', '/ai-features', '/workflow', '/about', '/terms', '/privacy'];
    for (const r of routes) {
      await page.goto(r);
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        len: (document.body.innerText || '').length
      }));
      expect(m.scrollW, r + ': горизонтальный overflow ' + m.scrollW + ' > ' + m.clientW).toBeLessThanOrEqual(m.clientW + 2);
      expect(m.len, r + ': страница пуста').toBeGreaterThan(30);
    }
  });

  test('ProjectView и плеер: мобильная вёрстка не съезжает', async ({ page }) => {
    test.setTimeout(180_000);
    resetMockData(page);
    await page.goto('/');
    await page.waitForTimeout(1500);

    const check = async (label: string) => {
      const m = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        len: (document.body.innerText || '').length
      }));
      expect(m.scrollW, label + ': горизонтальный overflow ' + m.scrollW + ' > ' + m.clientW).toBeLessThanOrEqual(m.clientW + 2);
      expect(m.len, label + ': пусто').toBeGreaterThan(30);
    };

    // открыть первый mock-проект
    const card = page.locator('[data-testid="project-card"], button:has-text("Открыть")').first();
    if (await card.count()) {
      await card.click();
      await page.waitForTimeout(1500);
      await check('ProjectView');

      // открыть первый ассет → плеер
      const asset = page.locator('[data-testid="asset-card"], button:has-text("Смотреть")').first();
      if (await asset.count()) {
        await asset.click();
        await page.waitForTimeout(2000);
        await check('Player');
        // шапка плеера и нижние контролы присутствуют
        await expect(page.locator('header').first()).toBeVisible();
        // закрываем назад, чтобы не оставлять состояние
        const back = page.locator('header button').first();
        if (await back.count()) { await back.click().catch(() => {}); }
      }
    }
  });

  test('вертикальный скролл работает на длинных страницах', async ({ page }) => {
    test.setTimeout(180_000);
    resetMockData(page);
    for (const r of ['/profile', '/pricing']) {
      await page.goto(r);
      await page.waitForTimeout(1200);
      const before = await page.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight }));
      if (before.scrollH > before.clientH + 20) {
        const after = await page.evaluate(() => { window.scrollTo(0, 400); return window.scrollY; });
        expect(after, r + ': страница не скроллится (scrollY=0)').toBeGreaterThan(0);
      }
    }
  });

  test('десктоп: скролл работает на профиле', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 800 });
    resetMockData(page);
    await page.goto('/profile');
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight }));
    if (m.scrollH > m.clientH + 20) {
      const y = await page.evaluate(() => { window.scrollTo(0, 500); return window.scrollY; });
      expect(y, 'десктоп: профиль не скроллится').toBeGreaterThan(0);
    }
  });
});
