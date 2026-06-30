// Chart rendering utilities for ChartRenderer.
// This is the file engineers copy into their own project. It contains only
// the functions needed to render charts — no mock data, no gallery configs.

import React from 'react';
import { tokens } from '../styles/tokens.js';

export var DONUT_COLORS = [
  tokens.colors.chart.dataBlue100,
  tokens.colors.chart.dataGreen100,
  tokens.colors.chart.dataPurple100,
  tokens.colors.chart.dataAqua100,
  tokens.colors.chart.dataNavy100,
];

export function ce(type, props) {
  var args = [type, props];
  for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
  return React.createElement.apply(React, args);
}

export function fV(v, f) {
  if (f === "in percent") return v + "%";
  if (f === "in units") return v + " units";
  if (f === "raw") return String(v);
  return "$" + v.toLocaleString() + "K";
}

export function fmtTableCell(val, format) {
  if (format === "dollar") return "$" + val.toLocaleString();
  if (format === "pct") return val.toFixed(1) + "%";
  if (format === "rating") return val.toFixed(1);
  return typeof val === "number" ? val.toLocaleString() : val;
}

export function fmtDateLabel(d, period) {
  if (period === "Year to date") return d.toLocaleDateString("en-US", {month:"short"});
  return d.toLocaleDateString("en-US", {month:"short", day:"numeric"});
}

export function useW(ref) {
  var st = React.useState(0), w = st[0], setW = st[1];
  React.useEffect(function() {
    if (!ref.current) return;
    function m() { var r = ref.current.getBoundingClientRect(); if (r.width > 0) setW(r.width); }
    m();
    var obs = new ResizeObserver(m);
    obs.observe(ref.current);
    return function() { obs.disconnect(); };
  }, []);
  return w;
}

// Y-axis tick formatter for value-axis charts (Column / Line / Area /
// Combo / Waterfall / Bar's X-axis side). Takes the raw tick value
// from ECharts plus the chart's `fmt` string and a char limit, returns
// a compact label string suitable for an axis tick. Truncates with an
// ellipsis if the formatted label exceeds the limit; the hover-on-axis
// tooltip (future enhancement) would reveal the full value.
//
// Value scale: source data is in K (so 1500 = $1,500,000). Currency
// labels use K / M / B suffixes to stay compact at all magnitudes,
// keeping the axis column narrow.
//
// Examples (default currency):
//   0       → "$0"
//   500     → "$500K"
//   1000    → "$1M"
//   1500    → "$1.5M"
//   1200000 → "$1.2B"
export function fmtAxisTick(value, fmt, charLimit) {
  charLimit = charLimit || 7;
  var label;
  if (fmt === "in percent") {
    label = Math.round(value) + "%";
  } else if (fmt === "in units" || fmt === "raw") {
    label = compactNumber(value);
  } else {
    // Default currency. Data values are already in K.
    if (value === 0) label = "$0";
    else if (Math.abs(value) < 1000) label = "$" + Math.round(value) + "K";
    else if (Math.abs(value) < 1000000) {
      var m = value / 1000;
      label = "$" + (Math.abs(m) < 10 ? m.toFixed(1) : Math.round(m)) + "M";
    } else {
      var b = value / 1000000;
      label = "$" + (Math.abs(b) < 10 ? b.toFixed(1) : Math.round(b)) + "B";
    }
  }
  if (label.length > charLimit) {
    label = label.substring(0, charLimit - 1) + "…";
  }
  return label;
}

// Compact number formatter for the "in units" / "raw" axis case.
function compactNumber(value) {
  if (value === 0) return "0";
  var abs = Math.abs(value);
  if (abs < 1000) return String(Math.round(value));
  if (abs < 1000000) {
    var k = value / 1000;
    return (Math.abs(k) < 10 ? k.toFixed(1) : Math.round(k)) + "K";
  }
  var m = value / 1000000;
  return (Math.abs(m) < 10 ? m.toFixed(1) : Math.round(m)) + "M";
}

// Char limit for Y-axis labels, scaled by chart card width. Base is 7
// chars at a typical ~320px gallery card; the limit grows on wider
// cards and shrinks gracefully on smaller ones. Clamped to [5, 14] so
// labels stay legible at extremes.
export function yAxisCharLimit(cardWidth, baseLimit) {
  baseLimit = baseLimit || 7;
  var raw = Math.floor((cardWidth - 300) / 25) + baseLimit;
  return Math.max(5, Math.min(14, raw));
}

// Canvas 2D measureText() is used to size the Y-axis label column so
// the LONGEST ACTUAL TICK LABEL — not a worst-case estimate — has its
// left edge land exactly at the chart's original pL.
var _measureCanvas = null;
function getMeasureCtx() {
  if (typeof document === 'undefined') return null;
  if (!_measureCanvas) _measureCanvas = document.createElement('canvas');
  var ctx = _measureCanvas.getContext('2d');
  // Font shorthand: weight, size, family — matches the axis label's
  // effective font as closely as the Canvas 2D API allows. The DEX
  // inherited font isn't directly resolvable to a font-family string
  // here, but sans-serif fallback is within ~1px of the rendered width.
  ctx.font = '500 10px system-ui, -apple-system, sans-serif';
  return ctx;
}

// Measure the rendered pixel width of an axis label string. Uses
// Canvas 2D measureText() — sync, accurate to within ~1px, no DOM
// reflow. Falls back to a character-count estimate during SSR.
export function measureAxisLabel(text) {
  var ctx = getMeasureCtx();
  if (!ctx) return String(text || '').length * 6;
  return Math.ceil(ctx.measureText(String(text || '')).width);
}

// Reserved horizontal pixel width for the Y-axis label column when
// the toggle is on. Measures the widest tick label that ECharts will
// actually render — by formatting the data peak through fmtAxisTick
// and measuring its rendered width — then adds the gap to the chart.
//
// Geometry guarantee: with the same YAXIS_LABEL_GAP value used for both
// the reservation AND ECharts' axisLabel.margin, the longest label
// renders with its LEFT edge exactly at the chart's original pL.
// Shorter labels (right-aligned by ECharts) float to the right of that
// column, ending at the same right edge as the longest one.
//
// Returns 0 when showOptionalAxis is off so existing chart geometry is
// completely untouched.
export var YAXIS_LABEL_GAP = 8;          // px between label right edge and chart
export function yAxisReservedWidth(peakValue, fmt, charLimit, showOptionalAxis) {
  if (!showOptionalAxis) return 0;
  charLimit = charLimit || 7;
  var widestLabel = fmtAxisTick(peakValue || 0, fmt, charLimit);
  var labelWidth = measureAxisLabel(widestLabel);
  return labelWidth + YAXIS_LABEL_GAP;
}

// Snap a raw value up to a "nice" number from {1, 2, 2.5, 5, 10} ×
// 10^n. Standard charting algorithm.
function niceNumberCeil(value) {
  if (!value || value <= 0) return 1;
  var exp = Math.floor(Math.log10(value));
  var mag = Math.pow(10, exp);
  var f = value / mag;
  var nf;
  if (f <= 1) nf = 1;
  else if (f <= 2) nf = 2;
  else if (f <= 2.5) nf = 2.5;
  else if (f <= 5) nf = 5;
  else nf = 10;
  return nf * mag;
}

// Round a raw value UP to a "nice" upper bound. Quick helper used
// when you need just the max (no matching interval). For full
// tick-control use niceAxisRange instead.
export function niceAxisMax(value) {
  return niceNumberCeil(value);
}

// Compute a {max, interval} pair that gives at most 6 ticks (including
// the 0 line at the bottom). Algorithm: pick the nice interval such
// that peak/interval ≤ 5, then round max up to a multiple of interval.
// This is what we hand to ECharts as yAxis.max + yAxis.interval so the
// 6-tick-max rule is enforced exactly — not just suggested via
// splitNumber.
//
// Examples (assume "K" suffix on labels via fmtAxisTick):
//   peak 600  → { max: 600,  interval: 200 } → 4 ticks (0/200/400/600)
//   peak 800  → { max: 800,  interval: 200 } → 5 ticks (0/200/400/600/800)
//   peak 1000 → { max: 1000, interval: 200 } → 6 ticks
//   peak 1200 → { max: 1250, interval: 250 } → 6 ticks (0/250/500/750/1000/1250)
//   peak 1617 → { max: 2000, interval: 500 } → 5 ticks (0/500/1000/1500/2000)
//   peak 2500 → { max: 2500, interval: 500 } → 6 ticks
export function niceAxisRange(peak) {
  if (!peak || peak <= 0) return { max: 1, interval: 0.2 };
  // Snap the "ideal" interval (peak / 5 segments) up to the nearest
  // nice number; that becomes our actual interval.
  var interval = niceNumberCeil(peak / 5);
  // Max is the smallest multiple of interval at or above the peak,
  // so the topmost bar always fits inside the chart.
  var max = Math.ceil(peak / interval) * interval;
  return { max: max, interval: interval };
}

// Build the ECharts yAxis option object for a value-axis chart. Single
// source of truth for axis styling (font, color, formatter, hidden
// gridlines, tick cap) so every chart's axis renders consistently.
// When showOptionalAxis is false, returns the minimal hidden-axis config the
// charts already use so existing behavior is unchanged.
//
// Pass `extra` to merge additional fields (e.g. `min`, `max` for the
// normalized 100% stacked column override).
//
// Tick cap: splitNumber=5 targets 5 intervals = 6 tick labels max
// (including 0 and the top tick). Keeps axes scannable across all
// chart widths — without this, ECharts can choose 7-8 ticks when the
// data range divides "nicely" by 7 or 8.
export function buildYAxisOpt(showOptionalAxis, fmt, charLimit, extra) {
  // yAxis.show is ALWAYS true — keeps the axis "active" in ECharts'
  // rendering context regardless of toggle. Only axisLabel.show flips
  // with the toggle. With yAxis.show:false, ECharts was changing the
  // X-axis rendering pipeline (X labels appeared darker / not picking
  // up the textStyle correctly when the user turned the optional axis
  // OFF). Keeping yAxis.show:true makes ECharts treat both modes
  // identically — only the Y label visibility differs. axisLine,
  // axisTick, splitLine are always hidden so the "always-on" axis is
  // visually invisible when the labels are off.
  var y = {
    type: 'value',
    show: true,
    splitNumber: 5,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: {
      show: !!showOptionalAxis,
      fontSize: 10,
      fontWeight: 500,
      color: 'rgba(0,0,0,0.6)',
      // Same canvas-vs-CSS constraint applies to fontFamily — 'inherit'
      // is a CSS keyword that canvas can't resolve, falling back to the
      // system sans-serif (Arial) which renders bolder/darker than the
      // page's actual DEX font (Open Sans). 'inherit'
      // reads the page's computed font-family at runtime so canvas
      // labels match the React-overlay edge labels exactly.
      fontFamily: 'inherit',
      // margin MUST match YAXIS_LABEL_GAP so the geometry works out:
      // the longest label lands with its left edge at the chart's
      // original pL (see comment on yAxisReservedWidth above).
      margin: YAXIS_LABEL_GAP,
      formatter: function(value) { return fmtAxisTick(value, fmt, charLimit); },
    },
  };
  if (extra) {
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) y[k] = extra[k];
  }
  return y;
}

export function buildLabels(dates, period, W, pL, pR) {
  var fmt = period === "Year to date"
    ? function(d) { return d.toLocaleDateString("en-US", {month:"short"}); }
    : function(d) { return d.toLocaleDateString("en-US", {month:"short", day:"numeric"}); };
  var n = Math.max(2, Math.min(Math.floor((W - pL - pR) / (period === "Year to date" ? 40 : 60)), dates.length));
  var res = [];
  for (var i = 0; i < n; i++) {
    var f = i / (n - 1);
    res.push({x: pL + f * (W - pL - pR), text: fmt(dates[Math.round(f * (dates.length - 1))])});
  }
  return res;
}

// Same selection algorithm as buildLabels above, but returns just the
// SET of indices that would be shown (no x-coords, no formatting). Used
// by charts that render their X-axis via native ECharts (axisLabel with
// an `interval` function) instead of the custom React XLabels component.
// Mirroring buildLabels exactly guarantees the native X-axis shows the
// same labels at the same positions as the legacy XLabels rendering —
// so swapping implementations is visually transparent.
//
// Callers should still handle "centered" modes (Last 7 days / Year to
// date in Column) separately by passing a Set of every index 0..N-1.
// Those modes show every label, no thinning, naturally centered under
// their bars.
export function pickedXAxisIndices(dates, period, W, pL, pR) {
  var s = new Set();
  if (!dates || dates.length === 0) return s;
  var L = dates.length;
  // Max labels that fit at the per-label min width (60px, or 40px for the
  // denser Year-to-date axis), clamped to [2, L].
  var maxN = Math.max(2, Math.min(Math.floor((W - pL - pR) / (period === "Year to date" ? 40 : 60)), L));
  // Use an INTEGER step between picked indices so every interior gap is
  // identical and the labels read as evenly spaced. The previous approach
  // —  round(f * (L-1)) for evenly-spaced fractions f — snapped each label
  // independently and produced alternating gaps (e.g. 1,2,1,2… at wide
  // widths, or an odd gap stranded in the middle at narrow widths), which
  // looked unevenly distributed. With an integer step the only non-uniform
  // gap is the final one (L-1 isn't always divisible by the step), and it
  // sits at the right edge where it's least noticeable. First (0) and last
  // (L-1) indices are always included so the axis spans edge to edge.
  var step = Math.max(1, Math.round((L - 1) / (maxN - 1)));
  var interior = [];
  for (var i = 0; i * step < L - 1; i++) interior.push(i * step);
  // interior = [0, step, 2*step, …, lastInterior]. The final label (L-1) is
  // added separately below as the right edge. By construction one step is
  // ~60px wide and a label is ~45px, so if the last interior index sits
  // closer than ~0.75 of a step to L-1 its label would overlap the L-1
  // label at the right edge (the "Mar 18 / Mar 19" collision). Drop it in
  // that case — the resulting end gap stays between 1x and ~1.75x a normal
  // step: a touch wider, but never overlapping.
  if (interior.length > 1 && ((L - 1) - interior[interior.length - 1]) < step * 0.75) {
    interior.pop();
  }
  for (var k = 0; k < interior.length; k++) s.add(interior[k]);
  s.add(L - 1);
  return s;
}

// Generate `count` related series from a single base `data` array. Index 0 is
// the original data; subsequent series are scaled-down variants with stable
// per-index variance so the bars look like related-but-distinct sub-totals
// (e.g. mobile vs desktop vs tablet) rather than perfectly proportional copies.
// Used by stacked + grouped Column and Bar variants.
export function buildMultiSeries(data, count) {
  var factors = [1.0, 0.66, 0.42, 0.28, 0.18];
  var out = [];
  for (var i = 0; i < count; i++) {
    var f = factors[i] !== undefined ? factors[i] : 0.15;
    var seed = (i + 1) * 7;
    out.push(data.map(function(v, idx) {
      var j = Math.sin(idx * 0.7 + seed * 0.3) * 0.12 + Math.cos(idx * 0.4 + seed * 0.2) * 0.08;
      return Math.max(1, Math.round(v * f * (1 + j)));
    }));
  }
  return out;
}
