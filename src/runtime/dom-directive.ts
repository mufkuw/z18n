import { LangService } from '../core/lang-service';
import { hashString } from '../core/hash';

/**
 * DOM Translation Directive — observes elements with [z18n] attribute
 * and auto-translates their text content on language change.
 * 
 * Usage in HTML:
 *   <span z18n>Hello world</span>
 *   <div z18n>Total documents:</div>
 * 
 * The directive:
 * 1. Scans the DOM for elements with [z18n] attribute
 * 2. Stores the original text as data-z18n-original
 * 3. On language change, re-translates all observed elements
 * 4. Handles dynamically added elements via MutationObserver
 */
export class DOMDirective {
    private langService: LangService;
    private observer: MutationObserver | null = null;
    private elements: Map<Element, string> = new Map(); // element → original text
    private unsubscribe: (() => void) | null = null;
    private active = false;

    constructor(langService: LangService) {
        this.langService = langService;
    }

    /**
     * Start observing the DOM for [translate] elements.
     */
    start(): void {
        if (this.active) return;
        if (typeof document === 'undefined') return;

        this.active = true;

        // Initial scan — translate all existing elements
        this.scanAndTranslate();

        // Watch for language changes
        this.unsubscribe = this.langService.onChange(() => {
            this.translateAll();
        });

        // Watch for DOM mutations (new elements added)
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof Element) {
                        this.processElement(node);
                        // Also check children
                        const translatables = node.querySelectorAll('[z18n]');
                        for (const child of translatables) {
                            this.processElement(child);
                        }
                    }
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * Stop observing and clean up.
     */
    stop(): void {
        this.active = false;

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.elements.clear();
    }

    /**
     * Scan the entire DOM for [z18n] elements and translate them.
     */
    private scanAndTranslate(): void {
        if (typeof document === 'undefined') return;

        const elements = document.querySelectorAll('[z18n]');
        for (const element of elements) {
            this.processElement(element);
        }
    }

    /**
     * Process a single element: store original text and translate.
     */
    private processElement(element: Element): void {
        // Skip if already processed
        if (this.elements.has(element)) return;

        // Check if it has the z18n attribute
        if (!element.hasAttribute('z18n')) return;

        const text = element.textContent?.trim() ?? '';
        if (!text) return;

        // Store original text
        this.elements.set(element, text);
        element.setAttribute('data-z18n-original', text);

        // Translate immediately
        const translated = this.langService.translate(text);
        if (translated !== text) {
            element.textContent = translated;
        }
    }

    /**
     * Re-translate all observed elements (called on language change).
     */
    private translateAll(): void {
        for (const [element, originalText] of this.elements) {
            const translated = this.langService.translate(originalText);
            element.textContent = translated;
        }
    }
}

/**
 * Create and start the DOM directive.
 * Returns the directive instance for manual control.
 */
export function createDOMDirective(langService: LangService): DOMDirective {
    const directive = new DOMDirective(langService);
    directive.start();
    return directive;
}