import { installInterceptor } from '../lib/interceptor.js';
import type { InterceptorConfig } from '../lib/interceptor.js';

/**
 * The page-world entry point.
 *
 * Deliberately almost empty. It waits to be told what to watch, then installs
 * the wrapper from lib/interceptor.ts, which is the file worth reading.
 * Nothing is watched until the isolated script hands over a nonce and a list
 * of addresses, so an injected script on its own does nothing at all.
 */
export default defineUnlistedScript(() => {
  let uninstall: (() => void) | null = null;

  window.addEventListener('buai:configure', (event) => {
    const config = (event as CustomEvent).detail as InterceptorConfig;
    if (!config || typeof config.nonce !== 'string' || !Array.isArray(config.patterns)) return;
    // Configured twice means the page navigated within the app. Put the
    // previous wrapper back before installing another, or they stack.
    uninstall?.();
    uninstall = installInterceptor(config);
  });
});
