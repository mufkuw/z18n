#!/usr/bin/env bun

/**
 * z18n Extract CLI — scans source files for translatable strings.
 * 
 * Finds:
 *   - "text".t() in .ts/.tsx files
 *   - <span z18n>text</span> in .html/.jsx/.vue files
 * 
 * Generates/updates .jsonc translation files with hash keys.
 * 
 * Usage:
 *   bun run src/cli/extract.ts
 *   bun run src/cli/extract.ts --config z18n.config.json
 */

import { md5, extractWhitespace } from '../core/hash';
import { parseJsoncWithSources, serializeJsonc } from '../loader/translation-loader';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────

interface ExtractedString {
    text: string;
    trimmed: string;
    hash: string;
    file: string;
    line: number;
}

interface ExtractConfig {
    baseLocale: string;
    languages: Array<{
        code: string;
        name: string;
        nativeName: string;
        direction: 'ltr' | 'rtl';
        isSource?: boolean;
    }>;
    srcDirs: string[];
    translationsDir: string;
    includePatterns: string[];
    excludePatterns: string[];
}

// ─── Default Config ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: Partial<ExtractConfig> = {
    baseLocale: 'en',
    srcDirs: ['./src'],
    translationsDir: './translations',
    includePatterns: ['**/*.ts', '**/*.tsx', '**/*.html', '**/*.jsx', '**/*.vue'],
    excludePatterns: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*'],
};

// ─── Scanner ─────────────────────────────────────────────────────────────

/**
 * Find all files matching patterns.
 */
function findFiles(srcDirs: string[], includePatterns: string[], excludePatterns: string[]): string[] {
    // Simple glob implementation — in production, use a proper glob library
    const files: string[] = [];

    for (const srcDir of srcDirs) {
        const absDir = path.resolve(srcDir);
        if (!fs.existsSync(absDir)) {
            console.warn(`⚠️  Source directory not found: ${absDir}`);
            continue;
        }
        walkDir(absDir, files, includePatterns, excludePatterns);
    }

    return files;
}

function walkDir(dir: string, files: string[], includes: string[], excludes: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            // Skip excluded directories
            const relativePath = fullPath.replace(/\\/g, '/');
            if (excludes.some(pattern => matchPattern(relativePath, pattern))) continue;
            walkDir(fullPath, files, includes, excludes);
        } else {
            const relativePath = fullPath.replace(/\\/g, '/');
            // Check includes
            const ext = path.extname(entry.name);
            const extensions = ['.ts', '.tsx', '.html', '.jsx', '.vue'];
            if (!extensions.includes(ext)) continue;

            // Check excludes
            if (excludes.some(pattern => matchPattern(relativePath, pattern))) continue;

            files.push(fullPath);
        }
    }
}

function matchPattern(filePath: string, pattern: string): boolean {
    // Simple pattern matching
    const normalized = pattern.replace(/\*\*/g, '§§').replace(/\*/g, '§');
    const regex = normalized
        .replace(/§§/g, '.*')
        .replace(/§/g, '[^/]*')
        .replace(/\./g, '\\.');
    return new RegExp(regex).test(filePath);
}

/**
 * Extract translatable strings from TypeScript/TSX files.
 * Matches patterns: "text".t() and 'text'.t()
 */
function extractFromTS(content: string, filePath: string): ExtractedString[] {
    const results: ExtractedString[] = [];

    // Match "text".t() and 'text'.t()
    const singleQuoteRegex = /'([^']+)'\s*\.t\s*\(\s*(?:'[^']*'|"[^"]*")?\s*\)/g;
    const doubleQuoteRegex = /"([^"]+)"\s*\.t\s*\(\s*(?:'[^']*'|"[^"]*")?\s*\)/g;

    let match: RegExpExecArray | null;
    const lines = content.split('\n');

    // Double quotes
    while ((match = doubleQuoteRegex.exec(content)) !== null) {
        const text = match[1];
        const ws = extractWhitespace(text);
        const hash = md5(ws.trimmed);
        const lineNum = content.substring(0, match.index).split('\n').length;
        results.push({ text, trimmed: ws.trimmed, hash, file: filePath, line: lineNum });
    }

    // Single quotes
    while ((match = singleQuoteRegex.exec(content)) !== null) {
        const text = match[1];
        const ws = extractWhitespace(text);
        const hash = md5(ws.trimmed);
        const lineNum = content.substring(0, match.index).split('\n').length;
        results.push({ text, trimmed: ws.trimmed, hash, file: filePath, line: lineNum });
    }

    return results;
}

/**
 * Extract translatable strings from HTML/JSX/VUE files.
 * Matches patterns: <tag z18n>text</tag>
 */
function extractFromHTML(content: string, filePath: string): ExtractedString[] {
    const results: ExtractedString[] = [];

    // Match <anyTag z18n>text</anyTag>
    const regex = /<([a-zA-Z][a-zA-Z0-9-]*)\s+[^>]*z18n[^>]*>([^<]+)<\/\1>/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        const text = match[2].trim();
        if (!text) continue;
        const ws = extractWhitespace(text);
        const hash = md5(ws.trimmed);
        const lineNum = content.substring(0, match.index).split('\n').length;
        results.push({ text, trimmed: ws.trimmed, hash, file: filePath, line: lineNum });
    }

    return results;
}

/**
 * Extract all translatable strings from a file.
 */
function extractFromFile(filePath: string): ExtractedString[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);

    if (['.ts', '.tsx', '.jsx'].includes(ext)) {
        return extractFromTS(content, filePath);
    } else if (['.html', '.vue'].includes(ext)) {
        return extractFromHTML(content, filePath);
    }

    return [];
}

// ─── Main ───────────────────────────────────────────────────────────────

function main(): void {
    console.log('🔍 z18n Translation Extraction Tool');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();

    // Load config
    const configPath = path.resolve('z18n.config.json');
    let userConfig: Partial<ExtractConfig> = {};

    if (fs.existsSync(configPath)) {
        console.log(`📖 Loading config from ${configPath}`);
        const configContent = fs.readFileSync(configPath, 'utf-8');
        userConfig = JSON.parse(configContent);
    } else {
        console.log('ℹ️  No z18n.config.json found, using defaults');
    }

    const config: ExtractConfig = {
        baseLocale: userConfig.baseLocale ?? DEFAULT_CONFIG.baseLocale ?? 'en',
        languages: userConfig.languages ?? [],
        srcDirs: userConfig.srcDirs ?? DEFAULT_CONFIG.srcDirs ?? ['./src'],
        translationsDir: userConfig.translationsDir ?? DEFAULT_CONFIG.translationsDir ?? './translations',
        includePatterns: userConfig.includePatterns ?? DEFAULT_CONFIG.includePatterns ?? [],
        excludePatterns: userConfig.excludePatterns ?? DEFAULT_CONFIG.excludePatterns ?? [],
    };

    if (config.languages.length === 0) {
        console.error('❌ No languages configured. Add languages to z18n.config.json');
        process.exit(1);
    }

    // Find files
    const files = findFiles(config.srcDirs, config.includePatterns, config.excludePatterns);
    console.log(`📁 Found ${files.length} source files`);
    console.log();

    // Extract strings
    const allStrings: Map<string, ExtractedString> = new Map();

    for (const file of files) {
        const extracted = extractFromFile(file);
        for (const entry of extracted) {
            // Use trimmed text as key for deduplication
            if (!allStrings.has(entry.hash)) {
                allStrings.set(entry.hash, entry);
            }
        }
    }

    console.log(`✅ Found ${allStrings.size} unique translatable strings`);
    console.log();

    // Ensure translations directory exists
    const translationsDir = path.resolve(config.translationsDir);
    if (!fs.existsSync(translationsDir)) {
        fs.mkdirSync(translationsDir, { recursive: true });
        console.log(`📁 Created translations directory: ${translationsDir}`);
    }

    // Process each target language
    const targetLanguages = config.languages.filter(l => !l.isSource);

    for (const lang of targetLanguages) {
        const langFile = path.join(translationsDir, `${lang.code}.jsonc`);
        const langFilePath = path.resolve(langFile);

        // Read existing translations
        let existingTranslations: Record<string, string> = {};
        let existingSources: Record<string, string> = {};

        if (fs.existsSync(langFilePath)) {
            const content = fs.readFileSync(langFilePath, 'utf-8');
            const parsed = parseJsoncWithSources(content);
            existingTranslations = parsed.translations;
            existingSources = parsed.sources;
        }

        // Merge new strings
        let newCount = 0;
        const mergedTranslations: Record<string, string> = { ...existingTranslations };
        const mergedSources: Record<string, string> = { ...existingSources };

        for (const [hash, entry] of allStrings) {
            if (!mergedTranslations[hash]) {
                mergedTranslations[hash] = ''; // Empty — waiting for translation
                newCount++;
            }
            // Always update source comments
            mergedSources[hash] = entry.trimmed;
        }

        // Write the file
        const output = serializeJsonc(mergedTranslations, mergedSources, lang.code);
        fs.writeFileSync(langFilePath, output, 'utf-8');

        if (newCount > 0) {
            console.log(`📝 Updated ${lang.code}.jsonc — ${newCount} new entries (total: ${Object.keys(mergedTranslations).length})`);
        } else {
            console.log(`✅ ${lang.code}.jsonc — up to date (${Object.keys(mergedTranslations).length} entries)`);
        }
    }

    console.log();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🎉 Extraction complete! ${allStrings.size} unique strings, ${targetLanguages.length} languages`);
}

main();