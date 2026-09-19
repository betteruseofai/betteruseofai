# Better Use of AI, the browser extension

What your chat costs in energy, water and carbon, counted on your own machine. Works on claude.ai,
chatgpt.com, gemini.google.com, and a model running on your own hardware.

## Building it

```
pnpm --filter @betteruseofai/extension build          # Chrome
pnpm --filter @betteruseofai/extension build:firefox  # Firefox
pnpm --filter @betteruseofai/extension shoot          # screenshots
```

Load `.output/chrome-mv3` as an unpacked extension to try it.

## What it asks for, and what it does not

| Permission | Why |
|---|---|
| `storage`, `unlimitedStorage` | Counts and settings, in this browser |
| `alarms` | A daily job that deletes anything past your retention setting |
| The four site hosts | The adapters read those pages and nothing else |

Not asked for: `tabs`, `webRequest`, `scripting`, `cookies`, `history`, or any-url access. Localhost
is an **optional** permission, requested only if you turn local model detection on.

## The claim, and how to check it

Nothing leaves your machine. That is easy to write and easy to break by accident, so a test reads
the files that actually ship and fails on any way of reaching the network that is not on a short
list with a reason beside it. Today that list is two entries:

- `background.js` fetches `o200k_base.json`, a file packaged inside the extension. The rank table
  is two and a half megabytes and a service worker is built as one file, so inlining it meant a
  worker that reloaded the whole table on every wake. It is 169 kB now.
- `content-scripts/sites.js` fetches our own interceptor out of the extension, which is how the
  build tool's `injectScript` reads a page-world script before handing it to the page.

An end-to-end test loads the built extension into Chromium, opens every page, and asserts that not
one request leaves for a host.

Prompt text lives for the length of one function call and is dropped. A test serialises a finished
event and asserts that neither the prompt nor the answer appears anywhere in it.

## Known lint warning

`web-ext lint` reports one `UNSAFE_VAR_ASSIGNMENT` for `innerHTML` in a vendored chunk. That is
Preact's support for `dangerouslySetInnerHTML`, which this extension never uses. Our own source
contains no `innerHTML` at all; the hint element writes text with `textContent`.

Errors: zero. Notices: zero.

## The adapters, and why each is awkward

| Site | The trap |
|---|---|
| claude.ai | The model is sometimes absent from the stream, and it can think without disclosing how much |
| chatgpt.com | Auto-routing means the requested model is not the answering model; only `resolved_model_slug` is honest |
| gemini.google.com | The body is a nested array with no field names, so the model comes from a header |
| Local front ends | The happy case: exact counts, nothing estimated |

Every adapter carries a version and a health probe. When a site changes shape the popup says the
adapter needs an update rather than showing a figure nobody should trust.
