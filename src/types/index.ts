/**
 * Language configuration
 */
export interface LanguageConfig {
    /** ISO 639-1 language code (e.g., 'en', 'ar', 'fr') */
    code: string;
    /** English display name */
    name: string;
    /** Native language display name */
    nativeName: string;
    /** Text direction */
    direction: 'ltr' | 'rtl';
    /** Is this the source/base language? */
    isSource?: boolean;
}

/**
 * Shorthand language entry — just a code string like 'en' or 'ar'.
 * Will be auto-resolved to a full LanguageConfig using the built-in language database.
 */
export type LanguageCode = string;

/**
 * Initialization configuration for z18n
 */
export interface LangConfig {
    /** Base/source locale code (default: 'en') */
    baseLocale?: string;
    /** Current locale code (default: baseLocale) */
    currentLocale?: string;
    /** Available languages — accept shorthand codes like ['en', 'ar'] or full config objects */
    languages: Array<LanguageConfig | LanguageCode>;
    /** Path to translations directory (browser: URL, Node: file path) */
    translationsPath?: string;
    /** Whether to auto-observe DOM for [z18n] attributes (default: true in browser) */
    observeDOM?: boolean;
}

/**
 * Translation entry in a .jsonc file
 */
export interface TranslationEntry {
    hash: string;
    translation: string;
    source?: string; // source text, from comment
}

/**
 * LLM translation provider configuration
 */
export interface LLMConfig {
    /** Provider name */
    provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
    /** Model name */
    model?: string;
    /** API key (or set via env: OPENAI_API_KEY, ANTHROPIC_API_KEY) */
    apiKey?: string;
    /** Custom endpoint URL */
    endpoint?: string;
    /** Number of strings per batch LLM call */
    batchSize?: number;
    /** Whether LLM translations need human review (marks them in comments) */
    reviewRequired?: boolean;
}

/**
 * Extract CLI configuration
 */
export interface ExtractConfig {
    /** Source directories to scan */
    srcDirs: string[];
    /** File patterns to include (defaults to common web file types) */
    includePatterns?: string[];
    /** File patterns to exclude */
    excludePatterns?: string[];
    /** Output directory for translations */
    translationsDir: string;
}

/**
 * Listener for language change events
 */
export type LangChangeListener = (newLocale: string, oldLocale: string) => void;

/**
 * Whitespace info extracted from a string before hashing
 */
export interface WhitespaceInfo {
    leading: string;
    trailing: string;
    trimmed: string;
}

/**
 * Result of the translate function
 */
export type TranslateResult = string;