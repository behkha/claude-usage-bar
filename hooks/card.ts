// The band's card, as a drawing has to know it. A mode that fills the card
// draws larger than the card and is laid behind the band's content; the app
// crops it to a plain rectangle, so the drawing cuts its own corners.
//
// All in CSS px, measured from screenshots of the band in the desktop app:
// the drawing starts about 9 px above and 9 px left of the card, a plate at
// the right ends about 9 px past it, and the card is about 93 px tall.

/** How far above the card's top edge a drawing starts, and how far outside its side edges it reaches. */
export const EDGE_TOP = 9
export const EDGE_SIDE = 9
export const CARD_HEIGHT = 93
/** The card's corner radius, the composer's. */
export const CORNER = 12
/** A drawing's full height: the card, the part above it, and some to spare below. */
export const ART_HEIGHT = 112
/** The height of the zone the drawing is laid behind; it is what gives the card its height. */
export const ZONE_HEIGHT = 82
/** A transparent drawing that only gives the zone its height. */
export const SPACER = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="${ZONE_HEIGHT}" viewBox="0 0 16 ${ZONE_HEIGHT}"><rect width="16" height="${ZONE_HEIGHT}" fill="#000" fill-opacity="0"/></svg>`

// Half a pixel inside the measured edges, so a small error shows as a sliver of the card and never as a square tip of art.
const TOP = EDGE_TOP + 0.5
const BOTTOM = EDGE_TOP + CARD_HEIGHT - 0.5

/** What a drawing `width` px wide keeps of itself at the card's left end: all of it but the two left corners. In the drawing's own coordinates. */
export const cutLeft = (width: number) => {
  const r = CORNER
  const l = EDGE_SIDE + 0.5
  return `M-99 ${TOP + r}H${l}A${r} ${r} 0 0 1 ${l + r} ${TOP}V-99H${width + 99}V999H${l + r}V${BOTTOM}A${r} ${r} 0 0 1 ${l} ${BOTTOM - r}H-99Z`
}
/** The card's edge at its left end, for a hairline: along the top, round the two left corners, along the bottom. In card coordinates. */
export const edgeLeft = (width: number) => {
  const r = CORNER
  const H = CARD_HEIGHT
  return `M${width} 1.4H${r}A${r - 1.4} ${r - 1.4} 0 0 0 1.4 ${r}V${H - r}A${r - 1.4} ${r - 1.4} 0 0 0 ${r} ${H - 1.4}H${width}`
}
/** The same two for a plate at the card's right end, whose part inside the card is `inner` px wide. */
export const cutRight = (inner: number) => {
  const r = CORNER
  const x = inner - 0.5
  return `M999 ${TOP + r}H${x}A${r} ${r} 0 0 0 ${x - r} ${TOP}V-99H-99V999H${x - r}V${BOTTOM}A${r} ${r} 0 0 0 ${x} ${BOTTOM - r}H999Z`
}
export const edgeRight = (inner: number) => {
  const r = CORNER
  const H = CARD_HEIGHT
  return `M0 1.4H${inner - r}A${r - 1.4} ${r - 1.4} 0 0 1 ${inner - 1.4} ${r}V${H - r}A${r - 1.4} ${r - 1.4} 0 0 1 ${inner - r} ${H - 1.4}H0`
}

/** One rate-limit window as a mode draws it: percent used, the share of the window gone by, the time left as text. */
export type Gauge = { percent: number; pace: number | null; left: string | null; level: 'ok' | 'ahead' | 'high' }

/**
 * A mode's left end, as one SVG `width` px wide and `ART_HEIGHT` tall: `body`, in card coordinates, on a `ground`
 * that fills the card, the two left corners cut, and a hairline of `edge` round them. `head` goes before the
 * drawing's defs: a mode's `<style>`.
 */
export const leftEnd = (width: number, ground: string, body: string, o: { defs?: string; edge: string; head?: string }) =>
  // `slice` from the top left: where the app gives the drawing a narrower box, it is cropped at the right, never scaled to fit.
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${ART_HEIGHT}" viewBox="0 0 ${width} ${ART_HEIGHT}" preserveAspectRatio="xMinYMin slice">${o.head ?? ''}<defs>${o.defs ?? ''}<clipPath id="cut"><path d="${cutLeft(width)}"/></clipPath></defs>` +
  `<g clip-path="url(#cut)"><rect width="${width}" height="${ART_HEIGHT}" fill="${ground}"/><g transform="translate(${EDGE_SIDE} ${EDGE_TOP})">${body}` +
  `<path d="${edgeLeft(width)}" fill="none" stroke="${o.edge}" stroke-width="1.2"/></g></g></svg>`

/**
 * A mode's plate at the card's right end, `inner` px of it on the card: `body`, in the plate's own coordinates, on
 * a `ground`, the two right corners cut, a hairline of `edge` round them, and a `rule` at `rail`, where the
 * band's buttons begin.
 */
export const rightEnd = (inner: number, rail: number, ground: string, body: string, o: { defs?: string; edge: string; rule: string; head?: string }) => {
  const width = inner + EDGE_SIDE
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${ART_HEIGHT}" viewBox="0 0 ${width} ${ART_HEIGHT}" preserveAspectRatio="xMaxYMin slice">${o.head ?? ''}<defs>${o.defs ?? ''}<clipPath id="cut"><path d="${cutRight(inner)}"/></clipPath></defs>` +
      `<g clip-path="url(#cut)"><rect width="${width}" height="${ART_HEIGHT}" fill="${ground}"/><g transform="translate(0 ${EDGE_TOP})">${body}` +
      `<line x1="${rail + 0.5}" y1="10" x2="${rail + 0.5}" y2="83" stroke="${o.rule}"/>` +
      `<path d="${edgeRight(inner)}" fill="none" stroke="${o.edge}" stroke-width="1.2"/></g></g></svg>`,
    width,
    height: ART_HEIGHT,
  }
}
