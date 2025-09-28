
/**
 * Navigates to a Workday job application and uploads a resume.
 * @param {import('playwright').Page} page The Playwright page object.
 * @param {string} filePath The absolute or relative path to the resume file.
 */
export async function resumeFill(page, filePath) {
  const applicationUrl = 'https://northmark.wd108.myworkdayjobs.com/en-US/NMS/job/Graduate-Program_R12714/apply/autofillWithResume';
  const fileInputSelector = 'input[data-automation-id="file-upload-input-ref"]';

  console.log(`Navigating to ${applicationUrl}...`);
  await page.goto(applicationUrl);

  console.log(`Uploading file: ${filePath}`);
  await page.setInputFiles(fileInputSelector, filePath);
}