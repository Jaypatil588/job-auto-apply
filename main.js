import { chromium } from 'playwright';
import { initializeAll } from './components/envSetup.js';
import { performNavigationFlow } from './components/navigation.js';
import { runDynamicFlow } from './components/pageRouter.js';

async function main() {
    console.log('Starting job auto-apply bot');

    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 1024 });

    try {
        await initializeAll();

        const navigationResult = await performNavigationFlow(page);
        if (!navigationResult.success) {
            console.error('Navigation failed:', navigationResult.error);
            return;
        }

        const completed = await runDynamicFlow(page);
        if (!completed) console.warn('Dynamic flow stopped before form completion.');

        await page.waitForTimeout(10000);
    } catch (error) {
        console.error('Main process error:', error);
    } finally {
        console.log('Bot finished.');
        // await browser.close();
    }
}

main().catch(console.error);

