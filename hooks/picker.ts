// The mode picker's card: a plain dark card the modes' names are laid over, in
// Board's colours, with a plate at the right end for the rail.

import { CARD_HEIGHT, leftEnd, rightEnd } from './card'
import { RAIL } from './glass'

const GROUND = '#0b0b0c'
const EDGE = 'rgba(255,255,255,.24)'
/** The plate's width left of the rail: enough to reach under where the card's art stops. */
const BODY = 96

/** The card's left end, `width` px drawn across. */
export const pickerArt = (width: number) => ({ source: leftEnd(Math.round(width), GROUND, '', { edge: EDGE }), width: Math.round(width) })

/** The card's right end, with the rail's rule. */
export const pickerPlate = () => rightEnd(BODY + RAIL, BODY, GROUND, `<rect width="${BODY + RAIL}" height="${CARD_HEIGHT}" fill="${GROUND}"/>`, { edge: EDGE, rule: 'rgba(255,255,255,.12)' })
