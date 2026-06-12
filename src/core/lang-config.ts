import type { LanguageConfig } from '../types/index';
import knownLanguages from './languages.json';

/**
 * Default language configuration — English as source language.
 */
export const DEFAULT_LANGUAGES: LanguageConfig[] = [
    {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        isSource: true,
    },
];

/**
 * Resolve a shorthand language config into full LanguageConfig objects.
 * 
 * Supports:
 * - Simple string codes: 'en', 'ar', 'fr'
 * - Partial objects: { code: 'ar' } — name/nativeName/direction auto-filled
 * - Full objects: { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' }
 */
export function resolveLanguages(input: Array<string | LanguageConfig>): LanguageConfig[] {
    return input.map((entry, index) => {
        if (typeof entry === 'string') {
            const known = knownLanguages[entry as keyof typeof knownLanguages];
            if (!known) {
                throw new Error(
                    `[z18n] Unknown language code: "${entry}". ` +
                    `Known codes: ${Object.keys(knownLanguages).join(', ')}. ` +
                    `Provide a full config object: { code: '${entry}', name: '...', nativeName: '...', direction: 'ltr' }`
                );
            }
            return {
                code: entry,
                name: known.name,
                nativeName: known.nativeName,
                direction: known.direction as 'ltr' | 'rtl',
                isSource: index === 0,
            };
        }

        // Full object — auto-fill missing fields from known languages
        const known = knownLanguages[entry.code as keyof typeof knownLanguages];
        return {
            code: entry.code,
            name: entry.name ?? known?.name ?? entry.code.toUpperCase(),
            nativeName: entry.nativeName ?? known?.nativeName ?? entry.code.toUpperCase(),
            direction: entry.direction ?? (known?.direction as 'ltr' | 'rtl' | undefined) ?? 'ltr',
            isSource: entry.isSource ?? (index === 0),
        };
    });
}

/**
 * Get the source/base language from a list of languages.
 */
export function getSourceLanguage(languages: LanguageConfig[]): LanguageConfig {
    const source = languages.find(l => l.isSource);
    if (!source) {
        throw new Error('[z18n] No source language defined. Mark one language with isSource: true');
    }
    return source;
}

/**
 * Get a language config by code.
 */
export function getLanguageByCode(languages: LanguageConfig[], code: string): LanguageConfig | undefined {
    return languages.find(l => l.code === code);
}

/**
 * Get all target (non-source) languages.
 */
export function getTargetLanguages(languages: LanguageConfig[]): LanguageConfig[] {
    return languages.filter(l => !l.isSource);
}

/**
 * Validate language configurations.
 */
export function validateLanguages(languages: LanguageConfig[]): string[] {
    const errors: string[] = [];

    const sources = languages.filter(l => l.isSource);
    if (sources.length === 0) {
        errors.push('No source language defined. Mark one language with isSource: true');
    }
    if (sources.length > 1) {
        errors.push('Multiple source languages defined. Only one language should have isSource: true');
    }

    const codes = languages.map(l => l.code);
    const duplicateCodes = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (duplicateCodes.length > 0) {
        errors.push(`Duplicate language codes: ${[...new Set(duplicateCodes)].join(', ')}`);
    }

    for (const lang of languages) {
        if (!lang.code || lang.code.length < 2) {
            errors.push(`Invalid language code: "${lang.code}"`);
        }
        if (!lang.name) {
            errors.push(`Missing name for language: "${lang.code}"`);
        }
        if (!lang.nativeName) {
            errors.push(`Missing nativeName for language: "${lang.code}"`);
        }
        if (lang.direction !== 'ltr' && lang.direction !== 'rtl') {
            errors.push(`Invalid direction for language "${lang.code}": "${lang.direction}"`);
        }
    }

    return errors;
}