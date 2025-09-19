const { chromium } = require('playwright');

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: false, slowMo: 200 });
    const page = await browser.newPage();
    const jobMap = new Map();

    await page.goto('https://github.com/SimplifyJobs/New-Grad-Positions/blob/dev/README.md');

    const rows = page.locator('article table').first().locator('tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const companyName = await row.locator('td').first().innerText();
      const link = await row.locator('a:not([href^="https://simplify.jobs/"])').first().getAttribute('href');

      if (link) {
        const cleanedLink = link.replace("utm_source=Simplify&ref=Simplify", "").replace(/[?&]$/, "");
        jobMap.set(companyName.trim(), cleanedLink);
      }
    }

    if (jobMap.size > 0) {
      const firstUrl = jobMap.values().next().value;
      await page.goto(firstUrl);

      const applyButton = page.locator('*:visible').getByText('Apply', { exact: false }).first();

      try {
        await applyButton.click({ timeout: 5000 });
      } catch (e) {
        // Button was not found or not clickable within the timeout.
      }
    }
  } catch (error) {
    // Errors are caught silently.
  } finally {
    // The browser remains open.
  }
}

main();