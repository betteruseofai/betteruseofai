# Toolchain

> Status: draft.

Pinned versions, so CI and this machine agree.

| Tool | Version | How it got here |
|---|---|---|
| Node | 22 for CI and Cloudflare Pages, 24.16 locally | `.node-version` pins 22 |
| pnpm | 10 | `npm install -g pnpm@10`. Corepack needs administrator rights on this machine, so we skipped it |
| uv | 0.12.12 | Official installer, lands in `~/.local/bin` |
| Vale | 3.21.0 | Pinned release binary from errata-ai/vale, in `~/.local/bin` |
| Python | 3.12 and 3.14 | Already present, used from step 5 onwards |

CI installs the same Vale version. If you bump it here, bump it in `.github/workflows/site.yml` too.
