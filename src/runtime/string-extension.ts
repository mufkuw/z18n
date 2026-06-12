import { LangService } from '../core/lang-service';
import { extractWhitespace, hashString } from '../core/hash';

/**
 * Initialize the String.prototype.t() extension method.
 * 
 * This adds `.t()` to all strings, enabling the developer API:
 *   "Hello world".t()
 *   "Hello world".t('ar')
 * 
 * Must be called after z18n.init() to have access to the service.
 */
export function initStringExtension(langService: LangService): void {
    // Extend String.prototype with .t() method
    if (typeof String.prototype.t === 'function') {
        // Already initialized — just update the service reference
        return;
    }

    Object.defineProperty(String.prototype, 't', {
        value: function (this: string, locale?: string): string {
            return langService.translate(this, locale);
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