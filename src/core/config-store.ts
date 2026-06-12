import type { LanguageConfig } from '../types/index';

/**
 * Default configuration values
 */
const DEFAULTS = {
    baseLocale: 'en',
    observeDOM: typeof window !== 'undefined',
};

/**
 * Central configuration store for the Lang system.
 * Initialized once via Lang.init().
 */
export class LangConfigStore {
    baseLocale: string;
    currentLocale: string;
    languages: LanguageConfig[];
    translationsPath?: string;
    observeDOM: boolean;

    constructor() {
        this.baseLocale = DEFAULTS.baseLocale;
        this.currentLocale = DEFAULTS.baseLocale;
        this.languages = [];
        this.observeDOM = DEFAULTS.observeDOM;
        this.translationsPath = undefined;
    }

    /**
     * Get the source language configuration.
     */
    get sourceLanguage(): LanguageConfig | undefined {
        return this.languages.find(l => l.isSource);
    }

    /**
     * Get all target (non-source) languages.
     */
    get targetLanguages(): LanguageConfig[] {
        return this.languages.filter(l => !l.isSource);
    }

    /**
     * Get a language config by code.
     */
    getLanguage(code: string): LanguageConfig | undefined {
        return this.languages.find(l => l.code === code);
    }

    /**
     * Check if a locale is the base/source locale.
     */
    isBaseLocale(locale: string): boolean {
        return locale === this.baseLocale;
    }

    /**
     * Get the text direction for a locale.
     */
    getDirection(locale: string): 'ltr' | 'rtl' {
        const lang = this.getLanguage(locale);
        return lang?.direction ?? 'ltr';
    }
}

/**
 * Global config instance — singleton.
 */
export const config = new LangConfigStore();