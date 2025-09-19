import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Personal Context & AI Setup ---
const personalContext = {
    "FirstName": "Jay",
    "LastName": "Patil",
    "email": "Jaypatil588@gmail.com",
    "phone": "6693407293",
    "linkedin": "https://www.linkedin.com/in/jaypatil588",
    "address": "Santa Clara, CA",
    "address_line1": "431 el camino real",
    "city": "Santa Clara",
    "state": "CA",
    "postal_code": "95050",
    "citizenship": "India",
    "us_citizen": false,
    "work_authorization": "Authorized to work in the US without sponsorship (except major FAANG companies)",
    "needs_visa_sponsorship": false,
    "veteran_status": "Not a veteran",
    "disability_status": "Not disabled",
    "ethnicity": "Asian",
    "previously_employed_at_company": false,
    "gender": "Male",
    "education": [{
        "school": "Santa Clara University",
        "degree": "Master of Science",
        "major": "Computer Science and Engineering",
        "start_date": "September 2024",
        "end_date": "June 2026",
        "location": "Santa Clara, CA",
        "courses": ["Flutter mobile development", "Advanced Data structures", "GenAI", "Data mining", "SQA", "Advanced SQL", "Machine learning"]
    }, {
        "school": "MIT Art Design & Technology",
        "degree": "Bachelor of Technology",
        "major": "Computer Science",
        "specialization": "Intelligent Systems (AI and IOT systems)",
        "start_date": "May 2018",
        "end_date": "August 2022",
        "location": "India"
    }],
    "experience": [{
        "title": "Student Web Developer",
        "company": "Santa Clara University",
        "location": "Santa Clara, CA",
        "start_date": "June 2025",
        "end_date": "October 2025",
        "responsibilities": ["Built an interactive fellowships database in Firebase with embedded JavaScript in TerminalFour, enabling roughly 200 students/month to discover opportunities and reducing average search time from 10 minutes to under 1 minute.", "Developed an OpenAI fine-tuned RAG chatbot for the SCU Provost's office answering 100+ queries/month with 95% accuracy, outperforming NotebookLLM by 15% fewer errors in context retrieval.", "Delivered general website upgrades that cut page load times by ~30%."]
    }, {
        "title": "Graduate Web Intern",
        "company": "Santa Clara University",
        "location": "Santa Clara, CA",
        "start_date": "April 2025",
        "end_date": "June 2025",
        "responsibilities": ["Redesigned the off-campus listings platform using TerminalFour and React, resulting in 250 active listings and a 20% increase in student housing matches."]
    }, {
        "title": "ECC Lab Assistant",
        "company": "Santa Clara University",
        "location": "Santa Clara, CA",
        "start_date": "January 2025",
        "end_date": "Present",
        "responsibilities": ["Provided first-line technical support and led infrastructure improvement projects, resolving hardware/software issues, supporting virtualization tools, and automating diagnostics using Python and Ansible.", "Improved curriculum design by analyzing 1000 student feedback responses; built an NLP pipeline with PyTorch + Hugging Face achieving 12% higher F1 scores over logistic regression and LDA baselines in sentiment and topic classification.", "Delivered insights that led to three curriculum adjustments (grading policy revisions, clearer assignment guidelines, workload redistribution) boosting student satisfaction by 15% in follow-up surveys."]
    }, {
        "title": "EV Software Engineer (Embedded, Full-Stack & VMS)",
        "company": "Ador Powertron",
        "location": "Pune, India",
        "start_date": "March 2022",
        "end_date": "August 2024",
        "responsibilities": ["Led the development of intelligent charging systems for EV infrastructure and CCS chargers, focusing on HMI-based screens and CAN communications.", "Integrated EVSE hardware using the OCPP1.6 protocol; built a C#-based EV emulator to simulate battery charging curves and test charging scenarios, accelerating hardware validation and feature rollout timeline by 60%.", "Contributed to early-stage implementations of VGI smart charging, dynamic load balancing algorithm, dual-VCCU switching, and auto-charge scripts, reducing charging times by 50% by maximizing allocated KW energy.", "Worked on smart ANPR systems and power throttling systems that optimized grid interactions, lowering peak-hour energy costs by up to 20%.", "Designed REST APIs and integrated frontend applications (React.js, TypeScript) with OCPP for seamless user interaction and charger control, reducing user interaction latency by 12 seconds; collaborated with German partner ECOG to align OCPP2.0 and V2X standards.", "Developed SMTP-NTCIP based full-stack software for highway road signs, enabling remote operation via IoT and centralized integrated traffic management system, reducing accidents in hotspots by 90%."]
    }],
    "publications": [{
        "title": "Framework for Cloud-Based Messaging System Using MQTT",
        "conference": "ACTHPA'22",
        "publisher": "IEEE",
        "year": 2020,
        "summary": "Designed scalable AWS IoT solution for two-way device connections using MQTT."
    }, {
        "title": "Development of a Comparison Based Medicine Purchasing System",
        "summary": "Developed a system to compare medicine prices across cities and platforms, helping users find the most affordable medicines."
    }],
    "achievements_projects": ["Ranked 1st in Best Developer Feedback at Adobe systems hackathon.", "Awarded “Best Junior Developer” at Ador Powertron due to significant impact on EV feature development.", "Emotico: built a generative AI system that mimics user emotions in real-time using Node.js and Veo 3.", "Built gesture-guided object tracking robot arm using ROS, dynamic lightings for Playstation5 using Arduino and Raspberry Pi, control circuit for DIY smart home automation, NAS storage and more."],
    "skills": ["Python", "C#", ".NET", "ReactJS", "TypeScript", "Firebase", "JavaScript", "TerminalFour", "PyTorch", "Hugging Face", "OCPP", "CAN Communications", "REST APIs", "Ansible", "Machine Learning", "Data Mining", "Generative AI", "Full Stack Development", "Embedded Systems", "IoT"],
    "external_links": {
        "linkedin": "https://www.linkedin.com/in/jaypatil588"
    },
    "user_instructions": {
        "ethnicity": "Asian",
        "nationality": "Indian",
        "visa_sponsorship": "Does not require sponsorship for most jobs; will accept sponsorship only from major FAANG or equivalent companies that do not reject candidates needing H1B.",
        "veteran_status": "Not a veteran",
        "disability_status": "Not disabled",
        "us_citizen": false,
        "prior_employment": "Has never worked for any of the companies currently being applied to.",
        "phone_number": "6693407293",
        "gender": "Male",
        "candidate_goals": "Prioritize getting selected for roles while adhering to application policies and maximizing chances of success.",
        "cover_letter_rules": "Cover letters must sound human and avoid any form of dashes or underscores. The sentence structure must not use the pattern 'not only X, but also Y'; instead describe the qualities directly.",
        "response_rules": "Assistant responses should avoid emotionally positive tone, glazing, and should not praise or compliment the user. All statements must be logical, accurate and concise. Code provided should be full and working without requiring user modification."
    }
};

const apiKey = "AIzaSyBjdtX11b0FSAyE_gGHxwc-dPNpvfMdtvk"
if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable not set.");
}
const genAI = new GoogleGenerativeAI(apiKey);

async function getAiGeneratedValues(labels) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const prompt = `
      Based on the provided context about a person, fill in the values for the following list of form fields.
      Respond ONLY with a single, raw JSON object where the keys are the exact field names from the list and the values are the filled-in answers. Do not add any extra text, explanations, or markdown formatting.

      CONTEXT:
      ${JSON.stringify(personalContext, null, 2)}

      FORM FIELDS TO FILL:
      ${JSON.stringify(labels)}
    `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const generatedText = response.text();
        const filledValues = JSON.parse(generatedText);

        console.log("🧠 AI Response (Live):", filledValues);
        return new Map(Object.entries(filledValues));

    } catch (error) {
        console.error("❌ Failed to call Gemini API:", error);
        return new Map(); // Return an empty map on failure to prevent script crash
    }
}

// --- Playwright Automation Logic ---

async function fillFrame(frame) {
    // ... (This function remains unchanged)
    const fields = new Map();
    const textInputs = frame.locator('input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])');

    for (let i = 0; i < await textInputs.count(); i++) {
        const el = textInputs.nth(i);
        try {
            if (await el.isVisible()) {
                const label = await el.getAttribute('aria-label') || await el.getAttribute('placeholder') || await el.getAttribute('name');
                if (label) fields.set(label, el);
            }
        } catch {}
    }

    if (fields.size > 0) {
        const labelsToFill = Array.from(fields.keys());
        console.log(`🤖 Sending prompt for fields: ${labelsToFill.join(', ')}`);
        const aiValues = await getAiGeneratedValues(labelsToFill);
        for (const [label, locator] of fields.entries()) {
            try {
                const value = aiValues.get(label);
                if (value) await locator.fill(String(value), {
                    timeout: 1000
                });
            } catch {}
        }
    }

    const selects = frame.locator('select:not([disabled])');
    for (let i = 0; i < await selects.count(); i++) {
        const el = selects.nth(i);
        const options = await el.locator('option').all();
        if (options.length > 1) {
            try {
                await el.selectOption({
                    index: 1
                });
            } catch {}
        }
    }

    const radios = frame.locator('input[type=radio]:not([disabled])');
    const seenNames = new Set();
    for (let i = 0; i < await radios.count(); i++) {
        const el = radios.nth(i);
        const name = await el.getAttribute('name');
        if (name && !seenNames.has(name)) {
            try {
                await el.check();
                seenNames.add(name);
            } catch {}
        }
    }
}

async function main() {
    // ... (This function remains unchanged)
    console.log("🚀 Starting the auto-apply bot...");
    const browser = await chromium.launch({
        headless: false,
        slowMo: 150
    });
    const page = await browser.newPage();
    await page.setViewportSize({
        width: 1280,
        height: 800
    });

    try {
        await page.goto('https://github.com/SimplifyJobs/New-Grad-Positions/blob/dev/README.md', {
            waitUntil: 'networkidle'
        });

        console.log("📄 Scraping for the first valid job link...");
        const jobMap = new Map();
        const rows = page.locator('article table').first().locator('tbody tr');
        const rowCount = await rows.count();

        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            try {
                const companyName = await row.locator('td').first().innerText({
                    timeout: 1000
                });
                const linkLocator = row.locator('a:not([href^="https://simplify.jobs/"])').first();
                if (await linkLocator.count() > 0) {
                    const link = await linkLocator.getAttribute('href');
                    if (link) {
                        const cleaned = link.replace(/utm_source=Simplify&ref=Simplify/g, "").replace(/[?&]$/, "");
                        jobMap.set(companyName.trim(), cleaned);
                        break;
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
        await page.goto(firstUrl, {
            waitUntil: 'networkidle'
        });

        console.log("🔎 Searching for an Apply button...");
        const applyButton = page.locator('button, a').filter({
            hasText: /apply/i
        }).first();
        if (await applyButton.count()) {
            await Promise.all([
                applyButton.click().catch(() => {}),
                page.waitForTimeout(2000)
            ]);
            console.log("✅ Apply button clicked.");
        } else {
            console.log("ℹ️ No Apply button found, continuing.");
        }

        await fillFrame(page.mainFrame());

        for (const frame of page.frames()) {
            if (frame === page.mainFrame()) continue;
            try {
                await fillFrame(frame);
            } catch {}
        }

        console.log("✅ Filled all detected fields with generated values.");
        await page.waitForTimeout(5000);

    } catch (error) {
        console.error("An error occurred:", error);
    } finally {
        console.log("🛑 Bot finished.");
    }
}

main();