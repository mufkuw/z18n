import { Dictionary } from '../core/dictionary';

/**
 * Strip JSONC comments and trailing commas from a string.
 * Handles // single-line comments (outside strings) and trailing commas before } or ].
 */
function stripJsoncComments(text: string): string {
    let result = '';
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
            result += char;
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            result += char;
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            result += char;
            continue;
        }

        if (!inString && char === '/' && i + 1 < text.length) {
            // Single-line comment
            if (text[i + 1] === '/') {
                // Skip until end of line
                while (i < text.length && text[i] !== '\n') {
                    i++;
                }
                continue;
            }
            // Block comment
            if (text[i + 1] === '*') {
                i += 2;
                while (i < text.length && !(text[i] === '*' && i + 1 < text.length && text[i + 1] === '/')) {
                    i++;
                }
                if (i < text.length) {
                    i++; // skip past the '/'
                }
                continue;
            }
        }

        result += char;
    }

    // Remove trailing commas before } or ]
    result = result.replace(/,\s*([}\]])/g, '$1');
    return result;
}

/**
 * Parse a JSONC string to a plain object.
 * Comments are stripped before parsing.
 */
export function parseJsonc(text: string): Record<string, string> {
    const stripped = stripJsoncComments(text);
    return JSON.parse(stripped);
}

/**
 * Parse a JSONC string and extract source text from inline comments.
 * Returns translations and a source map (hash → original English text).
 * 
 * Format expected:
 * {
 *   "5c32df...": "مرحبا بالعالم",  // Hello world
 * }
 */
export function parseJsoncWithSources(text: string): {
    translations: Record<string, string>;
    sources: Record<string, string>;
} {
    // First, parse the JSONC content using the robust parser
    const stripped = stripJsoncComments(text);
    const translations: Record<string, string> = JSON.parse(stripped);

    // Then, extract source comments from the original text line by line
    const sources: Record<string, string> = {};
    const lines = text.split('\n');
    for (const line of lines) {
        // Match lines like: "hash": "translation",  // source text
        const sourceMatch = line.match(/^\s*"([^"]+)"\s*:\s*.*?\s*,?\s*\/\/\s*(.+)\s*$/);
        if (sourceMatch) {
            const hash = sourceMatch[1];
            const source = sourceMatch[2].trim();
            if (source) {
                sources[hash] = source;
            }
        }
    }

    return { translations, sources };
}

/**
 * Load translations from a URL (browser environment).
 * Supports both .json and .jsonc files.
 */
export async function loadFromUrl(url: string, dictionary: Dictionary, locale: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`[z18n] Failed to load translations from ${url}: ${response.status}`);
    }
    const text = await response.text();
    const translations = parseJsonc(text);
    dictionary.load(locale, translations);
}

/**
 * Load translations from a JSONC string (direct content).
 */
export function loadFromString(
    content: string,
    dictionary: Dictionary,
    locale: string
): { translations: Record<string, string>; sources: Record<string, string> } {
    const { translations, sources } = parseJsoncWithSources(content);
    dictionary.load(locale, translations);
    return { translations, sources };
}

/**
 * Serialize translations to JSONC format with source comments.
 * Each entry includes the source English text as a comment.
 */
/**
 * Escape a string value for safe inclusion in JSON/JSONC output.
 * Handles backslashes, double quotes, and control characters.
 */
function escapeJsonString(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

export function serializeJsonc(
    translations: Record<string, string>,
    sources?: Record<string, string>,
    locale?: string
): string {
    const entries = Object.entries(translations).sort(([a], [b]) => a.localeCompare(b));
    const lines: string[] = ['{'];

    for (const [hash, translation] of entries) {
        const source = sources?.[hash];
        const comment = source ? `  // ${source}` : '';
        lines.push(`  "${hash}": "${escapeJsonString(translation)}",${comment}`);
    }

    lines.push('}');
    return lines.join('\n');
}

/**
 * Load translations from the filesystem (Node/Bun environment).
 */
export async function loadFromFile(
    filePath: string,
    dictionary: Dictionary,
    locale: string
): Promise<void> {
    // Dynamic import for Node/Bun environments
    const fs = await import('fs');
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const translations = parseJsonc(content);
    dictionary.load(locale, translations);
}

/**
 * Load all available translation files for configured languages.
 * In browser: fetches from translationsPath URL.
 * In Node: reads from translationsPath directory.
 */
export async function loadAllTranslations(
    dictionary: Dictionary,
    translationsPath: string,
    locales: string[],
    isBrowser: boolean
): Promise<void> {
    const extension = '.jsonc';

    const promises = locales.map(async (locale) => {
        if (isBrowser) {
            const url = `${translationsPath}/${locale}${extension}`;
            await loadFromUrl(url, dictionary, locale);
        } else {
            const fs = await import('fs');
            const path = await import('path');
            const filePath = path.resolve(translationsPath, `${locale}${extension}`);
            const exists = fs.existsSync(filePath);
            if (exists) {
                await loadFromFile(filePath, dictionary, locale);
            } else {
                console.warn(`[z18n] Translation file not found: ${filePath}. Skipping locale "${locale}".`);
            }
        }
    });

    await Promise.all(promises);
}