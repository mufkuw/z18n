# z18n

> **Z**ero-config i**18n** — Hash-based, zero-configuration multilingual translation system for TypeScript/JavaScript applications.

## Why z18n?

- ✅ **No manual keys** — English text automatically generates MD5 hash keys
- ✅ **Self-documenting** — Code reads naturally in English
- ✅ **Base language = free** — Zero overhead for source language, no `en.json` needed
- ✅ **Framework-agnostic** — Works with React, Vue, Angular, Svelte, vanilla JS
- ✅ **Whitespace-safe** — `"Hello ".t()` preserves spacing, but hashes trim to avoid duplicates
- ✅ **LLM-powered** — Auto-translate missing entries using OpenAI, Anthropic, or Ollama
- ✅ **JSONC with comments** — Translation files include source text for translators
- ✅ **Vite-compatible** — Ships ESM + CJS, tree-shakeable

## Install

```bash
npm install z18n
# or
bun add z18n
```

## Quick Start

### 1. Initialize

```ts
import { z18n } from 'z18n';

await z18n.init({
  baseLocale: 'en',
  currentLocale: 'ar',
  translationsPath: '/translations',
  languages: [
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isSource: true },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
    { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' },
  ],
});
```

### 2. Use in Code

```ts
// String extension method
const title = "Dashboard".t();       // → "لوحة التحكم" (Arabic active)
const msg = "Hello world".t('fr');   // → "Bonjour le monde"

// Standalone function (if you prefer not to extend String.prototype)
import { t } from 'z18n';
const title2 = t("Dashboard");
```

### 3. Use in HTML

```html
<h1 z18n>Dashboard</h1>
<p z18n>Total documents:</p>
<!-- MutationObserver auto-detects and translates -->
<!-- On language change, all [z18n] elements update -->
```

### 4. Switch Language

```ts
z18n.setLanguage('fr');      // All .t() calls now return French
z18n.setLanguage('en');       // Returns original English (zero overhead)
z18n.toggleLanguage();      // Toggle between base and first target language
```

## Translation Files

Translation files use **JSONC** (JSON with comments) so translators can see the original English text:

```jsonc
// translations/ar.jsonc
{
  "5eb63bbbe01eeed093cb22bb8f5acdc3": "مرحبا بالعالم",  // hello world
  "99dea78007133396a7b8ed70578ac6ae": "تسجيل الدخول",   // Login
  "0323de4f66a1700e2173e9bcdce02715": ""                 // Logout ← needs translation
}
```

- **Key = MD5 hash** of trimmed English text — deterministic, collision-proof
- **Value = translation** in target language
- **Comment = original English** — so translators know what they're translating
- **Empty string = missing** — the LLM tool fills these

No `en.jsonc` is needed — English IS the dictionary.

## CLI Tools

### Extract Translatable Strings

```bash
# Scan source files for .t() calls and [z18n] attributes
bun run src/cli/extract.ts
```

Finds `"text".t()` in `.ts`/`.tsx` and `<tag z18n>text</tag>` in `.html`/`.vue`/`.jsx`, then updates translation files.

### Auto-Translate with LLM

```bash
# Fill empty translations using AI
bun run src/cli/translate.ts
```

Supports **OpenAI** (gpt-4o-mini), **Anthropic** (claude-haiku), and **Ollama** (local). Configure in `z18n.config.json`:

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiKey": "sk-...",
    "batchSize": 20,
    "reviewRequired": true
  }
}
```

## API Reference

### `z18n.init(config)`

Initialize the translation system. Call once at app startup.

```ts
await z18n.init({
  baseLocale: 'en',           // Source language (never translated)
  currentLocale: 'ar',        // Active language
  translationsPath: '/translations',  // Path to .jsonc files
  languages: [...],           // Available languages
  observeDOM: true,           // Auto-observe [z18n] elements (default: true in browser)
});
```

### `"text".t(locale?)`

Translate a string. If `locale` is omitted, uses current locale.

```ts
"Hello world".t()       // Current locale
"Hello world".t('ar')   // Specific locale
```

### `t(text, locale?)`

Standalone translate function (doesn't extend String.prototype).

```ts
import { t } from 'z18n';
t("Hello world")        // Current locale
t("Hello world", 'ar')  // Specific locale
```

### `z18n.setLanguage(locale)`

Switch the active language. Notifies all listeners and updates DOM.

### `z18n.getLocale()`

Get the current locale code.

### `z18n.toggleLanguage()`

Toggle between base locale and first target locale.

### `z18n.onChange(callback)`

Subscribe to language changes. Returns an unsubscribe function.

```ts
const unsub = z18n.onChange((newLocale, oldLocale) => {
  console.log(`Language changed: ${oldLocale} → ${newLocale}`);
});
// Later: unsub();
```

### `z18n.loadTranslations(locale, translations)`

Manually load translations for a locale.

### `z18n.destroy()`

Clean up DOM observer and remove String.prototype extension.

## Configuration

### `z18n.config.json`

```json
{
  "baseLocale": "en",
  "languages": [
    { "code": "en", "name": "English", "nativeName": "English", "direction": "ltr", "isSource": true },
    { "code": "ar", "name": "Arabic", "nativeName": "العربية", "direction": "rtl" },
    { "code": "fr", "name": "French", "nativeName": "Français", "direction": "ltr" }
  ],
  "translationsDir": "./translations",
  "srcDirs": ["./src"],
  "includePatterns": ["**/*.ts", "**/*.tsx", "**/*.html", "**/*.jsx", "**/*.vue"],
  "excludePatterns": ["**/node_modules/**", "**/dist/**"],
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "batchSize": 20,
    "reviewRequired": true
  }
}
```

## How It Works

```
"Hello world".t()
       │
       ├── Locale is 'en' (base)? → Return "Hello world" immediately
       │
       └── Locale is 'ar'/'fr'/etc?
           │
           ├── MD5("Hello world") → "5eb63bbbe01eeed093cb22bb8f5acdc3"
           ├── Lookup ar.jsonc["5eb63bbbe01eeed093cb22bb8f5acdc3"]
           ├── Found? → Return "مرحبا بالعالم"
           └── Not found? → Return original "Hello world"
```

Whitespace is trimmed before hashing but preserved in output:

```
"  Hello world  ".t()  →  "  مرحبا بالعالم  "
" Hello world ".t()    →  " مرحبا بالعالم "
```

## Build

```bash
bun run build    # Vite build → dist/index.mjs + dist/index.cjs
bun test         # Run tests
```

## License

MIT