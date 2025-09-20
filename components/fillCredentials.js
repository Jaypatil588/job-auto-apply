import { createAccount } from './createAccount.js';

export async function fillCredentials(page) {
  const username = process.env.JOB_PORTAL_USERNAME || process.env.ACCOUNT_USERNAME || process.env.LOGIN_USERNAME;
  const email = process.env.JOB_PORTAL_EMAIL || process.env.ACCOUNT_EMAIL || process.env.LOGIN_EMAIL;
  const password = process.env.JOB_PORTAL_PASSWORD || process.env.ACCOUNT_PASSWORD || process.env.LOGIN_PASSWORD;

  if (!username && !email && !password) return false;


  //Will need to handle the case where the accoutn already exists and needs to be logged in
  await page.waitForLoadState('domcontentloaded').catch(() => {});
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

      if (!emailLocator){
      const usernameLocator = await findInput(frame, [
        'input[data-automation-id="username"]',
        'input[autocomplete="username" i]',
        'input[name*="user" i]',
        'input[id*="user" i]',
        'input[type="text"]'
      ]);}

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

      if (await locatorsReferToSame(passwordLocator, verifyLocator)) {
        verifyLocator = null;
      }

      if (!emailLocator && !passwordLocator && !verifyLocator) {
        continue;
      }

      if ((passwordLocator || verifyLocator) && !password) {
        continue;
      }

      const beforeUrl = page.url();
      let attempted = false;

      if (emailLocator) {
        const value = email || username;
        if (value) {
          attempted = true;
          await emailLocator.scrollIntoViewIfNeeded().catch(() => {});
          await emailLocator.fill('');
          await emailLocator.type(value, { delay: 20 }).catch(() => emailLocator.fill(value));
        }
      }

      if (!emailLocator){
      if (usernameLocator) {
        const value = username || email;
        if (value) {
          attempted = true;
          await usernameLocator.scrollIntoViewIfNeeded().catch(() => {});
          await usernameLocator.fill('');
          await usernameLocator.type(value, { delay: 20 }).catch(() => usernameLocator.fill(value));
        }
      }}

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

      const submitted = await submitLogin(page, frame, emailLocator, usernameLocator, passwordLocator, verifyLocator, beforeUrl);
      if (submitted) return true;

      const created = await createAccount(page);
      if (created) return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function submitLogin(page, frame, emailLocator, usernameLocator, passwordLocator, verifyLocator, beforeUrl) {
  const submitCandidates = [
    frame.getByRole('button', { name: /sign in|log in|submit|continue|next/i }),
    frame.locator('button[type="submit"]'),
    frame.locator('input[type="submit"]'),
  ];

  for (const cand of submitCandidates) {
    if (await cand.count() === 0) continue;

    try {
      const target = cand.first();
      await target.scrollIntoViewIfNeeded().catch(() => {});
      const [nav] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => null),
        target.click({ timeout: 5000 })
      ]);
      if (!nav) await page.waitForLoadState('domcontentloaded').catch(() => {});

      if (await didProgress(page, beforeUrl, emailLocator, usernameLocator, passwordLocator, verifyLocator)) return true;
      return false;
    } catch {
      continue;
    }
  }

  try {
    const target = passwordLocator || verifyLocator || usernameLocator || emailLocator;
    await target?.press('Enter');
    await page.waitForLoadState('domcontentloaded', { timeout: 6000 }).catch(() => {});
    if (await didProgress(page, beforeUrl, emailLocator, usernameLocator, passwordLocator, verifyLocator)) return true;
  } catch {}

  return false;
}

async function didProgress(page, beforeUrl, emailLocator, usernameLocator, passwordLocator, verifyLocator) {
  await page.waitForTimeout(2000).catch(() => {});
  const afterUrl = page.url();
  if (afterUrl !== beforeUrl) return true;

  const locators = [emailLocator, usernameLocator, passwordLocator, verifyLocator];
  for (const locator of locators) {
    if (locator && await locator.isVisible().catch(() => false)) return false;
  }
  return true;
}

async function findInput(frame, selectors) {
  for (const selector of selectors) {
    try {
      const locator = frame.locator(selector).filter({ hasNot: frame.locator('[disabled]') });
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
