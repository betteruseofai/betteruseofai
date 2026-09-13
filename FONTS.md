# Fonts

The code in this repository is MIT. The three typefaces it ships are not; they are under the SIL
Open Font License, version 1.1, which asks that its text travel with the fonts wherever they are
redistributed. This page is that notice for the repository, and the build copies each family's
licence file into `packages/tokens/fonts/` beside the font files themselves, so the published
package and the website carry it too.

| Face | Used for | Copyright | Licence |
|---|---|---|---|
| Big Shoulders | Display headlines | Patric King | OFL 1.1 |
| Schibsted Grotesk | Body text | Schibsted, drawn by Christian Grüner and others | OFL 1.1 |
| IBM Plex Mono | Every number, label and unit | IBM Corp. | OFL 1.1 |

The files come from the Fontsource packages `@fontsource/big-shoulders`, `@fontsource/schibsted-grotesk`
and `@fontsource/ibm-plex-mono`, latin subset only, six static instances in total. The full licence
text for each is in that package's `LICENSE` file and, after a build, in `packages/tokens/fonts/`.

The OFL permits use, bundling and redistribution, and forbids selling the fonts on their own or
using their reserved names for a modified version. We have modified none of them.
