# NSC Staff ID — design system

Material Design 3 structure, with a palette and a typographic voice drawn from
the artifact this tool exists to produce: the printed staff card.

Everything below lives in [`src/app/globals.css`](src/app/globals.css) as CSS
custom properties and a `@layer components` block. Components consume the tokens;
no component invents a colour.

---

## 1. Colour

Material Design 3 role structure, cool institutional palette. This is a records
system, and the chrome reads as one — navy and cool greys — with green left to
the card artwork the tool produces rather than borrowed for its interface.

| Role | Token | Hex | What it means |
| --- | --- | --- | --- |
| **Admiralty** | `--md-primary` | `#1B3A6B` | Navy. The institution, primary actions, completed work. |
| **Channel** | `--md-tertiary` | `#0E7490` | Teal, from the blue card family. Every interactive signal: focus rings, links, the stage you are on. |
| **Buoy** | `--md-warning` | `#B4530C` | Port-marker ochre. A record needs something from you. |
| **Flag** | `--md-error` | `#9A2420` | Signal red. Blocked, suspended, destructive. |

**The distinction to hold:** navy is what the system *has settled* — a filled
button, a finished stage. Teal is *live* interaction — where focus is, which
step you are on now. They never trade places.

Each role carries the full M3 set — `--md-primary` / `--md-on-primary` /
`--md-primary-container` / `--md-on-primary-container` — so any pairing has a
guaranteed-contrast partner. Use the container/on-container pair for anything
tonal (chips, banners); use the base/on pair only for filled controls.

### Neutrals

A cool neutral ramp — no hue borrowed from the card, so the cards are the only
saturated thing on screen.

```
--md-surface                   #F5F6F8   page canvas
--md-surface-container-lowest  #FFFFFF   cards, the manifest sheet
--md-surface-container-low     #EFF1F5   nested wells, disabled fills
--md-surface-container         #E8EAEE   app bar, preview stage
--md-surface-container-high    #E1E5EB   dialogs, avatar placeholders
--md-on-surface                #1A1C21   primary text
--md-on-surface-variant        #565D69   secondary text, column headers
--md-outline                   #767D89   field borders, control outlines
--md-outline-variant           #C6CBD4   hairline rules, dividers
```

### The rule that keeps it from looking like a dashboard

**Colour only ever encodes state.** A record that is progressing normally is
rendered in neutrals. Only exceptions — no photo, pending, edits awaiting
approval, suspended — take a container colour. If every row is coloured, no row
is legible, and the list stops answering the only question it is asked: *which
of these is stuck?*

This is why the staff list shows one state chip per row rather than four.

---

## 2. Type

Three faces, three jobs. All self-hosted from `public/fonts/`, all Material-native.

| Role | Face | Where |
| --- | --- | --- |
| Structure | **Roboto Condensed** 700, tracked +0.12em, upper | Column headers, eyebrows, page titles. `.md-eyebrow`, `.nsc-page-title` |
| Body | **Roboto** 400/500 | All prose, labels, buttons. The M3 type scale (`.md-title-medium`, `.md-body-medium`, `.md-label-large`…) |
| Data | **Roboto Mono** 400, tabular figures | ID numbers, tokens, dates, counts, pagination ranges. `.md-data` |

The condensed face is the vernacular of manifests, dockets and container
markings — it belongs to this subject. Mono is not decorative: an ID number is
the primary key an officer reads aloud and types back, and tabular figures make
mis-keyed digits visible.

### Card type sizing

The three dynamic slots on the card — name, designation, ID line — carry a
per-record multiplier (`Staff.cardTypeScale`, 75–125% in 5% steps) so an
operator can settle a long name or an oversized title without touching the
template. The name's base is the auto-fitted size, the other two are 6 pt. The
live preview, the print PDF and the operator's readout all resolve through
[`type-scale.ts`](src/lib/id-card/type-scale.ts), so what is on screen is what
prints. Pushing the name past its slot is allowed and warned about, never
silently clipped.

Poppins stays loaded but is **card-only** — it is the card's own typeface and
must never leak into the UI. `CardPreview` pins `letterSpacing: "normal"` so the
UI's Material tracking can't reach the artwork.

---

## 3. Shape, elevation, spacing

```
--md-shape-xs   4px    text fields, menus, banners
--md-shape-sm   8px    chips, status badges
--md-shape-md  12px    cards
--md-shape-lg  16px    the sticky mobile action bar
--md-shape-xl  28px    dialogs
--md-shape-full        buttons, nav pills, avatars
```

Elevation is M3's three levels, tinted with the primary navy rather than pure black
(`--md-elevation-1..3`). Level 1 rests, level 2 is hover/dialog-adjacent, level 3
is anything floating over content. Nothing invents a custom shadow.

Spacing follows Material's 4dp grid. Controls are 40dp tall, text fields 48dp,
table header rows 44dp, data rows 52dp.

State layers, not opacity changes: hover is 8% of the foreground colour, pressed
10%, per M3. Disabled controls use 12% container / 38% label — never
`opacity: 0.4`, which mutes the background through the control.

---

## 4. Signature: the stage rail

Card production is a real four-step pipeline — **details → photo → approve →
print** — and every record sits at exactly one step. The rail
([`stage-rail.tsx`](src/components/staff/stage-rail.tsx)) renders that as four
4px marks:

```
━━ ━━ ━━ ━━   printed, done
━━ ━━ ━━ ━━   awaiting print   (last mark channel teal)
━━ ━━ ━━ ━━   awaiting photo   (second mark teal, rest grey)
━━ ━━ ━━ ━━   suspended        (last mark flag red)
```

Navy = complete, channel teal = current, grey = not reached, red = blocked. Down a column of 25 rows it reads as texture, and the eye lands on
whichever row breaks the pattern. Each rail carries an `aria-label` naming the
stage in words ("Awaiting photo"), so it is not colour-only.

The editor's step chips use the same three colours for the same four stages, so
the list and the record teach each other.

---

## 5. The manifest

The staff list is a production queue, not a collection of cards. It renders as
one flat sheet (`.manifest`) — hairline rules top and bottom, no container
radius, no shadow, full width of the content column. It looks like the printer's
docket it stands in for, and the columns get their full measure.

Cards are for *records* (the editor, the verify page, dialogs). Sheets are for
*queues*. Don't wrap a table in a card.

Pagination follows the M3 data-table convention: range on the left of the
controls, icon steps, 25 rows per page, page held in the URL (`?page=`) so a
view survives a refresh and a shared link. Filters are preserved across steps;
exports always cover the whole filtered set, not the visible page.

---

## 6. Writing

Sentence case everywhere. An action keeps its name through the whole flow — the
button that says **Clear log** produces the toast **3 events cleared**. Errors
say what happened and what to do; they don't apologise. Empty states are an
invitation to act, and always carry the action as a button.

Name things the way an officer would: *photo queue*, *needs approval*, *ready*.
Never *photoPreviewKey is null*.
