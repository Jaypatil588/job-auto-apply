import { chromium } from 'playwright';

async function fillFrame(frame) {
  // --- Fill text-like inputs ---
  const inputs = frame.locator('input:not([disabled]):not([readonly])');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const el = inputs.nth(i);
    const typeAttr = (await el.getAttribute('type')) || '';
    const type = typeAttr.toLowerCase();

    let value = null;
    if (['', 'text'].includes(type)) value = '1';
    else if (type === 'email') value = 'test@example.com';
    else if (type === 'tel') value = '1234567890';
    else if (type === 'number') value = '1';

    if (value !== null) {
      try {
        if (await el.isVisible()) {
          await el.fill(value, { timeout: 1000 });
        }
      } catch {}
    }
  }

  // --- Fill textareas ---
  const textareas = frame.locator('textarea:not([disabled]):not([readonly])');
  const taCount = await textareas.count();
  for (let i = 0; i < taCount; i++) {
    try {
      await textareas.nth(i).fill('1', { timeout: 1000 });
    } catch {}
  }

  // --- Select first option in dropdowns ---
  const selects = frame.locator('select:not([disabled])');
  const selectCount = await selects.count();
  for (let i = 0; i < selectCount; i++) {
    const el = selects.nth(i);
    const options = await el.locator('option').all();
    if (options.length > 0) {
      const firstValue = await options[0].getAttribute('value');
      try {
        await el.selectOption(firstValue);
      } catch {}
    }
  }

  // --- Click first radio in each group ---
  const radios = frame.locator('input[type=radio]:not([disabled])');
  const radioCount = await radios.count();
  const seenNames = new Set();
  for (let i = 0; i < radioCount; i++) {
    const el = radios.nth(i);
    const name = await el.getAttribute('name');
    if (!name || seenNames.has(name)) continue;
    try {
      await el.check();
      seenNames.add(name);
    } catch {}
  }
}

async function main() {
  console.log("🚀 Starting the auto-apply bot...");
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    await page.goto('https://github.com/SimplifyJobs/New-Grad-Positions/blob/dev/README.md', { waitUntil: 'networkidle' });

    console.log("📄 Scraping for the first valid job link...");
    const jobMap = new Map();
    const rows = page.locator('article table').first().locator('tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      try {
        const companyName = await row.locator('td').first().innerText({ timeout: 1000 });
        const linkLocator = row.locator('a:not([href^="https://simplify.jobs/"])').first();
        if (await linkLocator.count() > 0) {
          const link = await linkLocator.getAttribute('href');
          if (link) {
            const cleaned = link.replace(/utm_source=Simplify&ref=Simplify/g, "").replace(/[?&]$/, "");
            jobMap.set(companyName.trim(), cleaned);
            break; // stop after first
          }
        }
      } catch {}
    }

    if (jobMap.size === 0) {
      console.error("❌ No valid job links found on the GitHub page.");
      return;
    }

    const [company, firstUrl] = jobMap.entries().next().value;
    console.log(`✅ Found job at ${company}. Navigating to: ${firstUrl}`);
    await page.goto(firstUrl, { waitUntil: 'networkidle' });

    // --- Click "Apply" button in top document if exists ---
    console.log("🔎 Searching for an Apply button...");
    const applyButton = page.locator('button, a').filter({ hasText: /apply/i }).first();
    if (await applyButton.count()) {
      await Promise.all([
        applyButton.click().catch(() => {}),
        page.waitForTimeout(2000) // don't assume navigation
      ]);
      console.log("✅ Apply button clicked.");
    } else {
      console.log("ℹ️ No Apply button found, continuing.");
    }

    // --- Fill forms in main frame ---
    await fillFrame(page.mainFrame());

    // --- Fill forms in all iframes ---
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        await fillFrame(frame);
      } catch {}
    }

    console.log("✅ Filled all detected fields with dummy values.");
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    console.log("🛑 Bot finished.");
    // await browser.close(); // keep browser open for debugging
  }
}

main();
