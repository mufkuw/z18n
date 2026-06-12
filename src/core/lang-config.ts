import type { LanguageConfig } from '../types/index';

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
 * Get the source/base language from a list of languages.
 */
export function getSourceLanguage(languages: LanguageConfig[]): LanguageConfig {
    const source = languages.find(l => l.isSource);
    if (!source) {
        throw new Error('[lang] No source language defined. Mark one language with isSource: true');
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