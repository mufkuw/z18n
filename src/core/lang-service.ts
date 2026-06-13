import { config } from './config-store';
import { Dictionary } from './dictionary';
import { hashString, extractWhitespace, applyWhitespace } from './hash';
import { validateLanguages, getSourceLanguage, resolveLanguages } from './lang-config';
import type { LangConfig, LangChangeListener, LanguageConfig } from '../types/index';

/**
 * LangService — the core translation engine for z18n.
 * 
 * Manages:
 * - Current locale
 * - Translation dictionary
 * - Language change listeners
 * - DOM direction attributes
 */
export class LangService {
    private dictionary: Dictionary;
    private listeners: Set<LangChangeListener> = new Set();
    private initialized = false;

    constructor(dictionary: Dictionary) {
        this.dictionary = dictionary;
    }

    /**
     * Initialize the z18n system.
     * Call this once at app startup.
     */
    init(userConfig: LangConfig): void {
        // Resolve shorthand languages (string codes) into full configs
        // Pass baseLocale so resolveLanguages can mark the correct source language
        const languages: LanguageConfig[] = resolveLanguages(userConfig.languages, userConfig.baseLocale);

        // Merge with defaults
        const baseLocale = userConfig.baseLocale ?? 'en';
        const currentLocale = userConfig.currentLocale ?? baseLocale;

        config.baseLocale = baseLocale;
        config.currentLocale = currentLocale;
        config.translationsPath = userConfig.translationsPath;
        config.languages = languages;
        config.observeDOM = userConfig.observeDOM ?? (typeof window !== 'undefined');

        // Validate
        const errors = validateLanguages(config.languages);
        if (errors.length > 0) {
            throw new Error(`[z18n] Configuration errors:\n${errors.join('\n')}`);
        }

        // Ensure source language matches baseLocale
        const source = getSourceLanguage(config.languages);
        if (source.code !== baseLocale) {
            throw new Error(
                `[z18n] Source language code "${source.code}" does not match baseLocale "${baseLocale}". ` +
                `The isSource language must match baseLocale.`
            );
        }

        // Set initial DOM attributes
        this.updateDOMDirection(currentLocale);

        this.initialized = true;
    }

    /**
     * Check if the service has been initialized.
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get the current locale.
     */
    getLocale(): string {
        return config.currentLocale;
    }

    /**
     * Get the base (source) locale.
     */
    getBaseLocale(): string {
        return config.baseLocale;
    }

    /**
     * Check if the current locale is the base locale.
     */
    isBaseLocale(): boolean {
        return config.currentLocale === config.baseLocale;
    }

    /**
     * Set the current language.
     * Triggers all listeners and updates DOM direction.
     */
    setLanguage(locale: string): void {
        const oldLocale = config.currentLocale;
        if (locale === oldLocale) return;

        config.currentLocale = locale;
        this.updateDOMDirection(locale);

        // Notify all listeners
        for (const listener of this.listeners) {
            try {
                listener(locale, oldLocale);
            } catch (e) {
                console.error('[z18n] Error in language change listener:', e);
            }
        }
    }

    /**
     * Translate a string.
     * 
     * - If current locale is the base locale, returns the string as-is.
     * - Otherwise, hashes the trimmed string, looks up the translation,
     *   and applies original whitespace.
     */
    translate(text: string, locale?: string): string {
        const targetLocale = locale ?? config.currentLocale;

        // Base locale: return as-is (zero overhead)
        if (targetLocale === config.baseLocale) {
            return text;
        }

        // Extract whitespace, hash the trimmed string
        const ws = extractWhitespace(text);
        const hash = hashString(ws.trimmed);

        // Look up translation
        const translation = this.dictionary.get(targetLocale, hash);

        if (translation !== undefined) {
            // Apply original whitespace around translation
            return applyWhitespace(translation, ws);
        }

        // Fallback: return original string
        return text;
    }

    /**
     * Register a listener for language changes.
     * Returns an unsubscribe function.
     */
    onChange(listener: LangChangeListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Get the dictionary instance (for loading translations).
     */
    getDictionary(): Dictionary {
        return this.dictionary;
    }

    /**
     * Get available language configs.
     */
    getLanguages() {
        return config.languages;
    }

    /**
     * Get a specific language config.
     */
    getLanguageConfig(code: string) {
        return config.getLanguage(code);
    }

    /**
     * Get the text direction for current or specified locale.
     */
    getDirection(locale?: string): 'ltr' | 'rtl' {
        return config.getDirection(locale ?? config.currentLocale);
    }

    /**
     * Toggle between base locale and the first target locale.
     */
    toggleLanguage(): void {
        if (this.isBaseLocale()) {
            const targets = config.targetLanguages;
            if (targets.length > 0) {
                this.setLanguage(targets[0].code);
            }
        } else {
            this.setLanguage(config.baseLocale);
        }
    }

    /**
     * Update the DOM's lang and dir attributes.
     */
    private updateDOMDirection(locale: string): void {
        if (typeof document === 'undefined') return;

        const direction = config.getDirection(locale);
        document.documentElement.setAttribute('lang', locale);
        document.documentElement.setAttribute('dir', direction);

        // Also set on body for broader CSS support
        document.body.setAttribute('dir', direction);
    }
}