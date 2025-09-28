export async function createAccount(page) {
  const frames = page.frames();
  const selectors = [
    (frame) => frame.getByRole('link', { name: /create account|sign up|register|join now|get started|create one|apply now/i }),
    (frame) => frame.getByRole('button', { name: /create account|sign up|register|join now|get started|create one/i }),
    (frame) => frame.locator(
      'a[href*="signup" i], a[href*="sign-up" i], a[href*="register" i], a[href*="create" i][href*="account" i], a:has-text("create account" i), a:has-text("sign up" i), a:has-text("register" i)'
    ),
    (frame) => frame.locator(
      'button:has-text("Create account" i), button:has-text("Sign up" i), button:has-text("Register" i), button:has-text("Get started" i)'
    ),
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

