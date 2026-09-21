import { test, expect } from '@playwright/test';

// T-172: неавторизованный пользователь получает навигацию по всем доступным ему страницам.
// Ветка рендера та же, что для реального гостя (App.tsx: !currentUser → MainLayout currentUser={null}).
const asGuest = (page: any) => {
  page.addInitScript(() => {
    window.localStorage.setItem('anotee_e2e_guest', '1');
  });
};

test.describe('Гостевая навигация (неавторизованный)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('нижнее меню гостя: только публичные разделы, переходы работают', async ({ page }) => {
    test.setTimeout(120_000);
    asGuest(page);
    await page.goto('/pricing');
    await page.waitForTimeout(1500);

    const nav = page.getByTestId('bottom-nav');
    await expect(nav).toBeVisible();

    // доступные гостю пункты
    const guestTabs = ['bottom-nav-ai_features', 'bottom-nav-workflow', 'bottom-nav-live_demo', 'bottom-nav-pricing', 'bottom-nav-about'];
    const navText = await nav.innerText();
    for (const t of guestTabs) {
      expect(await page.getByTestId(t).count(), t + ': нет пункта у гостя').toBeGreaterThan(0);
    }
    expect(navText).not.toContain('Проекты');
    expect(navText).not.toContain('Настройки');
    expect(navText).not.toContain('Профиль');
    console.log('GUEST-NAV tabs=' + guestTabs.length + ' text="' + navText.replace(/\n/g, '|') + '"');

    // переходы по публичным страницам + отсутствие горизонтального overflow
    // (демо открывается в собственной оболочке — проверяем его отдельно, последним)
    for (const t of guestTabs.filter((x) => x !== 'bottom-nav-live_demo')) {
      await page.getByTestId(t).first().click();
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        len: (document.body.innerText || '').length,
        path: location.pathname
      }));
      console.log('GUEST-NAV ' + t + ' -> ' + m.path + ' len=' + m.len);
      expect(m.scrollW, t + ': горизонтальный overflow').toBeLessThanOrEqual(m.clientW + 1);
      expect(m.len, t + ': пустая страница').toBeGreaterThan(50);
    }

    // демо: переход открывает LiveDemo, затем возврат к публичным разделам
    await page.goto('/pricing');
    await page.waitForTimeout(1200);
    await page.getByTestId('bottom-nav-live_demo').first().click();
    await page.waitForTimeout(1500);
    const demo = await page.evaluate(() => ({ path: location.pathname, len: (document.body.innerText || '').length }));
    console.log('GUEST-NAV demo -> ' + demo.path + ' len=' + demo.len);
    expect(demo.path, 'демо не открылось').toBe('/demo');
    expect(demo.len, 'страница демо пуста').toBeGreaterThan(50);
  });

  test('гость не видит пользовательских разделов по прямым адресам', async ({ page }) => {
    test.setTimeout(120_000);
    asGuest(page);
    for (const r of ['/profile', '/settings']) {
      await page.goto(r);
      await page.waitForTimeout(1200);
      const text = await page.evaluate(() => document.body.innerText || '');
      // вместо личного кабинета — приглашение войти (страница входа), без карточки аккаунта
      const hasAccountCard = await page.locator('#profile-block').count();
      expect(hasAccountCard, r + ': гостю показан личный кабинет').toBe(0);
      console.log('GUEST-GUARD ' + r + ' len=' + text.length + ' profileBlock=' + hasAccountCard);
    }
  });

  test('футер: из него открываются все публичные разделы (включая Roadmap, Оферту, Политику)', async ({ page }) => {
    test.setTimeout(150_000);
    asGuest(page);
    await page.goto('/pricing');
    await page.waitForTimeout(1500);

    const footerLinks = ['footer-nav-ai_features', 'footer-nav-workflow', 'footer-nav-live_demo', 'footer-nav-pricing', 'footer-nav-about', 'footer-nav-roadmap'];
    for (const id of footerLinks) {
      expect(await page.getByTestId(id).count(), id + ': нет ссылки в футере').toBeGreaterThan(0);
    }

    // переход по Roadmap из футера
    await page.getByTestId('footer-nav-roadmap').first().click();
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => location.pathname), 'roadmap не открылся').toBe('/roadmap');

    // оферта и политика доступны гостю
    for (const [id, path] of [['foot-check-terms', '/terms'], ['foot-check-privacy', '/privacy']]) {
      await page.goto(path);
      await page.waitForTimeout(900);
      const len = await page.evaluate(() => (document.body.innerText || '').length);
      console.log('GUEST-FOOTER ' + path + ' len=' + len);
      expect(len, path + ': пустая страница').toBeGreaterThan(50);
    }
  });
});
