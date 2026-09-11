/**
 * Stands in for the rank table so a bundler does not inline it.
 *
 * The extension's build aliases js-tiktoken's rank module to this file. The
 * table is two and a half megabytes and an extension service worker is built
 * as a single file, so leaving the real module reachable meant the worker
 * carried it whether it was used or not.
 *
 * The background sets a loader that reads the table out of a file packaged
 * with the extension. If this throws, that loader was never set, and the
 * message says so rather than failing somewhere further away.
 */
const notBundled = new Proxy(
  {},
  {
    get() {
      throw new Error(
        'The o200k rank table is not bundled into the extension. ' +
          'Call setRanksLoader before counting tokens; the background does this at startup.',
      );
    },
  },
);

export default notBundled;
