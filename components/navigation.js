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
    const frames = page.frames();
    for (const frame of frames) {
        try {
            const candidates = [
                frame.getByRole('link', { name: /apply/i }),
                frame.getByRole('button', { name: /apply/i }),
                frame.locator('a.iCIMS_ApplyOnlineButton'),
                frame.locator('a[title*="apply" i]'),
                frame.locator('a[href*="mode=apply" i], a[href*="apply=yes" i], a[href*="apply" i]'),
                frame.locator('a, button').filter({ hasText: /apply/i })
            ];

            for (const cand of candidates) {
                if (await cand.count() === 0) continue;
                const target = cand.first();
                const href = await target.getAttribute('href').catch(() => null);

                try {
                    await target.scrollIntoViewIfNeeded().catch(() => {});
                    const [popup] = await Promise.all([
                        page.waitForEvent('popup', { timeout: 4000 }).catch(() => null),
                        target.click({ timeout: 5000 })
                    ]);
                    if (popup) {
                        await popup.waitForLoadState('domcontentloaded');
                        await popup.bringToFront();
                    } else {
                        await page.waitForLoadState('domcontentloaded').catch(() => {});
                    }
                    return true;
                } catch (clickErr) {
                    if (!href) continue;
                    try {
                        const absolute = href.startsWith('http') ? href : new URL(href, page.url()).toString();
                        await page.goto(absolute, { waitUntil: 'networkidle' });
                        return true;
                    } catch (navErr) {
                        console.warn(`Apply navigation failed: ${navErr.message.split('\n')[0]}`);
                    }
                }
            }
        } catch {
            continue;
        }
    }

    console.warn('Apply button not found.');
    return false;
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

