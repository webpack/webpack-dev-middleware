---
"webpack-dev-middleware": patch
---

Dropped the `ansi-html-community` dependency. The overlay's ANSI-to-HTML
conversion is `client-src/utils/ansi-html.js` now, which is the third of that
package this project used — the rest was surface it never touched, and it
shipped into every consumer's browser bundle. Four production dependencies
instead of five, and one fewer unmaintained package in the supply chain (its
last release was 0.0.8 in April 2022, itself a fork of the abandoned
`ansi-html`).

Output is byte-identical for the sequences a build actually produces. Four
things it got wrong are fixed:

- A palette entry of `"transparent"`, which is how the overlay says to leave
  the page's own colour alone, became `color:#transparent`. That is not a
  colour, so the reset worked only because browsers drop an invalid
  declaration, and the inverse sequence did nothing at all.
- A sequence carrying more than one parameter (`\u001b[1;31m`) matched nothing,
  so the escape stayed in the output as text for the reader to see.
- `\u001b[m`, which is `\u001b[0m` written short, was left in the output the
  same way.
- A closing sequence with nothing open emitted an unmatched `</span>`. The
  highlighters wrap their own spans around this output, so a stray close could
  end one of theirs early.
- Every closing tag was a `</span>`, whatever was open. `\u001b[3m` opens an
  `<i>`, so an unclosed italic came out as `<i>x</span>`, and an interleaved
  sequence crossed its tags: `<i><span>x</i></span>`. Each open element now
  carries its own closing tag, so the markup nests whatever the sequences do.

The conversion had no test of its own while it was a dependency. It has 25 now,
one of which walks every three-sequence combination and checks the result
nests.
