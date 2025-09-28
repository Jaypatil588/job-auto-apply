import { createAccount } from './createAccount.js';
import { signIn } from './signIn.js';
import { resumeFill } from '../resumeFill.js';

export async function fillCredentials(page) {
  const created = await createAccount(page);
  if (created) {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});
    return true;
  }

  const signedIn = await signIn(page);
  if (signedIn) return true;
          const resumeHandled = await resumeFill(activePage);
          return resumeHandled;
}
