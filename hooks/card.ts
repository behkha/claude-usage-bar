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

/** One rate-limit window as a mode draws it: percent used, the share of the window gone by, the time left as text. */
export type Gauge = { percent: number; pace: number | null; left: string | null; level: 'ok' | 'ahead' | 'high' }
