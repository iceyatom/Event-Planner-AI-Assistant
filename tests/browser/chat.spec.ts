import { expect, test } from '@playwright/test';

test('desktop starter, send, revision, copy fallback, and clear', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Demo mode · sample responses, no AI calls')).toBeVisible();
  await page.getByRole('button', { name: /Plan a fundraiser/ }).click();
  const input = page.getByRole('textbox', { name: 'Tell me about your event' });
  await expect(input).toBeFocused();
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('Known facts');
  await input.fill('Actually make it indoors for 120 guests.');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('Recommended package · Signature');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked by iframe')) }, configurable: true }); });
  await page.getByRole('button', { name: /Copy plan/ }).click();
  await expect(page.getByLabel('Select and copy your plan')).toHaveValue(/Recommended package · Signature/);
  await page.getByRole('button', { name: 'Clear chat' }).click();
  await expect(page.getByRole('log')).toBeEmpty();
  await expect(input).toHaveValue('');
  await input.fill('First line'); await input.press('Shift+Enter'); await input.pressSequentially('Second line');
  await expect(input).toHaveValue('First line\nSecond line');
});

test('mobile at 320px and embed work without storage or cookies', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new Error('Storage disabled'); } });
    Object.defineProperty(document, 'cookie', { get() { return ''; }, set() { throw new Error('Cookies disabled'); } });
  });
  for (const path of ['/', '/embed']) {
    const response = await page.goto(path);
    expect(response?.headers()['x-frame-options']).toBeUndefined();
    expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: /Plan a fundraiser/ }).click();
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('log')).toContainText('Three directions');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (path === '/embed') await expect(page.getByRole('link', { name: /Open chatbot/ })).toHaveCount(0);
    else await expect(page.getByRole('link', { name: 'Open chatbot ↗', exact: true })).toHaveAttribute('target', '_blank');
  }
  expect(await context.cookies()).toEqual([]);
  await page.screenshot({ path: 'test-results/mobile-embed.png', fullPage: true });
});

test('safe rendering, loading, duplicate prevention and recoverable error', async ({ page }) => {
  await page.goto('/embed');
  let calls = 0;
  let respond: (() => Promise<void>) | undefined;
  await page.route('**/api/chat', async route => {
    calls++;
    await new Promise<void>(resolve => { respond = async () => { await route.fulfill({ json: { mode: 'demo', reply: '<img src=x onerror="alert(1)"><script>alert(1)</script>', contextTrimmed: true } }); resolve(); }; });
  });
  const input = page.getByRole('textbox', { name: 'Tell me about your event' });
  await input.fill('<svg onload="alert(1)">');
  await input.press('Enter');
  await expect(page.getByRole('status')).toContainText('Putting your plan together');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await expect.poll(() => calls).toBe(1);
  await respond!();
  await expect(page.getByRole('log')).toContainText('<script>alert(1)</script>');
  expect(await page.locator('.message img, .message script, .message svg').count()).toBe(0);
  await expect(page.getByText('Older context was left out.', { exact: false })).toBeVisible();
  await page.unroute('**/api/chat');
  await page.route('**/api/chat', route => route.fulfill({ status: 503, json: { error: 'Planner unavailable. Try later.' } }));
  await input.fill('A new event'); await input.press('Enter');
  await expect(page.locator('.error[role="alert"]')).toHaveText('Planner unavailable. Try later.');
  await expect(input).toHaveValue('A new event');
});

test('desktop screenshot and no server secrets in HTML or loaded scripts', async ({ page }) => {
  const bodies: Promise<string>[] = [];
  page.on('response', response => { if (response.request().resourceType() === 'script') bodies.push(response.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Plan a fundraiser/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  const sources = [await page.content(), ...await Promise.all(bodies)];
  for (const source of sources) {
    expect(source).not.toContain('TEST_SENTINEL_NOT_A_REAL_KEY');
    expect(source).not.toContain('UPSTASH_REDIS_REST_TOKEN');
  }
});
