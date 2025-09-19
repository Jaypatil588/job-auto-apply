import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import path from 'path'; // Needed for file uploads

// // --- Personal Context & AI Setup ---
// const personalContext = {
//     "FirstName": "Jay",
//     "LastName": "Patil",
//     "email": "Jaypatil588@gmail.com",
//     "phone": "6693407293",
//     "linkedin": "https://www.linkedin.com/in/jaypatil588",
//     "address": "Santa Clara, CA",
//     "address_line1": "431 el camino real",
//     "city": "Santa Clara",
//     "state": "CA",
//     "postal_code": "95050",
//     "citizenship": "India",
//     "us_citizen": false,
//     "work_authorization": "Authorized to work in the US without sponsorship",
//     "needs_visa_sponsorship": false,
//     "veteran_status": "Not a veteran",
//     "disability_status": "Not disabled",
//     "ethnicity": "Asian",
//     "previously_employed_at_company": false,
//     "gender": "Male",
//     // Make sure 'resume.pdf' is in the same folder as this script
//     "resume_filename": "resume.pdf",
//     "education": [{
//         "school": "Santa Clara University",
//         "degree": "Master of Science",
//         "major": "Computer Science and Engineering",
//         "start_date": "September 2024",
//         "end_date": "June 2026",
//         "location": "Santa Clara, CA"
//     }, {
//         "school": "MIT Art Design & Technology",
//         "degree": "Bachelor of Technology",
//         "major": "Computer Science",
//         "start_date": "May 2018",
//         "end_date": "August 2022",
//         "location": "India"
//     }],
//     "experience": [{
//         "title": "Student Web Developer",
//         "company": "Santa Clara University",
//         "location": "Santa Clara, CA",
//         "start_date": "June 2025",
//         "end_date": "October 2025"
//     }],
// };

    const { readFile } = require('fs/promises');

    async function readJsonFile() {
        try {
            const data = await readFile('data.json', 'utf8');
            const jsonData = JSON.parse(data);
            console.log(jsonData);
        } catch (error) {
            console.error('Error reading or parsing JSON file:', error);
        }
    }

    const personalContext = readJsonFile();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// --- Helper Functions (Unchanged) ---
async function getAiSuggestionForSingleField(field) {
    console.log(`🧠 Asking AI for help with field: "${field.name}"`);
    let prompt;
    const contextText = `My Profile: ${JSON.stringify(personalContext)}`;

    if (field.type === 'select' && field.options) {
        prompt = `Based on my profile, which of the following options is the best choice for the form field "${field.name}"?\nOptions: ${JSON.stringify(field.options)}\n${contextText}\nRespond with ONLY the exact text of the best option and nothing else.`;
    } else {
        prompt = `Based on my profile, what is the best value to enter for the form field "${field.name}"?\n${contextText}\nRespond with ONLY the value and nothing else.`;
    }
    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error(`❌ AI failed for field "${field.name}":`, error.message);
        return null;
    }
}

async function getElementLabel(element) {
    for (const attr of ['aria-label', 'placeholder', 'name', 'id']) {
        const value = await element.getAttribute(attr);
        if (value) return value;
    }
    return null;
}

function findBestKeyMatch(label) {
    if (!label) return null;
    // FIX: This function now removes spaces to ensure consistent matching.
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const normalizedLabel = normalize(label);
    if (!normalizedLabel) return null;

    let bestMatch = null;
    let highScore = 0;

    for (const key in personalContext) {
        // Example: "FirstName" becomes "firstname"
        const normalizedKey = normalize(key);
        let score = 0;

        // "firstname" is included in "firstname"
        if (normalizedLabel.includes(normalizedKey) || normalizedKey.includes(normalizedLabel)) {
            score = 8;
        }

        if (score > highScore) {
            highScore = score;
            bestMatch = key;
        }
    }
    // Using a threshold of 5 to ensure a reasonably confident match
    return highScore > 5 ? bestMatch : null;
}

function getValueFromContext(key, fieldName = '') {
    const value = personalContext[key];
    const lowerFieldName = fieldName.toLowerCase();

    const yesNoKeywords = ['sponsorship', 'visa', 'authorized', 'legally', 'require'];
    if (yesNoKeywords.some(kw => lowerFieldName.includes(kw))) {
        return personalContext.needs_visa_sponsorship ? 'Yes' : 'No';
    }
    if (key === 'education') {
        const latest = value[0];
        if (lowerFieldName.includes('school') || lowerFieldName.includes('university')) return latest.school;
        if (lowerFieldName.includes('degree')) return latest.degree;
        if (lowerFieldName.includes('major') || lowerFieldName.includes('discipline')) return latest.major;
        return `${latest.degree} in ${latest.major}, ${latest.school}`;
    }
    if (key === 'experience') return `${value[0].title} at ${value[0].company}`;
    if (key === 'address' || key === 'location') return personalContext.city;
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
}

function findBestDropdownOption(contextValue, options) {
    if (!contextValue) return null;
    const lowerContext = String(contextValue).toLowerCase().trim();
    let bestOption = null, highScore = 0;
    const isNegativeContext = ['no', 'not', 'false'].some(neg => lowerContext.includes(neg));
    for (const option of options) {
        const lowerOption = option.toLowerCase().trim();
        let score = 0;
        if (lowerOption === lowerContext) score = 20;
        else if (lowerOption.includes(lowerContext)) score = 10;

        const isNegativeOption = ['no', 'not', 'false'].some(neg => lowerOption.includes(neg));
        if (isNegativeContext && isNegativeOption) score = Math.max(score, 15);

        if (score > highScore) {
            highScore = score;
            bestOption = option;
        }
    }
    return bestOption;
}

// --- REFACTORED CORE LOGIC ---
async function fillFrame(frame) {
    // PASS 1: DISCOVER - Create an ordered map of all visible fields
    console.log("\n🔎 Pass 1: Discovering all fillable fields...");
    const fieldQueue = [];
    const inputsAndTextareas = frame.locator('input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea');
    for (let i = 0; i < await inputsAndTextareas.count(); i++) {
        const el = inputsAndTextareas.nth(i);
        try {
            if (await el.isVisible() && await el.isEnabled()) {
                const label = await getElementLabel(el);
                const type = await el.getAttribute('type');
                if (label) fieldQueue.push({ name: label.trim(), type: type === 'file' ? 'file' : 'text', locator: el });
            }
        } catch (e) { /* Ignore non-interactable elements */ }
    }
    const selects = frame.locator('select');
    for (let i = 0; i < await selects.count(); i++) {
        const el = selects.nth(i);
        try {
            if (await el.isVisible() && await el.isEnabled()) {
                const label = await getElementLabel(el);
                if (label) {
                    const options = (await el.locator('option').allInnerTexts()).map(opt => opt.trim()).filter(Boolean);
                    if (options.length > 1) fieldQueue.push({ name: label.trim(), type: 'select', options, locator: el });
                }
            }
        } catch (e) { /* Ignore non-interactable elements */ }
    }
    console.log(`  -> Discovered ${fieldQueue.length} fields.`);

    // PASS 2: POPULATE - Determine the value for each field (local or AI)
    console.log("\n📝 Pass 2: Populating values for each field...");
    for (const field of fieldQueue) {
        const matchedKey = findBestKeyMatch(field.name);
        let valueToFill = null;

        if (matchedKey) {
            const contextValue = getValueFromContext(matchedKey, field.name);
            if (field.type === 'select') {
                valueToFill = findBestDropdownOption(contextValue, field.options);
            } else {
                valueToFill = contextValue;
            }
            if (valueToFill) console.log(`  [Local] Field "${field.name}" -> "${valueToFill}"`);
        }
        
        // If no local match was found, use AI
        if (!valueToFill) {
            await new Promise(resolve => setTimeout(resolve, 4100)); // Rate limiting
            const aiSuggestion = await getAiSuggestionForSingleField(field);
            if(aiSuggestion) {
                valueToFill = aiSuggestion;
                console.log(`  [AI]    Field "${field.name}" -> "${valueToFill}"`);
            }
        }
        field.finalValue = valueToFill; // Store the determined value back into our map
    }

    // PASS 3: EXECUTE - Iterate through the populated map and fill the form
    console.log("\n🚀 Pass 3: Executing fill actions...");
    for (const field of fieldQueue) {
        if (!field.finalValue) {
            console.log(`  -> Skipping "${field.name}" (no value found).`);
            continue;
        }
        try {
            if (field.type === 'select') {
                const bestOption = findBestDropdownOption(field.finalValue, field.options);
                if (bestOption) {
                    console.log(`  -> Selecting "${bestOption}" for "${field.name}"`);
                    await field.locator.selectOption({ label: bestOption });
                } else {
                     console.warn(`  -> Could not find option for "${field.finalValue}" in "${field.name}"`);
                }
            } else if (field.type === 'file') {
                const lowerFieldName = field.name.toLowerCase();
                if (lowerFieldName.includes('resume')) {
                    console.log(`  -> Uploading resume for "${field.name}"`);
                    await field.locator.setInputFiles(path.resolve(personalContext.resume_filename));
                } else {
                    console.log(`  -> Skipping file field "${field.name}" (not a resume).`);
                }
            } else {
                console.log(`  -> Filling "${field.name}"`);
                await field.locator.fill(field.finalValue);
            }
        } catch (e) {
            console.error(`  -> ❌ ERROR interacting with field "${field.name}":`, e.message);
        }
    }
}


// --- Main Execution ---
async function main() {
    console.log("🚀 Starting the auto-apply bot...");
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 1024 });

    try {
        await page.goto('https://github.com/SimplifyJobs/New-Grad-Positions/blob/dev/README.md', { waitUntil: 'networkidle' });

        const jobMap = new Map();
        const rows = page.locator('article table').first().locator('tbody tr');
        for (let i = 0; i < await rows.count(); i++) {
            const row = rows.nth(i);
            try {
                const linkLocator = row.locator('a:not([href*="simplify.jobs"])').first();
                if (await linkLocator.count() > 0) {
                    const companyName = await row.locator('td').first().innerText({ timeout: 1000 });
                    const link = await linkLocator.getAttribute('href');
                    jobMap.set(companyName.trim(), link);
                    break;
                }
            } catch (e) {}
        }

        if (jobMap.size === 0) {
            console.error("❌ No valid job links found.");
            return;
        }

        const [company, url] = jobMap.entries().next().value;
        console.log(`✅ Found job at ${company}. Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle' });

        const applyButton = page.locator('button, a').filter({ hasText: /apply/i }).first();
        if (await applyButton.count() > 0) {
            console.log("✅ Apply button found, clicking...");
            await applyButton.click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(3000);
        }

        await fillFrame(page.mainFrame());
        for (const frame of page.frames()) {
            if (frame !== page.mainFrame()) {
                await fillFrame(frame);
            }
        }

        console.log("\n✅ Script finished processing all fields.");
        await page.waitForTimeout(10000);

    } catch (error) {
        console.error("An error occurred during the main process:", error);
    } finally {
        console.log("🛑 Bot finished.");
        // await browser.close();
    }
}

main();