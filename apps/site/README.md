# The website

Astro, static output, no adapter and no server. The whole site is files on a CDN, which is the only
shape that lets the privacy page say what it says.

```
pnpm --filter @betteruseofai/site dev     a dev server
pnpm --filter @betteruseofai/site build   the real thing, into dist
pnpm --filter @betteruseofai/site test    the copy rules, over the built pages
pnpm --filter @betteruseofai/site shots   48 screenshots, two widths, both themes
```

## The draft gate

Every page and every post carries a `status` of `draft`, `review` or `published`, and the default is
`draft`. Nothing becomes published because a build flag said so; it becomes published when somebody
has read it.

A draft page still renders, with a banner across the top and `noindex` in the head, because a site
missing its methodology page is worse than one with a banner on it. A draft post is different: it is
simply absent from the listing on the production branch, and never enters the feed on any branch,
because a reader's feed client keeps what it fetched.

`src/lib/status.ts` holds all of that. `REQUIRE_PUBLISHED=1` flips on at launch.

## Where the numbers come from

The same engine as the extension and both command line tools, over the same dataset. Two different
routes, for two different reasons.

The **calculator** imports the engine and the dataset into the browser, because it has to answer
whatever you type. It is the only island on the site.

The **landing page** does not. Its budget is 25 kB of JavaScript and the dataset alone is larger
than that, so `src/lib/landing.ts` runs the engine at build time over the handful of combinations
the sentence offers and ships a small table. The arithmetic left for the browser is one
multiplication. Same engine, same flags, nothing rounded on the way out.

That keeps the landing page at about 2.4 kB of script.

## The copy rules

`docs/STYLE.md` says what not to write, `docs/VOICE.md` says what to aim at, and `styles/BUAI` holds
eleven Vale rules that enforce the first one.

Vale has no parser for `.astro`, so pointing it at the source means it reads the JavaScript as
prose: every `!==` becomes an exclamation mark and every `prefers-color-scheme` becomes an American
spelling. So `scripts/copy-lint.mjs` pulls the text out of the **built** pages and lints that
instead, which is quieter and more honest, because it checks the words a reader sees.

Two things are deliberately excluded from that text. Source panels quote other people's titles
verbatim, and we are not entitled to rewrite a paper's name to suit a style guide. And a `summary`
is emitted as a heading, because the FAQ is made of questions and a question mark there is the whole
point.

The script also runs four checks Vale cannot express: every page has a status, no published page
carries a TODO, no page prints figures without a source, and no word runs into an inline tag.

That last one is a real Astro behaviour rather than a hypothetical. When an inline tag starts or
ends a source line, the whitespace at that break is dropped, and the page reads
`the<a>calculator</a>`. Ten of those shipped into the first build. Write `{' '}` at the break.

## Screenshots

`scripts/shoot.mjs` serves `dist` over the loopback address and drives a browser over twelve pages
at 1440 and 390, in both themes. It serves the built output rather than the dev server on purpose,
since the dev server rewrites paths and inlines styles, so it shows you something other than what
ships.

The design rules in this project are a hard rule rather than a preference, and a rule nobody looks
at is not a rule.

## Deploying

Cloudflare Pages, built from the repository root:

```
pnpm install --frozen-lockfile && pnpm turbo run build --filter=@betteruseofai/site...
```

Output is `apps/site/dist`, Node 22, pnpm 10.

Switch off Rocket Loader, Email Obfuscation, Auto Minify, Mirage, the Bot Fight Mode challenge, and
Web Analytics auto-injection. The beacon is added by hand in `Base.astro` so that the privacy page
can name its exact address, and auto-injection would quietly make that page wrong.

`public/_headers` carries the content security policy. It starts at `default-src 'none'` and opens
only what is used. `connect-src 'self'` is there because the beacon posts to `/cdn-cgi/rum` on this
domain.

Two environment variables, both optional. `PUBLIC_CF_BEACON_TOKEN` turns the beacon on; without it
no third-party script is written at all. `GITHUB_TOKEN` raises the rate limit on the build-time read
of releases, which falls back to a committed snapshot and says so on the page when it does.
