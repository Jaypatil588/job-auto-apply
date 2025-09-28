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
  await container.locator('button[type="submit"]').first().click();

  return true;
}
