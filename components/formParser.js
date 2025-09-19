/**
 * Form Parser Component
 * Handles AI-powered form field parsing and filling
 */

import path from 'path';
import fs from 'fs/promises';
import { getAIModel, getPersonalContext } from './envSetup.js';

// --- Helper Functions ---

/**
 * Appends multiple AI-generated key-value pairs to data.json in a single batch operation.
 * @param {Object} newPairs - An object containing the new key-value pairs to cache.
 */
async function cacheAiResultsBatch(newPairs) {
    const newPairCount = Object.keys(newPairs).length;
    if (newPairCount === 0) {
        return; // Nothing to cache
    }

    console.log(`\n💾 Caching ${newPairCount} new AI result(s) in a batch...`);
    try {
        const dataJsonPath = path.resolve('data.json');
        const fileContent = await fs.readFile(dataJsonPath, 'utf-8');
        const data = JSON.parse(fileContent);

        let addedCount = 0;
        for (const key in newPairs) {
            if (data[key] === undefined) {
                data[key] = newPairs[key];
                addedCount++;
            }
        }

        if (addedCount > 0) {
            await fs.writeFile(dataJsonPath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`  [Cache] Successfully saved ${addedCount} new pair(s) to data.json.`);
        } else {
            console.log("  [Cache] All AI-generated keys already existed in data.json. No changes made.");
        }
    } catch (error) {
        console.error(`❌ Failed to batch cache AI results:`, error.message);
    }
}


/**
 * Get AI suggestion for a single form field to generate a value.
 * @param {Object} field - Field object with name, type, and options
 * @returns {Promise<string|null>} AI suggestion or null if failed
 */
async function getAiSuggestionForSingleField(field) {
    console.log(`🧠 Asking AI for help to fill field: "${field.name}"`);
    
    const model = getAIModel();
    const personalContext = getPersonalContext();
    
    let prompt;
    const contextText = `My Profile: ${JSON.stringify(personalContext)}`;

    if ((field.type === 'select' || field.type === 'custom_dropdown') && field.options && field.options.length > 0) {
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

/**
 * Get element label from various attributes, including associated <label> tags.
 * @param {import('playwright').Locator} element - Playwright element locator
 * @param {import('playwright').Frame} frame - The frame the element belongs to
 * @returns {Promise<string|null>} Label text or null
 */
async function getElementLabel(element, frame) {
    // Priority 1: Look for a <label> that comes directly before the input.
    const precedingLabelLocator = element.locator('xpath=./preceding-sibling::label');
    if (await precedingLabelLocator.count() > 0) {
        const labelText = await precedingLabelLocator.last().innerText();
        if (labelText && labelText.trim()) {
            return labelText.trim();
        }
    }

    // Priority 2: Look for a <label> explicitly linked by the 'for' attribute.
    const id = await element.getAttribute('id');
    if (id) {
        const labelForLocator = frame.locator(`label[for="${id}"]`);
        if (await labelForLocator.count() > 0) {
            const labelText = await labelForLocator.first().innerText();
            if (labelText && labelText.trim()) {
                return labelText.trim();
            }
        }
    }
    
    // Priority 3: Fallback to common attributes if no explicit <label> is found.
    for (const attr of ['aria-label', 'placeholder', 'name', 'alt']) {
        const value = await element.getAttribute(attr);
        if (value && value.trim()) {
            return value.trim();
        }
    }
    
    return null;
}

/**
 * Uses Gemini to guess the label of a form field based on its surrounding HTML.
 * @param {import('playwright').Locator} element - The Playwright locator for the input-like element.
 * @returns {Promise<string|null>} The AI-guessed label or null.
 */
async function guessFieldLabelWithAi(element) {
    console.log(`  -> 🕵️‍♂️ Standard label detection failed. Using AI to guess the label from HTML...`);
    try {
        const model = getAIModel();
        const parentLocator = element.locator('xpath=..');
        const outerHtml = await parentLocator.innerHTML();

        if (!outerHtml || outerHtml.trim().length < 20) {
            console.log('  -> ⚠️ Could not get sufficient HTML context for AI guess.');
            return null;
        }

        const prompt = `Analyze the following HTML snippet for a form field and determine its human-readable label. Consider all surrounding text, placeholders, and attributes. Respond with ONLY the label text and nothing else. For example, if it's for a first name, just respond "First Name".\n\nHTML Snippet:\n\`\`\`html\n${outerHtml}\n\`\`\`\n\nLabel:`;

        const result = await model.generateContent(prompt);
        const guessedLabel = result.response.text().trim();

        if (guessedLabel) {
            console.log(`  -> 🤖 AI guessed the label: "${guessedLabel}"`);
            return guessedLabel;
        }
        return null;
    } catch (error) {
        console.error(`  -> ❌ AI label guess failed:`, error.message);
        return null;
    }
}


/**
 * Uses Gemini to find the best semantic match for a field label from a list of keys.
 * @param {string} fieldLabel The form field label.
 * @param {string[]} availableKeys The keys from data.json.
 * @returns {Promise<string|null>} The best matching key or null.
 */
async function getSemanticMatchWithAi(fieldLabel, availableKeys) {
    console.log(`  -> 🧠 Using AI to find a semantic match for "${fieldLabel}"...`);
    const model = getAIModel();

    const prompt = `Analyze the form field label and find the single best semantic match from the provided list of data keys. Respond with ONLY the best matching key from the list. If no key is a good semantic match, respond with the word "None".\n\nForm Field Label: "${fieldLabel}"\n\nAvailable Data Keys: ${JSON.stringify(availableKeys)}\n\nBest Matching Key:`;

    try {
        const result = await model.generateContent(prompt);
        const textResponse = result.response.text().trim();

        if (availableKeys.includes(textResponse)) {
            console.log(`  [AI Match] Semantically matched "${fieldLabel}" -> "${textResponse}"`);
            return textResponse;
        } else {
            console.log(`  [AI Match] No suitable semantic match found for "${fieldLabel}".`);
            return null;
        }
    } catch (error) {
        console.error(`❌ AI semantic match failed for "${fieldLabel}":`, error.message);
        return null;
    }
}


/**
 * Finds the best matching key from personal context for a given label.
 * @param {string} label - Field label to match
 * @returns {Promise<string|null>} Best matching key from personal context
 */
async function findBestKeyMatch(label) {
    if (!label) return null;
    
    const personalContext = getPersonalContext();
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedLabel = normalize(label);

    let bestMatch = null;
    let highScore = 0;
    for (const key in personalContext) {
        let currentScore = 0;
        if (label.toLowerCase() === key.toLowerCase()) {
            currentScore = 20;
        } else if (normalizedLabel.includes(normalize(key))) {
            currentScore = 8;
        }
        
        if (currentScore > highScore) {
            highScore = currentScore;
            bestMatch = key;
        }
    }
    
    if (highScore > 10) {
        return bestMatch;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await getSemanticMatchWithAi(label, Object.keys(personalContext));
}


/**
 * Get value from personal context based on key and field name
 * @param {string} key - Key from personal context
 * @param {string} fieldName - Name of the form field
 * @returns {string} Formatted value for the field
 */
function getValueFromContext(key, fieldName = '') {
    const personalContext = getPersonalContext();
    const value = personalContext[key];
    const lowerFieldName = fieldName.toLowerCase();

    const yesNoKeywords = ['sponsorship', 'visa', 'authorized', 'legally', 'require', 'eligible'];
    if (yesNoKeywords.some(kw => lowerFieldName.includes(kw))) {
        // Assuming 'false' for needs_visa_sponsorship means you are eligible/authorized.
        return personalContext.needs_visa_sponsorship === false ? 'Yes' : 'No';
    }
    
    if (key === 'education') {
        const latest = value[0] || {};
        if (lowerFieldName.includes('school') || lowerFieldName.includes('university')) return latest.school;
        if (lowerFieldName.includes('degree')) return latest.degree;
        if (lowerFieldName.includes('major') || lowerFieldName.includes('discipline')) return latest.major;
        return `${latest.degree} in ${latest.major}, ${latest.school}`;
    }
    
    if (key === 'experience' && Array.isArray(value) && value.length > 0) {
        return `${value[0].title} at ${value[0].company}`;
    }
    if (key === 'address' || key === 'location') return personalContext.city;
    if (Array.isArray(value)) return value.join(', ');
    
    return String(value);
}

/**
 * Find best dropdown option based on context value
 * @param {string} contextValue - Value from personal context
 * @param {Array<string>} options - Available dropdown options
 * @returns {string|null} Best matching option
 */
function findBestDropdownOption(contextValue, options) {
    if (!contextValue || !options || options.length === 0) return null;
    
    const lowerContext = String(contextValue).toLowerCase().trim();
    let bestOption = null, highScore = 0;
    
    for (const option of options) {
        const lowerOption = option.toLowerCase().trim();
        let score = 0;
        
        if (lowerOption === lowerContext) score = 20;
        else if (lowerOption.includes(lowerContext) || lowerContext.includes(lowerOption)) score = 10;
        
        if (score > highScore) {
            highScore = score;
            bestOption = option;
        }
    }
    
    return bestOption;
}

/**
 * Patiently checks if a dropdown's value was set correctly without external dependencies.
 * @param {object} field - The field object from the mappings.
 * @param {string} key - The label of the field.
 */
async function verifySelection(field, key) {
    let isVerified = false;
    const startTime = Date.now();
    const timeout = 2500; // Wait for up to 2.5 seconds

    while (Date.now() - startTime < timeout) {
        const valueAttr = await field.locator.inputValue({ timeout: 200 }).catch(() => '');
        if (valueAttr && valueAttr.toLowerCase().includes(field.value.toLowerCase())) {
            isVerified = true;
            break;
        }

        const text = await field.locator.locator('xpath=..').innerText({ timeout: 200 }).catch(() => '');
        if (text && text.toLowerCase().includes(field.value.toLowerCase())) {
            isVerified = true;
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (isVerified) {
        console.log(`  -> ✅ Successfully verified selection for "${key}"`);
    } else {
        console.warn(`  -> ⚠️ Selection for "${key}" could not be verified.`);
    }
}


/**
 * A highly instrumented, multi-step handler for custom dropdowns with detailed forensic logging.
 * @param {object} field - The field object from the mappings.
 * @param {string} key - The label of the field.
 * @param {import('playwright').Frame} frame - The Playwright frame.
 */
async function handleCustomDropdown(field, key, frame) {
    console.log(`\n--- Handling Dropdown: "${key}" ---`);
    const locator = field.locator;

    try {
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        const initialValue = await locator.inputValue().catch(() => '[not an input]');
        console.log(`  [Debug] Initial state - Value: "${initialValue}", IsVisible: ${await locator.isVisible()}, IsEnabled: ${await locator.isEnabled()}`);
        
        console.log(`  [Debug] Step 1: Clicking component to activate...`);
        await locator.click({ timeout: 3000, position: { x: 5, y: 5 } });
        await frame.page().waitForTimeout(500);

        console.log(`  [Debug] Step 2: Typing "${field.value}"...`);
        await locator.pressSequentially(field.value, { delay: 75 });
        const valueAfterType = await locator.inputValue().catch(() => '[not an input]');
        console.log(`  [Debug] State after typing - Input Value: "${valueAfterType}"`);

        await frame.page().waitForTimeout(2000); // Wait for options to render
        const optionsContainer = frame.locator('[role="listbox"]:visible');
        if (await optionsContainer.count() > 0) {
            console.log(`  [Debug] Step 3: Options container is VISIBLE. Searching for best match.`);
            const options = optionsContainer.locator('[role="option"], li');
            const allOptions = await options.allInnerTexts();
            const bestOptionText = findBestDropdownOption(field.value, allOptions);
            
            if (bestOptionText) {
                console.log(`  [Debug] Best match found: "${bestOptionText}". Clicking it.`);
                await options.getByText(bestOptionText, { exact: false }).first().click({ timeout: 3000 });
            } else {
                console.warn(`  [Debug] No suitable option found in list. Pressing Enter as fallback.`);
                await locator.press('Enter');
            }
        } else {
            console.log(`  [Debug] Step 3: Options container did NOT appear. Pressing Enter to confirm typed value.`);
            await locator.press('Enter');
        }

        await frame.page().waitForTimeout(1000);
        console.log('  [Debug] Step 4: Final verification...');
        await verifySelection(field, key);

    } catch (e) {
        console.error(`  -> ❌ ERROR during detailed interaction with "${key}":`, e.message.split('\n')[0]);
    }
    console.log(`--- Finished Dropdown: "${key}" ---\n`);
}

/**
 * NEW: Handles selecting an option from a custom component made of buttons (e.g., Yes/No).
 * @param {object} field - The field object from the mappings.
 * @param {string} key - The label of the field.
 */
async function handleButtonGroup(field, key) {
    console.log(`\n--- Handling Button Group: "${key}" ---`);
    try {
        // Step 1: Decide which button to click based on the value from context.
        const choiceToClick = findBestDropdownOption(field.value, field.options);

        if (choiceToClick) {
            console.log(`  [Debug] Determined value: "${field.value}". Best button match: "${choiceToClick}".`);
            // Step 2: Locate and click the correct button within the component's container.
            const buttonToClick = field.locator.getByText(choiceToClick, { exact: true });
             if (await buttonToClick.count() > 0) {
                await buttonToClick.first().click({ timeout: 3000 });
                console.log(`  -> ✅ Clicked "${choiceToClick}" for question "${key}"`);
             } else {
                 console.warn(`  [Debug] Could not find a button with the exact text "${choiceToClick}".`);
             }
        } else {
            console.warn(`  -> ⚠️ Could not determine which button to click for "${key}" based on value "${field.value}".`);
        }
    } catch (e) {
        console.error(`  -> ❌ ERROR during interaction with button group "${key}":`, e.message.split('\n')[0]);
    }
    console.log(`--- Finished Button Group: "${key}" ---\n`);
}


// --- Main Functions ---

/**
 * NEW: Discovers custom button-based choice components (e.g., Yes/No groups).
 * @param {import('playwright').Frame} frame - The Playwright frame.
 * @param {Object} mappings - The mappings object to populate.
 */
async function discoverButtonGroups(frame, mappings) {
    // This selector finds containers that have both a <label> and at least one <button>,
    // which is a good heuristic for our target component.
    const potentialContainers = frame.locator('div:has(label):has(button)');
    for (const container of await potentialContainers.all()) {
        try {
            const buttons = container.locator('button');
            if (await buttons.count() > 1) { // We're looking for choice groups, so more than 1 button
                const labelEl = container.locator('label').first();
                const key = (await labelEl.innerText()).trim();

                if (key && !mappings[key]) {
                     const buttonTexts = (await buttons.allInnerTexts()).map(t => t.trim());
                     mappings[key] = {
                         value: null,
                         locator: container, // The main container is the locator
                         type: 'button_group',
                         options: buttonTexts
                     };
                }
            }
        } catch (e) { /* Ignore stale elements */ }
    }
}


/**
 * Fill a single frame with form data.
 * @param {import('playwright').Frame} frame - Playwright frame object
 */
export async function fillFrame(frame) {
    const mappings = {};

    // Step 1: Discover all fields
    console.log("\n🔎 Step 1: Discovering fields and creating mappings...");

    // NEW: Step 1a - Run specialized discovery for custom button groups first.
    await discoverButtonGroups(frame, mappings);

    // Step 1b - Run standard discovery for all other fields.
    const fieldLocator = frame.locator('input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea, select, [role="combobox"]');
    const allLocatedFields = await fieldLocator.all();
    for (const el of allLocatedFields) {
        try {
            if (!(await el.isVisible({ timeout: 2000 }) && await el.isEnabled({ timeout: 2000 }))) continue;
            
            let key = await getElementLabel(el, frame);
            
            if (!key) {
                key = await guessFieldLabelWithAi(el);
            }

            // MODIFIED: If a button group with this label was already found, skip.
            if (!key || mappings[key]) continue;

            const tagName = (await el.evaluate(node => node.tagName)).toLowerCase();
            const role = await el.getAttribute('role');
            let fieldType, interactiveLocator = el;

            if (tagName === 'select') {
                fieldType = 'select';
            } else if (role === 'combobox') {
                fieldType = 'custom_dropdown';
                if (tagName === 'div') {
                    const inputInside = el.locator('input[type="text"]');
                    if (await inputInside.count() > 0) { interactiveLocator = inputInside.first(); }
                }
            } else {
                fieldType = (await el.getAttribute('type') || 'text');
            }
            mappings[key] = { value: null, locator: interactiveLocator, type: fieldType, options: null };
        } catch (e) { /* Ignore non-interactable or stale elements */ }
    }
    console.log(`  -> Discovered ${Object.keys(mappings).length} unique fields.`);

    // Step 2: Match fields with local data
    console.log("\n📝 Step 2: Matching fields with your local data...");
    for (const key in mappings) {
        const matchedContextKey = await findBestKeyMatch(key);
        if (matchedContextKey) {
            mappings[key].value = getValueFromContext(matchedContextKey, key);
        }
    }

    // Step 3: Use AI for remaining empty fields
    console.log("\n🧠 Step 3: Using AI to fill any remaining empty fields...");
    const newlyGeneratedPairs = {};
    for (const key in mappings) {
        if (mappings[key].value === null) {
            const field = mappings[key];
            await new Promise(resolve => setTimeout(resolve, 1500));
            const aiSuggestion = await getAiSuggestionForSingleField({ name: key, type: field.type, options: field.options });
            if (aiSuggestion) {
                mappings[key].value = aiSuggestion;
                newlyGeneratedPairs[key] = aiSuggestion;
            }
        }
    }
    await cacheAiResultsBatch(newlyGeneratedPairs);

    // Step 4: Execute fill actions
    console.log("\n🚀 Step 4: Filling the form on the page...");
    for (const key in mappings) {
        const field = mappings[key];
        if (!field.value) {
            console.log(`  -> Skipping "${key}" (no value found).`);
            continue;
        }
        try {
            if (field.type === 'select') {
                await field.locator.selectOption({ label: field.value });
            } else if (field.type === 'custom_dropdown') {
                await handleCustomDropdown(field, key, frame);
            } else if (field.type === 'button_group') { // NEW: Handle the button group
                await handleButtonGroup(field, key);
            } else if (field.type === 'file') {
                if (key.toLowerCase().includes('resume')) {
                    const resumePath = getPersonalContext().resume_filename || 'resume.pdf';
                    await field.locator.setInputFiles(path.resolve(resumePath));
                }
            } else {
                await field.locator.fill(field.value);
            }
        } catch (e) {
            console.error(`  -> ❌ ERROR interacting with field "${key}" (type: ${field.type}):`, e.message.split('\n')[0]);
        }
    }
    
    console.log('\n\n[DEBUG] Attempting to find and click a submit button to trigger validation...');
    const submitButton = frame.locator('button[type="submit"], input[type="submit"], button:text-matches("submit", "i")');
    if (await submitButton.count() > 0) {
        await submitButton.first().click({ force: true });
        console.log('[DEBUG] Submit button clicked. Please check the final screenshot for validation errors.');
        await frame.page().waitForTimeout(5000);
    } else {
        console.log('[DEBUG] Could not find a submit button.');
    }
}

/**
 * Fill all frames on the page
 * @param {import('playwright').Page} page - Playwright page object
 */
export async function fillAllFrames(page) {
    console.log("🔍 Starting form filling process...");
    
    await fillFrame(page.mainFrame());
    
    for (const frame of page.frames()) {
        if (frame !== page.mainFrame()) {
            console.log("🔍 Found iframe, filling it...");
            await fillFrame(frame);
        }
    }
    
    console.log("\n✅ Form filling completed for all frames.");
}
