/**
 * Translation dictionary — stores hash → translation mappings per locale.
 * 
 * Structure:
 * {
 *   "ar": { "5c32df...": "مرحبا بالعالم", ... },
 *   "fr": { "5c32df...": "Bonjour le monde", ... }
 * }
 */
export class Dictionary {
    private store: Map<string, Map<string, string>> = new Map();

    /**
     * Load translations for a specific locale.
     * Merges with existing entries (new entries overwrite old ones).
     */
    load(locale: string, translations: Record<string, string>): void {
        let localeMap = this.store.get(locale);
        if (!localeMap) {
            localeMap = new Map();
            this.store.set(locale, localeMap);
        }

        for (const [hash, translation] of Object.entries(translations)) {
            localeMap.set(hash, translation);
        }
    }

    /**
     * Look up a translation by locale and hash.
     * Returns the translation string, or undefined if not found.
     */
    get(locale: string, hash: string): string | undefined {
        const localeMap = this.store.get(locale);
        if (!localeMap) return undefined;
        return localeMap.get(hash);
    }

    /**
     * Check if a translation exists for a given locale and hash.
     */
    has(locale: string, hash: string): boolean {
        return this.store.get(locale)?.has(hash) ?? false;
    }

    /**
     * Set a single translation entry.
     */
    set(locale: string, hash: string, translation: string): void {
        let localeMap = this.store.get(locale);
        if (!localeMap) {
            localeMap = new Map();
            this.store.set(locale, localeMap);
        }
        localeMap.set(hash, translation);
    }

    /**
     * Get all translations for a locale as a plain object.
     */
    getLocaleTranslations(locale: string): Record<string, string> {
        const localeMap = this.store.get(locale);
        if (!localeMap) return {};
        const result: Record<string, string> = {};
        for (const [hash, translation] of localeMap) {
            result[hash] = translation;
        }
        return result;
    }

    /**
     * Get all loaded locales.
     */
    getLocales(): string[] {
        return Array.from(this.store.keys());
    }

    /**
     * Get the number of translations for a locale.
     */
    count(locale: string): number {
        return this.store.get(locale)?.size ?? 0;
    }

    /**
     * Clear all translations.
     */
    clear(): void {
        this.store.clear();
    }

    /**
     * Clear translations for a specific locale.
     */
    clearLocale(locale: string): void {
        this.store.delete(locale);
    }

    /**
     * Get missing hashes for a locale compared to a reference set of hashes.
     */
    getMissingHashes(locale: string, referenceHashes: Set<string>): string[] {
        const localeMap = this.store.get(locale);
        if (!localeMap) return Array.from(referenceHashes);

        const missing: string[] = [];
        for (const hash of referenceHashes) {
            if (!localeMap.has(hash)) {
                missing.push(hash);
            }
        }
        return missing;
    }

    /**
     * Export all translations as a plain object (for serialization).
     */
    toJSON(): Record<string, Record<string, string>> {
        const result: Record<string, Record<string, string>> = {};
        for (const [locale, localeMap] of this.store) {
            result[locale] = {};
            for (const [hash, translation] of localeMap) {
                result[locale][hash] = translation;
            }
        }
        return result;
    }
}