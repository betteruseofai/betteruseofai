/*
 * Applies the saved theme before the first paint.
 *
 * A file rather than an inline script, so the content security policy needs no
 * exception for inline execution at all. Loaded without defer or type=module
 * in the head, which blocks the parser and therefore runs before anything is
 * painted. That is the whole requirement: a dark page must not flash white.
 *
 * Two keys, two attributes. The theme, and whether the reader has asked the
 * backdrop to hold still. Both are named on the privacy page.
 */
try {
  var saved = localStorage.getItem('buai-theme');
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.dataset.theme = saved;
  }
  if (localStorage.getItem('buai-still') === '1') {
    document.documentElement.dataset.still = '1';
  }
} catch (error) {
  /* Site data switched off. The media query in tokens.css still applies. */
}
