# OFL fonts (self-hosted)

Card typography (preview + print PDF):

- `Poppins-Bold.ttf`, `Poppins-Regular.ttf` — NSC templates
- `InterDisplay-Regular.ttf`, `InterDisplay-ExtraBold.ttf` — NPERA templates
  (the `.woff2` copies are the same faces for the browser preview; licence in
  `Inter-LICENSE.txt`)

After adding or replacing a card font, regenerate the layout metrics:
`node --import tsx scripts/gen-font-metrics.ts`

Optional / unused by the card renderer today:

- `Montserrat-Regular.ttf`, `Montserrat-Bold.ttf`

Century Gothic must **not** be embedded (Monotype).
