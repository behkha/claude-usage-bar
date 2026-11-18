// A pure-black look for the app: the page is black, panels step up by a few
// percent, text is a soft white, and Clawd's clay is the one accent. Colours
// only; there is no backdrop, since the band's strip is the scene.
//
// The app paints a mod's colours in its main window. A side pane keeps the
// app's own dark grey; nothing a mod sets reaches it.
import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

const made = makeColors({
  label: 'Black',
  only: 'dark',
  roles: { accent: '#d97757', danger: '#e5534b', success: '#4caf6a', warning: '#d9a441', pro: '#9a7be0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#000000',
        'surface-1': '#0a0a0a',
        'surface-2': '#111111',
        'surface-3': '#161616',
        'text-primary': '#ededed',
        'text-secondary': '#c4c4c4',
        'text-muted': '#9a9a9a',
      },
    },
  },
})

/** The one line that would stop the app painting these colours at all; undefined when it paints. */
export const BLACK_PROBLEM = made.problems.find(line => line.startsWith("Desktop won't paint"))
export const BLACK_LOOK: ThemeSetArgs = { colors: made.theme, overrideColorScheme: 'dark' }
