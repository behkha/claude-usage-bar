# New card modes: design round (approved 2026-11-24)

Mockups: claude.ai/artifact/EuMg84EK4a4Vh2KRDZqQee (design/new-modes/mockups.ts). Pins: pins.md.

## Approved by the owner
- VU: Twin meters (glyph ◠). Nixie: Tubes and bars (◍). Cockpit: Flight tapes (△).
- LCD: Whole screen (▤). Panel: Knobs and screen, light aluminium (◎).
- Picking among ten: picker on the card (mode button shows the ten names, press one).

## Decisions that bind the build
- Draw each mode by lifting its function from mockups.ts (vuTwin, nixieTubes, cockpitTapes,
  lcdFull, panelLight) into hooks/<mode>.ts, in the style of tuner.ts (art + plate + alts).
- A tab's fill is the card's own along its top edge (owner, 2026-11-24): Panel's tab is aluminium
  with dark print (`print: 'dark'`); the app colours Button text itself, so there the drawing prints
  the update label and the Button is blank. Seen right in the app. LCD's edge is its black bezel.
- Light cards put the rail on dark keys/bezel. Glow filters never on a zero-height line.
- No unit tests. Commit nothing unless asked.
## Build plan
Per mode, README "Adding a mode":
  hooks/<mode>.ts · CARDS line + SCENES/SCENE_GLYPH in register.tsx · TAB_STYLE in tab.ts ·
  MODES + SHOTS in docs/pictures.ts · a README section.
Order:
1. LCD (lcd.ts): font table and dot paths; backlight amber in Sport.
2. Picker on the card (register.tsx): scene button opens a row of ten Buttons; Esc/timeout closes.
3. Nixie (nixie.ts): tubes with ghosts, IN-13 plate, neon lamp.
4. VU (vu.ts): twin faces, edgewise plate, peak lamps; 5-hour moves to the plate when narrow.
5. Cockpit (cockpit.ts): context tape with drum, limit tapes, caution box.
6. Panel (panel.ts): knobs, OLED, dark rail keys; tab room colour from the theme
   (tab.ts PAGE is fixed #0a0a0a today; on the light theme it shows a black strip).
Checks per mode: validate, tsc, bun docs/pictures.ts <mode>, the real band, a fresh-eyes review.

## Build progress (local_e3aef6e5, 2026-11-24; update-notice work still uncommitted, added in place)
- Built, reviewed, fixed: LCD, picker, Nixie, VU, Cockpit, Panel (hooks/<mode>.ts, instruments.ts,
  picker.ts), pictures, README. tsc + validate clean (project.ts `$.vcs` error pre-existing).
- Real band: LCD, VU, Nixie, Cockpit, Panel seen at one width (~767 px card) with the project tab.
  Not seen: picker (needs a click), narrow/wide in the app, update tab on a new mode.
- tab.ts: room above the card follows prefers-color-scheme (#faf9f5 light, not measured).
- Panel keys on the app's measured button rows; pictures' rail raised 6.5 px. Picker names don't shrink.
- Filed, not fixed: LCD bars under the plate below ~354 px; model keys cut to 3 letters;
  picker 10 s timer lost on a reload within 10 s; picker wraps past the card below ~30 cells.
