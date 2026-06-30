import React, { useState, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { DexIcon } from '@thryvlabs/dex-react';
import { tokens } from '../styles/tokens.js';
import { ce, fV, fmtTableCell, useW, buildLabels, pickedXAxisIndices, fmtDateLabel, DONUT_COLORS, buildMultiSeries, fmtAxisTick, yAxisCharLimit, yAxisReservedWidth, buildYAxisOpt, niceAxisMax, niceAxisRange } from './chartHelpers.js';

function useContainerSize(ref) {
  var [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(function() {
    if (!ref.current) return;
    function m() { var r = ref.current.getBoundingClientRect(); setSize({ w: r.width, h: r.height }); }
    m();
    var obs = new ResizeObserver(m);
    obs.observe(ref.current);
    return function() { obs.disconnect(); };
  }, []);
  return size;
}

export var EChart = React.forwardRef(function EChart({ option, style }, fwdRef) {
  var ref = useRef(), optRef = useRef(option), chartRef = useRef(null);
  // Expose the underlying ECharts instance so consumers (e.g. ComboChart)
  // can run their own setOption-driven animations (like the line-reveal
  // RAF) while still letting the wrapper own initial setOption + the
  // responsive option-update flow.
  React.useImperativeHandle(fwdRef, function() {
    return { getChart: function() { return chartRef.current; } };
  }, []);
  // entryAnimDoneRef gates the option-update effect below so it can't
  // fire setOption *during* the entry-animation window and clobber the
  // bar grow-from-zero animation. Phase 8 introduced the [option]
  // useEffect for responsive resize, but useContainerSize's initial
  // measurement (0 → measured) triggers a parent re-render IMMEDIATELY
  // after mount, producing a new option object and firing the [option]
  // useEffect. Its setOption(realValues) raced the _growFromZero's
  // setTimeout(16ms, setOption(realValues)) — whichever won, the bars
  // jumped straight to real values with no visible animation.
  //
  // Fix: the flag is set to true ONLY after the mount path's entry-
  // animation setOption has fired (inside the setTimeout for
  // _growFromZero, immediately after setOption for the other paths).
  // Until then, the [option] useEffect silently no-ops. The setTimeout
  // for _growFromZero reads optRef.current at fire time (not a mount-
  // time snapshot), so any width-driven option updates produced during
  // that 16ms window still reach the chart via the entry animation.
  var entryAnimDoneRef = useRef(false);
  optRef.current = option;
  useEffect(function() {
    var el = ref.current; if (!el) return;
    var existing = echarts.getInstanceByDom(el);
    if (existing) existing.dispose();
    var chart = echarts.init(el, null, {renderer:"canvas"});
    chartRef.current = chart;

    if (optRef.current._growFromZero) {
      var zeroOpt = JSON.parse(JSON.stringify(optRef.current));
      delete zeroOpt._growFromZero;
      // Preserve object structure when zeroing data — funnel/gauge series use
      // { value, name, itemStyle } shapes; flat .map(() => 0) would replace
      // those with the primitive 0 and break the render.
      if (zeroOpt.series) {
        for (var i = 0; i < zeroOpt.series.length; i++) {
          var sData = zeroOpt.series[i].data;
          if (!sData) continue;
          zeroOpt.series[i].data = sData.map(function(d) {
            if (d && typeof d === 'object') return Object.assign({}, d, { value: 0 });
            return 0;
          });
        }
      }
      zeroOpt.animation = false;
      chart.setOption(zeroOpt, {notMerge:true});
      // Read optRef.current at fire time (not a mount-time snapshot) so
      // any option updates produced during the 16ms window — typically
      // useContainerSize updating W from 0 → measured — are reflected in
      // the real-values setOption that drives the entry animation. After
      // this fires, the [option] useEffect is allowed to push subsequent
      // updates normally.
      var tid = setTimeout(function(){
        if (!chartRef.current) return;
        var latestOpt = Object.assign({}, optRef.current);
        delete latestOpt._growFromZero;
        chartRef.current.setOption(latestOpt, {notMerge:false});
        entryAnimDoneRef.current = true;
      }, 16);
      var obs = new ResizeObserver(function(){if(chartRef.current)chartRef.current.resize();});
      obs.observe(el);
      return function(){clearTimeout(tid);obs.disconnect();if(chartRef.current){chartRef.current.dispose();chartRef.current=null;}};
    } else if (optRef.current._clipReveal) {
      var clipOpt = Object.assign({}, optRef.current);
      delete clipOpt._clipReveal;
      chart.setOption(clipOpt, {notMerge:true});
      el.style.clipPath = "inset(0 100% 0 0)";
      el.style.transition = "none";
      el.offsetHeight;
      el.style.transition = "clip-path 1s cubic-bezier(0.25,0.46,0.45,0.94)";
      el.style.clipPath = "inset(0 0% 0 0)";
      // Initial setOption fired and CSS clip-path transition is running.
      // The clip-path is independent of ECharts setOption, so option
      // updates from here on are safe to push (they redraw the canvas
      // content but the clip-path keeps animating to reveal it).
      entryAnimDoneRef.current = true;
      var obs2 = new ResizeObserver(function(){if(chartRef.current)chartRef.current.resize();});
      obs2.observe(el);
      return function(){obs2.disconnect();if(chartRef.current){chartRef.current.dispose();chartRef.current=null;}};
    } else if (optRef.current._deferInit) {
      chart.dispose();
      chartRef.current = null;
      var deferOpt = Object.assign({}, optRef.current);
      delete deferOpt._deferInit;
      var animDur = deferOpt.animationDuration || 800;
      if (deferOpt.series && deferOpt.series[0]) deferOpt.series[0].itemStyle = Object.assign({}, deferOpt.series[0].itemStyle, {borderRadius:2});
      var tid2 = setTimeout(function() {
        if (!el.isConnected) return;
        var c2 = echarts.init(el, null, {renderer:"canvas"});
        chartRef.current = c2;
        c2.setOption(deferOpt, {notMerge:true});
        // Initial deferred setOption fired — option updates safe to push.
        entryAnimDoneRef.current = true;
        setTimeout(function() {
          if (chartRef.current) {
            var finalOpt = Object.assign({}, deferOpt);
            if (finalOpt.series && finalOpt.series[0]) finalOpt.series[0].itemStyle = Object.assign({}, finalOpt.series[0].itemStyle, {borderRadius:0});
            chartRef.current.setOption(finalOpt, {notMerge:false});
          }
        }, animDur+50);
      }, 50);
      var obs3 = new ResizeObserver(function(){if(chartRef.current)chartRef.current.resize();});
      obs3.observe(el);
      return function(){clearTimeout(tid2);obs3.disconnect();if(chartRef.current){chartRef.current.dispose();chartRef.current=null;}};
    } else {
      chart.setOption(optRef.current, {notMerge:true});
      // No entry-animation deferral — initial setOption is already done.
      entryAnimDoneRef.current = true;
      var obs4 = new ResizeObserver(function(){if(chartRef.current)chartRef.current.resize();});
      obs4.observe(el);
      return function(){obs4.disconnect();if(chartRef.current){chartRef.current.dispose();chartRef.current=null;}};
    }
  }, []);

  // Push option updates to ECharts after the entry animation completes.
  // The main effect above only runs once ([] deps), so a parent re-render
  // that produces a new `option` object — typically driven by container
  // resize through useContainerSize → new W → new picked label indices →
  // new colOpt — wouldn't otherwise reach ECharts. This effect gates on
  // entryAnimDoneRef (set true ONLY after the mount path's entry-animation
  // setOption has actually fired). Skipping until then prevents this
  // effect's setOption from clobbering the bar grow-from-zero animation
  // (any width updates that happened during the entry-anim window are
  // still picked up because the _growFromZero setTimeout reads
  // optRef.current at fire time, not a mount-time snapshot). After entry
  // anim, notMerge:false (default) preserves animation state for unchanged
  // series, so a pure resize won't re-trigger line draws or bar grows.
  useEffect(function() {
    if (!entryAnimDoneRef.current) return;
    if (!chartRef.current) return;
    // Strip the entry-animation sentinel flags — they're only consumed
    // by the initial mount path. Passing them again here is a no-op for
    // ECharts but keeps the option clean.
    var upd = Object.assign({}, option);
    delete upd._growFromZero;
    delete upd._clipReveal;
    delete upd._deferInit;
    // notMerge:true does a clean full redraw rather than merging the new
    // option onto the existing render. Merge mode (notMerge:false) was
    // leaving the previous X-axis labels painted underneath the newly
    // drawn ones when the option changed (e.g. toggling the optional
    // axis) — two layers of anti-aliased text stacked, making the
    // canvas labels look darker than the React-overlay edge labels.
    // A full redraw guarantees a single clean layer so the canvas
    // labels render at their true rgba(0,0,0,0.6) weight. Entry-anim
    // flags are already stripped above, so this won't replay the
    // grow-from-zero / clip-reveal animations on a pure option update.
    chartRef.current.setOption(upd, { notMerge: true });
  }, [option]);
  return ce("div", {ref, style: style || {width:"100%",height:"100%"}});
});

function TableChart({ data, dates, period, fmt, metric, animTick, H, scrollable, sortable, tableConfig, stickyFirst }) {
  // Use caller-supplied config (real data) or fall back to a generic 2-col layout.
  var cfg = tableConfig || {
    columns: [
      { key: 'date',  label: 'Date',  align: 'left' },
      { key: 'value', label: 'Value', align: 'right', numeric: true },
    ],
    rows: (data || []).slice(0, 7).map(function(v, i) {
      return { date: dates && dates[i] ? fmtDateLabel(dates[i], period) : String(i + 1), value: v };
    }),
  };
  var cols = cfg.columns, rows = cfg.rows;
  var [prog, setProg] = useState(0);
  var afRef = useRef();

  // stickyFirst: sticky pinned first column that shrinks as the user scrolls.
  // sizerFirstRef measures the natural (full) width of col 0 after mount so
  // we know the range to animate. scrollXState tracks the container's scrollLeft
  // fed back from ScrollableTableWrapper via onScrollX.
  var sizerFirstRef = useRef();
  var [naturalFirstW, setNaturalFirstW] = useState(null);
  var [scrollXState, setScrollXState] = useState(0);
  var MIN_FIRST_COL_PX = 88; // 72px text area + 16px left padding = ~10 chars at 11px sans-serif
  React.useLayoutEffect(function() {
    if (!stickyFirst || !sizerFirstRef.current) return;
    var w = sizerFirstRef.current.getBoundingClientRect().width;
    if (w > 0) setNaturalFirstW(w);
  }, [stickyFirst, animTick]);
  // Reset scroll state when animTick changes (new data / period)
  React.useLayoutEffect(function() {
    if (stickyFirst) setScrollXState(0);
  }, [animTick]);
  var currentFirstColW = (stickyFirst && naturalFirstW != null)
    ? Math.max(MIN_FIRST_COL_PX, naturalFirstW - scrollXState)
    : null;
  useEffect(function() {
    setProg(0);
    var start = null, dur = 800;
    function easeOut(t) { return 1 - Math.pow(1-t,3); }
    function frame(ts) {
      if (!start) start = ts;
      var t = Math.min((ts-start)/dur, 1);
      setProg(easeOut(t));
      if (t < 1) afRef.current = requestAnimationFrame(frame);
    }
    afRef.current = requestAnimationFrame(frame);
    return function(){if(afRef.current)cancelAnimationFrame(afRef.current);};
  }, [animTick]);
  var headerH = 24;
  var available = Math.max(80, H || 140);
  var rowH = Math.max(24, Math.floor((available-headerH)/rows.length));
  var divider = "1px solid " + tokens.colors.ui.buttonHover;

  // Sizing strategy: render every cell as a direct child of ONE CSS Grid so
  // all rows share the same column widths (otherwise vertical dividers won't
  // line up across rows). First text column flexes within a minmax(7ch, 1fr)
  // range so it never collapses below ~7 characters before ellipsing. Numeric
  // columns size to their widest cell content via minmax(0, max-content) —
  // they hold max-content when there's space, and shrink with ellipsis only
  // after the first column has reached its 7ch floor.
  //
  // In scrollable mode, the table's natural width is allowed to exceed the
  // container — every column sizes to its max-content (with a 7ch floor on
  // the first text column) and the wrapper handles horizontal overflow.
  var template = cols.map(function(col, ci) {
    if (scrollable && stickyFirst) {
      if (ci === 0) return currentFirstColW != null ? currentFirstColW + "px" : "minmax(7ch, max-content)";
      return "max-content";
    }
    if (scrollable) {
      return (col.align === "left" && ci === 0) ? "minmax(7ch, max-content)" : "max-content";
    }
    return (col.align === "left" && ci === 0) ? "minmax(7ch, 1fr)" : "minmax(0, max-content)";
  }).join(" ");

  // Hidden sizer row: contributes to grid column sizing using the FINAL
  // formatted values, so column widths don't shift during the count-up
  // animation. Visible cells render the animated value inside the same
  // grid track but contribute no growth beyond the sizer.
  var sizerRow = cols.map(function(col, ci) {
    var widest = String(col.label || "");
    for (var ri = 0; ri < rows.length; ri++) {
      var v = rows[ri][col.key];
      var s = (col.numeric && typeof v === "number") ? fmtTableCell(v, col.format) : String(v == null ? "" : v);
      if (s.length > widest.length) widest = s;
    }
    return ce("div", {
      key: "sizer-" + col.key,
      ref: (stickyFirst && ci === 0) ? sizerFirstRef : undefined,
      style: {
        height: 0, overflow: "hidden", whiteSpace: "nowrap",
        paddingLeft: (stickyFirst && ci === 0) ? 16 : (ci > 0 ? 8 : 0),
        paddingRight: ci < cols.length - 1 ? 8 : 0,
        fontSize: 11, fontWeight: tokens.typography.fontWeight.bold, fontFamily: "inherit",
        fontVariantNumeric: col.numeric ? "tabular-nums" : "normal",
        visibility: "hidden",
      },
    }, widest);
  });

  function cellStyle(col, ci, isHeader, isNum, isLastRow) {
    var s = {
      display: "flex",
      alignItems: "center",
      justifyContent: col.align === "right" ? "flex-end" : "flex-start",
      height: isHeader ? headerH : rowH,
      paddingRight: ci < cols.length - 1 ? 8 : 0,
      paddingLeft: ci > 0 ? 8 : 0,
      borderRight: ci < cols.length - 1 ? divider : "none",
      borderBottom: isHeader ? divider : (isLastRow ? "none" : divider),
      fontSize: 11,
      fontWeight: isHeader ? 700 : (isNum ? 600 : 400),
      color: isHeader ? tokens.colors.ui.bodyText : (isNum ? tokens.colors.ui.bodyText : tokens.colors.ui.subtleText),
      fontFamily: "inherit",
      fontVariantNumeric: isNum ? "tabular-nums" : "normal",
      overflow: "hidden",
      whiteSpace: "nowrap",
      minWidth: 0,
      boxSizing: "border-box",
    };
    if (stickyFirst && ci === 0) {
      s.position = "sticky";
      s.left = 0;
      s.paddingLeft = "16px"; // replaces the container's removed left padding
      s.zIndex = isHeader ? 3 : 2;
      s.backgroundColor = "var(--dex-bgColor-default, #fff)";
      // Row dividers on the sticky cell must start at the text indent (16px),
      // not at the cell's left edge. Use a background-image gradient positioned
      // 16px from the left instead of a real border-bottom.
      if (s.borderBottom !== "none") {
        s.borderBottom = "none";
        s.backgroundImage = "linear-gradient(" + tokens.colors.ui.buttonHover + ", " + tokens.colors.ui.buttonHover + ")";
        s.backgroundRepeat = "no-repeat";
        s.backgroundSize = "calc(100% - 16px) 1px";
        s.backgroundPosition = "16px 100%";
      }
    }
    return s;
  }
  function innerStyle(col) {
    return { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: col.align };
  }

  // First numeric column is the implied "active sort" — gets a solid
  // chevron-down icon next to its label. Other columns get a faint chevron
  // to signal "sortable, click to sort by this column".
  var activeSortKey = sortable ? (function(){
    for (var ic = 0; ic < cols.length; ic++) if (cols[ic].numeric) return cols[ic].key;
    return cols[0].key;
  })() : null;

  var headerCells = cols.map(function(col, ci) {
    var isActiveSort = sortable && col.key === activeSortKey;
    var headerStyle = cellStyle(col, ci, true, false, false);
    var labelInner = ce("div", { style: innerStyle(col) }, col.label);
    if (!sortable) {
      return ce("div", { key: "h-" + col.key, style: headerStyle }, labelInner);
    }
    // Sortable: render the label + a chevron icon at the right side of the
    // header cell. Active sort column gets full-opacity chevron; others
    // get a faint chevron so the affordance is visible but not noisy.
    return ce("div", { key: "h-" + col.key, style: headerStyle },
      ce("div", { style: { display: 'flex', alignItems: 'center', justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start', width: '100%', gap: 3, overflow: 'hidden' } },
        ce("span", { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, col.label),
        ce("span", { style: { display: 'inline-flex', alignItems: 'center', flexShrink: 0, opacity: isActiveSort ? 0.85 : 0.3, color: isActiveSort ? tokens.colors.ui.bodyText : tokens.colors.ui.subtleText } },
          ce(DexIcon, { name: 'chevron-down', size: 'xs' })
        )
      )
    );
  });

  function renderCellValue(col, val, isNum) {
    if (val == null) return ce('span', { style: { color: tokens.colors.ui.mutedText, fontWeight: 400 } }, '—');
    if (isNum) return fmtTableCell(Math.round(val * prog * 10) / 10, col.format);
    return val;
  }

  var bodyCells = [];
  for (var ri = 0; ri < rows.length; ri++) {
    var row = rows[ri], isLast = ri === rows.length - 1;
    for (var ci = 0; ci < cols.length; ci++) {
      var col = cols[ci];
      var val = row[col.key];
      var isNum = col.numeric && typeof val === "number";
      var displayVal = renderCellValue(col, val, isNum);
      bodyCells.push(
        ce("div", { key: ri + "-" + col.key, style: cellStyle(col, ci, false, isNum, isLast) },
          ce("div", { style: innerStyle(col) }, displayVal)
        )
      );
    }
  }

  if (scrollable) {
    var stickyColW = stickyFirst ? (currentFirstColW != null ? currentFirstColW : MIN_FIRST_COL_PX) : 0;
    return ce(ScrollableTableWrapper, { available: available, onScrollX: stickyFirst ? setScrollXState : undefined, stickyColW: stickyColW },
      ce("div", { style: { display: "grid", gridTemplateColumns: template, width: "max-content" } },
        sizerRow,
        headerCells,
        bodyCells
      )
    );
  }

  return ce("div", { style: { width: "100%", height: available, overflow: "hidden", padding: "0 16px", boxSizing: "border-box" } },
    ce("div", { style: { display: "grid", gridTemplateColumns: template, width: "100%" } },
      sizerRow,
      headerCells,
      bodyCells
    )
  );
}

// Wraps a table grid in a horizontal-scroll viewport with a custom thin
// scrollbar that auto-hides. Native scrollbar is suppressed via scrollbar-
// width:none / ::-webkit-scrollbar { display:none }. The browser still
// handles wheel/swipe events natively, including the user's natural-scroll
// direction setting — we just listen to scroll events to update our custom
// thumb position and to reveal/auto-hide it.
function ScrollableTableWrapper({ available, onScrollX, stickyColW, children }) {
  var scrollRef = useRef();
  var [scrollX, setScrollX] = useState(0);
  var [contentW, setContentW] = useState(1);
  var [viewportW, setViewportW] = useState(1);
  var [visible, setVisible] = useState(false);
  var hideRef = useRef();

  useEffect(function() {
    function measure() {
      var el = scrollRef.current;
      if (!el) return;
      setContentW(el.scrollWidth);
      setViewportW(el.clientWidth);
    }
    measure();
    var obs = new ResizeObserver(measure);
    if (scrollRef.current) obs.observe(scrollRef.current);
    // Re-measure after layout settles (sizer row and fonts may shift widths)
    var t = setTimeout(measure, 50);
    return function() { obs.disconnect(); clearTimeout(t); };
  }, []);

  function reveal() {
    setVisible(true);
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(function() { setVisible(false); }, 700);
  }
  function onScroll(e) {
    var x = e.currentTarget.scrollLeft;
    setScrollX(x);
    reveal();
    if (onScrollX) onScrollX(x);
  }

  // Custom thumb geometry. Thumb floats free (no visible track) and sits
  // 8px from the card edge. Width follows viewport/content ratio with a
  // 40px minimum so it's always grabbable. Height (6px) is intentionally a
  // few px taller than what a hairline track would be — making it easy to
  // hit without dominating the chrome.
  // When a sticky first column is present, the scrollbar thumb must start
  // past the column's right edge so it isn't hidden underneath it.
  var insetLeft = stickyColW > 0 ? stickyColW + 8 : 24;
  var insetRight = 24;
  var trackW = Math.max(0, viewportW - insetLeft - insetRight);
  var thumbRatio = contentW > 0 ? viewportW / contentW : 1;
  var thumbW = Math.max(40, trackW * thumbRatio);
  var maxThumbX = Math.max(0, trackW - thumbW);
  var maxScrollX = Math.max(0, contentW - viewportW);
  var thumbX = maxScrollX > 0 ? (scrollX / maxScrollX) * maxThumbX : 0;
  var hasOverflow = contentW > viewportW + 1;

  return ce("div", { style: { position: "relative", width: "100%", height: available, overflow: "hidden" } },
    // Inline CSS rule to hide the native scrollbar; scoped via a unique class.
    ce("style", null, ".chart-scroll-hide{scrollbar-width:none;-ms-overflow-style:none}.chart-scroll-hide::-webkit-scrollbar{display:none;width:0;height:0}"),
    ce("div", {
      ref: scrollRef,
      className: "chart-scroll-hide",
      onScroll: onScroll,
      onWheel: reveal,
      onTouchMove: reveal,
      style: {
        width: "100%", height: "100%",
        overflowX: "auto", overflowY: "hidden",
        // When stickyFirst, left padding is removed so sticky left:0 aligns
        // with the container edge — no gap for scrolled content to bleed through.
        padding: stickyColW > 0 ? "0 16px 0 0" : "0 16px",
        boxSizing: "border-box",
      },
    }, children),
    hasOverflow && ce("div", {
      style: {
        position: "absolute",
        bottom: 8,
        left: insetLeft + thumbX,
        width: thumbW,
        height: 6,
        background: tokens.colors.ui.mutedText,
        borderRadius: 3,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s ease",
        pointerEvents: "none",
      },
    })
  );
}

function DonutChart({ data, dates, period, fmt, animTick, W, H, mini }) {
  var ref = useRef(), textRef = useRef();
  // Two accepted input shapes:
  //  • Categorical (preferred for parts-of-a-whole semantics):
  //      data = [{ name: 'Web', value: 450 }, { name: 'Mobile', value: 300 }, ...]
  //    Each entry IS a slice — name + value used directly. This is the
  //    correct shape for Donut/Pie because it represents real business
  //    categories (channel, source, stage, etc.).
  //  • Time-series (legacy/fallback): data = number[], dates = Date[]
  //    Samples 2-5 evenly-spaced date points and treats each as a slice.
  //    Kept for backward compatibility with consumers that haven't moved
  //    to categorical data yet. Slices are mathematically valid but
  //    semantically weak (sample variance dressed up as composition).
  var isCategorical = !!(data && data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'value' in data[0]);
  var slices;
  if (isCategorical) {
    slices = data.map(function(d) { return { value: d.value, name: d.name }; });
  } else {
    var sliceCount = Math.min(5, Math.max(2, Math.round(data.length/12)||3));
    var step = Math.floor(data.length/sliceCount);
    slices = [];
    for (var i = 0; i < sliceCount; i++) slices.push({value:data[Math.min(i*step,data.length-1)],name:dates[Math.min(i*step,dates.length-1)].toLocaleDateString("en-US",{month:"short",day:period==="Year to date"?undefined:"numeric"})});
  }
  var total = slices.reduce(function(a,s){return a+s.value;},0)||1;
  // Center value: for categorical, show the sum of all slices — that
  // IS the "total" the donut is breaking down. For time-series legacy
  // mode, preserve the old behavior of showing the last data point as
  // a "current state" indicator (the slice sum is meaningless in that
  // mode since slices are sampled, not summed).
  var centerValue = fV(isCategorical ? total : data[data.length-1], fmt);
  var availH = mini ? Math.max(60, H || 90) : Math.max(120, H || 140);
  var availW = mini ? Math.max(80, W || 120) : Math.max(220, W || 320);
  var donutSize = mini
    ? Math.min(availH - 4, Math.max(50, availW * 0.7))
    : Math.min(availH, Math.max(120, availW * 0.5));
  var textMAX = mini ? Math.round(donutSize * 0.38) : 70;
  var [fit, setFit] = useState({cls:"dex-text-display-2-alt",fontSize:null});
  useEffect(function() {
    if (!textRef.current) return;
    var el = textRef.current, MAX = textMAX;
    el.style.fontSize = "";
    el.className = "dex-text-display-2-alt";
    if (el.getBoundingClientRect().width <= MAX) { setFit({cls:"dex-text-display-2-alt",fontSize:null}); return; }
    el.className = "dex-text-display-3-alt";
    var w = el.getBoundingClientRect().width;
    if (w <= MAX) { setFit({cls:"dex-text-display-3-alt",fontSize:null}); return; }
    setFit({cls:"dex-text-display-3-alt",fontSize:Math.max(9,Math.floor(24*(MAX/w)))+"px"});
  }, [centerValue, textMAX]);
  var donutOpt = {_deferInit:true,animation:true,animationDuration:800,animationEasing:"cubicOut",color:DONUT_COLORS,tooltip:{show:!mini,trigger:"item",backgroundColor:tokens.colors.ui.tooltipBg,borderColor:"transparent",textStyle:{color:tokens.colors.ui.whiteSurface,fontSize:10,fontWeight:700,fontFamily:tokens.typography.fontFamily.sans},formatter:function(params){return fV(params.value,fmt)+" ("+params.percent+"%)"}},series:[{type:"pie",radius:["55%","90%"],center:["50%","50%"],startAngle:90,animationType:"expansion",data:slices,label:{show:false},emphasis:{scale:false},itemStyle:{borderRadius:0,borderColor:tokens.colors.text.inverse,borderWidth:1}}]};
  var legendItems = slices.map(function(s, i) {
    return ce("div",{key:i,style:{display:"flex",alignItems:"center",gap:6}},
      ce("div",{style:{width:8,height:8,borderRadius:2,background:DONUT_COLORS[i%DONUT_COLORS.length],flexShrink:0}}),
      ce("span",{style:{fontSize:tokens.typography.fontSize.xs,color:tokens.colors.ui.subtleText,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},s.name),
      ce("span",{style:{fontSize:tokens.typography.fontSize.xs,color:tokens.colors.ui.bodyText,fontWeight:600,flexShrink:0}},Math.round((s.value/total)*100)+"%")
    );
  });
  return ce("div",{ref,style:{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:mini?0:tokens.spacing.md,height:availH,padding:mini?"0":"0 16px",boxSizing:"border-box"}},
    ce("div",{style:{position:"relative",width:donutSize,height:donutSize,flexShrink:0}},
      ce(EChart,{option:donutOpt,style:{width:"100%",height:"100%"}}),
      ce("div",{style:{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none",lineHeight:1}},
        ce("div",{ref:textRef,className:fit.cls,style:{color:tokens.colors.ui.cardTitle,whiteSpace:"nowrap",fontSize:fit.fontSize||undefined,lineHeight:1}},centerValue),
        !mini && ce("div",{style:{fontSize:11,fontWeight:500,color:tokens.colors.ui.subtleText,fontFamily:"inherit",lineHeight:1,marginTop:2}},"total")
      )
    ),
    !mini && ce("div",{style:{display:"flex",flexDirection:"column",gap:0,minWidth:0}},legendItems)
  );
}

// Pie chart — sibling of DonutChart. Same data slicing, palette, layout
// (chart on left, legend on right), and clockwise-from-12-o'clock animation,
// but solid (no inner hole) and no center value label. Implemented as a
// sibling rather than a Donut variant so the two paths stay independent —
// future tweaks to one can't break the other.
function PieChart({ data, dates, period, fmt, animTick, W, H, mini }) {
  var ref = useRef();
  // Same dual-shape contract as DonutChart — see that component for the
  // full rationale. Categorical (object array) is preferred; time-series
  // sampling is the backward-compat fallback.
  var isCategorical = !!(data && data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'value' in data[0]);
  var slices;
  if (isCategorical) {
    slices = data.map(function(d) { return { value: d.value, name: d.name }; });
  } else {
    var sliceCount = Math.min(5, Math.max(2, Math.round(data.length/12)||3));
    var step = Math.floor(data.length/sliceCount);
    slices = [];
    for (var i = 0; i < sliceCount; i++) slices.push({value:data[Math.min(i*step,data.length-1)],name:dates[Math.min(i*step,dates.length-1)].toLocaleDateString("en-US",{month:"short",day:period==="Year to date"?undefined:"numeric"})});
  }
  var total = slices.reduce(function(a,s){return a+s.value;},0)||1;
  var availH = mini ? Math.max(60, H || 90) : Math.max(120, H || 140);
  var availW = mini ? Math.max(80, W || 120) : Math.max(220, W || 320);
  var pieSize = mini
    ? Math.min(availH - 4, Math.max(50, availW * 0.7))
    : Math.min(availH, Math.max(120, availW * 0.5));
  // Same ECharts pie series as Donut but radius starts at 0 (no hole).
  // startAngle: 90 places the first slice at the 12-o'clock position;
  // ECharts naturally renders subsequent slices clockwise from there.
  // animationType "expansion" produces the same clockwise sweep reveal
  // the Donut uses today.
  var pieOpt = {_deferInit:true,animation:true,animationDuration:800,animationEasing:"cubicOut",color:DONUT_COLORS,tooltip:{show:!mini,trigger:"item",backgroundColor:tokens.colors.ui.tooltipBg,borderColor:"transparent",textStyle:{color:tokens.colors.ui.whiteSurface,fontSize:10,fontWeight:700,fontFamily:tokens.typography.fontFamily.sans},formatter:function(params){return fV(params.value,fmt)+" ("+params.percent+"%)"}},series:[{type:"pie",radius:["0%","90%"],center:["50%","50%"],startAngle:90,animationType:"expansion",data:slices,label:{show:false},emphasis:{scale:false},itemStyle:{borderRadius:0,borderColor:tokens.colors.text.inverse,borderWidth:1}}]};
  var legendItems = slices.map(function(s, i) {
    return ce("div",{key:i,style:{display:"flex",alignItems:"center",gap:6}},
      ce("div",{style:{width:8,height:8,borderRadius:2,background:DONUT_COLORS[i%DONUT_COLORS.length],flexShrink:0}}),
      ce("span",{style:{fontSize:tokens.typography.fontSize.xs,color:tokens.colors.ui.subtleText,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},s.name),
      ce("span",{style:{fontSize:tokens.typography.fontSize.xs,color:tokens.colors.ui.bodyText,fontWeight:600,flexShrink:0}},Math.round((s.value/total)*100)+"%")
    );
  });
  return ce("div",{ref,style:{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:mini?0:tokens.spacing.md,height:availH,padding:mini?"0":"0 16px",boxSizing:"border-box"}},
    ce("div",{style:{position:"relative",width:pieSize,height:pieSize,flexShrink:0}},
      ce(EChart,{option:pieOpt,style:{width:"100%",height:"100%"}})
    ),
    !mini && ce("div",{style:{display:"flex",flexDirection:"column",gap:0,minWidth:0}},legendItems)
  );
}

// Rating-distribution chart for the Reviews tab. Horizontal bars with star
// labels (5★ at top, 1★ at bottom). Bars are intentionally thin (barMaxWidth)
// to match the design mock, and barMinHeight keeps a visible stub for rows
// with a 0% rating so the row isn't "missing" from the read.
function ReviewsChart({ data, fmt, animTick, W, H, mini }) {
  // Order top-to-bottom: 5★, 4★, 3★, 2★, 1★. ECharts category axis is
  // bottom-up, so the arrays below are reversed before assigning so the
  // visual order matches the design mock. Values are tuned for visual
  // fill: 5★ near the max, others scaled so each bar covers a meaningful
  // portion of the horizontal track. 2★ is bumped to ~18 so the row reads
  // as a small but present bar.
  var topToBottomLabels = ['5 ★', '4 ★', '3 ★', '2 ★', '1 ★'];
  var topToBottomValues = [95, 68, 42, 18, 30];
  var yLabels = topToBottomLabels.slice().reverse();
  var yValues = topToBottomValues.slice().reverse();

  // Canvas-rendered text — literal hex required (CSS vars don't resolve in
  // canvas fillStyle). Both the number and the star get the brand blue so
  // the row label reads as one chip.
  var BLUE = tokens.colors.chart.dataBlue100; // '#3392FF'
  var TEXT = 'rgba(0,0,0,0.7)';
  // Background track behind each bar — matches DEX bgColor-alpha-emphasis
  // value (6% black overlay), used as a literal here so it paints on canvas.
  var TRACK = 'rgba(0,0,0,0.06)';

  var availH = Math.max(120, H || 140);
  // The chart is wrapped in a flex container that centers it vertically.
  // Capping inner height keeps the cluster compact when the card is taller
  // than needed, rather than spreading rows across all available space.
  var chartH = Math.min(availH, 160);
  var reviewOpt = {
    _growFromZero: true,
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut',
    grid: { left: 36, right: 16, top: 4, bottom: 4, containLabel: false },
    xAxis: { type: 'value', show: false, max: 100 },
    yAxis: {
      type: 'category',
      data: yLabels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: !mini,
        // Canvas-safe font family — see 'inherit' docs.
        fontFamily: 'inherit',
        margin: 4,
        interval: 0,
        formatter: function(value){
          var parts = value.split(' ');
          return '{n|' + parts[0] + '} {s|' + parts[1] + '}';
        },
        rich: {
          n: { color: TEXT, fontSize: 11, fontWeight: 500 },
          s: { color: BLUE, fontSize: 18, fontWeight: 700 },
        },
      },
    },
    tooltip: {
      show: !mini, trigger: 'axis', axisPointer: { type: 'none' },
      backgroundColor: tokens.colors.ui.tooltipBg, borderColor: 'transparent',
      textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
      formatter: function(p){ return p[0].value + '%'; },
    },
    series: [{
      type: 'bar',
      data: yValues,
      barCategoryGap: '55%',
      barMaxWidth: 10,
      barMinHeight: 3,
      // Subtle gray track behind each bar that spans the FULL category
      // width — gives the row a visible "rail" so even short bars read in
      // context of the maximum possible length.
      showBackground: true,
      backgroundStyle: { color: TRACK, borderRadius: [0, 2, 2, 0] },
      itemStyle: { color: BLUE, borderRadius: [0, 2, 2, 0] },
    }],
  };
  return ce('div', { style: { width: '100%', height: availH, display: 'flex', alignItems: 'center', justifyContent: 'stretch' } },
    ce('div', { style: { width: '100%', height: chartH } },
      ce(EChart, { option: reviewOpt, style: { width: '100%', height: '100%' } })
    )
  );
}

// Bullet chart — horizontal "goal progress" bar with a target tick.
// Animation: bar grows left-to-right (matches the Bar chart family),
// then the target tick fades in once the bar settles. The optional zone
// variant lays out three colored bands (poor / okay / great) behind the
// bar so the value can be read in context without an explicit legend.
function BulletChart({ data, fmt, animTick, W, H, mini, withZones }) {
  var actual = data[data.length - 1] || 0;
  // Target = peak observed value plus a small buffer (always above actual so
  // the marker visibly trails ahead of the current progress).
  var peak = data.reduce(function(m, v){ return v > m ? v : m; }, 0) || 1;
  var target = Math.round(peak * 0.92);
  var max = Math.round(peak * 1.05);
  if (actual > target) target = Math.round(actual * 1.1);

  var availH = Math.max(120, H || 140);
  var BLUE = tokens.colors.chart.dataBlue100;
  var zoneStops = [0.45, 0.75, 1.0];
  // Performance zone bands behind the bar. Chart-palette colors only
  // (red / yellow / green from data viz tokens — not DEX semantic
  // colors) at 15% opacity so the bands read as soft background
  // context behind the sharp foreground bar.
  var zoneColors = [
    colorWithAlpha(tokens.colors.chart.dataRed100, 0.15),
    colorWithAlpha(tokens.colors.chart.dataYellow100, 0.15),
    colorWithAlpha(tokens.colors.chart.dataGreen100, 0.15),
  ];

  // Tick mark for the target. Rendered as a markLine on the value axis so
  // ECharts handles positioning and resizing automatically.
  var markLine = {
    silent: true, symbol: ['none', 'none'],
    lineStyle: { color: 'rgba(0,0,0,0.75)', width: 2, type: 'solid' },
    label: { show: false },
    data: [{ xAxis: target }],
    // Tick appears at the end of the bar animation so it reads as the goal
    // post the bar is racing toward.
    animationDelay: 700,
    animationDuration: 250,
  };

  // Zone bands behind the bar — rendered as stacked transparent segments.
  var seriesList = [];
  if (withZones) {
    var prev = 0;
    for (var z = 0; z < zoneStops.length; z++) {
      var stop = Math.round(max * zoneStops[z]);
      seriesList.push({
        type: 'bar', data: [stop - prev], stack: 'zones',
        barCategoryGap: '0%', barWidth: 22,
        silent: true,
        itemStyle: { color: zoneColors[z], borderRadius: 0 },
        animation: false,
      });
      prev = stop;
    }
  }
  // The actual value bar — sits on top of the zones (rendered last so it
  // paints above them) and grows left-to-right via _growFromZero.
  seriesList.push({
    type: 'bar', data: [actual],
    barWidth: withZones ? 10 : 14,
    itemStyle: { color: BLUE, borderRadius: [0, 2, 2, 0] },
    markLine: markLine,
  });

  var bulletOpt = {
    _growFromZero: true,
    animation: true,
    animationDuration: 700,
    animationEasing: 'cubicOut',
    grid: { left: mini ? 8 : 16, right: mini ? 8 : 24, top: 'middle', height: 28, containLabel: false },
    xAxis: { type: 'value', show: false, max: max },
    yAxis: { type: 'category', data: [''], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false } },
    tooltip: {
      show: !mini, trigger: 'axis', axisPointer: { type: 'none' },
      appendToBody: true,
      backgroundColor: tokens.colors.ui.tooltipBg, borderColor: 'transparent',
      textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
      formatter: function(){ return fV(actual, fmt) + ' / target ' + fV(target, fmt); },
    },
    series: seriesList,
  };

  return ce('div', { style: { width: '100%', height: availH, display: 'flex', flexDirection: 'column', justifyContent: 'center' } },
    !mini && ce('div', { style: { padding: '0 16px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontFamily: tokens.typography.fontFamily.sans } },
      ce('span', { style: { fontSize: 22, fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.ui.cardTitle, fontVariantNumeric: 'tabular-nums' } }, fV(actual, fmt)),
      ce('span', { style: { fontSize: 11, fontWeight: tokens.typography.fontWeight.medium, color: tokens.colors.ui.subtleText, fontVariantNumeric: 'tabular-nums' } }, 'Goal ' + fV(target, fmt))
    ),
    ce('div', { style: { flex: 'none', height: 48 } },
      ce(EChart, { option: bulletOpt, style: { width: '100%', height: '100%' } })
    )
  );
}

// Combo chart — bars (left axis) + line (right axis), dual-axis for paired
// metrics where one is a count and the other a rate/ratio. Animations
// match each series' natural shape: bars grow bottom-up (ECharts default
// for bar), line draws left-to-right (ECharts default for line). Both
// fire simultaneously so the chart reads as one composed motion.
function ComboChart({ data, dates, period, fmt, animTick, W, H, mini, stacked, grouped, seriesCount, categorical, categories, showOptionalAxis }) {
  // Categorical mode: N (2-4) discrete categories with one bar each
  // (color-coded from SERIES_COLORS) + a rate line riding over the top.
  // Replaces the time-series data and date labels with N evenly-spaced
  // samples from the source data and generic Series 1..N labels.
  var catMode = !!categorical && (categories || 0) >= 2;
  var catCount = catMode ? Math.max(2, Math.min(4, categories)) : 0;
  var catLabelsArr = null;
  if (catMode) {
    var catStep = Math.max(1, Math.floor(data.length / catCount));
    var sliced = [];
    catLabelsArr = [];
    for (var ci = 0; ci < catCount; ci++) {
      sliced.push(data[Math.min(ci * catStep, data.length - 1)]);
      catLabelsArr.push('Series ' + (ci + 1));
    }
    data = sliced;
  }

  // Derived "secondary" metric for the line — a stable rate computed from
  // the primary metric, scaled to a 0-100 range so it reads as a percentage
  // independent of the absolute count.
  var peak = data.reduce(function(m, v){ return v > m ? v : m; }, 0) || 1;
  var lineData = data.map(function(v, i){
    var ratio = (v / peak) * 100;
    // Add stable variance so the line isn't a perfect rescale of the bars.
    var jitter = Math.sin(i * 0.7 + 1.3) * 8 + Math.cos(i * 0.4) * 5;
    return Math.max(2, Math.min(98, Math.round(ratio * 0.65 + 30 + jitter)));
  });

  var labels = catMode ? catLabelsArr : dates.map(function(d){ return fmtDateLabel(d, period); });
  var BLUE = tokens.colors.chart.dataBlue100;
  var GREEN = tokens.colors.chart.dataGreen100;

  var availH = Math.max(120, H || 140);
  var ref = useRef();
  var W2 = useW(ref);
  var pL = mini ? 4 : 16, pR = mini ? 4 : 16;
  var xlH = mini ? 0 : 20;
  var chartH = Math.max(50, availH - xlH);

  // Multi-series combo support: stacked (3 series stacked + line on top)
  // or grouped (2-3 series side-by-side + line on top). Color for the
  // line shifts to the next entry in SERIES_COLORS after the bars so it
  // stays in the family but contrasts with every stack segment.
  var isStackedCombo = !!stacked && seriesCount >= 2;
  var isGroupedCombo = !!grouped && seriesCount >= 2;
  var multiCount = (isStackedCombo || isGroupedCombo) ? Math.max(2, Math.min(4, seriesCount)) : 0;
  var multiBarData = multiCount >= 2 ? buildMultiSeries(data, multiCount) : null;
  // Line color: in catMode, pick the next SERIES_COLORS slot after the
  // N category colors so the line contrasts with every bar (matches the
  // existing multi-series convention). Otherwise default to GREEN, or
  // for stacked/grouped combos pick the next slot after the bar count.
  var comboLineColor = catMode
    ? (SERIES_COLORS[catCount] || tokens.colors.chart.dataNavy100)
    : multiCount >= 2
      ? (SERIES_COLORS[multiCount] || tokens.colors.chart.dataNavy100)
      : GREEN;

  // Y-axis sizing for the BAR (left) value axis. The line/rate series
  // lives on a separate hidden 0-100 axis and isn't affected by the
  // toggle. Peak depends on the bar variant:
  //   stacked → sum across all bar series at each X
  //   grouped → max across all bar series at any X
  //   catMode → max of the N category values
  //   default → max of the single bar series
  // niceAxisRange caps ticks at 6 (incl. 0). Same pattern as Column/Line.
  var comboBarPeak = 0;
  if (isStackedCombo && multiBarData) {
    for (var cbx = 0; cbx < (multiBarData[0] ? multiBarData[0].length : 0); cbx++) {
      var cbSum = 0;
      for (var cbs = 0; cbs < multiBarData.length; cbs++) cbSum += multiBarData[cbs][cbx] || 0;
      if (cbSum > comboBarPeak) comboBarPeak = cbSum;
    }
  } else if (isGroupedCombo && multiBarData) {
    for (var cgi = 0; cgi < multiBarData.length; cgi++) {
      for (var cgj = 0; cgj < multiBarData[cgi].length; cgj++) {
        if (multiBarData[cgi][cgj] > comboBarPeak) comboBarPeak = multiBarData[cgi][cgj];
      }
    }
  } else {
    comboBarPeak = data.reduce(function(m, v){ return v > m ? v : m; }, 0);
  }
  var comboRange = niceAxisRange(comboBarPeak);
  var comboYChars = yAxisCharLimit(W2 || 320);
  var comboYOffset = yAxisReservedWidth(comboRange.max, fmt, comboYChars, showOptionalAxis);
  var comboEffectivePL = pL + comboYOffset;

  // Phase 9: dual-axis X — same as Column. Bars + line bind to a hidden
  // category axis (index 0), kept exactly as-is so positioning and the
  // RAF line-reveal animation are untouched. A value axis (index 1)
  // renders the date labels at exactly even intervals (uniform pixel
  // spacing, export-safe canvas text). The categorical Combo sub-mode
  // (catMode) keeps category labels (they're Series names, not dates).
  var comboIs7d = period === 'Last 7 days';
  var comboIsYtd = period === 'Year to date';
  var comboCentered = catMode || comboIs7d || comboIsYtd;
  var comboXAxisGridBottom = mini ? 6 : 20;
  var comboL = (labels || []).length;
  var comboMaxN = Math.max(2, Math.min(Math.floor(((W2 || 320) - comboEffectivePL - pR) / (comboIsYtd ? 40 : 60)), comboL));
  function buildComboXAxisOpt() {
    // Centered (catMode / 7d / YTD): show labels on the CATEGORY axis —
    // boundaryGap:true centers each label under its bar/group natively.
    // Non-centered (30/90d): hide category labels; a value axis renders
    // evenly-spaced date labels.
    var catAxis = {
      type: 'category',
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: comboCentered ? {
        show: !mini,
        interval: 0,
        hideOverlap: false,
        fontSize: 10,
        fontWeight: 500,
        color: 'rgba(0,0,0,0.6)',
        fontFamily: 'inherit',
        margin: 8,
      } : { show: false },
    };
    if (comboCentered) return catAxis;
    var valAxis = {
      type: 'value',
      position: 'bottom',
      min: 0,
      max: comboL - 1,
      interval: (comboL - 1) / (comboMaxN - 1),
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        show: !mini,
        showMinLabel: true,
        showMaxLabel: true,
        alignMinLabel: 'left',
        alignMaxLabel: 'right',
        hideOverlap: false,
        fontSize: 10,
        fontWeight: 500,
        color: 'rgba(0,0,0,0.6)',
        fontFamily: 'inherit',
        margin: 8,
        formatter: function(val){
          var i = Math.round(val);
          if (i < 0) i = 0; else if (i > comboL - 1) i = comboL - 1;
          return labels[i];
        },
      },
    };
    return [catAxis, valAxis];
  }

  // Sequenced animation: bars animate bottom-up via ECharts default bar
  // entry animation, THEN the line draws left-to-right via RAF-driven
  // data reveal. Manually progressing the line's data array (filling
  // points from left to right) gives reliable directional animation;
  // ECharts' per-point animationDelay on line series doesn't produce
  // the same effect because the line renders as a single path.
  var barDuration = 600;
  var lineStart = 650;     // brief beat after bars settle
  var lineDuration = 500;
  // Refactored: Combo now uses the shared EChart wrapper (same as Column /
  // Line / Area). echartRef accesses the wrapper's chart instance via
  // forwardRef. lineRevealRef tracks the line-reveal animation state
  // (0=invisible, 1=fully revealed) — referenced both by buildBaseOption
  // (so React re-renders push correct line state) AND by the RAF below
  // (which writes the ref AND pushes incremental setOption updates).
  var echartRef = useRef();
  var lineRevealRef = useRef(0);

  function buildBarSeries() {
    if (catMode) {
      // Categorical: single bar series, one bar per category, each tinted
      // from SERIES_COLORS via per-data-item itemStyle. Matches the
      // Column/Bar categorical conventions (20% category gap, no width cap).
      return [{
        type: 'bar', name: 'Volume',
        yAxisIndex: 0,
        data: data.map(function(v, i){
          return { value: v, itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length], borderRadius: [2, 2, 0, 0] } };
        }),
        barCategoryGap: '20%',
      }];
    }
    if (isStackedCombo) {
      // Stacked column + line. Each segment shares stack:"total". Top
      // segment (last in array) gets rounded top corners; others stay flat.
      var out = [];
      for (var i = 0; i < multiCount; i++) {
        out.push({
          type: 'bar', name: 'Series ' + (i + 1),
          yAxisIndex: 0,
          stack: 'total',
          data: multiBarData[i],
          barMaxWidth: 40,
          itemStyle: {
            color: SERIES_COLORS[i],
            borderRadius: i === multiCount - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0],
          },
        });
      }
      return out;
    }
    if (isGroupedCombo) {
      var gout = [];
      for (var gi = 0; gi < multiCount; gi++) {
        var gs = {
          type: 'bar', name: 'Series ' + (gi + 1),
          yAxisIndex: 0,
          data: multiBarData[gi],
          itemStyle: { color: SERIES_COLORS[gi], borderRadius: [2, 2, 0, 0] },
        };
        if (gi === 0) {
          // Same group spacing math as the Column tab's grouped variants:
          // between-group = current single-bar spacing; within-group = half.
          gs.barCategoryGap = '32%';
          gs.barGap = '16%';
        }
        gout.push(gs);
      }
      return gout;
    }
    // Default single bar series.
    return [{
      type: 'bar', name: 'Volume',
      yAxisIndex: 0,
      data: data,
      barMaxWidth: 40,
      barCategoryGap: period === 'Last 7 days' ? '16%' : undefined,
      itemStyle: { color: BLUE, borderRadius: [2, 2, 0, 0] },
    }];
  }

  function buildBaseOption() {
    // _growFromZero: true tells the shared EChart wrapper to do the
    // zero→real bar animation (zeros series data first, then flips to
    // real at +16ms so ECharts reliably animates the transition). Same
    // entry-animation handling used by Column / Bar.
    return {
      _growFromZero: true,
      animation: true,
      animationDuration: barDuration,
      animationEasing: 'cubicOut',
      grid: { left: comboEffectivePL, right: pR, top: 6, bottom: comboXAxisGridBottom, containLabel: false },
      xAxis: buildComboXAxisOpt(),
      // Dual Y-axis: left (index 0) is the BAR value axis — controlled by
      // the showOptionalAxis toggle. Right (index 1) is the LINE/rate axis,
      // pinned to 0-100 and always hidden (the line series is a synthetic
      // ratio for visual narrative — exposing its scale would clutter).
      yAxis: [
        buildYAxisOpt(showOptionalAxis, fmt, comboYChars, { min: 0, max: comboRange.max, interval: comboRange.interval }),
        { type: 'value', show: false, min: 0, max: 100 },
      ],
      tooltip: {
        show: !mini, trigger: 'axis',
        appendToBody: true,
        backgroundColor: tokens.colors.ui.tooltipBg, borderColor: 'transparent',
        textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
        formatter: function(params){
          var tip = '';
          for (var pi = 0; pi < params.length; pi++) {
            var p = params[pi];
            if (p.value == null) continue;
            var isLine = p.seriesType === 'line';
            var val = isLine ? (p.value + '%') : fV(p.value, fmt);
            // In catMode the bar's row identifier is the category name
            // (p.name = "Series 1") rather than the series name "Volume".
            var label = (catMode && !isLine) ? p.name : p.seriesName;
            // Chip shape matches the chart geometry: line shape for the
            // rate line series, square chip for the bar series. Keeps the
            // tooltip visually consistent with the legend chips below.
            tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5">'
              + tooltipChipHtml(p.color, isLine ? 'line' : 'square', false)
              + '<span>' + label + ': ' + val + '</span></div>';
          }
          return tip;
        },
      },
      series: buildBarSeries().concat([
        {
          type: 'line', name: 'Rate',
          yAxisIndex: 1,
          // Line data reflects current reveal state from lineRevealRef so
          // React re-renders (e.g. on resize) push the right line state
          // through the wrapper's option-update useEffect — preventing
          // the line from snapping back to invisible during a resize
          // mid-RAF.
          data: (function() {
            var p = lineRevealRef.current;
            var visibleCount = Math.ceil(p * lineData.length);
            return lineData.map(function(v, i) { return i < visibleCount ? v : null; });
          })(),
          smooth: false,
          symbol: 'circle', symbolSize: 0,
          emphasis: { scale: false, itemStyle: { borderWidth: 2, borderColor: comboLineColor, color: tokens.colors.ui.whiteSurface }, symbolSize: 9 },
          lineStyle: { width: 2, color: comboLineColor },
          itemStyle: { color: comboLineColor },
          z: 5,
          // Line has its own animation suppressed — RAF drives it via
          // progressive data reveal. Bars rely on the option-level
          // animation: true and animate normally.
          animation: false,
        },
      ]),
    };
  }

  function buildLineUpdate(currentLineData) {
    // Selective merge: pass empty objects for each bar series so they
    // stay untouched, then update only the line's data. Crucially we do
    // NOT pass `animation` at the option level here — that would override
    // the chart's existing animation state and could cancel an in-flight
    // bar animation. Bars stay where they are; line gets new data.
    var emptyForBars = buildBarSeries().map(function(){ return {}; });
    return {
      series: emptyForBars.concat([
        { name: 'Rate', data: currentLineData },
      ]),
    };
  }

  // Bar entry animation (zero→real) is handled by the EChart wrapper via
  // the _growFromZero flag on baseOpt. Responsive xAxis/grid/yAxis option
  // pushing on resize is handled by the wrapper's option-update useEffect.
  //
  // This useEffect owns only the RAF-driven LINE reveal — the line points
  // animate in left-to-right by progressively setting null → real values
  // in the line series. We write to lineRevealRef so re-renders (e.g. on
  // resize) push the correct line state through the wrapper's option
  // update, AND we push setOption directly here for sub-frame granularity
  // (the RAF runs at 60fps; re-renders only fire on actual React state
  // changes).
  useEffect(function() {
    lineRevealRef.current = 0;
    var totalDur = lineStart + lineDuration;
    var start = null;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    var rafId = null;
    function frame(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      if (elapsed >= lineStart) {
        var lineElapsed = Math.max(0, Math.min(lineDuration, elapsed - lineStart));
        var p = easeOut(lineElapsed / lineDuration);
        lineRevealRef.current = p;
        var visibleCount = Math.ceil(p * lineData.length);
        var current = lineData.map(function(v, i){ return i < visibleCount ? v : null; });
        var c = echartRef.current && echartRef.current.getChart();
        if (c) {
          c.setOption(buildLineUpdate(current), { notMerge: false });
        }
      }
      if (elapsed < totalDur) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    return function() {
      if (rafId) cancelAnimationFrame(rafId);
      // Mark line as fully revealed on cleanup so any final renders show
      // the complete line (not a partially-revealed snapshot).
      lineRevealRef.current = 1;
    };
  }, [animTick]);

  // All X labels are canvas (category axis for catMode, value axis for
  // dates) — single return, no DOM overlay.
  return ce(EChart, { ref: echartRef, option: buildBaseOption(), style: { width: '100%', height: availH } });
}

// Heatmap — 7-day × time-of-day grid rendered as circular cells (scatter
// with symbol:'circle'). Each cell's size and color intensity scale with
// its value, so the eye reads pattern density at a glance. Animation is
// RAF-driven: cells start at size 0 with opacity 0 and scale to their
// target proportions; the population is grouped into 4 intensity buckets
// (small → large) and each bucket starts ~180ms after the prior, so the
// reveal builds momentum from quiet to loud. Total animation ≈ 990ms,
// matching the other chart families.
function HeatmapChart({ data, fmt, animTick, W, H, mini }) {
  var dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var hourLabels = ['8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm'];
  var peak = data.reduce(function(m, v){ return v > m ? v : m; }, 0) || 1;
  var dataLen = data.length || 1;

  // Cell intensities mix a fixed day-of-week × time-of-day pattern
  // (60%) with actual data values (40%) — the day/time shape keeps the
  // chart's narrative consistent (busy midweek midday, quiet weekends/
  // mornings/late evenings) while the data overlay produces visibly
  // different patterns for different periods (useWidgetData emits a
  // different length + different values per period).
  var targetCells = [];
  var maxVal = 0;
  for (var d = 0; d < dayLabels.length; d++) {
    for (var t = 0; t < hourLabels.length; t++) {
      var dayFactor = [0.7, 0.85, 1.0, 0.95, 0.9, 0.5, 0.4][d];
      var timeFactor = [0.4, 0.7, 1.0, 0.95, 0.85, 0.7, 0.5, 0.3][t];
      // Map each grid cell to a data point so different periods overlay
      // different intensity grids on the base day/time pattern.
      var dataIdx = (d * hourLabels.length + t) % dataLen;
      var dataNorm = (data[dataIdx] || 0) / Math.max(1, peak);
      // Jitter phase also shifts with the data sample to break grid lines.
      var jitter = Math.sin((d + 1) * (t + 1) * 0.7 + dataNorm * 4) * 0.10;
      var val = Math.max(0, peak * (0.6 * dayFactor * timeFactor + 0.4 * dataNorm) * (1 + jitter));
      if (val > maxVal) maxVal = val;
      targetCells.push({ t: t, d: d, val: val });
    }
  }
  if (maxVal === 0) maxVal = 1;
  var bucketCount = 4;
  for (var ci = 0; ci < targetCells.length; ci++) {
    var c = targetCells[ci];
    var norm = c.val / maxVal;
    c.norm = norm;
    // Smallest values → bucket 0 (animates first), largest → bucket 3 (last).
    c.bucket = Math.min(bucketCount - 1, Math.floor(norm * bucketCount));
    // Diameter range: 6px (smallest) → 24px (largest). Below 0.1 normalized,
    // cell is still given a 5px minimum so the grid never reads as empty.
    c.targetSize = Math.max(5, 6 + norm * 18);
    // Opacity scales with intensity so faint cells stay readable but
    // don't compete with the peaks visually.
    c.targetOpacity = 0.20 + norm * 0.80;
  }

  var availH = Math.max(120, H || 140);
  var domRef = useRef();
  var chartRef = useRef(null);

  useEffect(function() {
    var el = domRef.current;
    if (!el) return;
    var existing = echarts.getInstanceByDom(el);
    if (existing) existing.dispose();
    var chart = echarts.init(el, null, { renderer: 'canvas' });
    chartRef.current = chart;

    var BLUE_R = 51, BLUE_G = 146, BLUE_B = 255; // dataBlue100
    function buildOption(cells) {
      return {
        animation: false, // RAF-driven, no ECharts internal animation
        tooltip: {
          show: !mini, position: 'top',
          appendToBody: true,
          backgroundColor: tokens.colors.ui.tooltipBg, borderColor: 'transparent',
          textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
          formatter: function(p){ return dayLabels[p.data.value[1]] + ' ' + hourLabels[p.data.value[0]] + ': ' + fV(Math.round(p.data._val), fmt); },
        },
        // grid.left tuned so the rightmost edge of the day labels lands at
        // the standard 16px card padding. axisLabel.margin (6) + label
        // width (~18px) = 24, so grid.left ≈ 40 puts label-left at 16.
        grid: { left: mini ? 4 : 40, right: mini ? 4 : 16, top: mini ? 4 : 10, bottom: mini ? 4 : 22, containLabel: false },
        xAxis: {
          type: 'category', data: hourLabels,
          splitArea: { show: false }, axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { show: !mini, fontSize: 10, color: 'rgba(0,0,0,0.6)', fontFamily: 'inherit', margin: 6 },
        },
        yAxis: {
          type: 'category', data: dayLabels,
          splitArea: { show: false }, axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { show: !mini, fontSize: 10, fontWeight: 500, color: 'rgba(0,0,0,0.6)', fontFamily: 'inherit', margin: 6 },
          inverse: true,
        },
        series: [{
          type: 'scatter',
          symbol: 'circle',
          data: cells,
          // emphasis: subtle ring on hover, no extra borders elsewhere.
          emphasis: { scale: false, itemStyle: { shadowBlur: 6, shadowColor: 'rgba(51,146,255,0.45)' } },
          z: 2,
        }],
      };
    }

    function frameCells(progressByBucket) {
      return targetCells.map(function(c){
        var p = progressByBucket[c.bucket];
        var size = c.targetSize * p;
        var opacity = c.targetOpacity * p;
        return {
          value: [c.t, c.d],
          _val: c.val,
          symbolSize: size,
          itemStyle: { color: 'rgba(' + BLUE_R + ',' + BLUE_G + ',' + BLUE_B + ',' + opacity.toFixed(3) + ')' },
        };
      });
    }

    // Render initial state — every cell at zero size / zero opacity.
    chart.setOption(buildOption(frameCells([0, 0, 0, 0])), { notMerge: true });

    var bucketDelay = 130;        // ms between bucket starts (slightly tighter)
    var perCellDur = 380;          // each bucket's growth duration
    var totalDur = (bucketCount - 1) * bucketDelay + perCellDur;
    var start = null;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    var rafId = null;
    function frame(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var progressByBucket = [];
      for (var b = 0; b < bucketCount; b++) {
        var bStart = b * bucketDelay;
        var bElapsed = Math.max(0, Math.min(perCellDur, elapsed - bStart));
        progressByBucket.push(easeOut(bElapsed / perCellDur));
      }
      if (chartRef.current) {
        chartRef.current.setOption(buildOption(frameCells(progressByBucket)), { notMerge: false });
      }
      if (elapsed < totalDur) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    var obs = new ResizeObserver(function(){ if (chartRef.current) chartRef.current.resize(); });
    obs.observe(el);
    return function() {
      if (rafId) cancelAnimationFrame(rafId);
      obs.disconnect();
      if (chartRef.current) { chartRef.current.dispose(); chartRef.current = null; }
    };
  }, [animTick]);

  return ce('div', { ref: domRef, style: { width: '100%', height: availH } });
}

// Waterfall — start total → series of +/- deltas → end total. Each column
// is rendered via a transparent "placeholder" stack underneath a visible
// "value" stack so the visible bar sits at the right vertical position.
// Animation: bars grow bottom-up with a left-to-right stagger so the
// running total builds step by step.
function WaterfallChart({ data, fmt, animTick, W, H, mini, showOptionalAxis }) {
  // Compose a deterministic 5-step waterfall: start MRR + new + expansion
  // − churn = end MRR. Each component is pulled from a different SLICE
  // of the data array (first value as start, ~30/60/85% slices as the
  // deltas) so different periods produce visibly different bar heights
  // — the array length and value distribution shift between "Last 7
  // days", "Last 30 days", etc. End total closes by construction:
  // start + new + expansion + churn = end.
  var len = data.length || 1;
  var startVal = Math.round(data[0] || 1000);
  // Sample bar magnitudes from different windows of the period so each
  // period range produces a distinct shape. Coefficients keep the
  // typical "new ~30%, expansion ~20%, churn ~22%" SaaS narrative.
  var newSrc       = Math.round((data[Math.floor(len * 0.30)] || startVal) * 0.30);
  var expansionSrc = Math.round((data[Math.floor(len * 0.60)] || startVal) * 0.20);
  var churnSrc     = Math.round((data[Math.floor(len * 0.85)] || startVal) * 0.22);
  var newVal = newSrc;
  var expansionVal = expansionSrc;
  var churnVal = -churnSrc;
  var endVal = startVal + newVal + expansionVal + churnVal;

  var labels = ['Start', '+ New', '+ Expand', '− Churn', 'End'];
  var rawValues = [startVal, newVal, expansionVal, churnVal, endVal];

  var BLUE = tokens.colors.chart.dataBlue100;
  var GREEN = tokens.colors.chart.dataGreen100;
  var RED = tokens.colors.chart.dataRed100;

  // Compute the y-position offset (placeholder) and bar magnitude for each
  // column. Totals (Start, End) sit on the x-axis baseline; deltas float
  // at their running-total position.
  var placeholder = [];
  var values = [];
  var colors = [];
  var running = 0;
  for (var i = 0; i < rawValues.length; i++) {
    var v = rawValues[i];
    if (i === 0) {
      // Start total
      placeholder.push(0);
      values.push(v);
      colors.push(BLUE);
      running = v;
    } else if (i === rawValues.length - 1) {
      // End total
      placeholder.push(0);
      values.push(v);
      colors.push(BLUE);
    } else if (v >= 0) {
      placeholder.push(running);
      values.push(v);
      colors.push(GREEN);
      running += v;
    } else {
      // Negative delta: bar sits below the running total
      running += v;
      placeholder.push(running);
      values.push(-v);
      colors.push(RED);
    }
  }

  var availH = Math.max(120, H || 140);
  var domRef = useRef();
  var chartRef = useRef(null);
  var pL = mini ? 4 : 16, pR = mini ? 4 : 16;

  // Y-axis peak for Waterfall is the highest TOP edge reached by any bar
  // (= max of placeholder + value across the sequence). This isn't the
  // same as max(rawValues) — for a typical waterfall the start total
  // plus all positive deltas accumulate before the negative delta drags
  // running back down, so the peak lives in the middle of the chart, not
  // at the start/end columns.
  var wfPeak = 0;
  for (var wpi = 0; wpi < values.length; wpi++) {
    var top = placeholder[wpi] + values[wpi];
    if (top > wfPeak) wfPeak = top;
  }
  var wfRange = niceAxisRange(wfPeak);
  var wfYChars = yAxisCharLimit(W || 320);
  var wfYOffset = yAxisReservedWidth(wfRange.max, fmt, wfYChars, showOptionalAxis);
  var wfEffectivePL = pL + wfYOffset;

  useEffect(function() {
    var el = domRef.current;
    if (!el) return;
    var existing = echarts.getInstanceByDom(el);
    if (existing) existing.dispose();
    var chart = echarts.init(el, null, { renderer: 'canvas' });
    chartRef.current = chart;

    function buildOption(animatedPlaceholders, animatedValues) {
      return {
        animation: false, // RAF-driven, no ECharts internal animation
        grid: { left: wfEffectivePL, right: pR, top: 8, bottom: 24, containLabel: false },
        xAxis: {
          type: 'category', data: labels,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { show: !mini, fontSize: 10, fontWeight: 500, color: 'rgba(0,0,0,0.6)', fontFamily: 'inherit', margin: 8, interval: 0 },
        },
        yAxis: buildYAxisOpt(showOptionalAxis, fmt, wfYChars, { min: 0, max: wfRange.max, interval: wfRange.interval }),
        tooltip: {
          show: !mini, trigger: 'axis', axisPointer: { type: 'none' },
          appendToBody: true,
          backgroundColor: tokens.colors.ui.tooltipBg, borderColor: 'transparent',
          textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
          formatter: function(params){
            var idx = params[0].dataIndex;
            var raw = rawValues[idx];
            var label = labels[idx];
            var sign = raw > 0 && idx !== 0 && idx !== rawValues.length - 1 ? '+' : '';
            return label + ': ' + sign + fV(raw, fmt);
          },
        },
        series: [
          // Transparent placeholder — provides the y-offset for each column.
          {
            type: 'bar', name: 'placeholder',
            stack: 'wf',
            data: animatedPlaceholders,
            itemStyle: { color: 'transparent', borderColor: 'transparent' },
            emphasis: { itemStyle: { color: 'transparent' } },
            silent: true,
          },
          // Visible value bars.
          {
            type: 'bar', name: 'value',
            stack: 'wf',
            barMaxWidth: 40,
            data: animatedValues.map(function(v, i){ return { value: v, itemStyle: { color: colors[i], borderRadius: 2 } }; }),
          },
        ],
      };
    }

    // Initial: each bar's TOP edge is anchored at its target_total
    // (placeholder + value = target_total), value = 0. This positions
    // each bar's top exactly where it will end up; the bottom then "falls"
    // downward as the value grows.
    var initialPlaceholders = placeholder.map(function(ph, i){ return ph + values[i]; });
    var initialValues = values.map(function(){ return 0; });
    chart.setOption(buildOption(initialPlaceholders, initialValues), { notMerge: true });

    var perBarDelay = 130;
    var perBarDur = 520;
    var totalDur = (values.length - 1) * perBarDelay + perBarDur;
    var start = null;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    var rafId = null;
    function frame(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var pls = [], vls = [];
      for (var i = 0; i < values.length; i++) {
        var barStart = i * perBarDelay;
        var segE = Math.max(0, Math.min(perBarDur, elapsed - barStart));
        var p = easeOut(segE / perBarDur);
        var av = values[i] * p;
        // Keep stack TOP fixed at target_total — bar bottom falls
        // downward from top edge as value grows.
        var ap = placeholder[i] + (values[i] - av);
        pls.push(ap);
        vls.push(av);
      }
      if (chartRef.current) {
        chartRef.current.setOption(buildOption(pls, vls), { notMerge: false });
      }
      if (elapsed < totalDur) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    var obs = new ResizeObserver(function(){ if (chartRef.current) chartRef.current.resize(); });
    obs.observe(el);
    return function() {
      if (rafId) cancelAnimationFrame(rafId);
      obs.disconnect();
      if (chartRef.current) { chartRef.current.dispose(); chartRef.current = null; }
    };
  }, [animTick]);

  return ce('div', { ref: domRef, style: { width: '100%', height: availH } });
}

// Treemap — hierarchical box decomposition rendered through ECharts'
// native treemap series. Squarified layout makes tile areas proportional
// to values; bucket colors follow SERIES_COLORS + dataNavy100, children
// inherit the bucket hue at stepped opacity (1.00 → 0.78 → 0.56), 2px
// rounded corners, 1px white seams between siblings, built-in tooltip
// with appendToBody for free.
//
// Animation: ECharts' built-in scale+fade entry is disabled. Instead we
// drive setOption frames via RAF — each leaf's color + label color are
// baked as rgba() at the current progress alpha. Tile geometry stays
// fixed (squarified is computed once) so only opacity ramps. Per-leaf
// stagger is ordered by value descending so the largest tiles arrive
// first and detail fills in last — matches the Scatter cascade pattern.
function TreemapChart({ data, fmt, animTick, W, H, mini }) {
  // Same data synthesis as TreemapChart — kept duplicated rather than
  // factored out so each version can evolve independently if the
  // engines need divergent tuning.
  var total = data[data.length - 1] || 1000;
  var baselineShares = [0.36, 0.24, 0.20, 0.14, 0.06];
  var len = data.length;
  var dataChunks = [0, 0, 0, 0, 0];
  if (len > 0) {
    for (var di = 0; di < len; di++) {
      var bucketIdx = Math.min(4, Math.floor(di * 5 / len));
      dataChunks[bucketIdx] += (data[di] || 0);
    }
  }
  var dataChunksSorted = dataChunks.slice().sort(function(a, b){ return b - a; });
  var chunkTotal = dataChunksSorted.reduce(function(a, b){ return a + b; }, 0) || 1;
  var dataShares = dataChunksSorted.map(function(c){ return c / chunkTotal; });
  var blended = baselineShares.map(function(b, i){ return 0.6 * b + 0.4 * dataShares[i]; });
  var blendTotal = blended.reduce(function(a, b){ return a + b; }, 0);
  var shares = blended.map(function(s){ return s / blendTotal; });

  function childWeights(bucketIdx, baseWeights) {
    if (len === 0) return baseWeights;
    var seed = (dataChunks[bucketIdx] % 100) / 100;
    var perturbed = baseWeights.map(function(w, ci){
      return w * (0.85 + Math.sin(seed * 7 + ci * 1.3) * 0.30);
    });
    var t = perturbed.reduce(function(a, b){ return a + b; }, 0) || 1;
    return perturbed.map(function(w){ return w / t; });
  }

  var groups = [
    { name: 'Products',      share: shares[0], color: SERIES_COLORS[0],
      childNames: ['Premium', 'Standard', 'Basic'], childW: childWeights(0, [0.55, 0.30, 0.15]) },
    { name: 'Services',      share: shares[1], color: SERIES_COLORS[1],
      childNames: ['Install', 'Maintenance'], childW: childWeights(1, [0.60, 0.40]) },
    { name: 'Subscriptions', share: shares[2], color: SERIES_COLORS[2],
      childNames: ['Annual', 'Monthly'], childW: childWeights(2, [0.65, 0.35]) },
    { name: 'Add-ons',       share: shares[3], color: SERIES_COLORS[3],
      childNames: ['Hardware', 'Training'], childW: childWeights(3, [0.55, 0.45]) },
    { name: 'One-time',      share: shares[4], color: tokens.colors.chart.dataNavy100,
      childNames: ['Setup'], childW: [1.0] },
  ];

  var availH = Math.max(120, H || 140);

  // Flat leaf metadata for the RAF cascade. Each leaf knows which group
  // (parent) and child index it belongs to (used to look up the shade in
  // SHADE_LADDER), plus its value — the value drives the reveal-order
  // ranking below.
  var leaves = [];
  for (var gi = 0; gi < groups.length; gi++) {
    var g = groups[gi];
    var bucketTotal = Math.round(total * g.share);
    for (var ci = 0; ci < g.childNames.length; ci++) {
      leaves.push({
        groupIdx: gi,
        childIdx: ci,
        value: Math.max(1, Math.round(bucketTotal * g.childW[ci])),
      });
    }
  }

  // Reveal order: largest tiles first, smallest last. ECharts squarified
  // makes tile area proportional to value, so sorting by value descending
  // gives the same visual effect as sorting by rendered area. revealSlot[i]
  // is the cascade position (0 = first to fade in) for the i-th leaf in
  // the data array. The RAF loop uses this instead of the raw data index
  // so the dominant structure lands first and detail fills in last —
  // mirrors the cascade in the custom SVG TreemapChart.
  var revealOrder = leaves.map(function(l, i){ return { i: i, v: l.value }; })
                          .sort(function(a, b){ return b.v - a.v; });
  var revealSlot = new Array(leaves.length);
  for (var ri = 0; ri < revealOrder.length; ri++) revealSlot[revealOrder[ri].i] = ri;

  var domRef = useRef();
  var chartRef = useRef(null);

  useEffect(function() {
    var el = domRef.current;
    if (!el) return;
    var existing = echarts.getInstanceByDom(el);
    if (existing) existing.dispose();
    var chart = echarts.init(el, null, { renderer: 'canvas' });
    chartRef.current = chart;

    function buildOption(progressByLeaf) {
      // Rebuild the tree data with each leaf's color + label baked at
      // the current alpha. Tile VALUES stay constant across frames so
      // ECharts' squarified layout is computed once and doesn't reflow.
      var treeData = [];
      var leafCursor = 0;
      for (var gi2 = 0; gi2 < groups.length; gi2++) {
        var g2 = groups[gi2];
        var bucketTotal = Math.round(total * g2.share);
        var children = [];
        // Per-parent shade ladder for child tiles: index 0 = parent's
        // base 100 shade, index 1 = 200, index 2 = 300. Replaces the
        // prior opacity-stepping approach so children render as solid
        // colors with proper contrast at the steady state. Fallback to
        // the parent color if the ladder doesn't recognize it (defensive).
        var parentShades = SHADE_LADDER[g2.color] || [g2.color];
        for (var ci2 = 0; ci2 < g2.childNames.length; ci2++) {
          var leafIdx = leafCursor;
          var leaf = leaves[leafIdx];
          leafCursor++;
          var prog = progressByLeaf[leafIdx];
          // Child color = ci2-th shade in the ladder (clamped). RAF
          // entry animation rides on opacity only — at progress 1.0 the
          // child paints at the solid stepped shade with no opacity.
          var childShade = parentShades[Math.min(ci2, parentShades.length - 1)];
          children.push({
            name: g2.childNames[ci2],
            value: Math.max(1, Math.round(bucketTotal * g2.childW[ci2])),
            itemStyle: {
              // RAF animation: alpha = prog (0→1). Color = solid stepped
              // shade. When animation completes, alpha=1 → fully solid
              // color with no opacity differentiation between siblings;
              // the hue ladder carries the hierarchy.
              color: colorWithAlpha(childShade, prog),
              borderRadius: 2,
            },
            label: { color: 'rgba(255,255,255,' + prog.toFixed(3) + ')' },
          });
        }
        treeData.push({
          name: g2.name,
          value: bucketTotal,
          itemStyle: { color: g2.color, borderRadius: 2 },
          children: children,
        });
      }

      return {
        animation: false,              // RAF drives the entry; native off
        tooltip: {
          show: !mini,
          appendToBody: true,
          backgroundColor: tokens.colors.ui.tooltipBg,
          borderColor: 'transparent',
          textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
          formatter: function(info){
            var path = info.treePathInfo || [];
            if (path.length < 3) return '';
            var bucketName = path[1].name;
            var leafName = info.name;
            var leafVal = info.value;
            var pct = total > 0 ? Math.round((leafVal / total) * 100) : 0;
            return '<div style="line-height:1.5">' + bucketName + ' · ' + leafName + '</div>'
                 + '<div style="line-height:1.5;font-weight:500;color:rgba(255,255,255,0.65)">' + fV(leafVal, fmt) + ' (' + pct + '%)</div>';
          },
        },
        series: [{
          type: 'treemap',
          left: mini ? 0 : 16,
          right: mini ? 0 : 16,
          top: 0,
          bottom: 0,
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          data: treeData,
          label: {
            show: !mini,
            position: 'insideTopLeft',
            color: tokens.colors.text.inverse,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: tokens.typography.fontFamily.sans,
            overflow: 'truncate',
          },
          upperLabel: { show: false },
          itemStyle: { borderColor: tokens.colors.text.inverse, borderWidth: 2, gapWidth: 2, borderRadius: 2 },
          levels: [
            { itemStyle: { borderColor: tokens.colors.text.inverse, borderWidth: 0, gapWidth: 3, borderRadius: 2 } },
            { itemStyle: { borderColor: tokens.colors.text.inverse, borderWidth: 0, gapWidth: 2, borderRadius: 2 } },
            { itemStyle: { borderColor: tokens.colors.text.inverse, borderWidth: 1, gapWidth: 1, borderRadius: 2 } },
          ],
        }],
      };
    }

    // Initial frame: every leaf at progress 0 (invisible). The squarified
    // layout still computes here so subsequent frames just swap colors.
    var zeros = leaves.map(function(){ return 0; });
    chart.setOption(buildOption(zeros), { notMerge: true });

    // Cascade timing — matches the Scatter pattern (per-element stagger
    // + cubicOut easing). 70ms between leaves, 360ms per leaf fade →
    // total ~1.0s for 10 leaves. Each leaf's start delay is driven by
    // revealSlot[i] (sorted by value descending), so the largest tiles
    // animate first and the smallest fill in last.
    var perLeafDelay = 70;
    var perLeafDur = 360;
    var totalDur = (leaves.length - 1) * perLeafDelay + perLeafDur;
    var start = null;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    var rafId = null;
    function frame(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var progressArr = [];
      for (var i = 0; i < leaves.length; i++) {
        var pStart = revealSlot[i] * perLeafDelay;
        var pElapsed = Math.max(0, Math.min(perLeafDur, elapsed - pStart));
        progressArr.push(easeOut(pElapsed / perLeafDur));
      }
      if (chartRef.current) {
        chartRef.current.setOption(buildOption(progressArr), { notMerge: false });
      }
      if (elapsed < totalDur) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    var obs = new ResizeObserver(function(){ if (chartRef.current) chartRef.current.resize(); });
    obs.observe(el);
    return function() {
      if (rafId) cancelAnimationFrame(rafId);
      obs.disconnect();
      if (chartRef.current) { chartRef.current.dispose(); chartRef.current = null; }
    };
  }, [animTick]);

  return ce('div', { ref: domRef, style: { width: '100%', height: availH } });
}

// Scatter — paired-metric distribution on a 0-100 × 0-100 plane. Standard
// variant uses dataBlue100 for every point; grouped variant splits points
// into clusters, each in SERIES_COLORS, with centers spread across the
// plot so the groups read as distinct populations.
//
// Animation: matches HeatmapChart's RAF-driven reveal. Every point starts
// at symbolSize 0 with opacity 0 and scales to its target size + opacity.
// Per-point delay (staggered by index) produces a controlled cascade —
// ECharts' native scatter entry animation isn't reliably scale-from-zero,
// so we drive it manually via setOption frames the same way HeatmapChart
// drives its circle reveal.
function ScatterChart({ data, fmt, animTick, W, H, mini, segments }) {
  // Synthesize 30 points. Each point's group index drives its cluster
  // center and color; positions are derived from the actual data array
  // (whose length and values vary with the period pill) so different
  // periods produce visibly different distributions. sin/cos jitter
  // keeps the cloud looking organic; no random noise (would re-roll
  // on every render).
  var pointCount = 30;
  var groupCount = Math.max(1, Math.min(4, segments || 1));
  var dataLen = (data && data.length) || 1;
  var dataPeak = data ? data.reduce(function(m, v){ return v > m ? v : m; }, 1) : 1;
  var dataAvg = data ? (data.reduce(function(a, v){ return a + v; }, 0) / dataLen) : 0;
  // Stable 0-1 seed unique to each period (different periods have
  // different data lengths and value totals → different seed).
  var periodSeed = ((dataLen * 13 + Math.round(dataAvg)) % 100) / 100;
  var points = [];
  for (var i = 0; i < pointCount; i++) {
    var g = i % groupCount;
    var centerX = groupCount === 1 ? 50 : (18 + (g / Math.max(1, groupCount - 1)) * 64);
    var centerY = groupCount === 1 ? 50 : (28 + ((groupCount - 1 - g) / Math.max(1, groupCount - 1)) * 48);
    // Pull a data value for this point; map 30 points across the data
    // array so all values contribute. dataNorm is 0-1 relative to peak.
    var dataIdx = Math.floor(i * dataLen / pointCount) % dataLen;
    var dataNorm = data ? (data[dataIdx] / Math.max(1, dataPeak)) : 0.5;
    // Seed combines index + group + period-specific data — different
    // periods produce different sin/cos phase shifts → different clouds.
    var seed = i * 7 + g * 13 + dataNorm * 11 + periodSeed * 17;
    // Single-group spread is wider so the cloud fills the plot — without
    // a group split, points centered around the middle would read as
    // visually tight. Grouped variant keeps tighter clusters so the
    // groups stay visually distinct.
    var spreadX = groupCount === 1 ? 22 : 11;
    var spreadY = groupCount === 1 ? 20 : 9;
    var dx = Math.sin(seed * 0.7) * spreadX + Math.cos(seed * 1.3) * (spreadX * 0.55);
    var dy = Math.cos(seed * 0.5) * spreadY + Math.sin(seed * 1.1) * (spreadY * 0.55);
    // Add a slight positive correlation to single-group data so the cloud
    // suggests a trend rather than reading as noise — typical of paired-
    // metric scatter (e.g. spend vs leads). Strength varies with period.
    if (groupCount === 1) {
      var corrScale = 22 + periodSeed * 14;     // 22-36 px range
      var corr = (i / pointCount - 0.5) * corrScale;
      dx += corr; dy += corr * 0.9;
    }
    var px = Math.max(4, Math.min(96, centerX + dx));
    var py = Math.max(4, Math.min(96, centerY + dy));
    points.push({ g: g, x: px, y: py, _idx: i, targetSize: 10, targetOpacity: 0.78 });
  }

  var availH = Math.max(120, H || 140);
  // Asymmetric padding driven by ECharts' axis-label overhang behavior.
  // containLabel: true (set on grid below) keeps y-axis labels' left edges
  // and x-axis labels' bottom edges inside the grid box — but it does NOT
  // handle x-axis label horizontal overhang at the leftmost/rightmost
  // ticks. The "100" x-axis label is centered on the rightmost tick and
  // extends ~10px past the plot's right edge; pR=28 (16px target card-
  // edge inset + ~12px half-label-width) ensures the label's right edge
  // lands at the standard 16px card inset, matching every other chart in
  // the family. pL=16 because the y-axis labels (handled by containLabel)
  // already provide left-side breathing room.
  var pL = mini ? 4 : 16;
  var pR = mini ? 4 : 28;
  var pT = mini ? 4 : 8;
  var pB = mini ? 4 : 6;

  var domRef = useRef();
  var chartRef = useRef(null);

  useEffect(function() {
    var el = domRef.current;
    if (!el) return;
    var existing = echarts.getInstanceByDom(el);
    if (existing) existing.dispose();
    var chart = echarts.init(el, null, { renderer: 'canvas' });
    chartRef.current = chart;

    function buildOption(progressByIdx) {
      var seriesList = [];
      for (var s = 0; s < groupCount; s++) {
        var ptsForGroup = points.filter(function(p){ return p.g === s; }).map(function(p){
          var prog = progressByIdx[p._idx];
          var size = p.targetSize * prog;
          var opacity = p.targetOpacity * prog;
          var color = groupCount === 1 ? tokens.colors.chart.dataBlue100 : SERIES_COLORS[p.g];
          // Build literal rgba so opacity rides on the same color string —
          // ECharts canvas doesn't blend a separate itemStyle.opacity with
          // partial-progress values as reliably as a baked alpha.
          var rgba = colorWithAlpha(color, opacity);
          return {
            value: [p.x, p.y],
            symbolSize: size,
            itemStyle: { color: rgba, borderColor: 'transparent', borderWidth: 0 },
          };
        });
        seriesList.push({
          type: 'scatter',
          name: groupCount === 1 ? 'Items' : 'Group ' + (s + 1),
          data: ptsForGroup,
          symbol: 'circle',
          emphasis: { scale: 1.4, itemStyle: { borderWidth: 0 } },
          z: 2,
        });
      }
      return {
        animation: false, // RAF-driven, no ECharts internal animation
        grid: { left: pL, right: pR, top: pT, bottom: pB, containLabel: true },
        xAxis: {
          type: 'value', min: 0, max: 100,
          axisLine: { show: !mini, lineStyle: { color: 'rgba(0,0,0,0.12)' } },
          axisTick: { show: false },
          splitLine: { show: !mini, lineStyle: { color: 'rgba(0,0,0,0.06)' } },
          axisLabel: { show: !mini, fontSize: 10, color: 'rgba(0,0,0,0.6)', fontFamily: 'inherit' },
        },
        yAxis: {
          type: 'value', min: 0, max: 100,
          axisLine: { show: !mini, lineStyle: { color: 'rgba(0,0,0,0.12)' } },
          axisTick: { show: false },
          splitLine: { show: !mini, lineStyle: { color: 'rgba(0,0,0,0.06)' } },
          axisLabel: { show: !mini, fontSize: 10, color: 'rgba(0,0,0,0.6)', fontFamily: 'inherit' },
        },
        tooltip: {
          show: !mini,
          trigger: 'item',
          appendToBody: true,
          backgroundColor: tokens.colors.ui.tooltipBg, borderColor: 'transparent',
          textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
          formatter: function(p){
            var label = groupCount === 1 ? 'Item' : p.seriesName;
            return label + '<br/>x: ' + Math.round(p.value[0]) + ', y: ' + Math.round(p.value[1]);
          },
        },
        series: seriesList,
      };
    }

    // Initial: every point at size 0, opacity 0 → invisible. The plot
    // chrome (axes, gridlines) appears immediately; points reveal across
    // the RAF loop below.
    var zeros = points.map(function(){ return 0; });
    chart.setOption(buildOption(zeros), { notMerge: true });

    // Cascade timing: each point starts perPointDelay ms after the prior
    // and animates over perPointDur ms. Matches the heatmap's per-bucket
    // pacing but at per-point granularity (30 points → tighter delay).
    // Total reveal ~780ms (vs heatmap's ~770ms) — keeps the family rhythm.
    var perPointDelay = 16;
    var perPointDur = 320;
    var totalDur = (pointCount - 1) * perPointDelay + perPointDur;
    var start = null;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    var rafId = null;
    function frame(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var progressArr = [];
      for (var i = 0; i < pointCount; i++) {
        var pStart = i * perPointDelay;
        var pElapsed = Math.max(0, Math.min(perPointDur, elapsed - pStart));
        progressArr.push(easeOut(pElapsed / perPointDur));
      }
      if (chartRef.current) {
        chartRef.current.setOption(buildOption(progressArr), { notMerge: false });
      }
      if (elapsed < totalDur) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    var obs = new ResizeObserver(function(){ if (chartRef.current) chartRef.current.resize(); });
    obs.observe(el);
    return function() {
      if (rafId) cancelAnimationFrame(rafId);
      obs.disconnect();
      if (chartRef.current) { chartRef.current.dispose(); chartRef.current = null; }
    };
  }, [animTick, groupCount]);

  return ce('div', { ref: domRef, style: { width: '100%', height: availH } });
}

// Pure helper: convert a hex color like "#3392FF" to an rgba() string at
// the given alpha. Used by RAF-driven charts (scatter, treemap) to bake
// the opacity into the color since canvas-rendered series in ECharts
// sometimes ignore a separate itemStyle.opacity during rapid updates.
function colorWithAlpha(hex, alpha) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var r = parseInt(h.substring(0, 2), 16);
  var g = parseInt(h.substring(2, 4), 16);
  var b = parseInt(h.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(1, alpha)).toFixed(3) + ')';
}

// Tooltip chip HTML — generates the small color swatch that precedes each
// tooltip row's value. Three shapes:
//   shape='square' (default) — 8x8 rounded rect, used for bar-family charts
//   shape='line'             — 13x2 solid horizontal line, used for line/area
//   shape='line' + dashed    — 13x2 line with three visible dashes, matches
//                              the legend's dashed prior-period chip
//                              (strokeDasharray "3 2"). Dashes are drawn via
//                              a tiled linear-gradient so the chip renders
//                              correctly inside ECharts' HTML tooltip
//                              without needing an inline SVG.
function tooltipChipHtml(color, shape, dashed) {
  if (shape === 'line') {
    if (dashed) {
      // Pattern: 3px solid + 2px transparent, tiled across 13px width →
      // exactly three dashes visible (3+2+3+2+3 = 13). Matches the legend.
      return '<span style="display:inline-block;width:13px;height:2px;background-image:linear-gradient(to right,' + color + ' 0,' + color + ' 3px,transparent 3px,transparent 5px);background-size:5px 2px;background-repeat:repeat-x;"></span>';
    }
    return '<span style="display:inline-block;width:13px;height:2px;background:' + color + ';"></span>';
  }
  return '<span style="display:inline-block;width:8px;height:8px;background:' + color + ';border-radius:1px"></span>';
}

// Calendar — 5-week month grid (35 day cells). Each cell shades to a
// blue intensity proportional to that day's value; the calendar reads
// like a heatmap on a familiar month layout. Animation: cells reveal in
// chronological cascade — earliest day appears first, latest day last —
// so the eye reads the period from start to end.
function CalendarChart({ data, dates, fmt, animTick, W, H, mini }) {
  // Build the grid: 5 weeks (35 days), ending on the Sunday of the week
  // containing the latest date. Cells before the data range render at
  // zero intensity (faint placeholder) so the grid never has visual gaps.
  var lastDate = (dates && dates.length > 0) ? new Date(dates[dates.length - 1]) : new Date();
  var dayOfWeek = lastDate.getDay();          // 0 = Sun .. 6 = Sat
  var mondayOffset = (dayOfWeek + 6) % 7;     // days since Monday
  var endOfWeek = new Date(lastDate); endOfWeek.setDate(endOfWeek.getDate() + (6 - mondayOffset));
  var startOfGrid = new Date(endOfWeek); startOfGrid.setDate(startOfGrid.getDate() - 34);

  var cells = [];
  for (var i = 0; i < 35; i++) {
    var d = new Date(startOfGrid); d.setDate(d.getDate() + i);
    var val = 0;
    if (dates && dates.length) {
      for (var di = 0; di < dates.length; di++) {
        var dd = dates[di];
        if (dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() && dd.getDate() === d.getDate()) {
          val = data[di] || 0;
          break;
        }
      }
    }
    cells.push({ date: d, val: val, idx: i });
  }

  var maxVal = cells.reduce(function(m, c){ return c.val > m ? c.val : m; }, 0) || 1;

  // Single shared progress drives the chronological cascade. Each cell
  // owns a slice of the [0,1] progress window — earlier cells start
  // (and finish) sooner than later cells.
  var [prog, setProg] = useState(0);
  var afRef = useRef();
  useEffect(function(){
    setProg(0);
    var start = null, totalDur = 900;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    function frame(ts){
      if (!start) start = ts;
      var p = Math.min((ts - start) / totalDur, 1);
      setProg(easeOut(p));
      if (p < 1) afRef.current = requestAnimationFrame(frame);
    }
    afRef.current = requestAnimationFrame(frame);
    return function(){ if (afRef.current) cancelAnimationFrame(afRef.current); };
  }, [animTick]);

  // Per-cell opacity: 0 until the cell's reveal point, then ramps to its
  // target intensity over a window of ~4 cell-widths of overall progress.
  function cellOpacity(c) {
    var revealPoint = c.idx / 38; // earlier cells finish before global progress = 1
    if (prog < revealPoint) return 0;
    var localDur = 0.18;
    var localP = Math.min(1, (prog - revealPoint) / localDur);
    var intensity = c.val / maxVal;
    return localP * (0.18 + intensity * 0.82);
  }

  var availH = Math.max(120, H || 140);
  var dayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Tooltip state — always render the tooltip so CSS transitions can
  // fade it in/out and glide its position between cells (matches the
  // ECharts tooltip easing the rest of the family uses). visible drives
  // opacity; idx/x/y are LAST-KNOWN values so the fade-out renders the
  // last-shown content from its final position.
  var [calTip, setCalTip] = useState({ visible: false, idx: 0, x: 0, y: 0 });
  // Same first-show suppression as TreemapChart — without this, the
  // tooltip flies in from (0,0) on initial hover because the transform
  // transition is active before the first position is set.
  var [calSettled, setCalSettled] = useState(false);
  useEffect(function() {
    if (!calTip.visible) { setCalSettled(false); return; }
    var raf = requestAnimationFrame(function(){ setCalSettled(true); });
    return function(){ cancelAnimationFrame(raf); };
  }, [calTip.visible]);
  var dateFmt = { weekday: 'short', month: 'short', day: 'numeric' };

  // Layout strategy: outer column flex centers the grid block within
  // availH; the grid itself sizes rows to FILL remaining space (not to
  // each cell's width), so 5 rows always fit even when the card is short.
  // Cells end up slightly wider than tall — acceptable for a calendar
  // read where day labels are the anchor, not perfect squareness.
  return ce('div', { style: { width: '100%', height: availH, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 16px 6px', boxSizing: 'border-box', minHeight: 0 } },
    !mini && ce('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', columnGap: 4, marginBottom: 4, flexShrink: 0 } },
      dayHeaders.map(function(d, i){
        return ce('div', { key: i, style: { fontSize: 10, fontWeight: tokens.typography.fontWeight.semibold, color: 'rgba(0,0,0,0.5)', textAlign: 'center', letterSpacing: '0.04em' } }, d);
      })
    ),
    ce('div', { style: { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(5, minmax(0, 1fr))', columnGap: 4, rowGap: 4 } },
      cells.map(function(c, i){
        var op = cellOpacity(c);
        var label = c.date.getDate();
        function onMove(e) { setCalTip({ visible: true, idx: i, x: e.clientX, y: e.clientY }); }
        function onLeave() { setCalTip(function(t){ return t.idx === i ? Object.assign({}, t, { visible: false }) : t; }); }
        return ce('div', { key: i,
          onMouseMove: !mini ? onMove : undefined,
          onMouseEnter: !mini ? onMove : undefined,
          onMouseLeave: !mini ? onLeave : undefined,
          style: {
            background: 'rgba(51, 146, 255, ' + op.toFixed(3) + ')',
            borderRadius: tokens.borderRadius.sm,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: '0 5px 3px',
            fontSize: 10,
            color: op > 0.5 ? tokens.colors.text.inverse : 'rgba(0,0,0,0.50)',
            fontWeight: tokens.typography.fontWeight.semibold,
            fontFamily: tokens.typography.fontFamily.sans,
            boxSizing: 'border-box',
            minWidth: 0, minHeight: 0,
            transition: 'color 0.2s ease',
            cursor: 'default',
          } }, label);
      })
    ),
    !mini && (function(){
      var c = cells[calTip.idx];
      // Same fade + smooth-move pattern as Treemap: tooltip stays mounted
      // and CSS transitions on opacity (0.18s) + transform (0.25s) carry
      // the ease. translate3d engages GPU compositing for smoother motion
      // than animating top/left.
      var transform = 'translate3d(' + (calTip.x + 12) + 'px, ' + (calTip.y - 36) + 'px, 0)';
      return ce('div', {
        style: {
          position: 'fixed',
          left: 0, top: 0,
          transform: transform,
          opacity: calTip.visible ? 1 : 0,
          // Transform transition kicks in one RAF after the tooltip
          // becomes visible (see calSettled effect above) — so the first
          // appearance teleports under opacity 0 then fades in, instead
          // of flying across from the last position.
          transition: calSettled
            ? 'opacity 0.18s ease, transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : 'opacity 0.18s ease',
          background: tokens.colors.ui.tooltipBg,
          color: tokens.colors.ui.whiteSurface,
          fontSize: 10, fontWeight: tokens.typography.fontWeight.bold,
          fontFamily: tokens.typography.fontFamily.sans,
          padding: '6px 8px',
          borderRadius: tokens.borderRadius.sm,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 9999,
          lineHeight: 1.5,
        },
      },
        c && ce('div', null, c.date.toLocaleDateString('en-US', dateFmt)),
        c && ce('div', { style: { fontWeight: tokens.typography.fontWeight.medium, color: 'rgba(255,255,255,0.65)' } }, fV(c.val, fmt))
      );
    })()
  );
}

// ECharts-engine funnel — single "Conversion path" variant. Uses
// ECharts' native type:'funnel' for the signature pointed-bottom
// shape. Per-stage colors follow the SERIES_COLORS hierarchy; tooltip
// matches the family chrome (dark bg, white text, appendToBody).
//
// Animation: sequential top-down reveal. Each stage starts at value=0
// (effectively invisible) and animates to its target value, with a
// per-stage delay that's LONGER than the per-stage duration — so
// stage 0 finishes appearing before stage 1 begins. Reads as "one
// segment at a time, top to bottom," matching the customer-journey
// narrative.
function FunnelEchartsChart({ data, fmt, animTick, W, H, mini }) {
  // 4-stage conversion narrative + matching SERIES_COLORS slots.
  var stageNames = ['Show', 'Click', 'Visit', 'Order'];
  var stageColors = [
    SERIES_COLORS[0],   // Show — blue
    SERIES_COLORS[1],   // Click — green
    SERIES_COLORS[2],   // Visit — purple
    SERIES_COLORS[3],   // Order — aqua
  ];

  // Per-stage values: non-uniform stepping (0.90 → 0.70 → 0.30 → 0.10)
  // gives a clear visible "kink" between Click and Visit, so the
  // funnel reads with distinct stages rather than a smooth diagonal.
  var base = data[data.length - 1] || 1000;
  var count = stageNames.length;
  var stageFactors = [0.90, 0.70, 0.30, 0.10];
  var currentValues = stageFactors.map(function(f){ return Math.round(base * f); });
  var topVal = currentValues[0];

  var availH = Math.max(120, H || 140);

  function formatTooltip(p) {
    var pct = topVal > 0 ? Math.round((p.value / topVal) * 100) : 0;
    return '<div style="line-height:1.5">' + p.name + '</div>'
         + '<div style="line-height:1.5;font-weight:500;color:rgba(255,255,255,0.65)">' + fV(p.value, fmt) + ' (' + pct + '% of top)</div>';
  }

  var domRef = useRef();
  var chartRef = useRef(null);

  useEffect(function() {
    var el = domRef.current;
    if (!el) return;
    var existing = echarts.getInstanceByDom(el);
    if (existing) existing.dispose();
    var chart = echarts.init(el, null, { renderer: 'canvas' });
    chartRef.current = chart;

    // Top-down sequential FADE-IN reveal via RAF. Each segment paints
    // at its FINAL value and shape from the start — its tile color is
    // baked as rgba(R,G,B,progress) and its label color as
    // rgba(255,255,255,progress), so the segment goes from fully
    // transparent to fully solid without changing geometry. Avoids
    // the sharp pointed-triangle artifacts that the previous
    // value-grow approach produced (each segment's top edge re-shaped
    // as the value transitioned 0 → V, leaving brief sharp angles).
    //
    //   Per-stage duration: 130ms
    //   Per-stage delay:    130ms (continuous — each stage starts
    //                      exactly as the previous finishes, no gap)
    //   Total for 4 stages: ~520ms (matches the column chart's snappy
    //                              entry-animation feel)
    var perStageDelay = 130;
    var perStageDuration = 130;

    function buildOption(progressArr) {
      return {
        animation: false,    // RAF drives the entry
        tooltip: {
          show: !mini,
          trigger: 'item',
          appendToBody: true,
          backgroundColor: tokens.colors.ui.tooltipBg,
          borderColor: 'transparent',
          textStyle: {
            color: tokens.colors.ui.whiteSurface,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: tokens.typography.fontFamily.sans,
          },
          formatter: formatTooltip,
        },
        series: [{
          type: 'funnel',
          sort: 'descending',
          funnelAlign: 'center',
          left: '10%', width: '80%',
          top: '4%', bottom: '4%',
          min: 0,
          max: topVal,
          minSize: '20%',
          maxSize: '100%',
          gap: 2,
          label: {
            show: !mini,
            position: 'inside',
            // Default white; per-item label color (set below in data)
            // overrides with rgba(progress) so labels fade with tiles.
            color: tokens.colors.text.inverse,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: tokens.typography.fontFamily.sans,
            formatter: function(p){ return p.name; },
          },
          labelLine: { show: false },
          itemStyle: { borderColor: tokens.colors.text.inverse, borderWidth: 1 },
          emphasis: { label: { fontSize: 11, fontWeight: 700 } },
          data: currentValues.map(function(v, i){
            var prog = progressArr[i];
            return {
              name: stageNames[i],
              value: v,                                            // final value always — no growth
              itemStyle: { color: colorWithAlpha(stageColors[i], prog) },
              label: { color: 'rgba(255,255,255,' + prog.toFixed(3) + ')' },
            };
          }),
        }],
      };
    }

    // Initial frame: every stage at progress 0 (fully transparent).
    // Segments still occupy their final positions/sizes so no layout
    // shift occurs during the fade-in.
    var zeros = currentValues.map(function(){ return 0; });
    chart.setOption(buildOption(zeros), { notMerge: true });

    // RAF loop — for each frame, compute per-stage progress (0..1),
    // rebuild the data with those alphas, and setOption.
    var totalDur = (count - 1) * perStageDelay + perStageDuration;
    var start = null;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    var rafId = null;
    function frame(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var progressArr = [];
      for (var i = 0; i < count; i++) {
        var stageStart = i * perStageDelay;
        var localElapsed = Math.max(0, Math.min(perStageDuration, elapsed - stageStart));
        progressArr.push(easeOut(localElapsed / perStageDuration));
      }
      if (chartRef.current) {
        chartRef.current.setOption(buildOption(progressArr), { notMerge: false });
      }
      if (elapsed < totalDur) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    var obs = new ResizeObserver(function(){ if (chartRef.current) chartRef.current.resize(); });
    obs.observe(el);
    return function() {
      if (rafId) cancelAnimationFrame(rafId);
      obs.disconnect();
      if (chartRef.current) { chartRef.current.dispose(); chartRef.current = null; }
    };
  }, [animTick]);

  return ce('div', { ref: domRef, style: { width: '100%', height: availH } });
}

// Custom SVG funnel — ECharts funnel uses polygon shapes which can't have
// rounded corners. We render each segment as an SVG path so the four outer
// corners of the overall funnel (first-segment top-L/R, last-segment
// bottom-L/R) can use 2px arcs. Animation drives each segment's width from
// 0 → target via React state + RAF, with per-segment staggered timing for
// the visible top-down build.
function FunnelChart({ data, fmt, animTick, W, H, segments }) {
  var count = Math.max(3, Math.min(5, segments || 3));
  var stageNames = ['Impressions', 'Clicks', 'Engaged', 'Leads', 'Conversions'];
  var base = data[data.length - 1] || 1000;
  var bottomFrac = 0.20;

  // Target top-edge fraction per segment (uniform-taper formula). The bottom
  // edge of the funnel sits at bottomFrac; each segment narrows by exactly
  // (1 - bottomFrac) / count.
  var targetTopFracs = [];
  for (var i = 0; i < count; i++) {
    targetTopFracs.push(1.0 - (i / count) * (1.0 - bottomFrac));
  }

  // Animation progress per segment (0 = invisible, 1 = full width). Staggered
  // per-segment start times produce the top-down build.
  var [prog, setProg] = useState(function(){ return targetTopFracs.map(function(){ return 0; }); });
  useEffect(function() {
    setProg(targetTopFracs.map(function(){ return 0; }));
    var start = null;
    var perSeg = 160, segDur = 600;
    var totalDur = (count - 1) * perSeg + segDur;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    var rafId = null;
    function frame(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var next = targetTopFracs.map(function(_, i){
        var segStart = i * perSeg;
        var segElapsed = Math.max(0, Math.min(segDur, elapsed - segStart));
        return easeOut(segElapsed / segDur);
      });
      setProg(next);
      if (elapsed < totalDur) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    return function() { if (rafId) cancelAnimationFrame(rafId); };
  }, [count, animTick]);

  // Container size — measured via ResizeObserver so the SVG geometry stays
  // responsive when the card resizes.
  var rootRef = useRef();
  var [size, setSize] = useState({ w: W || 320, h: H || 140 });
  useEffect(function() {
    if (!rootRef.current) return;
    function m() {
      var r = rootRef.current.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    }
    m();
    var obs = new ResizeObserver(m);
    obs.observe(rootRef.current);
    return function() { obs.disconnect(); };
  }, []);

  var availH = Math.max(120, size.h || 140);
  var availW = Math.max(180, size.w || 320);
  var padX = 16, padY = 8;
  var funnelW = Math.max(40, availW - 2 * padX);
  var funnelH = Math.max(60, availH - 2 * padY);
  var segH = funnelH / count;
  var cx = availW / 2;
  var R = 2; // corner radius

  // Build each segment as an SVG path. Outer corners (first-segment top,
  // last-segment bottom) use quadratic Bézier arcs that are TANGENT to
  // both edges meeting at the corner. Crucially, the arc end-point on the
  // slanted edge must lie ON that edge — not 2px straight up/down from
  // the corner — otherwise the slanted line emerges from a slightly
  // wrong point and creates a tiny protrusion outside the natural funnel
  // outline. We compute the inset point along the edge's own direction.
  var paths = targetTopFracs.map(function(topFrac, i) {
    var p = prog[i];
    var nextFrac = (i === count - 1) ? bottomFrac : targetTopFracs[i + 1];
    var nextP = (i === count - 1) ? prog[i] : prog[i + 1];

    var topW = funnelW * topFrac * p;
    var botW = funnelW * nextFrac * nextP;

    var ty = padY + i * segH;
    var by = padY + (i + 1) * segH;
    var tlX = cx - topW / 2, trX = cx + topW / 2;
    var blX = cx - botW / 2, brX = cx + botW / 2;

    var isFirst = (i === 0);
    var isLast = (i === count - 1);

    // Slanted-side geometry — the funnel narrows by (topW-botW)/2 over
    // height segH. Unit components along the right slanted edge going
    // DOWN-LEFT (TR → BR).
    var halfShrink = (topW - botW) / 2;            // positive when narrowing
    var sideLen = Math.sqrt(halfShrink * halfShrink + segH * segH) || 1;
    var rUx = -halfShrink / sideLen;               // right edge going down: negative x
    var rUy = segH / sideLen;                       // right edge going down: positive y
    // Left edge going DOWN-RIGHT (TL → BL): mirror of right.
    var lUx = halfShrink / sideLen;                // positive x (or 0 if not narrowing)
    var lUy = segH / sideLen;                       // positive y

    // Clamp radius so it never exceeds half the smallest edge or half
    // the slanted edge length — keeps the path well-formed.
    var r = Math.min(R, Math.max(0, (topW - 2) / 2), Math.max(0, (botW - 2) / 2), segH / 2, sideLen / 2);

    var d = '';
    if (isFirst && r > 0 && topW > 2 * r) {
      // Start on top edge, 2px right of TL corner (after the TL arc).
      d += 'M' + (tlX + r) + ',' + ty;
      // Top edge to 2px left of TR.
      d += ' L' + (trX - r) + ',' + ty;
      // TR arc: end point lies ON the right slanted edge, r along the edge.
      d += ' Q' + trX + ',' + ty + ' ' + (trX + r * rUx) + ',' + (ty + r * rUy);
    } else {
      d += 'M' + tlX + ',' + ty;
      d += ' L' + trX + ',' + ty;
    }

    if (isLast && r > 0 && botW > 2 * r) {
      // Slanted right edge down to point r BEFORE BR along the edge.
      // BR_in = BR - r × (right-edge-down-unit) = (brX - r×rUx, by - r×rUy).
      d += ' L' + (brX - r * rUx) + ',' + (by - r * rUy);
      // BR arc to (brX - r, by) on the bottom edge.
      d += ' Q' + brX + ',' + by + ' ' + (brX - r) + ',' + by;
      // Bottom edge to (blX + r, by).
      d += ' L' + (blX + r) + ',' + by;
      // BL arc: end point lies ON the left slanted edge, r along the edge
      // going UP. BL_out = BL - r × (left-edge-down-unit) = (blX - r×lUx, by - r×lUy).
      d += ' Q' + blX + ',' + by + ' ' + (blX - r * lUx) + ',' + (by - r * lUy);
    } else {
      d += ' L' + brX + ',' + by;
      d += ' L' + blX + ',' + by;
    }

    if (isFirst && r > 0 && topW > 2 * r) {
      // Up the left slanted edge to point r BEFORE TL along the edge.
      // TL_in = TL + r × (left-edge-down-unit) = (tlX + r×lUx, ty + r×lUy).
      d += ' L' + (tlX + r * lUx) + ',' + (ty + r * lUy);
      // TL arc back to the start (tlX + r, ty).
      d += ' Q' + tlX + ',' + ty + ' ' + (tlX + r) + ',' + ty;
    } else {
      d += ' L' + tlX + ',' + ty;
    }
    d += ' Z';

    return { d: d, color: SERIES_COLORS[i % SERIES_COLORS.length], i: i, midY: ty + segH / 2, topFrac: topFrac, p: p };
  });

  // Labels — name above value, both centered horizontally and vertically
  // within each segment. Scale fonts down as segment count increases so
  // labels keep breathing room in shorter segments. 3 segments: 13/12.
  // 4 segments: ~12% smaller. 5 segments: ~25% smaller from base.
  var labelScale = count === 3 ? 1.0 : count === 4 ? 0.88 : 0.78;
  var nameFontSize = Math.max(8, Math.round(13 * labelScale));
  var valueFontSize = Math.max(8, Math.round(12 * labelScale));
  var labelGap = Math.round(14 * labelScale); // distance between name and value lines
  var labels = paths.map(function(seg) {
    if (seg.p < 0.35) return null;
    var rawVal = Math.round(base * targetTopFracs[seg.i]);
    return ce('g', { key: 'lbl-' + seg.i },
      ce('text', { x: cx, y: seg.midY - labelGap / 2 + 1, textAnchor: 'middle', dominantBaseline: 'middle', fill: tokens.colors.text.inverse, fontSize: nameFontSize, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans, opacity: Math.min(1, (seg.p - 0.35) / 0.3) }, stageNames[seg.i]),
      ce('text', { x: cx, y: seg.midY + labelGap / 2 + 1, textAnchor: 'middle', dominantBaseline: 'middle', fill: tokens.colors.text.inverse, fontSize: valueFontSize, fontWeight: 500, fontFamily: tokens.typography.fontFamily.sans, opacity: Math.min(1, (seg.p - 0.35) / 0.3) }, fV(rawVal, fmt))
    );
  });

  return ce('div', { ref: rootRef, style: { width: '100%', height: '100%', minHeight: 120, position: 'relative' } },
    ce('svg', { width: availW, height: availH, style: { display: 'block', overflow: 'visible' } },
      paths.map(function(seg){
        return ce('path', { key: 'p-' + seg.i, d: seg.d, fill: seg.color });
      }),
      labels
    )
  );
}

function GaugeChart({ data, fmt, animTick, W, H, composite, mini }) {
  // The main value is the latest data point normalized to 0-100. For the
  // composite variant, we derive 4 sub-scores from earlier slices of the
  // data so each row shows a related-but-distinct number.
  var raw = data[data.length - 1] || 0;
  var maxObserved = data.reduce(function(m, v){ return v > m ? v : m; }, 0) || 1;
  // Normalize to 0-100 if data is much larger; otherwise pass through (so
  // small percent metrics show their actual value).
  var value = maxObserved > 100 ? Math.round((raw / maxObserved) * 100) : Math.min(100, Math.round(raw));

  // Count-up animation progress — matches the ECharts gauge ring's 800ms
  // easeOut so the center value and every sub-score badge animate together.
  var [gProg, setGProg] = useState(0);
  var gAfRef = useRef();
  useEffect(function() {
    setGProg(0);
    var start = null, dur = 800;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    function frame(ts) {
      if (!start) start = ts;
      var t = Math.min((ts-start)/dur, 1);
      setGProg(easeOut(t));
      if (t < 1) gAfRef.current = requestAnimationFrame(frame);
    }
    gAfRef.current = requestAnimationFrame(frame);
    return function(){ if (gAfRef.current) cancelAnimationFrame(gAfRef.current); };
  }, [value, animTick]);
  var centerVal = Math.round(value * gProg);

  var subScores = composite ? (function(){
    var names = ['Listings', 'Website', 'Social', 'SEO'];
    var step = Math.max(1, Math.floor(data.length / 5));
    var out = [];
    for (var i = 0; i < 4; i++) {
      var v = data[Math.min(i * step, data.length - 1)] || 0;
      var n = maxObserved > 100 ? Math.round((v / maxObserved) * 100) : Math.min(100, Math.round(v));
      out.push({ name: names[i], value: n });
    }
    return out;
  })() : null;

  var availH = Math.max(120, H || 140);
  var availW = Math.max(180, W || 320);

  // Gauge dimensions: ring takes the left portion when composite, full width otherwise.
  var ringSize = composite
    ? Math.min(availH, Math.max(120, availW * 0.42))
    : Math.min(availH, Math.max(140, availW * 0.6));

  var gaugeOpt = {
    _growFromZero: true,
    animation: true,
    animationDuration: 800,
    animationDurationUpdate: 800,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    series: [{
      type: 'gauge',
      startAngle: 225,
      endAngle: -45,
      min: 0, max: 100,
      progress: { show: true, width: 10, roundCap: true, itemStyle: { color: tokens.colors.chart.dataBlue100 } },
      axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(0,0,0,0.08)']] } },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      anchor: { show: false },
      title: { show: false },
      detail: { show: false },
      data: [{ value: value }],
    }],
  };

  var ringEl = ce('div', { style: { position: 'relative', width: ringSize, height: ringSize, flexShrink: 0 } },
    ce(EChart, { option: gaugeOpt, style: { width: '100%', height: '100%' } }),
    ce('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', lineHeight: 1 } },
      ce('div', { className: 'dex-text-display-2-alt', style: { color: tokens.colors.ui.cardTitle, whiteSpace: 'nowrap', lineHeight: 1, fontVariantNumeric: 'tabular-nums' } }, String(centerVal)),
      !mini && ce('div', { style: { fontSize: 11, fontWeight: tokens.typography.fontWeight.medium, color: tokens.colors.ui.subtleText, fontFamily: 'inherit', lineHeight: 1, marginTop: 4 } }, 'Score')
    )
  );

  if (!composite) {
    return ce('div', { style: { width: '100%', height: availH, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', boxSizing: 'border-box' } }, ringEl);
  }

  var legendItems = subScores.map(function(s, i) {
    return ce('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: tokens.spacing[2] } },
      ce('div', { style: { width: 22, height: 22, borderRadius: '50%', background: SERIES_COLORS[i % SERIES_COLORS.length], color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: tokens.typography.fontWeight.bold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontVariantNumeric: 'tabular-nums' } }, Math.round(s.value * gProg)),
      ce('span', { style: { fontSize: 12, fontWeight: tokens.typography.fontWeight.medium, color: tokens.colors.ui.bodyText } }, s.name)
    );
  });

  return ce('div', { style: { width: '100%', height: availH, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing.md, padding: '0 16px', boxSizing: 'border-box' } },
    ringEl,
    ce('div', { style: { display: 'flex', flexDirection: 'column', gap: tokens.spacing[2], minWidth: 0 } }, legendItems)
  );
}

function HeroChart({ data, period, fmt, segment, animTick, H, W, mini, sparkline, multiStat }) {
  if (multiStat) return MultiStatHero({ data: data, period: period, fmt: fmt, animTick: animTick, H: H, W: W });

  var val = data[data.length-1], prev = data[0];
  var pct = prev > 0 ? Math.round(((val-prev)/prev)*100) : 0;
  var up = pct >= 0, col = up ? tokens.colors.ui.positiveGreen : tokens.colors.ui.negativeRed;
  var subLabel = period === "Year to date" ? "Year to date" : period === "Last 90 days" ? "Last 90 days" : period === "Last 30 days" ? "Last 30 days" : "Last 7 days";
  var [dispVal, setDispVal] = useState(0);
  var afRef = useRef();
  useEffect(function() {
    setDispVal(0);
    var start = null, dur = 950;
    function easeOut(t) { return 1 - Math.pow(1-t,3); }
    function frame(ts) {
      if (!start) start = ts;
      var t = Math.min((ts-start)/dur, 1);
      setDispVal(Math.round(val*easeOut(t)));
      if (t < 1) afRef.current = requestAnimationFrame(frame);
    }
    afRef.current = requestAnimationFrame(frame);
    return function(){if(afRef.current)cancelAnimationFrame(afRef.current);};
  }, [val, animTick]);
  var availH = Math.max(120, H || 140);
  var availW = Math.max(180, W || 320);
  // Sparkline variant reserves the bottom ~35% of the card height for a thin
  // trend line, mirroring the screenshot's "big number + small chart" pattern.
  var sparkH = sparkline ? Math.max(40, Math.floor(availH * 0.35)) : 0;
  var headerH = availH - sparkH;
  // Approximate text width: ~0.6 × fontSize per char. Reserve 32px side padding.
  var maxByWidth = Math.floor((availW - 32) / (Math.max(4, fV(val, fmt).length) * 0.6));
  var bigSize = Math.max(24, Math.min(mini ? 38 : 64, Math.min(Math.floor(headerH * 0.40), maxByWidth)));

  var sparkOpt = sparkline ? {
    _clipReveal: true, color: [tokens.colors.chart.dataBlue100], animation: false,
    grid: { left: 16, right: 16, top: 4, bottom: 4, containLabel: false },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: data.map(function(_, i){ return i; }) },
    yAxis: { type: 'value', show: false },
    // Same tooltip treatment as the regular Line chart so the sparkline
    // reads as a peer member of the chart family on hover. appendToBody
    // portals the tooltip into document.body — otherwise it sits inside
    // the DexCard's stacking context and the neighboring multi-stat card
    // paints on top of it.
    tooltip: {
      show: true,
      trigger: 'axis',
      appendToBody: true,
      axisPointer: { type: 'line', lineStyle: { color: tokens.colors.chart.dataBlue100, width: 1, type: 'solid', opacity: 0.35 } },
      backgroundColor: tokens.colors.ui.tooltipBg,
      borderColor: 'transparent',
      textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
      formatter: function(params){ return fV(params[0].value, fmt); },
    },
    series: [{
      type: 'line',
      data: data,
      smooth: false,
      symbol: 'circle',
      symbolSize: 0,
      // Match the Line chart's hover treatment — small ring marker on the
      // hovered point.
      emphasis: { scale: false, itemStyle: { borderWidth: 2, borderColor: tokens.colors.chart.dataBlue100, color: tokens.colors.ui.whiteSurface }, symbolSize: 9 },
      lineStyle: { width: 2, color: tokens.colors.chart.dataBlue100 },
      itemStyle: { color: tokens.colors.chart.dataBlue100 },
    }],
  } : null;

  return ce('div', { style: { display: 'flex', flexDirection: 'column', height: availH, boxSizing: 'border-box' } },
    ce('div', { style: { flex: sparkline ? 'none' : 1, height: sparkline ? headerH : availH, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing[1], padding: sparkline ? '0 16px 4px' : '0 16px 10px', boxSizing: 'border-box' } },
      ce('div', { style: { color: tokens.colors.ui.cardTitle, letterSpacing: '-1.5px', fontSize: bigSize, fontWeight: tokens.typography.fontWeight.bold, lineHeight: 1.05, fontFamily: tokens.typography.fontFamily.sans } }, fV(dispVal, fmt)),
      ce('div', { style: { display: 'flex', alignItems: 'center', gap: tokens.spacing[1.5] } },
        ce('div', { style: { width: 16, height: 16, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
          ce(DexIcon, { name: up ? 'arrow-up' : 'arrow-down', size: 10, style: { color: tokens.colors.ui.whiteSurface } })
        ),
        ce('span', { style: { fontSize: 12, fontWeight: tokens.typography.fontWeight.bold, color: col } }, Math.abs(pct) + '%'),
        ce('span', { style: { fontSize: 12, fontWeight: 400, color: 'var(--dex-fgColor-subtle)' } }, 'vs previous')
      ),
      !sparkline && ce('div', { style: { fontSize: 11, color: tokens.colors.ui.bodyText, fontWeight: tokens.typography.fontWeight.medium } }, (segment || 'All segments') + ': ' + subLabel)
    ),
    sparkline && ce('div', { style: { height: sparkH, paddingTop: 4 } },
      ce(EChart, { option: sparkOpt, style: { width: '100%', height: '100%' } })
    )
  );
}

// Multi-stat Hero — two stat rows in one card, each with icon + label +
// value + delta chip. Values derived from the data array so the demo is
// deterministic. In production, this variant would consume multiple metrics.
function MultiStatHero({ data, period, fmt, animTick, H, W }) {
  var availH = Math.max(120, H || 140);
  // Derive two related stats: views (latest value) and engagement rate
  // (proportion of latest vs peak). Provides a "two related signals" demo.
  var latest = data[data.length - 1] || 0;
  var peak = data.reduce(function(m, v){ return v > m ? v : m; }, 1);
  var prevLatest = data[Math.max(0, data.length - 8)] || latest;
  var rate = Math.max(1, Math.min(99, Math.round((latest / peak) * 100)));
  var prevRate = Math.max(1, Math.min(99, Math.round((prevLatest / peak) * 100)));
  // Color hierarchy top → bottom: blue → green → purple.
  // Background uses the 200-shade data color at 15% alpha for a soft wash;
  // the icon itself uses the same color at full opacity.
  //   dataBlue200   = #0A7CFF → rgb(10, 124, 255)
  //   dataGreen200  = #319530 → rgb(49, 149, 48)
  //   dataPurple200 = #8358F1 → rgb(131, 88, 241)
  // Impressions sits above Views since impressions count is typically a
  // multiple of unique views (~3.5× here gives a realistic ratio).
  var impressions = Math.round(latest * 3.5);
  var prevImpressions = Math.round(prevLatest * 3.5);
  var stats = [
    {
      icon: 'trending-up', label: 'Impressions',
      iconColor: tokens.colors.chart.dataBlue200,
      iconBg: colorWithAlpha(tokens.colors.chart.dataBlue200, 0.15),
      numericValue: impressions, isPct: false,
      pct: prevImpressions > 0 ? Math.round(((impressions - prevImpressions) / prevImpressions) * 100) : 0,
    },
    {
      icon: 'eye-show', label: 'Views',
      iconColor: tokens.colors.chart.dataGreen200,
      iconBg: colorWithAlpha(tokens.colors.chart.dataGreen200, 0.15),
      numericValue: latest, isPct: false,
      pct: prevLatest > 0 ? Math.round(((latest - prevLatest) / prevLatest) * 100) : 0,
    },
    {
      icon: 'activity', label: 'Engagement rate',
      iconColor: tokens.colors.chart.dataPurple200,
      iconBg: colorWithAlpha(tokens.colors.chart.dataPurple200, 0.15),
      numericValue: rate, isPct: true,
      pct: prevRate > 0 ? Math.round(((rate - prevRate) / prevRate) * 100) : 0,
    },
  ];

  // Single shared count-up progress drives every stat value at the same pace.
  var [msProg, setMsProg] = useState(0);
  var msAfRef = useRef();
  useEffect(function() {
    setMsProg(0);
    var start = null, dur = 800;
    function easeOut(t){ return 1 - Math.pow(1-t, 3); }
    function frame(ts) {
      if (!start) start = ts;
      var t = Math.min((ts-start)/dur, 1);
      setMsProg(easeOut(t));
      if (t < 1) msAfRef.current = requestAnimationFrame(frame);
    }
    msAfRef.current = requestAnimationFrame(frame);
    return function(){ if (msAfRef.current) cancelAnimationFrame(msAfRef.current); };
  }, [latest, animTick]);

  return ce('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', height: availH, gap: tokens.spacing.md, padding: '0 16px', boxSizing: 'border-box' } },
    stats.map(function(s, i) {
      var up = s.pct >= 0;
      var col = up ? tokens.colors.ui.positiveGreen : tokens.colors.ui.negativeRed;
      var animated = Math.round(s.numericValue * msProg);
      var displayVal = s.isPct ? animated + '%' : fV(animated, fmt);
      return ce('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: tokens.spacing[2.5] } },
        ce('div', { style: {
          width: 28, height: 28,
          background: s.iconBg,
          color: s.iconColor,
          borderRadius: tokens.borderRadius.base,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        } },
          ce(DexIcon, { name: s.icon, size: 'sm' })
        ),
        ce('span', { style: { flex: 1, fontSize: 13, fontWeight: tokens.typography.fontWeight.medium, color: tokens.colors.ui.bodyText, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.label),
        ce('span', { style: { fontSize: 20, fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.ui.cardTitle, fontVariantNumeric: 'tabular-nums' } }, displayVal),
        ce('div', { style: { display: 'flex', alignItems: 'center', gap: tokens.spacing[1] } },
          ce(DexIcon, { name: up ? 'arrow-up' : 'arrow-down', size: 'xs', style: { color: col } }),
          ce('span', { style: { fontSize: 12, fontWeight: tokens.typography.fontWeight.bold, color: col, fontVariantNumeric: 'tabular-nums' } }, Math.abs(s.pct) + '%')
        )
      );
    })
  );
}

// Standard multi-series color cycle for stacked / grouped variants.
// Matches DONUT_COLORS but kept separate so future tweaks here don't
// drift the donut palette.
var SERIES_COLORS = [
  tokens.colors.chart.dataBlue100,
  tokens.colors.chart.dataGreen100,
  tokens.colors.chart.dataPurple100,
  tokens.colors.chart.dataAqua100,
];
// Parallel "compare" palette — same hue per index as SERIES_COLORS but the
// darker 200-series shade. Used for prior-period bars in categorical
// compare variants so the pairing reads "same color family, deeper tone"
// rather than "same color, faded" (opacity was hard to read against the
// dark tooltip background and didn't meet best-practice contrast).
var SERIES_COLORS_COMPARE = [
  tokens.colors.chart.dataBlue200,
  tokens.colors.chart.dataGreen200,
  tokens.colors.chart.dataPurple200,
  tokens.colors.chart.dataAqua200,
];
// Third-step palette in the same family ladder. Currently used by the
// Treemap for the deepest child shade; available for future variants that
// need a third state distinction (e.g. compare + benchmark or "current /
// prior / two-back" period overlays).
var SERIES_COLORS_300 = [
  tokens.colors.chart.dataBlue300,
  tokens.colors.chart.dataGreen300,
  tokens.colors.chart.dataPurple300,
  tokens.colors.chart.dataAqua300,
];
// Per-hue ladders: base 100 → deeper 200 → deepest 300 within one color
// family. Keyed by the literal 100-shade hex so any chart that already
// has the base color can look up its stepped siblings. Used by Treemap
// to color child tiles in a deepening band of one parent's hue.
var SHADE_LADDER = {};
SHADE_LADDER[tokens.colors.chart.dataBlue100]    = [tokens.colors.chart.dataBlue100,    tokens.colors.chart.dataBlue200,    tokens.colors.chart.dataBlue300];
SHADE_LADDER[tokens.colors.chart.dataGreen100]   = [tokens.colors.chart.dataGreen100,   tokens.colors.chart.dataGreen200,   tokens.colors.chart.dataGreen300];
SHADE_LADDER[tokens.colors.chart.dataPurple100]  = [tokens.colors.chart.dataPurple100,  tokens.colors.chart.dataPurple200,  tokens.colors.chart.dataPurple300];
SHADE_LADDER[tokens.colors.chart.dataAqua100]    = [tokens.colors.chart.dataAqua100,    tokens.colors.chart.dataAqua200,    tokens.colors.chart.dataAqua300];
SHADE_LADDER[tokens.colors.chart.dataNavy100]    = [tokens.colors.chart.dataNavy100,    tokens.colors.chart.dataNavy200,    tokens.colors.chart.dataNavy300];
SHADE_LADDER[tokens.colors.chart.dataEmerald100] = [tokens.colors.chart.dataEmerald100, tokens.colors.chart.dataEmerald200, tokens.colors.chart.dataEmerald300];
SHADE_LADDER[tokens.colors.chart.dataYellow100]  = [tokens.colors.chart.dataYellow100,  tokens.colors.chart.dataYellow200,  tokens.colors.chart.dataYellow300];

export default function ChartRenderer({ data, dates, period, fmt, type, metric, segment, animTick, compare, prevData, mini, scrollable, stacked, grouped, series, sparkline, multiStat, composite, sortable, segments, withZones, normalize, categorical, categories, showOptionalAxis, engine, tableConfig, stickyFirst }) {
  var wrapRef = useRef();
  var { w: containerW, h: containerH } = useContainerSize(wrapRef);

  // Multi-series applies to Column and Bar (stacked/grouped flag), Line/Area
  // (plain series count), and Combo (stacked/grouped bars on the left axis
  // + a line overlay on the right axis).
  var isMultiBar = (stacked || grouped) && (type === 'Column' || type === 'Bar');
  var isMultiLine = (type === 'Line' || type === 'Area') && (series || 0) >= 2;
  var isMultiCombo = type === 'Combo' && (stacked || grouped) && (series || 0) >= 2;
  var isMulti = isMultiBar || isMultiLine || isMultiCombo;
  var multiCount = isMulti ? Math.max(2, Math.min(4, series || 2)) : 0;
  // Hero variant flags (sparkline, multi-stat) suppress the family legend.
  var heroHasNoLegend = type === 'Hero' || type === 'Funnel' || type === 'Gauge';

  // Build the legend item list. Compare mode, multi-series, and combo are
  // separate paths; combo can ALSO be multi-series (stacked/grouped bars +
  // line on top), in which case the legend mixes bar chips with a line chip.
  var legendItems = null;
  if (type === 'Combo') {
    // Categorical Combo: N per-category chips + a rate line chip, same
    // pattern as the grouped Combo variants (Series 1..N + Rate). The
    // chip colors map 1:1 to the bars rendered in ComboChart's catMode.
    var comboCatMode = !!categorical && (categories || 0) >= 2;
    var comboCatCount = comboCatMode ? Math.max(2, Math.min(4, categories)) : 0;
    var comboBarColors = comboCatMode
      ? SERIES_COLORS.slice(0, comboCatCount)
      : ((stacked || grouped) && series >= 2
          ? SERIES_COLORS.slice(0, series)
          : [tokens.colors.chart.dataBlue100]);
    // Line uses the next color in the hierarchy after the bars so it stays
    // in the palette but contrasts. Falls back to dataNavy100 if we've
    // already used all of SERIES_COLORS.
    var lineColor = comboBarColors.length === 1
      ? tokens.colors.chart.dataGreen100
      : (SERIES_COLORS[comboBarColors.length] || tokens.colors.chart.dataNavy100);
    legendItems = comboBarColors.map(function(c, i){
      return {
        label: comboBarColors.length === 1 ? 'Volume' : 'Series ' + (i + 1),
        color: c,
        shape: 'bar',
      };
    });
    legendItems.push({ label: 'Rate', color: lineColor, shape: 'line' });
  } else if (isMulti) {
    legendItems = SERIES_COLORS.slice(0, multiCount).map(function(c, i){
      return { label: 'Series ' + (i + 1), color: c };
    });
  } else if (compare) {
    // Categorical Column/Bar in compare mode pair each category with a
    // 45%-opacity version of its own color (current vs prior). The
    // family's "Current blue / Previous green" legend would lie about
    // what's actually drawn, so we suppress it entirely. The pairing
    // reads as obvious — solid bar = current, faded same-color bar =
    // prior — and the hover tooltip carries the precise prev values.
    var isCategoricalColBar = !!categorical && (categories || 0) >= 2 && (type === 'Column' || type === 'Bar');
    if (!isCategoricalColBar) {
      var isLine = type === 'Line' || type === 'Area';
      legendItems = [
        { label: 'Current period', color: tokens.colors.chart.dataBlue100, solid: true },
        { label: 'Previous period', color: tokens.colors.chart.dataGreen100, dashed: isLine },
      ];
    }
  }
  // Funnel is excluded here because the ECharts funnel compare variant
  // renders its OWN stage-name legend as an HTML overlay inside the
  // chart card; the family's Current/Previous CLegend would be a
  // redundant second legend with the wrong granularity (period vs stage).
  var showLegend = !mini && legendItems && type !== 'Donut' && type !== 'Hero' && type !== 'Table' && type !== 'Funnel';
  // legendH reserves vertical space within the container for the legend
  // row. CLegend renders with padding: 12px top + ~14px text line + 2px
  // bottom = ~28px total. Keeping this in sync with the CLegend padding
  // above is essential — if the reservation is too small the chart
  // overflows into the legend area; too large, the chart shrinks.
  var legendH = showLegend ? 28 : 0;
  var effectiveH = (containerH || 140) - legendH;

  return (
    <div ref={wrapRef} style={{width:"100%", height:"100%", minHeight:mini ? 60 : 120, display:"flex", flexDirection:"column"}}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <InnerChart
          data={data}
          dates={dates}
          period={period}
          fmt={fmt}
          type={type}
          metric={metric}
          segment={segment}
          animTick={animTick}
          compare={compare}
          prevData={prevData}
          W={containerW}
          H={effectiveH}
          mini={mini}
          scrollable={scrollable}
          stacked={!!stacked && isMulti}
          grouped={!!grouped && isMulti}
          seriesCount={multiCount}
          sparkline={sparkline}
          multiStat={multiStat}
          composite={composite}
          sortable={sortable}
          segments={segments}
          withZones={withZones}
          normalize={normalize}
          categorical={categorical}
          categories={categories}
          showOptionalAxis={showOptionalAxis}
          engine={engine}
          tableConfig={tableConfig}
          stickyFirst={stickyFirst}
        />
      </div>
      {showLegend && <CLegend items={legendItems} type={type} fontSize={tokens.typography.fontSize.xs} />}
    </div>
  );
}

// Legend with per-item chip style. Chart type sets the DEFAULT (Line/Area →
// line marks, everything else → square chips), but each item can override
// via `shape: 'bar' | 'line'`. Combo charts use this to mix square chips
// for the bar series with a line-mark chip for the overlaid line.
function CLegend({ items, type, fontSize: legendFontSize = 11 }) {
  var defaultIsLine = type === 'Line' || type === 'Area';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '12px 0 2px', fontSize: legendFontSize, color: tokens.colors.ui.subtleText }}>
      {items.map(function(item, i) {
        var renderAsLine;
        if (item.shape === 'line') renderAsLine = true;
        else if (item.shape === 'bar') renderAsLine = false;
        else renderAsLine = defaultIsLine;

        var chip;
        if (renderAsLine) {
          // Line shape width = square-chip width (12) + 1px so the line reads
          // as deliberate alongside square chips rather than visually stunted.
          // Dashed variant renders as an inline SVG with an explicit
          // stroke-dasharray (~1:2 dash:gap ratio) so the spacing reads as
          // obviously dashed and matches the chart line's [5, 10] pattern,
          // scaled down for the chip width. The solid variant stays as a
          // CSS border since native rendering is already correct.
          if (item.dashed) {
            // Pattern: 3px dash + 2px gap × 3 = 13px exactly, so the chip
            // renders three clearly visible dashes within its 13px width.
            chip = (
              <svg width="13" height="2" style={{ display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }}>
                <line x1="0" y1="1" x2="13" y2="1" stroke={item.color} strokeWidth="2" strokeDasharray="3 2" />
              </svg>
            );
          } else {
            chip = <span style={{ display: 'inline-block', width: 13, height: 0, marginRight: 5, borderTop: '2px solid ' + item.color }} />;
          }
        } else {
          chip = <span style={{ display: 'inline-block', width: 12, height: 12, background: item.color, borderRadius: 2, marginRight: 5 }} />;
        }
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {chip}
            <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}

function InnerChart({ data, dates, period, fmt, type, metric, segment, animTick, compare, prevData, W, H, mini, scrollable, stacked, grouped, seriesCount, sparkline, multiStat, composite, sortable, segments, withZones, normalize, categorical, categories, showOptionalAxis, engine, tableConfig, stickyFirst }) {
  if (type === "Table")     return <TableChart     data={data} dates={dates} period={period} fmt={fmt} metric={metric} animTick={animTick} H={H} scrollable={scrollable} sortable={sortable} tableConfig={tableConfig} stickyFirst={stickyFirst} />;
  if (type === "Donut")     return <DonutChart     data={data} dates={dates} period={period} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} />;
  if (type === "Pie")       return <PieChart       data={data} dates={dates} period={period} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} />;
  if (type === "Hero")      return <HeroChart      data={data} period={period} fmt={fmt} segment={segment} animTick={animTick} H={H} W={W} mini={mini} sparkline={sparkline} multiStat={multiStat} />;
  if (type === "Funnel")    return engine === 'echarts'
    ? <FunnelEchartsChart data={data} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} />
    : <FunnelChart        data={data} fmt={fmt} animTick={animTick} W={W} H={H} segments={segments} />;
  if (type === "Gauge")     return <GaugeChart     data={data} fmt={fmt} animTick={animTick} W={W} H={H} composite={composite} mini={mini} />;
  if (type === "Reviews")   return <ReviewsChart   data={data} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} />;
  if (type === "Bullet")    return <BulletChart    data={data} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} withZones={withZones} />;
  if (type === "Combo")     return <ComboChart     data={data} dates={dates} period={period} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} stacked={stacked} grouped={grouped} seriesCount={seriesCount} categorical={categorical} categories={categories} showOptionalAxis={showOptionalAxis} />;
  if (type === "Heatmap")   return <HeatmapChart   data={data} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} />;
  if (type === "Waterfall") return <WaterfallChart data={data} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} showOptionalAxis={showOptionalAxis} />;
  if (type === "Treemap")   return <TreemapChart   data={data} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} />;
  if (type === "Scatter")   return <ScatterChart   data={data} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} segments={segments} />;
  if (type === "Calendar")  return <CalendarChart  data={data} dates={dates} fmt={fmt} animTick={animTick} W={W} H={H} mini={mini} />;

  var pL = 4, pR = 4, pT = 4, pB = 4;
  if (!mini) { pL = 16; pR = 16; }
  var ref = useRef();
  var W2 = useW(ref);
  if (W2 === 0) return ce("div", {ref, style:{width:"100%",height:H}});

  var xlH = mini ? 0 : 20;
  var chartH = Math.max(50, H - xlH);

  if (type === "Bar") {
    // Categorical single-bar variant for Bar (rows = categories). Y-axis
    // labels are the category identifiers ("Series 1, ...") so no legend
    // is needed. Same SERIES_COLORS hierarchy, same per-period data
    // derivation as the Column categorical branch.
    if (categorical && categories >= 2) {
      var barCatCount = Math.max(2, Math.min(4, categories));
      var barCatStep = Math.max(1, Math.floor(data.length / barCatCount));
      var barCatData = [];
      var barCatLabelsRev = [];
      for (var bci = 0; bci < barCatCount; bci++) {
        barCatData.push(data[Math.min(bci * barCatStep, data.length - 1)]);
        barCatLabelsRev.push('Series ' + (bci + 1));
      }
      // ECharts y-axis category renders bottom-up; reverse so Series 1
      // appears at the top row (left-to-right reading order in the bar
      // grid → top-to-bottom in the rendered chart).
      var barCatLabels = barCatLabelsRev.slice().reverse();
      var barCatValues = barCatData.slice().reverse();
      // Per-bar color: data array also reversed so SERIES_COLORS[0] still
      // maps to Series 1 visually (which is now the top row).
      var barCatColors = [];
      for (var bcj = 0; bcj < barCatCount; bcj++) {
        barCatColors.push(SERIES_COLORS[(barCatCount - 1 - bcj) % SERIES_COLORS.length]);
      }
      var barCatGridLeft = mini ? 4 : 53;
      // Compute the X-axis (value axis) peak across current + previous data
      // so the tick scale fits all bars. niceAxisRange caps at 6 ticks with
      // a rounded-up max + matching interval — same helper used by every
      // Y-axis in the library, just rotated 90° for Bar's horizontal layout.
      var barCatPeak = barCatValues.reduce(function(m, v){ return v > m ? v : m; }, 0);
      if (compare && prevData) {
        for (var bcpp = 0; bcpp < barCatCount; bcpp++) {
          var pcv = prevData[Math.min(bcpp * barCatStep, prevData.length - 1)];
          if (pcv > barCatPeak) barCatPeak = pcv;
        }
      }
      var barCatXRange = niceAxisRange(barCatPeak);
      var barCatXShow = !mini && !!showOptionalAxis;
      var barCatXChars = yAxisCharLimit(W2);
      // Reserve ~20px below the bars when the X-axis labels are visible
      // (fontSize 10 + margin 8 ≈ 18-20px). Matches the Column branch's
      // colXAxisGridBottom math. Mini variant keeps the smaller 6px since
      // its axisLabel is hidden.
      var barCatXGridBottom = barCatXShow ? 20 : 6;
      var barCatOpt = {
        _growFromZero: true,
        animation: true, animationDuration: 1000, animationEasing: 'cubicOut',
        animationDelay: 0, animationDurationUpdate: 600, animationEasingUpdate: 'cubicOut',
        grid: { left: barCatGridLeft, right: pR, top: 6, bottom: barCatXGridBottom, containLabel: false },
        // Native ECharts value axis (Phase 8 sibling for Bar). Gated behind
        // the shared showOptionalAxis toggle (rebadged "Optional axis" in the UI)
        // so designers/devs can flip on the value scale when comparison
        // precision matters and leave it off for minimal sparkline contexts.
        // alignMinLabel/alignMaxLabel pin the 0 and max labels' inner edges
        // to the plot bounds — same edge-alignment trick the Column X-axis
        // uses for non-centered date variants. niceAxisRange + fmtAxisTick
        // ensure the tick marks are sensible whole-number values formatted
        // per the metric's fmt (currency, %, count, etc.).
        xAxis: {
          type: 'value',
          show: barCatXShow,
          min: 0,
          max: barCatXRange.max,
          interval: barCatXRange.interval,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            show: barCatXShow,
            alignMinLabel: 'left',
            alignMaxLabel: 'right',
            fontSize: 10,
            fontWeight: 500,
            // Literal hex — ECharts canvas can't resolve CSS variables
            // so we use the literal that matches DEX subtle color.
            color: 'rgba(0,0,0,0.6)',
            fontFamily: 'inherit',
            margin: 8,
            formatter: function(value){ return fmtAxisTick(value, fmt, barCatXChars); },
          },
        },
        yAxis: {
          type: 'category', data: barCatLabels,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { show: !mini, fontSize: 10, fontWeight: 500, color: 'rgba(0,0,0,0.6)', fontFamily: 'inherit', margin: 4, interval: 0 },
        },
        tooltip: {
          show: !mini, trigger: 'axis', axisPointer: { type: 'none' },
          backgroundColor: tokens.colors.ui.tooltipBg, borderColor: 'transparent',
          textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
          formatter: function(params){
            var p = params[0];
            return '<div style="display:flex;align-items:center;gap:6px;line-height:1.5"><span style="display:inline-block;width:8px;height:8px;background:'+p.color+';border-radius:1px"></span><span>'+p.name+': '+fV(p.value,fmt)+'</span></div>';
          },
        },
        series: [{
          type: 'bar',
          data: barCatValues.map(function(v, i){
            return { value: v, itemStyle: { color: barCatColors[i], borderRadius: [0,2,2,0] } };
          }),
          // No barMaxWidth cap — rows fill their proportional slot of the
          // chart height (1/N each, minus barCategoryGap padding). 20%
          // category gap matches the library's standard density.
          barGap: compare && prevData ? '30%' : undefined,
          barCategoryGap: '20%',
        }],
      };
      // Compare overlay: per-category prev row drawn in the matching
      // SERIES_COLORS_COMPARE (200-series) tone. Same color family,
      // deeper shade — meets contrast standards better than opacity and
      // keeps the tooltip chip legible against the dark tooltip bg.
      // Color array is reversed to match the bottom-up axis order
      // already used for barCatColors.
      if (compare && prevData) {
        var barCatPrevRaw = [];
        for (var bcp = 0; bcp < barCatCount; bcp++) {
          barCatPrevRaw.push(prevData[Math.min(bcp * barCatStep, prevData.length - 1)]);
        }
        var barCatPrev = barCatPrevRaw.slice().reverse();
        var barCatCompareColors = [];
        for (var bcc = 0; bcc < barCatCount; bcc++) {
          barCatCompareColors.push(SERIES_COLORS_COMPARE[(barCatCount - 1 - bcc) % SERIES_COLORS_COMPARE.length]);
        }
        barCatOpt.series.push({
          type: 'bar',
          data: barCatPrev.map(function(v, i){
            return { value: v, itemStyle: { color: barCatCompareColors[i], borderRadius: [0,2,2,0] } };
          }),
        });
        barCatOpt.tooltip.formatter = function(params){
          var tip = '';
          for (var pi = 0; pi < params.length; pi++) {
            var p = params[pi];
            var lbl = pi === 0 ? p.name : 'prev';
            tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5"><span style="display:inline-block;width:8px;height:8px;background:' + p.color + ';border-radius:1px"></span><span>' + lbl + ': ' + fV(p.value, fmt) + '</span></div>';
          }
          return tip;
        };
      }
      return ce('div', { ref, style: { width: '100%', height: H } }, ce(EChart, { option: barCatOpt, style: { width: '100%', height: '100%' } }));
    }

    var sc = Math.min(data.length, 8), bstep = Math.max(1, Math.floor(data.length/sc));
    var sam = [], samD = [], samP = [];
    for (var si = 0; si < data.length; si += bstep) {
      sam.push(data[si]); samD.push(dates[si]);
      if (compare && prevData) samP.push(prevData[si]);
    }
    var barLabels = samD.map(function(d){return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});}).reverse();
    var barData = sam.slice().reverse();
    var barPrev = compare && prevData ? samP.slice().reverse() : null;
    var barGridLeft = mini ? 4 : 53;
    var isMultiBar = (stacked || grouped) && seriesCount >= 2;
    var multiBarData = isMultiBar ? buildMultiSeries(barData, seriesCount) : null;
    var multiBarTooltipFmt = function(params){
      var tip = '';
      for (var pi = 0; pi < params.length; pi++) {
        var p = params[pi];
        tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5"><span style="display:inline-block;width:8px;height:8px;background:' + p.color + ';border-radius:1px"></span><span>Series ' + (pi+1) + ': ' + fV(p.value, fmt) + '</span></div>';
      }
      return tip;
    };
    // Single-series + compare formatter: chip + "Current"/"Previous" label
    // + white value, matching the multi-series tooltip styling. Square
    // chips because Bar is a rectangular shape.
    var barCompareTooltipFmt = function(params){
      var tip = '<div style="display:flex;align-items:center;gap:6px;line-height:1.5">'
        + tooltipChipHtml(tokens.colors.chart.dataBlue100, 'square', false)
        + '<span>Current: ' + fV(params[0].value, fmt) + '</span></div>';
      if (params.length > 1) {
        tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5">'
          + tooltipChipHtml(tokens.colors.chart.dataGreen100, 'square', false)
          + '<span>Previous: ' + fV(params[1].value, fmt) + '</span></div>';
      }
      return tip;
    };
    var barSingleTooltipFmt = function(params){ return fV(params[0].value, fmt); };
    // X-axis (value) peak math — covers all four data shapes:
    //   - Single bar: max of barData + barPrev (if compare)
    //   - Multi grouped: max of any individual series value
    //   - Multi stacked: sum across all series at each row, then max of sums
    //   - Multi 100% stacked (normalize): forced to 100 (% scale)
    // niceAxisRange then rounds the peak up to a nice tick boundary.
    var barXPeak = 0;
    if (isMultiBar && normalize) {
      barXPeak = 100;
    } else if (isMultiBar && stacked) {
      for (var bsi = 0; bsi < barData.length; bsi++) {
        var rowSum = 0;
        for (var bss = 0; bss < multiBarData.length; bss++) rowSum += (multiBarData[bss][bsi] || 0);
        if (rowSum > barXPeak) barXPeak = rowSum;
      }
    } else if (isMultiBar) {
      for (var bgs = 0; bgs < multiBarData.length; bgs++) {
        for (var bgi = 0; bgi < multiBarData[bgs].length; bgi++) {
          if (multiBarData[bgs][bgi] > barXPeak) barXPeak = multiBarData[bgs][bgi];
        }
      }
    } else {
      for (var bi = 0; bi < barData.length; bi++) if (barData[bi] > barXPeak) barXPeak = barData[bi];
      if (barPrev) for (var bpi = 0; bpi < barPrev.length; bpi++) if (barPrev[bpi] > barXPeak) barXPeak = barPrev[bpi];
    }
    var barXRange = (isMultiBar && normalize) ? { max: 100, interval: 25 } : niceAxisRange(barXPeak);
    // 100% stacked always shows the percentage X-axis — engineers need the
    // 0/25/50/75/100% scale to read composition. All other bar variants gate
    // behind the gallery's "Optional axis" toggle.
    var barXShow = !mini && ((isMultiBar && normalize) || !!showOptionalAxis);
    var barXChars = yAxisCharLimit(W2);
    var barXGridBottom = barXShow ? 20 : 6;
    // For 100% stacked, override the metric's fmt so ticks render as
    // percentages (0%, 25%, 50%, 75%, 100%) regardless of the underlying
    // metric type. For all other variants, use the metric's native fmt
    // so currency/count/percent etc. render correctly.
    var barXFmt = (isMultiBar && normalize) ? '%' : fmt;
    var barOpt = {_growFromZero:true,textStyle:{color:'rgba(0,0,0,0.6)'},color:isMultiBar?SERIES_COLORS.slice(0,seriesCount):[tokens.colors.chart.dataBlue100],animation:true,animationDuration:1000,animationEasing:"cubicOut",animationDelay:0,animationDurationUpdate:600,animationEasingUpdate:"cubicOut",grid:{left:barGridLeft,right:pR,top:6,bottom:barXGridBottom,containLabel:false},
      // Native ECharts value X-axis (Phase 8 sibling for Bar). Gated behind
      // the shared showOptionalAxis toggle (UI label: "Optional axis"). When on,
      // displays a 0→max value scale below the bars using niceAxisRange
      // for clean tick spacing and fmtAxisTick for metric-appropriate
      // formatting. alignMinLabel/alignMaxLabel pin first/last labels'
      // inner edges to plot bounds — same edge-alignment trick the Column
      // X-axis uses for date variants.
      xAxis: {
        type: 'value',
        show: barXShow,
        min: 0,
        max: barXRange.max,
        interval: barXRange.interval,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          show: barXShow,
          alignMinLabel: 'left',
          alignMaxLabel: 'right',
          fontSize: 10,
          fontWeight: 500,
          // Literal hex — ECharts canvas can't resolve CSS variables
          // so we use the literal that matches DEX subtle color.
          color: 'rgba(0,0,0,0.6)',
          fontFamily: 'inherit',
          margin: 8,
          formatter: function(value){ return fmtAxisTick(value, barXFmt, barXChars); },
        },
      },
      yAxis:{type:"category",data:barLabels,axisLine:{show:false},axisTick:{show:false},axisLabel:{show:!mini,fontSize:10,fontWeight:500,color:'rgba(0,0,0,0.6)',fontFamily:'inherit',margin:4,interval:0}},tooltip:{show:!mini,trigger:"axis",axisPointer:{type:"none"},backgroundColor:tokens.colors.ui.tooltipBg,borderColor:"transparent",textStyle:{color:tokens.colors.ui.whiteSurface,fontSize:10,fontWeight:700,fontFamily:tokens.typography.fontFamily.sans},formatter:isMultiBar?multiBarTooltipFmt:(compare?barCompareTooltipFmt:barSingleTooltipFmt)},series:[]};
    if (isMultiBar && stacked) {
      // Horizontal stacked: rightmost (last in series) segment gets rounded
      // right corners; leftmost stays square at the y-axis edge so the row
      // reads as one continuous bar.
      //
      // 100% mode: normalize each row so all bars total 100% — surfaces
      // mix-shift across rankings independent of absolute totals.
      var seriesForRenderBar = multiBarData;
      if (normalize) {
        var rowCountBar = multiBarData[0].length;
        var pctDataBar = [];
        for (var sBi = 0; sBi < seriesCount; sBi++) pctDataBar.push([]);
        for (var rBi = 0; rBi < rowCountBar; rBi++) {
          var rowTotalBar = 0;
          for (var sBj = 0; sBj < seriesCount; sBj++) rowTotalBar += multiBarData[sBj][rBi];
          if (rowTotalBar === 0) rowTotalBar = 1;
          for (var sBk = 0; sBk < seriesCount; sBk++) {
            pctDataBar[sBk].push(Math.round((multiBarData[sBk][rBi] / rowTotalBar) * 1000) / 10);
          }
        }
        seriesForRenderBar = pctDataBar;
      }
      for (var bi = 0; bi < seriesCount; bi++) {
        barOpt.series.push({
          type:"bar",
          data: seriesForRenderBar[bi],
          stack: "total",
          barCategoryGap: "16%",
          itemStyle:{
            color: SERIES_COLORS[bi],
            borderRadius: bi === seriesCount - 1 ? [0,2,2,0] : [0,0,0,0],
          },
        });
      }
      if (normalize) {
        // The xAxis is already configured above with max:100/interval:25/%
        // formatter via barXRange/barXFmt/barXShow. Only the tooltip needs
        // a custom formatter to render pre-normalized values as percentages.
        barOpt.tooltip.formatter = function(params){
          var tip = '';
          for (var pi = 0; pi < params.length; pi++) {
            var p = params[pi];
            tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5"><span style="display:inline-block;width:8px;height:8px;background:' + p.color + ';border-radius:1px"></span><span>Series ' + (pi+1) + ': ' + p.value + '%</span></div>';
          }
          return tip;
        };
      }
    } else if (isMultiBar && grouped) {
      // Horizontal grouped: between-group gap is the category gap on the
      // y-axis; within-group gap is half that.
      for (var bgi = 0; bgi < seriesCount; bgi++) {
        var bs = {
          type:"bar",
          data: multiBarData[bgi],
          itemStyle:{ color: SERIES_COLORS[bgi], borderRadius: [0,2,2,0] },
        };
        if (bgi === 0) {
          bs.barCategoryGap = "32%";
          bs.barGap = "16%";
        }
        barOpt.series.push(bs);
      }
    } else {
      barOpt.series.push({type:"bar",data:barData,barGap:barPrev?"5%":"0%",barCategoryGap:"16%",itemStyle:{color:tokens.colors.chart.dataBlue100,borderRadius:[0,2,2,0]}});
      if (barPrev) barOpt.series.push({type:"bar",data:barPrev,itemStyle:{color:tokens.colors.chart.dataGreen100,borderRadius:[0,2,2,0]}});
    }
    return ce("div",{ref,style:{width:"100%",height:H,display:"flex",flexDirection:"column"}},ce(EChart,{option:barOpt,style:{width:"100%",height:"100%",flex:1}}));
  }

  if (type === "Column") {
    // Categorical single-bar variant. One bar per category (2-4), each
    // colored from SERIES_COLORS hierarchy. X-axis labels are the
    // category identifiers ("Series 1, Series 2, ...") so the bar
    // position + label below it carries the identification — no legend
    // required. Bar values come from N evenly-spaced positions in the
    // source data so the chart varies with the selected period.
    if (categorical && categories >= 2) {
      var catCount = Math.max(2, Math.min(4, categories));
      var catStep = Math.max(1, Math.floor(data.length / catCount));
      var catData = [];
      var catLabels = [];
      for (var ci = 0; ci < catCount; ci++) {
        catData.push(data[Math.min(ci * catStep, data.length - 1)]);
        catLabels.push('Series ' + (ci + 1));
      }
      // Y-axis sizing — same pattern as the standard Column branch:
      // niceAxisRange caps the tick count at 6 (incl. 0) and gives us
      // matching max + interval. yAxisReservedWidth measures the widest
      // formatted tick at the rendered max so the longest label's left
      // edge lands at the chart's original pL.
      var catDataPeak = catData.reduce(function(m, v){ return v > m ? v : m; }, 0);
      if (compare && prevData) {
        for (var cpp = 0; cpp < catCount; cpp++) {
          var pv = prevData[Math.min(cpp * catStep, prevData.length - 1)];
          if (pv > catDataPeak) catDataPeak = pv;
        }
      }
      var catRange = niceAxisRange(catDataPeak);
      var catYChars = yAxisCharLimit(W2);
      var catYOffset = yAxisReservedWidth(catRange.max, fmt, catYChars, showOptionalAxis);
      var catEffectivePL = pL + catYOffset;
      var catOpt = {
        _growFromZero: true,
        animation: true, animationDuration: 1000, animationEasing: 'cubicOut',
        animationDelay: 0, animationDurationUpdate: 600, animationEasingUpdate: 'cubicOut',
        // X-axis label rendering takes ~20px at fontSize 10 with margin 8 —
        // matches the date Column branch (colXAxisGridBottom). Replaces what
        // the legacy XLabels overlay reserved as a separate flex row below
        // the chart (height 12 + marginTop 4 = 16) plus the old grid.bottom
        // (pB=4) → net 20 reserved here. Mini variant keeps the smaller pB
        // since its axisLabel is hidden.
        grid: { left: catEffectivePL, right: pR, top: pT, bottom: mini ? pB : 20, containLabel: false },
        // Native ECharts xAxis (Phase 8 follow-up). Categorical has a small
        // fixed label set (3-8 segments) — show every label, no thinning
        // (interval:0). alignMinLabel/alignMaxLabel 'center' matches the
        // legacy XLabels centered:true behavior (every label centers under
        // its bar). Styling matches the date Column branch + the legacy
        // XLabels props (fontSize 10, weight 500, subtle text color).
        xAxis: {
          type: 'category',
          data: catLabels,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            show: !mini,
            interval: 0,
            hideOverlap: false,
            alignMinLabel: 'center',
            alignMaxLabel: 'center',
            fontSize: 10,
            fontWeight: 500,
            // Literal hex — ECharts canvas can't resolve CSS variables
            // so we use the literal that matches DEX subtle color.
            color: 'rgba(0,0,0,0.6)',
            fontFamily: 'inherit',
            margin: 8,
          },
        },
        yAxis: buildYAxisOpt(showOptionalAxis, fmt, catYChars, { min: 0, max: catRange.max, interval: catRange.interval }),
        tooltip: {
          show: !mini, trigger: 'axis', axisPointer: { type: 'none' },
          backgroundColor: tokens.colors.ui.tooltipBg, borderColor: 'transparent',
          textStyle: { color: tokens.colors.ui.whiteSurface, fontSize: 10, fontWeight: 700, fontFamily: tokens.typography.fontFamily.sans },
          formatter: function(params){
            var p = params[0];
            return '<div style="display:flex;align-items:center;gap:6px;line-height:1.5"><span style="display:inline-block;width:8px;height:8px;background:'+p.color+';border-radius:1px"></span><span>'+p.name+': '+fV(p.value,fmt)+'</span></div>';
          },
        },
        series: [{
          type: 'bar',
          data: catData.map(function(v, i){
            return { value: v, itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length], borderRadius: [2,2,0,0] } };
          }),
          // No barMaxWidth cap — bars fill their proportional slot of the
          // chart width (1/N each, minus barCategoryGap padding). Same
          // 20% category gap convention the standard Column variants use,
          // so density matches the rest of the library.
          barGap: compare && prevData ? '30%' : undefined,
          barCategoryGap: '20%',
        }],
      };
      // Compare overlay: add a second series with prevData sliced the
      // same way, painted in the matching SERIES_COLORS_COMPARE (200-series)
      // tone so the pairing reads "same color family, deeper for prior".
      // Same-hue family means the tooltip chip stays legible against the
      // dark tooltip background, and the contrast meets readability
      // standards better than the previous opacity approach.
      if (compare && prevData) {
        var catPrev = [];
        for (var cp = 0; cp < catCount; cp++) {
          catPrev.push(prevData[Math.min(cp * catStep, prevData.length - 1)]);
        }
        catOpt.series.push({
          type: 'bar',
          data: catPrev.map(function(v, i){
            return { value: v, itemStyle: { color: SERIES_COLORS_COMPARE[i % SERIES_COLORS_COMPARE.length], borderRadius: [2,2,0,0] } };
          }),
        });
        catOpt.tooltip.formatter = function(params){
          var tip = '';
          for (var pi = 0; pi < params.length; pi++) {
            var p = params[pi];
            var lbl = pi === 0 ? p.name : 'prev';
            tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5"><span style="display:inline-block;width:8px;height:8px;background:' + p.color + ';border-radius:1px"></span><span>' + lbl + ': ' + fV(p.value, fmt) + '</span></div>';
          }
          return tip;
        };
      }
      // X-axis labels now render via native ECharts axisLabel (configured
      // above). Both mini and non-mini paths use the same simple render —
      // axisLabel.show=!mini hides labels in mini, and grid.bottom adapts
      // via the mini ternary, so a single return covers both.
      return ce('div', { ref, style: { width: '100%', height: H } },
        ce(EChart, { option: catOpt, style: { width: '100%', height: '100%' } })
      );
    }

    var colLabels = dates.map(function(d){return fmtDateLabel(d,period);});
    var is7d = period === "Last 7 days", isYtd = period === "Year to date";
    var isMultiCol = (stacked || grouped) && seriesCount >= 2;
    var multiColData = isMultiCol ? buildMultiSeries(data, seriesCount) : null;
    // Compute the actual chart peak based on variant — used ONLY for
    // sizing the Y-axis label reservation (so the widest label that'll
    // render gets the right amount of horizontal space). We do NOT pin
    // ECharts' yAxis.max from this — that would force a different scale
    // than ECharts' default auto-pick and shrink bars relative to the
    // original chart heights. ECharts picks its own max from the data
    // (preserving original heights); our formatter then displays
    // whatever ticks it chooses using the K/M/B suffix conventions.
    //
    // Exception: 100% stacked (`normalize`) — there we DO pin max=100
    // since the data has been normalized to percentages and the axis
    // needs a fixed 0-100 range.
    var colYFmt = (isMultiCol && stacked && normalize) ? 'in percent' : fmt;
    var colDataPeak;
    if (isMultiCol && stacked && normalize) {
      colDataPeak = 100;
    } else if (isMultiCol && stacked) {
      // Stacked: total bar height at each X = sum of all series.
      colDataPeak = 0;
      for (var sx = 0; sx < multiColData[0].length; sx++) {
        var sum = 0;
        for (var ss = 0; ss < seriesCount; ss++) sum += multiColData[ss][sx];
        if (sum > colDataPeak) colDataPeak = sum;
      }
    } else if (isMultiCol && grouped) {
      // Grouped: bars are side-by-side, so peak = max across all series.
      colDataPeak = 0;
      for (var gx = 0; gx < multiColData.length; gx++) {
        for (var gxx = 0; gxx < multiColData[gx].length; gxx++) {
          if (multiColData[gx][gxx] > colDataPeak) colDataPeak = multiColData[gx][gxx];
        }
      }
    } else {
      // Single series, optionally paired with prevData for compare.
      colDataPeak = data.reduce(function(m, v){ return v > m ? v : m; }, 0);
      if (compare && prevData) {
        colDataPeak = prevData.reduce(function(m, v){ return v > m ? v : m; }, colDataPeak);
      }
    }

    // Compute the nice {max, interval} pair via niceAxisRange so the
    // Y-axis is capped at exactly 6 ticks (including the 0 line). For
    // 100% stacked, override with a fixed 0-100 range at 25 per step
    // (= 5 ticks: 0/25/50/75/100). niceAxisRange's max may exceed the
    // raw data peak slightly (e.g. peak 1617 → max 2000) but it ensures
    // clean intervals; bar heights scale proportionally.
    var colRange = (isMultiCol && stacked && normalize)
      ? { max: 100, interval: 20 }
      : niceAxisRange(colDataPeak);
    var colYChars = yAxisCharLimit(W2);
    // Measure against the computed max (which is what ECharts will render
    // as the topmost tick label) so the reserved width matches exactly.
    var colYOffset = yAxisReservedWidth(colRange.max, colYFmt, colYChars, showOptionalAxis);
    var colEffectivePL = pL + colYOffset;
    var colYExtra = { min: 0, max: colRange.max, interval: colRange.interval };

    // Phase 9: dual-axis X for Column. The BARS bind to a hidden category
    // axis (xAxisIndex 0) — kept exactly as-is so all bar positioning,
    // stacking, grouping, and grow-from-zero animation are untouched. A
    // SECOND value axis (xAxisIndex 1) renders the date labels at exactly
    // even value intervals, so label pixel spacing is uniform at every
    // width (no category-snapping wobble), and the labels stay on the
    // canvas (export-safe). The value axis maps value→nearest date via a
    // formatter.
    //
    // Centered periods (Last 7 days / Year to date): the value axis spans
    // -0.5 → L-0.5 so its integer ticks land exactly on the bar centers,
    // and interval=1 shows a label under every bar (the "centered" look).
    // Other periods: the value axis spans 0 → L-1 with a fractional
    // interval that splits it into equal segments, first label pinned to
    // the left pad, last to the right pad.
    var colCentered = is7d || isYtd;
    // X-axis label rendering takes ~20px at fontSize 10 with margin 8.
    // Replaces what the old <XLabels> component reserved as a separate
    // div below the chart (height 12 + marginTop 4 = 16) plus the
    // chart's old grid.bottom (pB=4) → net 20 reserved here.
    var colXAxisGridBottom = mini ? pB : 20;
    // Multi-series tooltip: list every series with its color chip.
    var multiTooltipFmt = function(params){
      var tip = '';
      for (var pi = 0; pi < params.length; pi++) {
        var p = params[pi];
        tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5"><span style="display:inline-block;width:8px;height:8px;background:' + p.color + ';border-radius:1px"></span><span>Series ' + (pi+1) + ': ' + fV(p.value, fmt) + '</span></div>';
      }
      return tip;
    };
    // Single-series + compare formatter: chip + "Current"/"Previous" label
    // + white value. Square chips for the bar-family Column.
    var colCompareTooltipFmt = function(params){
      var tip = '<div style="display:flex;align-items:center;gap:6px;line-height:1.5">'
        + tooltipChipHtml(tokens.colors.chart.dataBlue100, 'square', false)
        + '<span>Current: ' + fV(params[0].value, fmt) + '</span></div>';
      if (params.length > 1) {
        tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5">'
          + tooltipChipHtml(tokens.colors.chart.dataGreen100, 'square', false)
          + '<span>Previous: ' + fV(params[1].value, fmt) + '</span></div>';
      }
      return tip;
    };
    var colSingleTooltipFmt = function(params){ return fV(params[0].value, fmt); };
    var colL = dates.length;
    var colMaxN = Math.max(2, Math.min(Math.floor((W2 - colEffectivePL - pR) / (isYtd ? 40 : 60)), colL));
    // CATEGORY axis the bars bind to.
    //  - Centered (7d / YTD): show the labels HERE. A category axis with
    //    boundaryGap:true centers each label in its band = dead-center
    //    under the bar/group, natively. This is the reliable way to get
    //    the "label centered under bar" look (no value-axis tick-placement
    //    guesswork).
    //  - Non-centered (30/90d): hide these; the value axis below renders
    //    evenly-spaced labels instead.
    var colXAxisOpt = {
      type: "category",
      data: colLabels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: colCentered ? {
        show: !mini,
        interval: 0, // every category labeled, centered under its bar/group
        hideOverlap: false,
        fontSize: 10,
        fontWeight: 500,
        color: 'rgba(0,0,0,0.6)',
        fontFamily: 'inherit',
        margin: 8,
      } : { show: false },
    };
    // VALUE axis — only for non-centered periods. Renders date labels at
    // exactly even value intervals (0 → L-1), uniform pixel spacing,
    // export-safe canvas text. position:'bottom' (a 2nd xAxis defaults to
    // top). First label at value 0 (left pad), last at L-1 (right pad).
    var colLabelAxisOpt = colCentered ? null : {
      type: 'value',
      position: 'bottom',
      min: 0,
      max: colL - 1,
      interval: (colL - 1) / (colMaxN - 1),
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        show: !mini,
        showMinLabel: true,
        showMaxLabel: true,
        alignMinLabel: 'left',
        alignMaxLabel: 'right',
        hideOverlap: false,
        fontSize: 10,
        fontWeight: 500,
        color: 'rgba(0,0,0,0.6)',
        fontFamily: 'inherit',
        margin: 8,
        formatter: function(val){
          var i = Math.round(val);
          if (i < 0) i = 0; else if (i > colL - 1) i = colL - 1;
          return fmtDateLabel(dates[i], period);
        },
      },
    };
    var colXAxisFinal = colLabelAxisOpt ? [colXAxisOpt, colLabelAxisOpt] : colXAxisOpt;
    var colOpt = {_growFromZero:true,textStyle:{color:'rgba(0,0,0,0.6)'},color:isMultiCol?SERIES_COLORS.slice(0,seriesCount):[tokens.colors.chart.dataBlue100],animation:true,animationDuration:1000,animationEasing:"cubicOut",animationDelay:0,animationDurationUpdate:600,animationEasingUpdate:"cubicOut",grid:{left:colEffectivePL,right:pR,top:pT,bottom:colXAxisGridBottom,containLabel:false},xAxis:colXAxisFinal,yAxis:buildYAxisOpt(showOptionalAxis,colYFmt,colYChars,colYExtra),tooltip:{show:!mini,trigger:"axis",backgroundColor:tokens.colors.ui.tooltipBg,borderColor:"transparent",textStyle:{color:tokens.colors.ui.whiteSurface,fontSize:10,fontWeight:700,fontFamily:tokens.typography.fontFamily.sans},formatter:isMultiCol?multiTooltipFmt:(compare?colCompareTooltipFmt:colSingleTooltipFmt)},series:[]};
    if (isMultiCol && stacked) {
      // Stacked: all segments share stack:"total"; only the topmost segment
      // (last in the array) gets rounded top corners — others stay square so
      // the seam between segments reads as flat.
      //
      // 100% mode: normalize each column so all bars total 100% — surfaces
      // mix-shift over time independent of absolute totals.
      var seriesForRender = multiColData;
      if (normalize) {
        // Compute per-category totals across all series, then express each
        // series' value as a percentage of that total.
        var rowCount = multiColData[0].length;
        var pctData = [];
        for (var si = 0; si < seriesCount; si++) pctData.push([]);
        for (var ri = 0; ri < rowCount; ri++) {
          var rowTotal = 0;
          for (var sj = 0; sj < seriesCount; sj++) rowTotal += multiColData[sj][ri];
          if (rowTotal === 0) rowTotal = 1;
          for (var sk = 0; sk < seriesCount; sk++) {
            pctData[sk].push(Math.round((multiColData[sk][ri] / rowTotal) * 1000) / 10);
          }
        }
        seriesForRender = pctData;
      }
      for (var ci = 0; ci < seriesCount; ci++) {
        colOpt.series.push({
          type:"bar",
          data: seriesForRender[ci],
          stack: "total",
          barMaxWidth: 40,
          barCategoryGap: is7d || isYtd ? "16%" : "20%",
          itemStyle:{
            color: SERIES_COLORS[ci],
            borderRadius: ci === seriesCount - 1 ? [2,2,0,0] : [0,0,0,0],
          },
        });
      }
      if (normalize) {
        // 100% stacked override: yAxis is already configured up front via
        // colYFmt='in percent' + colNiceMax=100 when normalize is on, so
        // no axis change needed here. Just override the tooltip formatter
        // to show segment values as percentages.
        colOpt.tooltip.formatter = function(params){
          var tip = '';
          for (var pi = 0; pi < params.length; pi++) {
            var p = params[pi];
            tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5"><span style="display:inline-block;width:8px;height:8px;background:' + p.color + ';border-radius:1px"></span><span>Series ' + (pi+1) + ': ' + p.value + '%</span></div>';
          }
          return tip;
        };
      }
    } else if (isMultiCol && grouped) {
      // Grouped: each series renders side-by-side within the category band.
      // barCategoryGap controls between-group spacing; barGap controls
      // within-group spacing. Within-group is set to half (relative to
      // category band) so the eye reads each group as a unit, separated
      // by a visibly wider gap from the next group.
      for (var gi = 0; gi < seriesCount; gi++) {
        var sOpt = {
          type:"bar",
          data: multiColData[gi],
          itemStyle:{ color: SERIES_COLORS[gi], borderRadius: [2,2,0,0] },
        };
        if (gi === 0) {
          // Set spacing once on the first series; ECharts applies it to the
          // whole bar coordinate system.
          sOpt.barCategoryGap = "32%";
          sOpt.barGap = "16%";
        }
        colOpt.series.push(sOpt);
      }
    } else {
      // Single-series + optional compare overlay — preserves existing styling.
      colOpt.series.push({type:"bar",data:data,barMaxWidth:is7d?undefined:40,barGap:is7d?"5%":(isYtd?"5%":undefined),barCategoryGap:is7d?"16%":(isYtd?"16%":undefined),itemStyle:{color:tokens.colors.chart.dataBlue100,borderRadius:[2,2,0,0]}});
      if (compare && prevData) colOpt.series.push({type:"bar",data:prevData,barMaxWidth:is7d?undefined:40,itemStyle:{color:tokens.colors.chart.dataGreen100,borderRadius:[2,2,0,0]}});
    }
    // All X labels are canvas (rendered by the value axis) — single
    // return for mini and full, no DOM overlay.
    return ce("div",{ref,style:{width:"100%",height:H}}, ce(EChart,{option:colOpt,style:{width:"100%",height:"100%"}}));
  }

  // Line / Area
  var isArea = type === "Area";
  var isMultiLineSeries = (type === 'Line' || type === 'Area') && !stacked && !grouped && seriesCount >= 2;
  var multiLineData = isMultiLineSeries ? buildMultiSeries(data, seriesCount) : null;
  // Multi-series tooltip: list every series with its color chip.
  // Multi-series tooltip — every chip is a LINE shape since this is the
  // Line/Area chart family (the chart strokes are lines, so the tooltip
  // chip should match).
  var multiLineTooltipFmt = function(params){
    var tip = '';
    for (var pi = 0; pi < params.length; pi++) {
      var p = params[pi];
      tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5">'
        + tooltipChipHtml(p.color, 'line', false)
        + '<span>Series ' + (pi+1) + ': ' + fV(p.value, fmt) + '</span></div>';
    }
    return tip;
  };
  // Compare tooltip — solid line chip + "Current" for the current period,
  // DASHED line chip + "Previous" for the prior period (matches the
  // dashed prior-period line drawn on the chart).
  var laCompareTooltipFmt = function(params){
    var tip = '<div style="display:flex;align-items:center;gap:6px;line-height:1.5">'
      + tooltipChipHtml(tokens.colors.chart.dataBlue100, 'line', false)
      + '<span>Current: ' + fV(params[0].value, fmt) + '</span></div>';
    if (params.length > 1) {
      tip += '<div style="display:flex;align-items:center;gap:6px;line-height:1.5">'
        + tooltipChipHtml(tokens.colors.chart.dataGreen100, 'line', true)
        + '<span>Previous: ' + fV(params[1].value, fmt) + '</span></div>';
    }
    return tip;
  };
  var laSingleTooltipFmt = function(params){ return fV(params[0].value, fmt); };
  // Y-axis sizing for Line/Area — same pattern as Column. Peak is the
  // highest value across whatever series will render: multi-series →
  // max across all lines at any X; single + compare → max(data, prevData);
  // single → max(data). niceAxisRange gives the {max, interval} pair
  // that caps ticks at 6 (incl. 0). When showOptionalAxis is off, laEffectivePL
  // === pL and the existing geometry is preserved.
  var laDataPeak = 0;
  if (isMultiLineSeries) {
    for (var lpi = 0; lpi < multiLineData.length; lpi++) {
      for (var lpj = 0; lpj < multiLineData[lpi].length; lpj++) {
        if (multiLineData[lpi][lpj] > laDataPeak) laDataPeak = multiLineData[lpi][lpj];
      }
    }
  } else {
    laDataPeak = data.reduce(function(m, v){ return v > m ? v : m; }, 0);
    if (compare && prevData) {
      laDataPeak = prevData.reduce(function(m, v){ return v > m ? v : m; }, laDataPeak);
    }
  }
  var laRange = niceAxisRange(laDataPeak);
  var laYChars = yAxisCharLimit(W2);
  var laYOffset = yAxisReservedWidth(laRange.max, fmt, laYChars, showOptionalAxis);
  var laEffectivePL = pL + laYOffset;

  // Phase 9: native ECharts VALUE x-axis. Replaces the category axis +
  // React-overlay edge labels. A value axis lets us pin ticks at exactly
  // even value intervals (0 → L-1), so label pixel spacing is uniform at
  // every width — first tick at value 0 (left pad), last at value L-1
  // (right pad), and the in-between ticks evenly distributed. The
  // formatter maps each tick's value back to the nearest date. All labels
  // are ECharts canvas text (so they export with the chart), and there's
  // no more hybrid DOM edge-label overlay to keep aligned.
  var laL = dates.length;
  // Max labels that fit at the per-label min width (60px / 40px YTD),
  // clamped to [2, L]. The tick interval is the fractional step that
  // divides 0..L-1 into (maxN-1) EQUAL segments — guarantees even pixel
  // spacing with both endpoints landing exactly on a tick.
  var laMaxN = Math.max(2, Math.min(Math.floor((W2 - laEffectivePL - pR) / (period === "Year to date" ? 40 : 60)), laL));
  var laTickInterval = (laL - 1) / (laMaxN - 1);
  var laXAxisGridBottom = mini ? pB : 20;
  var laXAxisOpt = {
    type: 'value',
    min: 0,
    max: laL - 1,
    interval: laTickInterval,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: {
      show: !mini,
      showMinLabel: true,
      showMaxLabel: true,
      // Pin the first/last label edges to the plot bounds (rest center
      // on their tick) so the axis reads edge-to-edge.
      alignMinLabel: 'left',
      alignMaxLabel: 'right',
      hideOverlap: false,
      fontSize: 10,
      fontWeight: 500,
      // Literal color — canvas can't resolve the CSS-var token.
      color: 'rgba(0,0,0,0.6)',
      fontFamily: 'inherit',
      margin: 8,
      // Tick value (may be fractional, e.g. 5.8) → nearest real date.
      formatter: function(val){
        var i = Math.round(val);
        if (i < 0) i = 0; else if (i > laL - 1) i = laL - 1;
        return fmtDateLabel(dates[i], period);
      },
    },
  };
  // Value axis needs explicit [x, y] pairs (x = data index).
  function laXY(arr){ return arr.map(function(y, i){ return [i, y]; }); }
  var laOpt = {_clipReveal:true,textStyle:{color:'rgba(0,0,0,0.6)'},color:isMultiLineSeries?SERIES_COLORS.slice(0,seriesCount):[tokens.colors.chart.dataBlue100],animation:false,grid:{left:laEffectivePL,right:pR,top:pT,bottom:laXAxisGridBottom,containLabel:false},xAxis:laXAxisOpt,yAxis:buildYAxisOpt(showOptionalAxis,fmt,laYChars,{min:0,max:laRange.max,interval:laRange.interval}),tooltip:{show:!mini,trigger:"axis",appendToBody:true,backgroundColor:tokens.colors.ui.tooltipBg,borderColor:"transparent",textStyle:{color:tokens.colors.ui.whiteSurface,fontSize:10,fontWeight:700,fontFamily:tokens.typography.fontFamily.sans},formatter:isMultiLineSeries?multiLineTooltipFmt:(compare?laCompareTooltipFmt:laSingleTooltipFmt)},series:[]};
  if (isMultiLineSeries) {
    // Multi-series Line/Area — every line is SOLID in SERIES_COLORS order.
    // Compare-overlay dashed treatment is reserved for the dedicated
    // "with comparison overlay" variant. For Area, fill opacity steps
    // down as series count grows so overlap zones stay readable: 2 → 0.12
    // (single-series baseline), 3 → 0.10, 4 → 0.08.
    var areaOpacity = seriesCount === 2 ? 0.12 : seriesCount === 3 ? 0.10 : 0.08;
    for (var li = 0; li < seriesCount; li++) {
      laOpt.series.push({
        type: 'line', data: laXY(multiLineData[li]),
        smooth: false, symbol: 'circle', symbolSize: 0,
        emphasis: { scale: false, itemStyle: { borderWidth: 2, borderColor: SERIES_COLORS[li], color: tokens.colors.ui.whiteSurface }, symbolSize: 9 },
        lineStyle: { width: 2, color: SERIES_COLORS[li] },
        itemStyle: { color: SERIES_COLORS[li] },
        areaStyle: isArea ? { color: SERIES_COLORS[li], opacity: areaOpacity } : undefined,
      });
    }
  } else {
    // Single-series + optional compare overlay (existing behavior).
    laOpt.series.push({type:"line",data:laXY(data),smooth:false,symbol:"circle",symbolSize:0,emphasis:{scale:false,itemStyle:{borderWidth:2,borderColor:tokens.colors.chart.dataBlue100,color:tokens.colors.ui.whiteSurface},symbolSize:9},lineStyle:{width:2,color:tokens.colors.chart.dataBlue100},itemStyle:{color:tokens.colors.chart.dataBlue100},areaStyle:isArea?{color:tokens.colors.chart.dataBlue100,opacity:0.12}:undefined});
    if (compare && prevData) laOpt.series.push({type:"line",data:laXY(prevData),smooth:false,symbol:"circle",symbolSize:0,lineStyle:{width:2,type:"dashed",color:tokens.colors.chart.dataGreen100},itemStyle:{color:tokens.colors.chart.dataGreen100}});
  }
  // All labels are canvas now (no DOM overlay) — single return for mini
  // and full.
  return ce("div",{ref,style:{width:"100%",height:H}}, ce(EChart,{option:laOpt,style:{width:"100%",height:"100%"}}));
}
