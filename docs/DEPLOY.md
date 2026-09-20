# Launch checklist

> Working document. What has to happen, in order, to take the site live and put the tools in the
> stores. The code is ready; every item below needs an account, a decision or a reading that only
> the owner can supply. Tick them off here.

## 1. Read the pages

Every page carries `status: draft` and a banner until a person has read it. That person is
Anirudh. For each page, read it on the local build, change `status="draft"` to `status="published"`
in its `.astro` file, and commit. There are eleven:

- [x] `/` landing
- [x] `/methodology`
- [x] `/calculator`
- [x] `/install`
- [x] `/about`, read 2026-09-14; the affiliation line is still `Redacted` and needs its text
- [x] `/local-llms`
- [x] `/privacy`
- [x] `/changelog`
- [x] `/blog`, the Writing hub
- [x] `/design`, which stays `noindex` regardless
- [x] `/404`, already published

All eleven were read and flipped on 2026-09-14. Then set `REQUIRE_PUBLISHED=1` in the Cloudflare
build environment, and the gate is closed.

## 2. Accounts and names

All three names were free on 2026-09-10.

- [x] GitHub organisation `betteruseofai`, with `gordianknot-legacy` as owner. Created 2026-09-17,
      free plan. The repository `betteruseofai/betteruseofai` exists, public, with the homepage set
      and wiki and projects off, and `main` was pushed to it on 2026-09-17 once the `gh` token
      had the `workflow` scope; every link in the site already points there.
- [x] In the repository settings, an environment named `release` with required reviewers, so the
      publish jobs in `release.yml` wait for a person. Created 2026-09-17 via the API.
- [x] npm organisation `betteruseofai`, created 2026-09-17. A granular automation token is stored
      as the `NPM_TOKEN` secret since 2026-09-19, for the first publish only. After the first
      release, set up trusted publishing for each of the six packages against this repository
      and the `release.yml` workflow, then revoke the token and delete the secret.
- [ ] PyPI project `betteruseofai`, with trusted publishing configured for this repository, the
      `release.yml` workflow and the `release` environment. No token is stored.
- [ ] Chrome Web Store developer account. One-time fee.
- [ ] Firefox Add-ons account.
- [ ] Cloudflare account.

Checked again on 2026-09-14: the organisation, the npm name and the PyPI name were all still free.
`gh` cannot create an organisation, so that step is a browser step at github.com/organizations/new,
free plan, with `gordianknot-legacy` as owner. Once it exists, the rest of the GitHub side runs from
this checkout:

```sh
gh repo create betteruseofai/betteruseofai --public --source=. --remote=origin --push   --description "See the energy, water and carbon behind your own LLM use, computed on your machine."
gh api -X PUT repos/betteruseofai/betteruseofai/environments/release   --input - <<'JSON'
{ "reviewers": [ { "type": "User", "id": 213015643 } ] }
JSON
gh repo edit betteruseofai/betteruseofai --homepage https://betteruseofai.org   --enable-issues --enable-wiki=false --enable-projects=false --delete-branch-on-merge
```

`213015643` is the id of `gordianknot-legacy`, from `gh api user --jq .id`. A git push that carries `.github/workflows`
needs the `workflow` scope; the checkout pushes through Git Credential Manager, whose token has
it, while the `gh` token itself does not (`gist`, `read:org`, `repo`). If a push is refused for
that reason, run `gh auth refresh -s workflow` once.

npm: the organisation is made at npmjs.com/org/create. Trusted publishing is preferred over a
token. For each of the six packages, once it has been published a first time, Settings, Trusted
Publishing, add `betteruseofai/betteruseofai` with workflow `release.yml` and environment
`release`; the first publish of a new name cannot use trusted publishing, so the first release
needs a granular automation token in the `NPM_TOKEN` secret, deleted afterwards. Every manifest
already carries `repository` pointing at the organisation, which `--provenance` verifies.

PyPI: at pypi.org/manage/account/publishing add a pending publisher for project `betteruseofai`,
owner `betteruseofai`, repository `betteruseofai`, workflow `release.yml`, environment `release`.
A pending publisher creates the project on the first upload, so no token is needed at any point.

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
