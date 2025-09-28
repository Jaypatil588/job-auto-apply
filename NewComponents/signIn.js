import 'dotenv/config';

export async function signIn(page) {
  const username = process.env.JOB_PORTAL_EMAIL || process.env.JOB_PORTAL_USERNAME;
  const password = process.env.JOB_PORTAL_PASSWORD;
  if (!username || !password) return false;

  const dialog = page.locator('[data-automation-id="popUpDialog"]').first();
  let container = null;

  if (await dialog.count()) {
    container = dialog;
  } else {
    const inlineSignIn = page.locator('[data-automation-id="signInContent"]').first();
    if (await inlineSignIn.count()) {
      container = inlineSignIn;
    } else {
      return false;
    }
  }

  await container.locator('[data-automation-id="email"]').fill(username);
  await container.locator('[data-automation-id="password"]').fill(password);
  //await container.locator('button[type="submit"]').first().click();
  return await clickSignInButton(page);
  //return true;
}

async function clickSignInButton(page) {
  console.log('Clicking Sign In button...');
  const frames = page.frames();
  const selectors = [
    (frame) => frame.getByRole('link', { name: /Sign In/i }),
    (frame) => frame.getByRole('button', { name: /sign in/i }),
    (frame) => frame.locator(
      ' a:has-text("Sign In" i)'
    ),
    (frame) => frame.locator('[data-automation-id="signInSubmitButton"]'),
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