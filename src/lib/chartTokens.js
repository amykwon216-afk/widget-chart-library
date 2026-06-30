// Canvas-safe resolved values for use in ECharts configurations.
// ECharts renders to <canvas> — CSS custom properties (var(--dex-...))
// cannot be read by the canvas drawing context at paint time.
// All values here are resolved literals that match their DEX design
// system equivalents. Each color key mirrors the DEX token name in
// camelCase; the CSS variable name is listed in the comment.

export var chartTokens = {
  colors: {
    colorDataBlue100:    '#3392FF',  // --dex-color-data-blue-100
    colorDataGreen100:   '#36A635',  // --dex-color-data-green-100
    colorDataPurple100:  '#9570F3',  // --dex-color-data-purple-100
    colorDataAqua100:    '#3E9BB6',  // --dex-color-data-aqua-100
    colorDataNavy100:    '#7C8EB0',  // --dex-color-data-navy-100
    colorDataEmerald100: '#00A462',  // --dex-color-data-emerald-100
    colorDataYellow100:  '#AF8904',  // --dex-color-data-yellow-100
    colorDataBlue200:    '#0A7CFF',  // --dex-color-data-blue-200
    colorDataGreen200:   '#319530',  // --dex-color-data-green-200
    colorDataPurple200:  '#8358F1',  // --dex-color-data-purple-200
    colorDataAqua200:    '#377F95',  // --dex-color-data-aqua-200
    colorDataNavy200:    '#667BA3',  // --dex-color-data-navy-200
    colorDataEmerald200: '#008650',  // --dex-color-data-emerald-200
    colorDataYellow200:  '#8F7004',  // --dex-color-data-yellow-200
    colorDataBlue300:    '#006CEB',  // --dex-color-data-blue-300
    colorDataGreen300:   '#2B852A',  // --dex-color-data-green-300
    colorDataPurple300:  '#744ED6',  // --dex-color-data-purple-300
    colorDataAqua300:    '#337285',  // --dex-color-data-aqua-300
    colorDataNavy300:    '#506896',  // --dex-color-data-navy-300
    colorDataEmerald300: '#007747',  // --dex-color-data-emerald-300
    colorDataYellow300:  '#7F6403',  // --dex-color-data-yellow-300
    colorDataRed100:     '#EA6E55',  // --dex-color-data-red-100
  },
  axis: {
    labelColor:      'rgba(0,0,0,0.6)',  // --dex-fgColor-subtle
    labelFontSize:   10,
    labelFontWeight: 500,
    splitLineColor:  'rgba(0,0,0,0.06)', // --dex-borderColor-default
  },
  tooltip: {
    backgroundColor: '#1A1A1A',  // --dex-bgColor-neutral-emphasis-base
    textColor:       '#FFFFFF',
    fontSize:        10,
    fontWeight:      700,
  },
  animation: {
    duration:       1000,
    easing:         'cubicOut',
    durationUpdate: 600,
    easingUpdate:   'cubicOut',
  },
};
