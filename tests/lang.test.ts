import { describe, test, expect } from 'bun:test';
import { md5, hashString, extractWhitespace, applyWhitespace } from '../src/core/hash';
import { Dictionary } from '../src/core/dictionary';
import { LangService } from '../src/core/lang-service';
import { validateLanguages, getSourceLanguage, getTargetLanguages } from '../src/core/lang-config';
import { parseJsonc, parseJsoncWithSources, serializeJsonc } from '../src/loader/translation-loader';
import type { LanguageConfig } from '../src/types/index';

describe('hash', () => {
    test('md5 produces deterministic 32-char hex string', () => {
        const hash = md5('hello world');
        expect(hash).toBe('5eb63bbbe01eeed093cb22bb8f5acdc3');
        expect(hash).toHaveLength(32);
    });

    test('md5 is case-sensitive', () => {
        expect(md5('Hello')).not.toBe(md5('hello'));
    });

    test('md5 produces same hash for same input', () => {
        expect(md5('test')).toBe(md5('test'));
    });

    test('md5 produces different hashes for different inputs', () => {
        expect(md5('hello')).not.toBe(md5('world'));
    });

    test('extractWhitespace handles leading whitespace', () => {
        const result = extractWhitespace('  hello');
        expect(result).toEqual({ leading: '  ', trailing: '', trimmed: 'hello' });
    });

    test('extractWhitespace handles trailing whitespace', () => {
        const result = extractWhitespace('hello  ');
        expect(result).toEqual({ leading: '', trailing: '  ', trimmed: 'hello' });
    });

    test('extractWhitespace handles both', () => {
        const result = extractWhitespace('  hello  ');
        expect(result).toEqual({ leading: '  ', trailing: '  ', trimmed: 'hello' });
    });

    test('extractWhitespace handles no whitespace', () => {
        const result = extractWhitespace('hello');
        expect(result).toEqual({ leading: '', trailing: '', trimmed: 'hello' });
    });

    test('hashString trims whitespace before hashing', () => {
        expect(hashString('hello')).toBe(hashString(' hello'));
        expect(hashString('hello')).toBe(hashString('hello '));
        expect(hashString('hello')).toBe(hashString(' hello '));
    });

    test('applyWhitespace preserves whitespace around translation', () => {
        expect(applyWhitespace('مرحبا', { leading: '  ', trailing: '' })).toBe('  مرحبا');
        expect(applyWhitespace('مرحبا', { leading: '', trailing: '  ' })).toBe('مرحبا  ');
        expect(applyWhitespace('مرحبا', { leading: '  ', trailing: '  ' })).toBe('  مرحبا  ');
    });
});

describe('dictionary', () => {
    test('load and get translations', () => {
        const dict = new Dictionary();
        dict.load('ar', { '5eb63bbbe01eeed093cb22bb8f5acdc3': 'مرحبا بالعالم' });
        expect(dict.get('ar', '5eb63bbbe01eeed093cb22bb8f5acdc3')).toBe('مرحبا بالعالم');
    });

    test('returns undefined for missing translation', () => {
        const dict = new Dictionary();
        expect(dict.get('ar', 'nonexistent')).toBeUndefined();
    });

    test('returns undefined for missing locale', () => {
        const dict = new Dictionary();
        dict.load('ar', { 'hash1': 'value1' });
        expect(dict.get('fr', 'hash1')).toBeUndefined();
    });

    test('merges translations on load', () => {
        const dict = new Dictionary();
        dict.load('ar', { 'hash1': 'value1' });
        dict.load('ar', { 'hash2': 'value2' });
        expect(dict.get('ar', 'hash1')).toBe('value1');
        expect(dict.get('ar', 'hash2')).toBe('value2');
    });

    test('overwrites existing translations', () => {
        const dict = new Dictionary();
        dict.load('ar', { 'hash1': 'old' });
        dict.load('ar', { 'hash1': 'new' });
        expect(dict.get('ar', 'hash1')).toBe('new');
    });

    test('getLocaleTranslations returns plain object', () => {
        const dict = new Dictionary();
        dict.load('ar', { 'hash1': 'value1', 'hash2': 'value2' });
        const result = dict.getLocaleTranslations('ar');
        expect(result).toEqual({ hash1: 'value1', hash2: 'value2' });
    });

    test('getLocales returns loaded locale codes', () => {
        const dict = new Dictionary();
        dict.load('ar', {});
        dict.load('fr', {});
        expect(dict.getLocales()).toContain('ar');
        expect(dict.getLocales()).toContain('fr');
    });

    test('count returns number of translations', () => {
        const dict = new Dictionary();
        dict.load('ar', { 'hash1': 'v1', 'hash2': 'v2' });
        expect(dict.count('ar')).toBe(2);
        expect(dict.count('fr')).toBe(0);
    });

    test('getMissingHashes finds missing translations', () => {
        const dict = new Dictionary();
        dict.load('ar', { 'hash1': 'v1' });
        const reference = new Set(['hash1', 'hash2', 'hash3']);
        const missing = dict.getMissingHashes('ar', reference);
        expect(missing).toContain('hash2');
        expect(missing).toContain('hash3');
        expect(missing).not.toContain('hash1');
    });
});

describe('lang-config', () => {
    const validLanguages: LanguageConfig[] = [
        { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isSource: true },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
    ];

    test('validateLanguages passes for valid config', () => {
        const errors = validateLanguages(validLanguages);
        expect(errors).toHaveLength(0);
    });

    test('validateLanguages detects missing source', () => {
        const noSource = validLanguages.map(l => ({ ...l, isSource: false }));
        const errors = validateLanguages(noSource);
        expect(errors.length).toBeGreaterThan(0);
    });

    test('validateLanguages detects duplicate codes', () => {
        const dupes = [...validLanguages, { code: 'ar', name: 'Arabic2', nativeName: 'العربية', direction: 'rtl' as const }];
        const errors = validateLanguages(dupes);
        expect(errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    test('getSourceLanguage returns source language', () => {
        expect(getSourceLanguage(validLanguages).code).toBe('en');
    });

    test('getTargetLanguages returns non-source languages', () => {
        expect(getTargetLanguages(validLanguages)).toHaveLength(1);
        expect(getTargetLanguages(validLanguages)[0].code).toBe('ar');
    });
});

describe('lang-service', () => {
    const testLanguages: LanguageConfig[] = [
        { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', isSource: true },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
    ];

    function createService(): LangService {
        const dict = new Dictionary();
        dict.load('ar', {
            '5eb63bbbe01eeed093cb22bb8f5acdc3': 'مرحبا بالعالم',
            '8b1a9953c4611296a827abf8c47804d7': 'مرحبا',
        });
        return new LangService(dict);
    }

    test('init sets locale and config', () => {
        const service = createService();
        service.init({
            baseLocale: 'en',
            currentLocale: 'ar',
            languages: testLanguages,
        });
        expect(service.getLocale()).toBe('ar');
        expect(service.getBaseLocale()).toBe('en');
        expect(service.isBaseLocale()).toBe(false);
    });

    test('translate returns original string for base locale', () => {
        const service = createService();
        service.init({
            baseLocale: 'en',
            currentLocale: 'en',
            languages: testLanguages,
        });
        expect(service.translate('hello world')).toBe('hello world');
    });

    test('translate returns translation for target locale', () => {
        const service = createService();
        service.init({
            baseLocale: 'en',
            currentLocale: 'ar',
            languages: testLanguages,
        });
        expect(service.translate('hello world')).toBe('مرحبا بالعالم');
    });

    test('translate with explicit locale overrides current', () => {
        const service = createService();
        service.init({
            baseLocale: 'en',
            currentLocale: 'en',
            languages: testLanguages,
        });
        expect(service.translate('hello world', 'ar')).toBe('مرحبا بالعالم');
    });

    test('translate returns original for missing translation', () => {
        const service = createService();
        service.init({
            baseLocale: 'en',
            currentLocale: 'ar',
            languages: testLanguages,
        });
        expect(service.translate('unknown string')).toBe('unknown string');
    });

    test('translate preserves whitespace', () => {
        const service = createService();
        service.init({
            baseLocale: 'en',
            currentLocale: 'ar',
            languages: testLanguages,
        });
        expect(service.translate('  hello world  ')).toBe('  مرحبا بالعالم  ');
        expect(service.translate('hello world ')).toBe('مرحبا بالعالم ');
        expect(service.translate(' hello world')).toBe(' مرحبا بالعالم');
    });

    test('setLanguage changes locale and notifies listeners', () => {
        const service = createService();
        service.init({
            baseLocale: 'en',
            currentLocale: 'en',
            languages: testLanguages,
        });

        const changes: Array<{ newLocale: string; oldLocale: string }> = [];
        service.onChange((newLocale, oldLocale) => {
            changes.push({ newLocale, oldLocale });
        });

        service.setLanguage('ar');
        expect(service.getLocale()).toBe('ar');
        expect(changes).toHaveLength(1);
        expect(changes[0]).toEqual({ newLocale: 'ar', oldLocale: 'en' });
    });

    test('onChange returns unsubscribe function', () => {
        const service = createService();
        service.init({
            baseLocale: 'en',
            currentLocale: 'en',
            languages: testLanguages,
        });

        let count = 0;
        const unsub = service.onChange(() => { count++; });

        service.setLanguage('ar');
        expect(count).toBe(1);

        unsub();
        service.setLanguage('en');
        expect(count).toBe(1);
    });

    test('toggleLanguage switches between base and target', () => {
        const service = createService();
        service.init({
            baseLocale: 'en',
            currentLocale: 'en',
            languages: testLanguages,
        });

        service.toggleLanguage();
        expect(service.getLocale()).toBe('ar');

        service.toggleLanguage();
        expect(service.getLocale()).toBe('en');
    });
});

describe('jsonc', () => {
    test('parseJsonc strips single-line comments', () => {
        const jsonc = '{\n  "hash1": "value1",\n  "hash2": "value2"\n}';
        const result = parseJsonc(jsonc);
        expect(result).toEqual({ hash1: 'value1', hash2: 'value2' });
    });

    test('parseJsonc handles trailing commas', () => {
        const jsonc = '{\n  "hash1": "value1",\n  "hash2": "value2",\n}';
        const result = parseJsonc(jsonc);
        expect(result).toEqual({ hash1: 'value1', hash2: 'value2' });
    });

    test('parseJsoncWithSources extracts sources', () => {
        const jsonc = '{\n  "5eb63bbbe01eeed093cb22bb8f5acdc3": "مرحبا بالعالم",  // hello world\n}';
        const { translations, sources } = parseJsoncWithSources(jsonc);
        expect(translations['5eb63bbbe01eeed093cb22bb8f5acdc3']).toBe('مرحبا بالعالم');
        expect(sources['5eb63bbbe01eeed093cb22bb8f5acdc3']).toBe('hello world');
    });

    test('serializeJsonc produces valid JSONC with comments', () => {
        const translations = { '5eb63bbbe01eeed093cb22bb8f5acdc3': 'مرحبا بالعالم' };
        const sources = { '5eb63bbbe01eeed093cb22bb8f5acdc3': 'hello world' };
        const result = serializeJsonc(translations, sources);
        expect(result).toContain('// hello world');
        expect(result).toContain('"5eb63bbbe01eeed093cb22bb8f5acdc3"');
        expect(result).toContain('مرحبا بالعالم');
    });
});