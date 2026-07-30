import type { Page } from '@playwright/test';

/** Abaikan noise yang diketahui tidak memblokir UI. */
const IGNORE = [
  /Download the React DevTools/i,
  /\[Tiptap warn\]/i,
  /Duplicate extension names/i,
  /favicon/i,
  /Failed to load resource/i,
  /Function components cannot be given refs/i,
  /Warning:/i,
  /React does not recognize/i,
  /validateDOMNesting/i,
];

export function attachPageErrorGuard(page: Page): () => void {
  const errors: string[] = [];

  const onPageError = (err: Error) => {
    const msg = err.message || String(err);
    if (IGNORE.some((re) => re.test(msg))) return;
    errors.push(msg);
  };

  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORE.some((re) => re.test(text))) return;
    if (/net::ERR_/i.test(text)) return;
    // React DevTools / forwardRef sering muncul sebagai console.error
    if (/forwardRef|cannot be given refs/i.test(text)) return;
    errors.push(text);
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  return () => {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    if (errors.length) {
      throw new Error(`Page error / console error:\n- ${errors.join('\n- ')}`);
    }
  };
}
