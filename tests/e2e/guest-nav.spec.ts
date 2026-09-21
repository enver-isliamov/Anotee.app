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
    const guestTabs = ['bottom-nav-ai_features', 'bottom-nav-workflow', 'bottom-nav-pricing', 'bottom-nav-about'];
    const navText = await nav.innerText();
    for (const t of guestTabs) {
      expect(await page.getByTestId(t).count(), t + ': нет пункта у гостя').toBeGreaterThan(0);
    }
    expect(navText).not.toContain('Проекты');
    expect(navText).not.toContain('Настройки');
    expect(navText).not.toContain('Профиль');
    console.log('GUEST-NAV tabs=' + guestTabs.length + ' text="' + navText.replace(/\n/g, '|') + '"');

    // переходы по публичным страницам + отсутствие горизонтального overflow
    for (const t of guestTabs) {
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
});
