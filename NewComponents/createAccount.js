import 'dotenv/config';

export async function createAccount(page) {
  const email = process.env.JOB_PORTAL_EMAIL || process.env.JOB_PORTAL_USERNAME;
  const password = process.env.JOB_PORTAL_PASSWORD;
  if (!email || !password) return false;

  await page.locator('[data-automation-id="email"]').fill(email);
  await page.locator('[data-automation-id="password"]').fill(password);
  await page.locator('[data-automation-id="verifyPassword"]').fill(password);

  return await clickCreateAccountButton(page);
}

async function clickCreateAccountButton(page) {
  const frames = page.frames();
  const selectors = [
    (frame) => frame.getByRole('link', { name: /create account/i }),
    (frame) => frame.getByRole('button', { name: /create account/i }),
    (frame) => frame.locator(
      ' a:has-text("create" i)'
    ),
    (frame) => frame.locator('[data-automation-id="createAccountSubmitButton"]'),
    (frame) => frame.locator('[data-automation-id="click_filter"]'),
    (frame) => frame.locator('[data-automation-id="noCaptchaWrapper"]')

    // data-automation-id="noCaptchaWrapper"

  ];

  for (const frame of frames) {
    for (const selectorFn of selectors) {
      let loc;
      try {
        loc = selectorFn(frame);
      } catch {
        continue;
      }
      if (!loc || await loc.count() === 0) continue;

      const target = loc.first();
      try {
        await target.scrollIntoViewIfNeeded().catch(() => {});
        const [popup] = await Promise.all([
          page.waitForEvent('popup', { timeout: 4000 }).catch(() => null),
          target.click({ timeout: 5000 })
        ]);
        console.log(target)
        if (popup) {
          await popup.waitForLoadState('domcontentloaded').catch(() => {});
          await popup.bringToFront().catch(() => {});
        } else {
          await page.waitForLoadState('domcontentloaded').catch(() => {});
        }
        return true;
      } catch {
        continue;
      }
    }
  }

  return false;
}
