import { clickApplyButton } from './navigation.js';
import { fillAllFrames } from './formParser.js';
import { fillCredentials } from './fillCredentials.js';

export async function detectPageState(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const frames = page.frames();

  for (const frame of frames) {
    try {
      const resumeInput = frame.locator('input[type="file"], [aria-label*="resume" i], [for*="resume" i], button:has-text("Attach" i), button:has-text("Upload" i)');
      const count = await resumeInput.count();
      for (let i = 0; i < count; i++) {
        if (await resumeInput.nth(i).isVisible().catch(() => false)) return 'form';
      }
    } catch {}
  }

  for (const frame of frames) {
    try {
      const apply = frame.locator('a:has-text("Apply" i), button:has-text("Apply" i), a.iCIMS_ApplyOnlineButton, a[title*="apply" i], a[href*="apply" i]');
      const count = await apply.count();
      for (let i = 0; i < count; i++) {
        if (await apply.nth(i).isVisible().catch(() => false)) return 'apply';
      }
    } catch {}
  }

  return 'login';
}

export async function runDynamicFlow(page) {
  let activePage = page;
  const maxSteps = 8;
  for (let step = 1; step <= maxSteps; step++) {
    activePage = await ensureActivePage(activePage);
    await activePage.waitForLoadState('domcontentloaded').catch(() => {});
    await activePage.waitForTimeout(3000).catch(() => {});
    const state = await detectPageState(activePage);
    console.log(`Dynamic flow step ${step}: state=${state}`);
    

    if (state === 'login') {
      const filled = await fillCredentials(activePage);
      console.log(`fillCredentials result: ${filled}`);
      if (!filled) return false;
      await activePage.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }

    if (state === 'apply') {
      const clicked = await clickApplyButton(activePage);
      if (!clicked) return false;
      await activePage.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }

    if (state === 'form') {
      await fillAllFrames(activePage);
      return true;
    }

    await fillAllFrames(activePage).catch(() => {});
    return true;
  }

  return false;
}

async function ensureActivePage(page) {
  try {
    if (!page || page.isClosed()) {
      const candidates = page?.context()?.pages() ?? [];
      const fallback = candidates.find(p => !p.isClosed());
      if (fallback) {
        await fallback.bringToFront().catch(() => {});
        return fallback;
      }
      return page;
    }

    const context = page.context();
    const pages = context.pages().filter(p => !p.isClosed());
    const latest = pages[pages.length - 1];
    if (latest && latest !== page) {
      await latest.bringToFront().catch(() => {});
      return latest;
    }
    return page;
  } catch {
    return page;
  }
}
