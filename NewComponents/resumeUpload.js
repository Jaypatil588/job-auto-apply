import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function handleResumeUpload(page) {
  console.log('--- Step 3: Upload Resume ---');
  console.log('Checking for resume upload page...');
  try {
    // 1. Confirm we are on the correct page by finding the header.
    const header = page.getByRole('heading', { name: 'Autofill with Resume' });
    await header.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Resume page confirmed. Preparing to upload...');

    // 2. Define the path to the resume file.
    const resumePath = path.join(__dirname, 'resume.pdf');

    // 3. Locate the hidden file input element and set its value to the resume path.
    const fileInputElement = page.locator('[data-automation-id="file-upload-input-ref"]');
    await fileInputElement.setInputFiles(resumePath);
    console.log(`Successfully attached file: ${resumePath}`);
    
    // 4. Wait for the upload to register, then click Continue.
    await page.waitForTimeout(3000);
    const continueButton = page.locator('[data-automation-id="pageFooterNextButton"]');
    await continueButton.click();
    
    console.log('Resume uploaded and "Continue" button clicked.');
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return true;

  } catch (error) {
    console.error('⛔️ Error: Could not find the "Autofill with Resume" page or failed to upload.');
    console.error(error.message);
    return false;
  }
}