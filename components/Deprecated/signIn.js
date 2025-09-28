export async function signIn(page) {
  // Fast-path: prioritize Workday modal dialog sign-in (no selector loops)
  const modalHandled = await handleWorkdayModalSignIn(page).catch(() => null);
  if (modalHandled !== null) {
    return modalHandled;
  }

  const email = process.env.JOB_PORTAL_EMAIL || process.env.ACCOUNT_EMAIL || process.env.LOGIN_EMAIL;
  const password = process.env.JOB_PORTAL_PASSWORD || process.env.ACCOUNT_PASSWORD || process.env.LOGIN_PASSWORD;

  if (!email && !password) return false;

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(500).catch(() => {});

  const frames = page.frames();
  for (const frame of frames) {
    try {
      const emailLocator = await findInput(frame, [
        'input[data-automation-id="email"]',
        'input[type="email"]',
        'input[autocomplete="email" i]',
        'input[name*="email" i]',
        'input[id*="email" i]'
      ]);

      const passwordLocator = await findInput(frame, [
        'input[data-automation-id="password"]',
        'input[type="password"][data-automation-id="password"]',
        'input[type="password"]',
        'input[name*="password" i]',
        'input[id*="password" i]'
      ]);

      let verifyLocator = await findInput(frame, [
        'input[data-automation-id="verifyPassword"]',
        'input[type="password"][data-automation-id="verifyPassword"]',
        'input[type="password"][name*="verify" i]',
        'input[type="password"][name*="confirm" i]',
        'input[type="password"][id*="verify" i]',
        'input[type="password"][id*="confirm" i]',
        'input[type="password"][aria-label*="verify" i]',
        'input[type="password"][placeholder*="verify" i]'
      ]);

      if (await locatorsReferToSame(passwordLocator, verifyLocator)) verifyLocator = null;

      if (!emailLocator && !passwordLocator && !verifyLocator) continue;
      if ((passwordLocator || verifyLocator) && !password) continue;

      const beforeUrl = page.url();
      let attempted = false;

      if (emailLocator && email) {
        attempted = true;
        await emailLocator.scrollIntoViewIfNeeded().catch(() => {});
        await emailLocator.fill('');
        await emailLocator.type(email, { delay: 20 }).catch(() => emailLocator.fill(email));
      }

      if (passwordLocator && password) {
        attempted = true;
        await passwordLocator.scrollIntoViewIfNeeded().catch(() => {});
        await passwordLocator.fill('');
        await passwordLocator.type(password, { delay: 20 }).catch(() => passwordLocator.fill(password));
      }

      if (verifyLocator && password) {
        attempted = true;
        await verifyLocator.scrollIntoViewIfNeeded().catch(() => {});
        await verifyLocator.fill('');
        await verifyLocator.type(password, { delay: 20 }).catch(() => verifyLocator.fill(password));
      }

      if (!attempted) continue;

      await checkAllCheckboxes(frame);
      console.log('signIn: checkbox sweep completed for frame.');

      if (await submitLogin(page, frame, emailLocator, passwordLocator, verifyLocator, beforeUrl)) {
        return true;
      }
    } catch (err) {
      console.log('signIn: frame processing error', err?.message || err);
      continue;
    }
  }

  return false;
}

async function submitLogin(page, frame, emailLocator, passwordLocator, verifyLocator, beforeUrl) {
  console.log('submitLogin: start, beforeUrl=', beforeUrl);

  const createAccountButton = await findCreateAccountButton(frame);
  if (createAccountButton) {
    const progressed = await clickAndCheckProgress(createAccountButton, page, beforeUrl, emailLocator, passwordLocator, verifyLocator);
    console.log(`submitLogin: Create Account click progressed=${progressed}`);
    if (progressed) return true;
    console.log('submitLogin: Create Account click did not progress, falling back to Sign In link.');
  } else {
    console.log('submitLogin: Create Account button not found in current frame.');
  }

  const signInLink = await findSignInLink(frame);
  if (!signInLink) {
    console.log('submitLogin: Sign In link not available.');
    return false;
  }

  const signInProgress = await clickAndCheckProgress(signInLink, page, beforeUrl, null, null, null);
  console.log(`submitLogin: Sign In link clicked (progressed=${signInProgress})`);
  await handlePopupOrModal(page).catch(() => {});
  return true;
}

async function findCreateAccountButton(frame) {
  try {
    const base = frame.getByRole('button', { name: /create account/i });
    if (await base.count().catch(() => 0) === 0) return null;
    const locator = base.first();
    const visible = await locator.isVisible().catch(() => false);
    return visible ? locator : null;
  } catch {
    return null;
  }
}

async function findSignInLink(frame) {
  try {
    let base = frame.getByRole('link', { name: /sign in/i });
    if (await base.count().catch(() => 0) === 0) {
      base = frame.locator('text=/sign in/i');
    }
    if (await base.count().catch(() => 0) === 0) return null;
    const locator = base.first();
    const visible = await locator.isVisible().catch(() => false);
    return visible ? locator : null;
  } catch {
    return null;
  }
}

async function clickAndCheckProgress(target, page, beforeUrl, emailLocator, passwordLocator, verifyLocator) {
  try {
    await target.scrollIntoViewIfNeeded().catch(() => {});
    const [nav] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => null),
      target.click({ timeout: 5000, button: 'left' })
    ]);
    if (!nav) await page.waitForLoadState('domcontentloaded').catch(() => {});
  } catch (err) {
    console.log('submitLogin: primary click failed', err?.message || err);
    return false;
  }

  return await didProgress(page, beforeUrl, emailLocator, passwordLocator, verifyLocator);
}

async function handlePopupOrModal(page) {
  try {
    const popup = await page.waitForEvent('popup', { timeout: 2000 }).catch(() => null);
    if (popup) {
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      await popup.bringToFront().catch(() => {});
      console.log('signIn: popup detected and focused.');
      return popup;
    }
  } catch {}

  try {
    const modalLocator = page.locator('[role="dialog"], .modal, .wd-popup, [data-automation-id*="dialog"]').filter({ has: page.locator('text=/sign in|sign on|email/i') });
    if (await modalLocator.count().catch(() => 0) > 0) {
      const modal = await modalLocator.first();
      if (await modal.isVisible().catch(() => false)) {
        console.log('signIn: modal detected.');
        await modal.focus().catch(() => {});
        return modal;
      }
    }
  } catch {}

  return null;
}

async function handleWorkdayModalSignIn(page) {
  try {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    // Only handle if the specific Workday sign-in modal is present and visible
    const dialog = page.locator('[role="dialog"][data-automation-id="popUpDialog"]').first();
    const visible = await dialog.isVisible({ timeout: 500 }).catch(() => false);
    if (!visible) return null; // not applicable; let caller fall back to generic

    const email = process.env.JOB_PORTAL_EMAIL || process.env.ACCOUNT_EMAIL || process.env.LOGIN_EMAIL;
    const password = process.env.JOB_PORTAL_PASSWORD || process.env.ACCOUNT_PASSWORD || process.env.LOGIN_PASSWORD;
    if (!email || !password) return false;

    const beforeUrl = page.url();

    const emailInput = dialog.locator('input[data-automation-id="email"]').first();
    const passwordInput = dialog.locator('input[data-automation-id="password"]').first();

    await emailInput.fill('');
    await emailInput.type(email, { delay: 15 }).catch(() => emailInput.fill(email));
    await passwordInput.fill('');
    await passwordInput.type(password, { delay: 15 }).catch(() => passwordInput.fill(password));

    // Prefer the overlay click_filter inside the modal; fallback to hidden submit
    const overlayButton = dialog.locator('[data-automation-id="click_filter"][role="button"]').first();
    const hiddenSubmit = dialog.locator('button[data-automation-id="signInSubmitButton"]').first();

    const clickTarget = (await overlayButton.count().catch(() => 0)) ? overlayButton : hiddenSubmit;
    await clickTarget.scrollIntoViewIfNeeded().catch(() => {});
    await clickTarget.click({ timeout: 3000 }).catch(() => clickTarget.evaluate(el => el.click()).catch(() => {}));

    // Do not wait for navigation; modal often resolves inline. Wait briefly and consider it handled.
    await page.waitForTimeout(1500).catch(() => {});

    // Consider it progressed if modal disappears or URL changes
    const stillVisible = await dialog.isVisible().catch(() => false);
    const progressed = !stillVisible || page.url() !== beforeUrl;
    if (!progressed) {
      // Bring any new popup to front just in case
      await handlePopupOrModal(page).catch(() => {});
    }
    return true; // Hand control back to router to re-detect next state
  } catch (err) {
    console.log('signIn: handleWorkdayModalSignIn error', err?.message || err);
    return null;
  }
}

async function didProgress(page, beforeUrl, emailLocator, passwordLocator, verifyLocator) {
  await page.waitForTimeout(1500).catch(() => {});
  const afterUrl = page.url();
  if (afterUrl !== beforeUrl) return true;

  const locators = [emailLocator, passwordLocator, verifyLocator].filter(Boolean);
  if (locators.length === 0) {
    return afterUrl !== beforeUrl;
  }
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) return false;
  }
  return true;
}

async function findInput(container, selectors) {
  for (const selector of selectors) {
    try {
      const locator = container.locator(selector).filter({ hasNot: container.locator('[disabled]') });
      const count = await locator.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        const candidate = locator.nth(i);
        const visible = await candidate.isVisible().catch(() => false);
        const enabled = await candidate.isEnabled().catch(() => false);
        if (visible && enabled) return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function locatorsReferToSame(a, b) {
  if (!a || !b) return false;
  try {
    const [ah, bh] = await Promise.all([a.elementHandle(), b.elementHandle()]);
    if (!ah || !bh) {
      await ah?.dispose();
      await bh?.dispose();
      return false;
    }
    const same = await ah.evaluate((node, other) => node === other, bh);
    await ah.dispose();
    await bh.dispose();
    return same;
  } catch {
    return false;
  }
}

async function checkAllCheckboxes(container) {
  try {
    const checkboxes = container.locator('input[type="checkbox"]').filter({ hasNot: container.locator('[disabled]') });
    const count = await checkboxes.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const box = checkboxes.nth(i);
      const visible = await box.isVisible().catch(() => false);
      const enabled = await box.isEnabled().catch(() => false);
      if (!visible || !enabled) continue;
      const checked = await box.isChecked().catch(() => false);
      if (!checked) {
        await box.click({ timeout: 3000, button: 'left' }).catch(() => box.evaluate(el => el.click()).catch(() => {}));
      }
    }
  } catch {}
}
