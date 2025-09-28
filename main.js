import { chromium } from 'playwright';
import { initializeAll } from './components/envSetup.js';
import { performNavigationFlow } from './components/navigation.js';
// Deprecated flows removed. We'll route per-site going forward.
import { signIn as workdaySignIn } from './NewComponents/signIn.js';
import { createAccount as workdayCreateAccount } from './NewComponents/createAccount.js';
import { handleResumeUpload } from './NewComponents/resumeUpload.js';

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
            console.log('Detected Workday URL. Attempting sign-in.');
            const signedIn = await workdaySignIn(page);
            if (!signedIn) {
                console.log('Sign-in not detected. Proceeding to create-account flow.');
                await workdayCreateAccount(page).catch(() => { });
                // console.log('Attempting resume upload..');
                // const uploadCheck = await handleResumeUpload(page);
                // if (!uploadCheck) {
                //     console.log('Resume not uploaded');
                // }
            }

        } else {
            console.log('No specific flow matched for URL:', currentUrl);
        }

        await page.waitForTimeout(2000);
    } catch (error) {
        console.error('Main process error:', error);
    } finally {
        console.log('Bot finished.');
        // await browser.close();
    }
}

main().catch(console.error);
