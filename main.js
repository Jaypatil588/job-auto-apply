import { chromium } from 'playwright';
import { initializeAll } from './components/envSetup.js';
import { performNavigationFlow } from './components/navigation.js';
// Deprecated flows removed. We'll route per-site going forward.
import { signIn as workdaySignIn } from './NewComponents/signIn.js';

async function main() {
    console.log('Starting job auto-apply bot');

    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 600, height: 600 });

    try {
        await initializeAll();

        const navigationResult = await performNavigationFlow(page);
        if (!navigationResult.success) {
            console.error('Navigation failed:', navigationResult.error);
            return;
        }

        const currentUrl = page.url();
        if (/workday/i.test(currentUrl)) {
            console.log('Detected Workday URL. Proceeding to Workday sign-in flow.');
            await workdaySignIn(page);
        } else {
            console.log('No specific flow matched for URL:', currentUrl);
        }

        await page.waitForTimeout(10000);
    } catch (error) {
        console.error('Main process error:', error);
    } finally {
        console.log('Bot finished.');
        // await browser.close();
    }
}

main().catch(console.error);
