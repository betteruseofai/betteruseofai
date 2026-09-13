# Launch checklist

> Working document. What has to happen, in order, to take the site live and put the tools in the
> stores. The code is ready; every item below needs an account, a decision or a reading that only
> the owner can supply. Tick them off here.

## 1. Read the pages

Every page carries `status: draft` and a banner until a person has read it. That person is
Anirudh. For each page, read it on the local build, change `status="draft"` to `status="published"`
in its `.astro` file, and commit. There are eleven:

- [ ] `/` landing
- [ ] `/methodology`
- [ ] `/calculator`
- [ ] `/install`
- [ ] `/about`, which also needs the affiliation line that is still `Redacted`
- [ ] `/local-llms`
- [ ] `/privacy`
- [ ] `/changelog`
- [ ] `/blog`, the Writing hub
- [ ] `/design`, which stays `noindex` regardless
- [ ] `/404`, already published

Then set `REQUIRE_PUBLISHED=1` in the Cloudflare build environment, and the gate is closed.

## 2. Accounts and names

All three names were free on 2026-09-10.

- [ ] GitHub organisation `betteruseofai`, with `gordianknot-legacy` as owner. Transfer or push this
      repository to `betteruseofai/betteruseofai`; every link in the site already points there.
- [ ] In the repository settings, an environment named `release` with required reviewers, so the
      publish jobs in `release.yml` wait for a person.
- [ ] npm organisation `betteruseofai`. Either an automation token stored as the `NPM_TOKEN` secret,
      or trusted publishing configured for each of the five packages against this repository and
      the `release.yml` workflow.
- [ ] PyPI project `betteruseofai`, with trusted publishing configured for this repository, the
      `release.yml` workflow and the `release` environment. No token is stored.
- [ ] Chrome Web Store developer account. One-time fee.
- [ ] Firefox Add-ons account.
- [ ] Cloudflare account.

## 3. Contributors' Substack addresses

- [ ] Add each to `apps/site/src/data/substacks.json` as `{ "name": "...", "url": "https://....substack.com" }`.
      The build reads `<url>/feed`. Then run `pnpm exec tsx apps/site/scripts/snapshot.ts` once so
      the committed snapshot is not empty.

## 4. Cloudflare Pages

From `PLAN.md` section 8.7, still current.

- [ ] Create the Pages project from the repository. Build command, from the repository root:
      `pnpm install --frozen-lockfile && pnpm turbo run build --filter=@betteruseofai/site...`.
      Output directory `apps/site/dist`. Node 22, `PNPM_VERSION=10`.
- [ ] Environment variables: `PUBLIC_CF_BEACON_TOKEN` from Web Analytics (optional; without it no
      third-party script is written at all), `GITHUB_TOKEN` read-only (optional; raises the API rate
      limit for the build-time reads), and at launch `REQUIRE_PUBLISHED=1`.
- [ ] Switch off Rocket Loader, Email Obfuscation, Auto Minify, Mirage, the Bot Fight Mode challenge,
      and Web Analytics auto-injection. The beacon is added by hand in `Base.astro` so the privacy
      page can name its exact address; auto-injection would make that page wrong.
- [ ] Add the zone `betteruseofai.org`, then at Namecheap set the two Cloudflare nameservers (Domain
      List, Manage, Custom DNS). Add `betteruseofai.org` and `www` as custom domains on the project.
- [ ] Full (strict) TLS, Always HTTPS, DNSSEC. HSTS after a stable week.
- [ ] Check the preview URL on `*.pages.dev` carries `noindex` (the `_headers` file does this) and
      that production loads only self-hosted assets plus the one disclosed beacon.

## 5. The first release

- [ ] `pnpm changeset` for the change, then `pnpm version-packages`, which moves the fixed group to
      one version and copies it into the Python package. Commit.
- [ ] Rebuild the plugin bundle, `pnpm --filter @betteruseofai/claude-code-plugin build`, and commit
      `apps/claude-code-plugin/dist`. It is tracked because a marketplace install cannot build; CI
      fails if the committed bundle is not the one the commit builds.
- [ ] Tag `v<version>` and push the tag. `release.yml` builds, tests, runs parity, attaches both
      extension zips and `SHA256SUMS` to a GitHub release, and then waits for approval of the
      `release` environment before touching npm or PyPI.
- [ ] Chrome Web Store: upload `betteruseofai-<version>-chrome.zip`. The listing needs the 128 px
      icon, which is in the zip, and screenshots, which are in `apps/extension/shots`.
- [ ] Firefox Add-ons: upload `betteruseofai-<version>-firefox.zip` and the `-sources.zip` beside it.
      `web-ext lint` is clean of errors and notices on every push.
- [ ] Claude Code plugin: nothing to upload. `/plugin marketplace add betteruseofai/betteruseofai`
      reads the repository.

## 6. Afterwards

- [ ] The `snapshots` workflow runs every Monday and opens a pull request when the committed
      snapshots moved. Merge it.
- [ ] The `dataset links` workflow runs every Monday and fails loudly on a dead source URL. Fix the
      row.
- [ ] The dataset debt in `packages/dataset/CHANGELOG.md`, in the order it is listed there: the
      Ember refetch first.
