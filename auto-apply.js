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

      const btn = page.locator('text=Apply').first();
      await btn.waitFor({ state: 'visible' });
      const box = await btn.boundingBox();
      if (box) {
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y, { steps: 20 });
        await page.mouse.click(x, y);
      }
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // browser remains open
  }
}

main();
