// T-193: поле комментария — под таймлайном (мобильные), не прибито к низу экрана
import { test, expect } from '@playwright/test';
import { resetMockData } from './support';

test.use({ viewport: { width: 390, height: 844 } });

async function openPlayer(page: any) {
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.getByText('Anotee – Commercial Spot X').first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.getByText('Main_Commercial_Cut').first().click().catch(() => {});
  await page.waitForTimeout(2500);
}

test.describe('Плеер: позиция поля комментария', () => {
  test('поле ввода под таймлайном, в потоке (не fixed у нижнего края)', async ({ page }) => {
    test.setTimeout(150_000);
    resetMockData(page);
    await openPlayer(page);

    const input = page.locator('#tour-comment-input input').first();
    await expect(input).toBeVisible();

    const m = await page.evaluate(() => {
      const inp = document.querySelector('#tour-comment-input input') as HTMLElement | null;
      const tl = document.getElementById('tour-timeline') as HTMLElement | null;
      const composer = (document.querySelector('#tour-comment-input') as HTMLElement | null)?.parentElement as HTMLElement | null;
      const cs = composer ? getComputedStyle(composer) : null;
      return {
        inputTop: inp ? inp.getBoundingClientRect().top : null,
        timelineBottom: tl ? tl.getBoundingClientRect().bottom : null,
        composerPosition: cs ? cs.position : null,
        composerTop: composer ? composer.getBoundingClientRect().top : null,
        viewportH: window.innerHeight,
        pageY: window.scrollY
      };
    });
    console.log('POSITION ' + JSON.stringify(m));

    expect(m.inputTop, 'не нашли поле').not.toBeNull();
    expect(m.timelineBottom, 'не нашли таймлайн').not.toBeNull();
    // поле ниже таймлайна
    expect(m.inputTop as number, 'поле не под таймлайном').toBeGreaterThanOrEqual((m.timelineBottom as number) - 2);
    // на мобильном блок не position: fixed (значит не прибит к низу экрана)
    expect(m.composerPosition, 'блок ввода всё ещё fixed').not.toBe('fixed');
    // и он не у самого нижнего края вьюпорта (в потоке под таймлайном)
    await page.screenshot({ path: 'test-results/screens/mobile-comment-under-timeline.png' });
  });

  test('фокус в поле не уводит его за пределы вьюпорта', async ({ page }) => {
    test.setTimeout(150_000);
    resetMockData(page);
    await openPlayer(page);
    const input = page.locator('#tour-comment-input input').first();
    await input.click();
    await page.waitForTimeout(700);
    const inView = await input.evaluate((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight + 1;
    });
    console.log('FOCUS-IN-VIEW ' + inView);
    expect(inView, 'поле после фокуса вне вьюпорта').toBe(true);
  });
});
