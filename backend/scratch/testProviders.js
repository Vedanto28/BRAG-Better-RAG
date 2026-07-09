import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as geminiProvider from '../src/providers/geminiProvider.js';
import * as openaiProvider from '../src/providers/openaiProvider.js';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const rootEnvPath = path.resolve(scratchDir, '..', '..', '.env');
const backendEnvPath = path.resolve(scratchDir, '..', '.env');

dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

async function testGemini() {
  try {
    const res = await geminiProvider.generateResponse({
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'respond only with hello',
      tools: [],
      maxTokens: 5
    });
    if (res && res.text) {
      console.log('Gemini Status: WORKING');
    } else {
      console.log('Gemini Status: NOT WORKING: unknown (empty text returned)');
    }
  } catch (error) {
    console.log(`Gemini Status: NOT WORKING: ${error.category || 'unknown'} (${error.message.trim()})`);
  }
}

async function testOpenAI() {
  try {
    const res = await openaiProvider.generateResponse({
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'respond only with hello',
      tools: [],
      maxTokens: 5
    });
    if (res && res.text) {
      console.log('OpenAI Status: WORKING');
    } else {
      console.log('OpenAI Status: NOT WORKING: unknown (empty text returned)');
    }
  } catch (error) {
    const category = error.category || 'unknown';
    console.log(`OpenAI Status: NOT WORKING: ${category} (${error.message.trim()})`);
  }
}

async function run() {
  console.log('--- LLM Providers Direct Testing ---');
  await testGemini();
  await testOpenAI();
}

run();
