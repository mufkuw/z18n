# z18n

> **Z**ero-config i**18n** — Your code in English. Every language, zero key management.

---

## The Problem

Adding i18n to a project is painful:

- **Manual keys** — You invent keys like `login.button.text`, maintain a separate `en.json`, and keep code and keys in sync forever
- **Key soup** — `t('auth.login.submit')` tells you nothing. Where's the actual text?
- **Source language file** — You ship an `en.json` that's 1:1 with your code. Why duplicate it?
- **Whitespace bugs** — `"  Hello  "` gets a different hash than `"Hello"`, bloating dictionaries
- **HTML duplication** — Every framework reinvents `<span translate>text</span>` differently

## The Solution

**z18n** turns your English strings into hash keys automatically. No manual keys. No source language file. No key management.

```ts
// Your code IS the key
"Hello world".t()       // → "مرحبا بالعالم" (Arabic)
"Hello world".t('fr')   // → "Bonjour le monde" (French)

// In HTML — just add z18n
<h1 z18n>Dashboard</h1>  // → <h1 z18n>لوحة التحكم</h1>
```

**How?** MD5 of trimmed text = dictionary key. Whitespace is preserved in output but stripped before hashing, so `"  Hello  "` and `"Hello"` map to the same entry.

---

## Quick Start

**1. Install**

```bash
npm install z18n
```

**2. Initialize** (once at app startup)

```ts
import { z18n } from 'z18n';

await z18n.init({
  languages: ['en', 'ar'],    // Just codes — name, nativeName, direction auto-filled!
  translationsPath: '/translations',
});
```

**3. Translate**

```ts
// String extension — use anywhere
"Hello world".t()         // current locale
"Hello world".t('ar')     // specific locale

// Standalone function — if you don't want String.prototype extension
import { t } from 'z18n';
t("Hello world")
t("Hello world", 'ar')

// HTML — just add z18n attribute
<h1 z18n>Dashboard</h1>
<p z18n>Total documents:</p>
<!-- MutationObserver auto-detects, translates, updates on language change -->
```

**4. Switch language**

```ts
z18n.setLanguage('fr')    // all .t() and [z18n] elements update instantly
z18n.toggleLanguage()     // toggle between base and target
```

That's it. No keys, no source file, no config hell.

---

## Translation Files

No `en.jsonc` needed — English IS the dictionary. Target language files use **JSONC** so translators see the original text:

```jsonc
// translations/ar.jsonc
{
  "5eb63bbbe01eeed093cb22bb8f5acdc3": "مرحبا بالعالم",  // hello world
  "99dea78007133396a7b8ed70578ac6ae": "تسجيل الدخول",   // Login
  "0323de4f66a1700e2173e9bcdce02715": ""                 // Logout ← needs translation
}
```

| Part | Purpose |
|------|---------|
| **Key** | MD5 hash of trimmed English text — deterministic, collision-proof |
| **Value** | Translation in target language |
| **Comment** | Original English — so translators know context |
| **Empty string** | Missing translation — the LLM tool fills these |

---

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

---

## CLI Tools

### Extract — Scan code, update translation files

```bash
bun run src/cli/extract.ts
```

Finds `"text".t()` in `.ts`/`.tsx` and `<tag z18n>text</tag>` in `.html`/`.vue`/`.jsx`, then updates translation files with new entries.

### Translate — Auto-fill missing translations with LLM

```bash
bun run src/cli/translate.ts
```

Supports **OpenAI** (gpt-4o-mini), **Anthropic** (claude-haiku), and **Ollama** (local).

---

## API Reference

| Method | Description |
|--------|-------------|
| `z18n.init(config)` | Initialize. Call once at startup. |
| `"text".t(locale?)` | Translate a string. Uses current locale if omitted. |
| `t(text, locale?)` | Standalone translate (no String.prototype extension). |
| `z18n.setLanguage(locale)` | Switch active language. Updates all DOM elements. |
| `z18n.getLocale()` | Get current locale code. |
| `z18n.toggleLanguage()` | Toggle between base and target language. |
| `z18n.onChange(fn)` | Subscribe to language changes. Returns unsubscribe function. |
| `z18n.loadTranslations(locale, obj)` | Manually load translations for a locale. |
| `z18n.destroy()` | Clean up DOM observer and String.prototype extension. |

### `z18n.init(config)`

```ts
await z18n.init({
  languages: ['en', 'ar', 'fr'],       // Simple codes or full objects
  // baseLocale defaults to first language code ('en')
  // currentLocale defaults to baseLocale
  translationsPath: '/translations',    // Path to .jsonc files
  observeDOM: true,                     // Auto-observe [z18n] elements (default: true in browser)
});

// Still supports full objects for custom/unknown languages:
await z18n.init({
  languages: [
    { code: 'en', isSource: true },
    { code: 'klingon', name: 'Klingon', nativeName: 'tlhIngan Hol', direction: 'ltr' },
  ],
  translationsPath: '/translations',
});
```

### `z18n.onChange(callback)`

```ts
const unsub = z18n.onChange((newLocale, oldLocale) => {
  console.log(`Language changed: ${oldLocale} → ${newLocale}`);
});
// Later: unsub();
```

---

## Configuration

Create a `z18n.config.json` in **your app's project root** (not inside z18n itself):

### `z18n.config.json`

```json
{
  "languages": ["en", "ar", "fr"],
  "translationsDir": "./translations",
  "srcDirs": ["./src"],
  "includePatterns": ["**/*.ts", "**/*.tsx", "**/*.html", "**/*.jsx", "**/*.vue"],
  "excludePatterns": ["**/node_modules/**", "**/dist/**"],
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiKey": "sk-...",
    "batchSize": 20,
    "reviewRequired": true
  }
}
```

| Field | Used by | Description |
|-------|---------|-------------|
| `languages` | Runtime + CLI | Language codes or full objects. First = source language. |
| `baseLocale` | Runtime | Defaults to first language code. |
| `translationsDir` | CLI | Where `.jsonc` files are stored. |
| `srcDirs` | CLI | Source directories to scan for strings. |
| `includePatterns` | CLI | File patterns to include in extraction. |
| `excludePatterns` | CLI | File patterns to skip. |
| `llm` | CLI | LLM provider config for auto-translation. |

> **Shorthand:** Just use language codes — `name`, `nativeName`, `direction` are auto-filled from a built-in database of 20 common languages. Use a full object only for languages not in the database.

---

## Why z18n?

| Feature | z18n | Traditional i18n |
|---------|------|------------------|
| Key management | **Automatic** (MD5 hash) | Manual (`login.title`) |
| Source language file | **Not needed** | Required (`en.json`) |
| Code readability | `"Hello world".t()` | `t('login.title')` — what's the text? |
| Whitespace handling | **Trimmed for hashing, preserved in output** | Fragile — extra space = different key |
| HTML integration | `<h1 z18n>text</h1>` | Framework-specific directives |
| Missing translations | Fallback to original text | `login.title` shown to users |
| Auto-translation | **Built-in LLM pipeline** | Manual or external |
| Framework support | **Any** (vanilla, React, Vue, Angular, Svelte) | Framework-specific packages |

---

## Build

```bash
bun run build    # Vite build → dist/index.mjs + dist/index.cjs
bun test         # Run tests
```

## License

MIT