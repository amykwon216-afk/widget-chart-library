// Design system tokens for the chart gallery prototype.
// Mapped to @thryvlabs/dex-react CSS custom properties via
// data-theme="keap" on <html>. Tokens with a direct DEX equivalent
// reference the CSS variable. The only non-DEX literals are the chart
// palette (ECharts canvas cannot read CSS custom properties) and
// colors.text.inverse (#FFFFFF, same reason — used for canvas axis labels).

export const tokens = {
  colors: {
    // Text — inverse must be a literal; canvas drawing context cannot
    // resolve CSS custom properties at paint time.
    text: {
      inverse: '#FFFFFF',
    },

    // Chart palette — NOT DEX. All values must be resolved hex because
    // ECharts renders to <canvas> and cannot read CSS vars.
    // 100 → 200 → 300 deepen within the same hue family; used for
    // compare overlays (200) and Treemap child hierarchy (300).
    // Yellow is intentionally last; only reach for it when rotating
    // past five categories.
    chart: {
      dataBlue100:    '#3392FF',
      dataGreen100:   '#36A635',
      dataPurple100:  '#9570F3',
      dataAqua100:    '#3E9BB6',
      dataNavy100:    '#7C8EB0',
      dataEmerald100: '#00A462',
      dataYellow100:  '#AF8904',
      dataBlue200:    '#0A7CFF',
      dataGreen200:   '#319530',
      dataPurple200:  '#8358F1',
      dataAqua200:    '#377F95',
      dataNavy200:    '#667BA3',
      dataEmerald200: '#008650',
      dataYellow200:  '#8F7004',
      dataBlue300:    '#006CEB',
      dataGreen300:   '#2B852A',
      dataPurple300:  '#744ED6',
      dataAqua300:    '#337285',
      dataNavy300:    '#506896',
      dataEmerald300: '#007747',
      dataYellow300:  '#7F6403',
      dataRed100:     '#EA6E55',
    },

    // App UI — all DEX custom properties
    ui: {
      tooltipBg:     'var(--dex-bgColor-neutral-emphasis-base, var(--dex-bgColor-reverse))',
      buttonHover:   'var(--dex-bgColor-alpha-emphasis)',
      mutedText:     'var(--dex-fgColor-disabled)',
      subtleText:    'var(--dex-fgColor-subtle)',
      bodyText:      'var(--dex-fgColor-default)',
      cardTitle:     'var(--dex-fgColor-highContrast)',
      positiveGreen: 'var(--dex-fgColor-success)',
      negativeRed:   'var(--dex-fgColor-danger)',
      whiteSurface:  'var(--dex-surface-flat-bgColor)',
      textPrimary:   'var(--dex-fgColor-default)',
    },
  },

  typography: {
    fontFamily: {
      sans: 'var(--dex-fontFamily-default)',
      mono: 'var(--dex-fontFamily-mono)',
    },
    fontSize: {
      '2xs': 'var(--dex-fontSize-2xs)',   // .625rem / 10px
      xs:    'var(--dex-fontSize-xs)',    // .75rem  / 12px
      sm:    'var(--dex-fontSize-sm)',    // .875rem / 14px
      base:  'var(--dex-fontSize-md)',    // 1rem    / 16px
      lg:    'var(--dex-fontSize-lg)',    // 1.125rem/ 18px
      xl:    'var(--dex-fontSize-xl)',    // 1.25rem / 20px
      '2xl': 'var(--dex-fontSize-2xl)',   // 1.5rem  / 24px
    },
    fontWeight: {
      normal:   'var(--dex-fontWeight-regular)',
      medium:   'var(--dex-fontWeight-medium)',
      semibold: 'var(--dex-fontWeight-semibold)',
      bold:     'var(--dex-fontWeight-bold)',
    },
    lineHeight: {
      tight:   '1.25',
      snug:    '1.375',
      normal:  '1.5',
      relaxed: '1.625',
    },
    letterSpacing: {
      tight:  '-0.025em',
      normal: '0em',
      wide:   '0.025em',
      wider:  '0.05em',
    },
  },

  spacing: {
    // 4px base grid — numeric keys mapped to DEX where exact match exists
    0.5: '2px',                            // no DEX match
    1:   'var(--dex-spacing-050)',         // .25rem  /  4px
    1.5: 'var(--dex-spacing-075)',         // .375rem /  6px
    2:   'var(--dex-spacing-100)',         // .5rem   /  8px
    2.5: 'var(--dex-spacing-125)',         // .625rem / 10px
    3:   'var(--dex-spacing-150)',         // .75rem  / 12px
    3.5: '14px',                           // no DEX match
    4:   'var(--dex-spacing-200)',         // 1rem    / 16px
    5:   'var(--dex-spacing-250)',         // 1.25rem / 20px
    6:   'var(--dex-spacing-300)',         // 1.5rem  / 24px
    7:   '28px',                           // no DEX match
    8:   'var(--dex-spacing-400)',         // 2rem    / 32px
    10:  '40px',
    12:  'var(--dex-spacing-600)',         // 3rem    / 48px
    14:  '56px',
    16:  'var(--dex-spacing-800)',         // 4rem    / 64px

    // Named aliases
    xs:    'var(--dex-spacing-050)',       //  4px
    sm:    'var(--dex-spacing-100)',       //  8px
    md:    'var(--dex-spacing-200)',       // 16px
    lg:    'var(--dex-spacing-300)',       // 24px
    xl:    'var(--dex-spacing-400)',       // 32px
    '2xl': 'var(--dex-spacing-600)',       // 48px
    '3xl': 'var(--dex-spacing-800)',       // 64px
  },

  borderRadius: {
    none:  '0',
    sm:    'var(--dex-borderRadius-050)',  // .25rem  /  4px
    base:  'var(--dex-borderRadius-075)',  // .375rem /  6px
    md:    'var(--dex-borderRadius-100)',  // .5rem   /  8px
    lg:    'var(--dex-borderRadius-150)',  // .75rem  / 12px
    xl:    'var(--dex-borderRadius-200)',  // 1rem    / 16px
    '2xl': 'var(--dex-borderRadius-300)',  // 1.5rem  / 24px
    full:  'var(--dex-borderRadius-full)', // 9999px
  },

  borderWidth: {
    default: 'var(--dex-borderWidth-100)',
    2:       'var(--dex-borderWidth-200)',
    4:       'var(--dex-borderWidth-400)',
  },

  shadows: {
    sm:   'var(--dex-elevation-z0)',       // 1px hairline
    base: 'var(--dex-elevation-z1)',       // very light lift
    md:   'var(--dex-elevation-z2)',       // light lift
    lg:   'var(--dex-elevation-z3)',       // medium lift
    none: 'none',
  },

  transitions: {
    duration: {
      fast:   '100ms',
      base:   '150ms',
      slow:   '250ms',
      slower: '350ms',
    },
    easing: {
      linear: 'linear',
      in:     'cubic-bezier(0.4, 0, 1, 1)',
      out:    'cubic-bezier(0, 0, 0.2, 1)',
      inOut:  'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    default: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    fast:    '100ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow:    '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  zIndex: {
    base:     0,
    raised:   10,
    dropdown: 100,
    sticky:   200,
    overlay:  300,
    modal:    400,
    toast:    500,
  },
};

export default tokens;
