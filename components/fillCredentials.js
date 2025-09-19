import { createAccount } from './createAccount.js';

export async function fillCredentials(page) {
  const email = process.env.JOB_PORTAL_EMAIL || process.env.ACCOUNT_EMAIL || process.env.LOGIN_EMAIL;
  const password = process.env.JOB_PORTAL_PASSWORD || process.env.ACCOUNT_PASSWORD || process.env.LOGIN_PASSWORD;

  if (!email || !password) return false;

  const frames = page.frames();
  for (const frame of frames) {
    try {
      const emailLocator = frame.locator(
        'input[type="email"], input[autocomplete="email" i], input[name*="email" i], input[id*="email" i], input[name*="user" i], input[id*="user" i]'
      ).first();
      const passwordLocator = frame.locator(
        'input[type="password"], input[name*="password" i], input[id*="password" i]'
      ).first();

      if (await emailLocator.count() === 0 || await passwordLocator.count() === 0) continue;

      const beforeUrl = page.url();

      await emailLocator.scrollIntoViewIfNeeded().catch(() => {});
      await emailLocator.fill('');
      await emailLocator.type(email, { delay: 20 }).catch(() => emailLocator.fill(email));

      await passwordLocator.scrollIntoViewIfNeeded().catch(() => {});
      await passwordLocator.fill('');
      await passwordLocator.type(password, { delay: 20 }).catch(() => passwordLocator.fill(password));

      const submitted = await submitLogin(page, frame, emailLocator, passwordLocator, beforeUrl);
      if (submitted) return true;

      const created = await createAccount(page);
      if (created) return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function submitLogin(page, frame, emailLocator, passwordLocator, beforeUrl) {
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

      if (await didProgress(page, beforeUrl, emailLocator, passwordLocator)) return true;
      return false;
    } catch {
      continue;
    }
  }

  try {
    await passwordLocator.press('Enter');
    await page.waitForLoadState('domcontentloaded', { timeout: 6000 }).catch(() => {});
    if (await didProgress(page, beforeUrl, emailLocator, passwordLocator)) return true;
  } catch {}

  return false;
}

async function didProgress(page, beforeUrl, emailLocator, passwordLocator) {
  await page.waitForTimeout(2000).catch(() => {});
  const afterUrl = page.url();
  if (afterUrl !== beforeUrl) return true;

  const emailVisible = await emailLocator.isVisible().catch(() => false);
  const passwordVisible = await passwordLocator.isVisible().catch(() => false);
  return !(emailVisible || passwordVisible);
}

