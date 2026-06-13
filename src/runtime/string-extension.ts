import { LangService } from '../core/lang-service';

/**
 * Module-level reference to the current LangService.
 * This allows String.prototype.t() to always use the latest service
 * even after re-initialization.
 */
let currentLangService: LangService | null = null;

/**
 * Initialize the String.prototype.t() extension method.
 * 
 * This adds `.t()` to all strings, enabling the developer API:
 *   "Hello world".t()
 *   "Hello world".t('ar')
 * 
 * Must be called after z18n.init() to have access to the service.
 * Can be called multiple times — the service reference is updated.
 */
export function initStringExtension(langService: LangService): void {
    // Always update the service reference
    currentLangService = langService;

    // Only define String.prototype.t once
    if (typeof String.prototype.t === 'function') {
        return;
    }

    Object.defineProperty(String.prototype, 't', {
        value: function (this: string, locale?: string): string {
            if (!currentLangService) {
                console.warn('[z18n] String.prototype.t() called before init. Returning original string.');
                return this;
            }
            return currentLangService.translate(this, locale);
        },
        writable: false,
        configurable: true,
        enumerable: false,
    });
}

/**
 * Remove the String.prototype.t() extension.
 * Useful for testing or teardown.
 */
export function removeStringExtension(): void {
    if (typeof String.prototype.t === 'function') {
        delete (String.prototype as any).t;
    }
    // Clear the service reference so .t() cannot use stale state
    currentLangService = null;
}

/**
 * Standalone translate function — alternative to String.prototype.t().
 * Use this if you prefer not to extend String.prototype.
 * 
 * Usage:
 *   t("Hello world")
 *   t("Hello world", "ar")
 */
export function createTFunction(langService: LangService): (text: string, locale?: string) => string {
    return function t(text: string, locale?: string): string {
        return langService.translate(text, locale);
    };
}

// TypeScript type declaration for String.prototype.t()
declare global {
    interface String {
        /**
         * Translate this string to the current locale.
         * 
         * @param locale - Optional locale code. If not provided, uses current locale.
         * @returns Translated string, or original string if translation not found.
         * 
         * @example
         * "Hello world".t()      // Translates to current locale
         * "Hello world".t('ar')  // Translates to Arabic
         */
        t(locale?: string): string;
    }
}