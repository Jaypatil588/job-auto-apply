export async function findJobLinks(page) {
    await page.goto('https://github.com/SimplifyJobs/New-Grad-Positions/blob/dev/README.md', {
        waitUntil: 'networkidle'
    });

    const jobMap = new Map();
    const rows = page.locator('article table').first().locator('tbody tr');

    for (let i = 0; i < await rows.count(); i++) {
        const row = rows.nth(i);
        try {
            const linkLocator = row.locator('a:not([href*="simplify.jobs"])').first();
            if (await linkLocator.count() === 0) continue;

            const companyName = await row.locator('td').first().innerText({ timeout: 1000 });
            const link = await linkLocator.getAttribute('href');
            if (link) jobMap.set(companyName.trim(), link);
        } catch {
            continue;
        }
    }

    if (jobMap.size === 0) throw new Error('No valid job links found.');
    return jobMap;
}

export async function navigateToJob(page, url, companyName) {
    console.log(`Navigating to ${companyName}: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
}

export async function clickApplyButton(page) {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    const frames = page.frames();
    const collected = [];
    let order = 0;

    const sources = [
        { weight: 40, build: (frame) => frame.getByRole('button', { name: /apply/i }) },
        { weight: 30, build: (frame) => frame.locator('button:has-text("apply" i)') },
        { weight: 25, build: (frame) => frame.getByRole('link', { name: /apply/i }) },
        { weight: 22, build: (frame) => frame.locator('[data-automation-id="applyButton"]') },
        { weight: 18, build: (frame) => frame.locator('a.iCIMS_ApplyOnlineButton') },
        { weight: 16, build: (frame) => frame.locator('a[title*="apply" i]') },
        { weight: 14, build: (frame) => frame.locator('a[href*="mode=apply" i], a[href*="apply=yes" i], a[href*="apply" i]') },
        { weight: 10, build: (frame) => frame.locator('a, button').filter({ hasText: /apply/i }) }
    ];

    for (const frame of frames) {
        for (const source of sources) {
            let locator;
            try {
                locator = source.build(frame);
            } catch {
                continue;
            }

            let count;
            try {
                count = await locator.count();
            } catch {
                continue;
            }

            for (let i = 0; i < count; i++) {
                const candidate = locator.nth(i);
                try {
                    if (!(await candidate.isVisible().catch(() => false))) continue;
                    const text = (await candidate.innerText().catch(() => '') || '').toLowerCase();
                    if (!text.includes('apply')) continue;
                    if (text.includes('employee') || text.includes('workday account')) continue;

                    const tag = await candidate.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
                    const href = await candidate.getAttribute('href').catch(() => null);
                    let priority = source.weight;
                    if (tag === 'button') priority += 50;
                    if (href) priority += 5;

                    collected.push({ locator: candidate, priority, href, order: order++ });
                } catch {
                    continue;
                }
            }
        }
    }

    if (collected.length === 0) {
        console.warn('Apply button not found.');
        return false;
    }

    collected.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.order - b.order;
    });

    for (const entry of collected) {
        const target = entry.locator;
        const href = entry.href;
        const isLink = typeof href === 'string' && href.trim().length > 0;

        try {
            await target.scrollIntoViewIfNeeded().catch(() => {});
            const [popup] = await Promise.all([
                page.waitForEvent('popup', { timeout: 4000 }).catch(() => null),
                target.click({ timeout: 5000 })
            ]);
            if (popup) {
                await popup.waitForLoadState('domcontentloaded');
                await popup.bringToFront();
                await tryAutofillWithResume(popup).catch(() => {});
            } else {
                await page.waitForLoadState('domcontentloaded').catch(() => {});
                await tryAutofillWithResume(page).catch(() => {});
            }
            return true;
        } catch {
            if (!isLink) continue;
            try {
                const absolute = href.startsWith('http') ? href : new URL(href, page.url()).toString();
                await page.goto(absolute, { waitUntil: 'networkidle' });
                await tryAutofillWithResume(page).catch(() => {});
                return true;
            } catch (navErr) {
                console.warn(`Apply navigation failed: ${navErr.message.split('\n')[0]}`);
                continue;
            }
        }
    }

    console.warn('Apply button not found.');
    return false;
}

async function tryAutofillWithResume(page) {
    try {
        const button = page.getByRole('button', { name: /autofill with resume/i }).first();
        if (await button.count() === 0) return false;
        await button.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        if (!(await button.isVisible().catch(() => false))) return false;
        await button.click({ timeout: 4000 }).catch(async () => {
            await button.evaluate(el => el.click()).catch(() => {});
        });
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        return true;
    } catch (err) {
        console.warn(`Autofill selection failed: ${String(err.message || err).split('\n')[0]}`);
        return false;
    }
}

export async function performNavigationFlow(page) {
    try {
        const jobMap = await findJobLinks(page);
        const entries = Array.from(jobMap.entries());

        const idxEnv = process.env.NAV_TARGET_INDEX;
        let targetIndex = Number.isFinite(Number(idxEnv)) ? Number(idxEnv) : 0;
        if (targetIndex < 0) targetIndex = 0;
        if (targetIndex >= entries.length) {
            console.warn(`NAV_TARGET_INDEX=${targetIndex} is out of range (0..${entries.length - 1}). Using last entry.`);
            targetIndex = Math.max(0, entries.length - 1);
        }

        const [companyName, jobUrl] = entries[targetIndex];
        console.log(`Selected job index ${targetIndex}: ${companyName}`);

        await navigateToJob(page, jobUrl, companyName);
        const applyClicked = await clickApplyButton(page);

        return {
            success: true,
            companyName,
            jobUrl,
            applyClicked
        };
    } catch (error) {
        console.error('Navigation failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}
