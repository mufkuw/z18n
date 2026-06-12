/**
 * z18n — Hash-based, zero-configuration multilingual translation system.
 * 
 * @example
 * import { z18n } from 'z18n';
 * 
 * // Simple — just language codes!
 * await z18n.init({
 *   languages: ['en', 'ar', 'fr'],
 *   translationsPath: '/translations',
 * });
 * 
 * // Full config still works
 * await z18n.init({
 *   languages: [
 *     { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isSource: true },
 *     { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
 *   ],
 *   translationsPath: '/translations',
 * });
 * 
 * // Now use .t() anywhere
 * "Hello world".t()       // → current locale translation
 * "Hello world".t('ar')   // → Arabic translation
 * 
 * // Or use t() function (if you don't want to extend String.prototype)
 * import { t } from 'z18n';
 * t("Hello world");
 */

import { LangService } from './core/lang-service';
import { Dictionary } from './core/dictionary';
import { config } from './core/config-store';
import { initStringExtension, removeStringExtension, createTFunction } from './runtime/string-extension';
import { createDOMDirective, DOMDirective } from './runtime/dom-directive';
import { loadFromUrl, loadFromString, loadFromFile, loadAllTranslations, parseJsonc, parseJsoncWithSources, serializeJsonc } from './loader/translation-loader';
import { md5, hashString, extractWhitespace, applyWhitespace } from './core/hash';
import type { LangConfig, LanguageConfig, LLMConfig, LangChangeListener, ExtractConfig } from './types/index';

// Singleton instances
const dictionary = new Dictionary();
const langService = new LangService(dictionary);
let domDirective: DOMDirective | null = null;
let tFunction: ((text: string, locale?: string) => string) | null = null;

/**
 * z18n — the main entry point for the translation system.
 */
export const z18n = {
    /**
     * Initialize the z18n system.
     * Call this once at app startup.
     * 
     * @param userConfig - Configuration for the z18n system
     */
    async init(userConfig: LangConfig): Promise<void> {
        // Initialize the service
        langService.init(userConfig);

        // Load translations for all target languages
        if (config.translationsPath) {
            const targetLocales = config.languages
                .filter(l => !l.isSource)
                .map(l => l.code);

            if (targetLocales.length > 0) {
                const isBrowser = typeof window !== 'undefined';
                await loadAllTranslations(dictionary, config.translationsPath, targetLocales, isBrowser);
            }
        }

        // Initialize String.prototype.t()
        initStringExtension(langService);

        // Create standalone t() function
        tFunction = createTFunction(langService);

        // Start DOM observer if in browser and enabled
        if (config.observeDOM && typeof document !== 'undefined') {
            domDirective = createDOMDirective(langService);
        }
    },

    /**
     * Translate a string to the current or specified locale.
     * Alternative to "string".t() — useful if you don't want to extend String.prototype.
     */
    translate(text: string, locale?: string): string {
        return langService.translate(text, locale);
    },

    /**
     * Get the current locale.
     */
    getLocale(): string {
        return langService.getLocale();
    },

    /**
     * Get the base (source) locale.
     */
    getBaseLocale(): string {
        return langService.getBaseLocale();
    },

    /**
     * Set the current language. Triggers re-translation of DOM elements.
     */
    setLanguage(locale: string): void {
        langService.setLanguage(locale);
    },

    /**
     * Toggle between base locale and first target locale.
     */
    toggleLanguage(): void {
        langService.toggleLanguage();
    },

    /**
     * Register a listener for language changes.
     * Returns an unsubscribe function.
     */
    onChange(listener: LangChangeListener): () => void {
        return langService.onChange(listener);
    },

    /**
     * Get available language configs.
     */
    getLanguages(): LanguageConfig[] {
        return langService.getLanguages();
    },

    /**
     * Get the text direction for current or specified locale.
     */
    getDirection(locale?: string): 'ltr' | 'rtl' {
        return langService.getDirection(locale);
    },

    /**
     * Load translations for a specific locale from a string.
     * Useful for dynamic loading or bundling.
     */
    loadTranslations(locale: string, translations: Record<string, string>): void {
        dictionary.load(locale, translations);
    },

    /**
     * Load translations for a specific locale from a URL (browser) or file path (Node).
     */
    async loadTranslationsFrom(source: string, locale: string): Promise<void> {
        const isBrowser = typeof window !== 'undefined';
        if (isBrowser) {
            await loadFromUrl(source, dictionary, locale);
        } else {
            await loadFromFile(source, dictionary, locale);
        }
    },

    /**
     * Get the dictionary instance for advanced usage.
     */
    getDictionary(): Dictionary {
        return dictionary;
    },

    /**
     * Get the LangService instance for advanced usage.
     */
    getService(): LangService {
        return langService;
    },

    /**
     * Stop the DOM directive observer and clean up.
     */
    destroy(): void {
        if (domDirective) {
            domDirective.stop();
            domDirective = null;
        }
        removeStringExtension();
        tFunction = null;
    },
};

/**
 * Standalone translate function.
 * Use this if you prefer not to extend String.prototype.
 * 
 * @example
 * import { t } from 'z18n';
 * t("Hello world")      // → current locale translation
 * t("Hello world", 'ar') // → Arabic translation
 */
export function t(text: string, locale?: string): string {
    if (tFunction) {
        return tFunction(text, locale);
    }
    // Fallback if not initialized
    return text;
}

// Re-export all types
export type {
    LangConfig,
    LanguageConfig,
    LanguageCode,
    LLMConfig,
    LangChangeListener,
    ExtractConfig,
    TranslationEntry,
    WhitespaceInfo,
} from './types/index';

// Re-export core functions for advanced usage
export {
    md5,
    hashString,
    extractWhitespace,
    applyWhitespace,
} from './core/hash';

export {
    Dictionary,
} from './core/dictionary';

export {
    LangService,
} from './core/lang-service';

export {
    parseJsonc,
    parseJsoncWithSources,
    serializeJsonc,
    loadFromUrl,
    loadFromString,
    loadFromFile,
} from './loader/translation-loader';

export {
    initStringExtension,
    removeStringExtension,
    createTFunction,
} from './runtime/string-extension';

export {
    DOMDirective,
    createDOMDirective,
} from './runtime/dom-directive';

export {
    validateLanguages,
    resolveLanguages,
    getSourceLanguage,
    getLanguageByCode,
    getTargetLanguages,
} from './core/lang-config';

// Default export
export default z18n;