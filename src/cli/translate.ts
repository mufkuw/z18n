#!/usr/bin/env bun

/**
 * Lang Translate CLI — auto-translate missing entries using LLM.
 * 
 * Reads .jsonc translation files, finds empty entries,
 * and uses an LLM to fill in translations.
 * 
 * Usage:
 *   bun run src/cli/translate.ts
 *   bun run src/cli/translate.ts --provider openai --model gpt-4o-mini
 *   bun run src/cli/translate.ts --provider ollama --model llama3
 */

import { md5 } from '../core/hash';
import { parseJsoncWithSources, serializeJsonc } from '../loader/translation-loader';
import type { LLMConfig } from '../types/index';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────

interface TranslateConfig {
    baseLocale: string;
    languages: Array<{
        code: string;
        name: string;
        nativeName: string;
        direction: 'ltr' | 'rtl';
        isSource?: boolean;
    }>;
    translationsDir: string;
    llm: LLMConfig;
}

// ─── LLM Providers ──────────────────────────────────────────────────────

interface TranslationRequest {
    source_language: string;
    target_language: string;
    target_native_name: string;
    strings: Array<{ hash: string; text: string }>;
}

interface TranslationResponse {
    translations: Record<string, string>;
}

async function callOpenAI(request: TranslationRequest, config: LLMConfig): Promise<Record<string, string>> {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key required. Set OPENAI_API_KEY env var or llm.apiKey in config.');
    }

    const model = config.model || 'gpt-4o-mini';
    const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';

    const systemPrompt = `You are a professional translator. Translate the given strings from ${request.source_language} to ${request.target_language} (${request.target_native_name}).

Rules:
- Return a JSON object with hash keys and translated values
- Preserve placeholders like {name}, {count}, etc.
- Keep the same tone and formality level
- For UI strings, keep them concise
- Do not translate technical terms or brand names
- Return ONLY valid JSON, no markdown fences`;

    const userPrompt = `Translate these strings:\n${JSON.stringify(request.strings, null, 2)}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
        throw new Error('No response from OpenAI');
    }

    try {
        const parsed = JSON.parse(content);
        return parsed.translations || parsed;
    } catch {
        throw new Error(`Failed to parse OpenAI response: ${content}`);
    }
}

async function callAnthropic(request: TranslationRequest, config: LLMConfig): Promise<Record<string, string>> {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('Anthropic API key required. Set ANTHROPIC_API_KEY env var or llm.apiKey in config.');
    }

    const model = config.model || 'claude-3-haiku-20240307';
    const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';

    const systemPrompt = `You are a professional translator. Translate the given strings from ${request.source_language} to ${request.target_language} (${request.target_native_name}).

Rules:
- Return a JSON object with hash keys and translated values
- Preserve placeholders like {name}, {count}, etc.
- Keep the same tone and formality level
- For UI strings, keep them concise
- Do not translate technical terms or brand names
- Return ONLY valid JSON, no markdown fences`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                { role: 'user', content: `Translate these strings:\n${JSON.stringify(request.strings, null, 2)}` },
            ],
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
        throw new Error('No response from Anthropic');
    }

    try {
        const parsed = JSON.parse(content);
        return parsed.translations || parsed;
    } catch {
        throw new Error(`Failed to parse Anthropic response: ${content}`);
    }
}

async function callOllama(request: TranslationRequest, config: LLMConfig): Promise<Record<string, string>> {
    const model = config.model || 'llama3';
    const endpoint = config.endpoint || 'http://localhost:11434/api/generate';

    const prompt = `You are a professional translator. Translate these strings from ${request.source_language} to ${request.target_language} (${request.target_native_name}).

Rules:
- Return ONLY a JSON object with hash keys and translated values
- Preserve placeholders like {name}, {count}, etc.
- Keep the same tone and formality level
- For UI strings, keep them concise

Strings to translate:
${JSON.stringify(request.strings, null, 2)}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            stream: false,
            format: 'json',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const content = data.response;

    if (!content) {
        throw new Error('No response from Ollama');
    }

    try {
        const parsed = JSON.parse(content);
        return parsed.translations || parsed;
    } catch {
        throw new Error(`Failed to parse Ollama response: ${content}`);
    }
}

async function callLLM(request: TranslationRequest, config: LLMConfig): Promise<Record<string, string>> {
    switch (config.provider) {
        case 'openai':
            return callOpenAI(request, config);
        case 'anthropic':
            return callAnthropic(request, config);
        case 'ollama':
            return callOllama(request, config);
        case 'custom':
            if (!config.endpoint) {
                throw new Error('Custom provider requires an endpoint URL');
            }
            // Use OpenAI-compatible API for custom endpoints
            return callOpenAI(request, config);
        default:
            throw new Error(`Unknown LLM provider: ${config.provider}`);
    }
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log('🌍 Lang LLM Translation Tool');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();

    // Load config
    const configPath = path.resolve('lang.config.json');
    if (!fs.existsSync(configPath)) {
        console.error('❌ lang.config.json not found. Run "lang extract" first.');
        process.exit(1);
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config: TranslateConfig = JSON.parse(configContent);

    if (!config.llm) {
        console.error('❌ No LLM configuration found in lang.config.json.');
        console.error('   Add an "llm" section with provider, model, and apiKey.');
        process.exit(1);
    }

    const targetLanguages = config.languages.filter(l => !l.isSource);
    const translationsDir = path.resolve(config.translationsDir || './translations');
    const batchSize = config.llm.batchSize || 20;
    const reviewRequired = config.llm.reviewRequired !== false; // default true

    console.log(`🤖 Provider: ${config.llm.provider}`);
    console.log(`📦 Model: ${config.llm.model || 'default'}`);
    console.log(`📝 Batch size: ${batchSize}`);
    console.log(`🔍 Review required: ${reviewRequired}`);
    console.log();

    let totalTranslated = 0;

    for (const lang of targetLanguages) {
        const langFile = path.join(translationsDir, `${lang.code}.jsonc`);

        if (!fs.existsSync(langFile)) {
            console.log(`⚠️  No translation file for ${lang.code} (${lang.name}). Run "lang extract" first.`);
            continue;
        }

        // Read existing translations
        const content = fs.readFileSync(langFile, 'utf-8');
        const { translations, sources } = parseJsoncWithSources(content);

        // Find empty entries
        const missingEntries: Array<{ hash: string; text: string }> = [];
        for (const [hash, translation] of Object.entries(translations)) {
            if (!translation || translation.trim() === '') {
                const sourceText = sources[hash] || hash;
                missingEntries.push({ hash, text: sourceText });
            }
        }

        if (missingEntries.length === 0) {
            console.log(`✅ ${lang.name} (${lang.code}) — all translations complete!`);
            continue;
        }

        console.log(`📖 ${lang.name} (${lang.code}) — ${missingEntries.length} missing translations`);
        console.log(`   Translating in batches of ${batchSize}...`);

        // Process in batches
        let langTranslated = 0;
        for (let i = 0; i < missingEntries.length; i += batchSize) {
            const batch = missingEntries.slice(i, i + batchSize);
            const request: TranslationRequest = {
                source_language: 'English',
                target_language: lang.name,
                target_native_name: lang.nativeName,
                strings: batch,
            };

            try {
                const result = await callLLM(request, config.llm);

                // Apply translations
                for (const { hash } of batch) {
                    if (result[hash]) {
                        translations[hash] = result[hash];
                        langTranslated++;
                    }
                }

                console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${Object.keys(result).length} translations`);
            } catch (error) {
                console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
            }
        }

        // Write updated translations
        const output = serializeJsonc(translations, sources, lang.code);
        fs.writeFileSync(langFile, output, 'utf-8');

        console.log(`   📝 ${lang.code}.jsonc updated — ${langTranslated} new translations`);
        totalTranslated += langTranslated;
        console.log();
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🎉 Translation complete! ${totalTranslated} strings translated across ${targetLanguages.length} languages`);
    console.log();

    if (reviewRequired && totalTranslated > 0) {
        console.log('⚠️  LLM translations are marked for review.');
        console.log('   Please verify translations before deploying.');
    }
}

main().catch(console.error);