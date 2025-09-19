import { clickApplyButton } from './navigation.js';
import { fillAllFrames } from './formParser.js';
import { fillCredentials } from './fillCredentials.js';

export async function detectPageState(page) {
  const frames = page.frames();

  const has = async (frame, selector) => (await frame.locator(selector).count()) > 0;
  const visible = async (frame, selector) => {
    const loc = frame.locator(selector);
    const count = await loc.count();
    for (let i = 0; i < count; i++) {
      if (await loc.nth(i).isVisible().catch(() => false)) return true;
    }
    return false;
  };

  for (const frame of frames) {
    try {
      const emailLike = await has(frame, 'input[type="email"], input[autocomplete="email" i], input[name*="email" i], input[id*="email" i], input[name*="user" i], input[id*="user" i]');
      const passwordLike = await has(frame, 'input[type="password"], input[name*="password" i], input[id*="password" i]');
      const authCta = await visible(frame, 'button:has-text("Sign in" i), button:has-text("Log in" i), input[type="submit"]');
      if (emailLike && passwordLike && authCta) return 'login';
    } catch {}
  }

  for (const frame of frames) {
    try {
      const fieldCount = await frame.locator('input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]), textarea, select').count();
      const hasResume = await has(frame, 'input[type="file"], [aria-label*="resume" i], [for*="resume" i]');
      const submitApp = await visible(frame, 'button:has-text("Submit" i), button:has-text("Submit application" i), button:has-text("Next" i)');
      if (fieldCount >= 6 || hasResume || submitApp) return 'form';
    } catch {}
  }

  for (const frame of frames) {
    try {
      const hasApply = await visible(frame,
        'a:has-text("Apply" i), button:has-text("Apply" i), a.iCIMS_ApplyOnlineButton, a[title*="apply" i], a[href*="apply" i]'
      );
      if (hasApply) return 'apply';
    } catch {}
  }

  return 'unknown';
}

export async function runDynamicFlow(page) {
  const maxSteps = 8;
  for (let step = 1; step <= maxSteps; step++) {
    const state = await detectPageState(page);

    if (state === 'login') {
      const filled = await fillCredentials(page);
      if (!filled) return false;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }

    if (state === 'apply') {
      const clicked = await clickApplyButton(page);
      if (!clicked) return false;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }

    if (state === 'form') {
      await fillAllFrames(page);
      return true;
    }

    await fillAllFrames(page).catch(() => {});
    return false;
  }

  return false;
}

