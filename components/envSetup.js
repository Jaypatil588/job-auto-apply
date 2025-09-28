import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import { readFile } from 'fs/promises';

let personalContext = null;
let genAI = null;
let model = null;

export async function initializeEnvironment() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable not set.');

    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    return { genAI, model };
}

export async function loadPersonalContext() {
    const data = await readFile('data.json', 'utf8');
    personalContext = JSON.parse(data);
    return personalContext;
}

export function getAIModel() {
    if (!model) throw new Error('AI model not initialized.');
    return model;
}

export function getPersonalContext() {
    if (!personalContext) throw new Error('Personal context not loaded.');
    return personalContext;
}

export async function initializeAll() {
    await initializeEnvironment();
    await loadPersonalContext();
    return { genAI, model, personalContext };
}

