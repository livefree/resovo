export interface StackTheme {
  layer1OffsetX:       string
  layer1OffsetY:       string
  layer1Opacity:       string
  layer1HoverOffsetX:  string
  layer1HoverOffsetY:  string
  layer1HoverOpacity:  string
  layer1Bg:            string
  layer2OffsetX:       string
  layer2OffsetY:       string
  layer2Opacity:       string
  layer2HoverOffsetX:  string
  layer2HoverOffsetY:  string
  layer2HoverOpacity:  string
  layer2Bg:            string
  transitionDuration:        string
  transitionDurationReverse: string
}

export interface StackToken {
  light: StackTheme
  dark:  StackTheme
}

export const stack: StackToken = {
  light: {
    layer1OffsetX:      '4px',
    layer1OffsetY:      '-2px',
    layer1Opacity:      '0.55',
    layer1HoverOffsetX: '6px',
    layer1HoverOffsetY: '-8px',
    layer1HoverOpacity: '0.70',
    layer1Bg:           'oklch(90.0% 0.004 247)',
    layer2OffsetX:      '8px',
    layer2OffsetY:      '-4px',
    layer2Opacity:      '0.30',
    layer2HoverOffsetX: '10px',
    layer2HoverOffsetY: '-14px',
    layer2HoverOpacity: '0.45',
    layer2Bg:           'oklch(85.0% 0.004 247)',
    transitionDuration:        '80ms',
    transitionDurationReverse: '200ms',
  },
  dark: {
    layer1OffsetX:      '4px',
    layer1OffsetY:      '-2px',
    layer1Opacity:      '0.60',
    layer1HoverOffsetX: '6px',
    layer1HoverOffsetY: '-8px',
    layer1HoverOpacity: '0.75',
    layer1Bg:           'oklch(25.0% 0.004 247)',
    layer2OffsetX:      '8px',
    layer2OffsetY:      '-4px',
    layer2Opacity:      '0.35',
    layer2HoverOffsetX: '10px',
    layer2HoverOffsetY: '-14px',
    layer2HoverOpacity: '0.50',
    layer2Bg:           'oklch(20.0% 0.004 247)',
    transitionDuration:        '80ms',
    transitionDurationReverse: '200ms',
  },
}
