/*
 * Applies the saved theme before the first paint.
 *
 * A file rather than an inline script, so the content security policy needs no
 * exception for inline execution at all. Loaded without defer or type=module
 * in the head, which blocks the parser and therefore runs before anything is
 * painted. That is the whole requirement: a dark page must not flash white.
 *
 * Two lines of work. Read one key, set one attribute.
 */
try {
  var saved = localStorage.getItem('buoa-theme');
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.dataset.theme = saved;
  }
} catch (error) {
  /* Site data switched off. The media query in tokens.css still applies. */
}
