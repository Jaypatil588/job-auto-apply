import { chromium } from 'playwright';
import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = 'AIzaSyBd3I4tMZ-KEHdro9t6bHwOpfvsdGYMXOc'; // Replace this

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

      // const applyButton = page.locator('*:visible').getByText('Apply', { exact: false }).first();
      // try {
      //   await applyButton.click({ timeout: 5000 });
      // } catch (e) {
      //   // Button was not found or not clickable within the timeout.
      // }

      // 1. Launch Firefox via Playwright
      // NOTE: You already launched browser above, so skip relaunching.
      // 2. Serve test content
      // await page.setContent(`
      //   <html>
      //     <body style="margin:0;height:100vh;position:relative;">
      //       <button id="apply" style="position:absolute;bottom:0px;left:20px;padding:10px 20px;font-size:16px;"
      //         onclick="alert('Button clicked')">Apply</button>
      //     </body>
      //   </html>
      // `);

      // // 3. Wait for layout
      // await page.waitForTimeout(1000);

      // 4. Take screenshot
      const screenshotPath = 'screenshot.png';
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // 5. Read image and encode as base64
      const imageBuffer = await fs.readFile(screenshotPath);
      const base64Image = imageBuffer.toString('base64');

      // 6. Prompt Gemini to locate the button
      const prompt = `Locate the position of "Apply" button or similar. The screen resolution for this attached image is 3024 x 1964 px. The button is inside the chromium window of this image. Return only JSON like this: {"x":<number>, "y":<number>, "width":<number>, "height":<number>}`;

      const result = await model.generateContent({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: 'image/png',
                },
              },
            ],
          },
        ],
      });

      const raw = await result.response.text();
      console.log("Gemini raw response:", raw);
      const match = raw.match(/{[^}]+}/);
      if (!match) {
        console.error("Gemini response missing bounding box:", raw);
        process.exit(1);
      }

      let box;
      try {
        box = JSON.parse(match[0]);
      } catch (e) {
        console.error("Malformed JSON:", match[0]);
        process.exit(1);
      }

      // 7. Move mouse and click center of bounding box
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      await page.mouse.move(centerX, centerY);
      await page.mouse.click(centerX, centerY);

      console.log("Click executed at:", centerX, centerY);

      // Optional: keep browser open for debugging
      await page.waitForTimeout(3000);
      await browser.close();
    }
  } catch (error) {
    // Errors are caught silently.
  } finally {
    // The browser remains open.
  }
}

main();