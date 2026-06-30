// Top-level layout for the chart library gallery. Two columns: a fixed
// left panel that holds the brand header, search input, and chart-type
// list; and a main area that shows the selected type's variants. The
// widget-frame toggle floats in the upper-right of the gray main area
// without a container.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DexInput, DexSwitch, DexIcon, DexTooltip, DexDropdownMenu, DexModal, DexModalBody, DexModalContent, DexModalHeading, DexModalFooter, DexButton, DexLink, useNotification } from '../mocks/dex-react/index.jsx';
import { tokens } from '../styles/tokens.js';
import { CHART_CATALOG, getCatalogEntry, getAllVariants } from '../chartCatalog.js';
import { BM } from './galleryData.js';
import GalleryWidget, { BareChart } from './GalleryWidget.jsx';

var LS_TYPE = 'chart-library:selected-type';
var LS_FRAME = 'chart-library:frame-on';
var LS_OPTIONAL_AXIS = 'chart-library:show-optional-axis';

function readType() {
  try {
    var v = localStorage.getItem(LS_TYPE);
    return getCatalogEntry(v) ? v : CHART_CATALOG[0].id;
  } catch (_) { return CHART_CATALOG[0].id; }
}
function readFrame() {
  try {
    var v = localStorage.getItem(LS_FRAME);
    if (v === null) return true;
    return v === '1';
  } catch (_) { return true; }
}
// Optional-axis toggle defaults to ON — the gallery always opens with axes
// visible. User preference is persisted in localStorage so toggling off
// survives a page refresh, but fresh sessions start with axes shown.
function readOptionalAxis() {
  try {
    var v = localStorage.getItem(LS_OPTIONAL_AXIS);
    if (v === null) return true;
    return v === '1';
  } catch (_) { return true; }
}

// --- Search helpers ------------------------------------------------------
// Lowercase + strip common punctuation so "100%", "p&l", "drop-off", etc.
// all reduce to comparable word streams. The arrow glyph used in some
// catalog text (→) and em/en dashes get scrubbed too so they never split
// a meaningful token from its neighbors.
function normalizeText(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[–—→]/g, ' ')     // en/em dash, → arrow
    .replace(/[%+()\/\-]/g, ' ')                // common punctuation
    .replace(/[^\w\s&]/g, ' ')                  // keep word chars, spaces, &
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeQuery(q) {
  var n = normalizeText(q);
  if (!n) return [];
  return n.split(' ').filter(function(t){ return t.length > 0; });
}

// Stopwords stripped from queries before semantic matching. Lets a
// natural-language query like "best chart for revenue" or "show charts
// for leads" reduce to the meaningful intent token(s) ("revenue",
// "leads") instead of failing the AND-semantics filter because of
// surrounding filler words.
var SEARCH_STOPWORDS = new Set([
  'a','an','the','and','or','of','to','for','with','on','in','is','are','be',
  'best','better','good','great','top','suitable','recommended',
  'chart','charts','graph','graphs','viz','visualization','visualisation',
  'show','display','give','find','help','need','want','looking','use',
  'me','my','i','we','us','you','your',
  'what','which','how','why','when','where',
  'about','some','any','all','only','just','please','can','could','should','would','do','does','did',
  'something','anything','everything','kind','type','types','sort',
  'metric','metrics','data','dataset','value','values',
  'see','view','using',
]);

// Build the metric lookup once at module load. Pulls the canonical names
// from BM (the benchmark map in chartHelpers) — that's the single source
// of truth for valid metric names across the library. Each name is
// indexed in lowercase plus a plural/singular variant so queries like
// "lead", "leads", "ORDER", "orders" all resolve to the right canonical.
function buildMetricLookup() {
  var lookup = new Map(); // lc-name (or stem) -> canonical
  var names = Object.keys(BM || {});
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var lc = name.toLowerCase();
    lookup.set(lc, name);
    // Naive plural/singular tolerance: register both forms when the
    // canonical ends in 's' (Bookings → Booking) and a plural form
    // when it doesn't (Revenue → revenues).
    if (lc.endsWith('s')) lookup.set(lc.slice(0, -1), name);
    else lookup.set(lc + 's', name);
  }
  return lookup;
}
var METRIC_LOOKUP = buildMetricLookup();

// Detect a metric name in the query. Tries (in order):
//   1. The FULL pre-stopword phrase — catches multi-word metric names
//      that include words otherwise treated as stopwords. e.g. "Top
//      Products" includes "top" which is a stopword for "best/top
//      chart" intent; checking the raw phrase first lets the metric
//      detection still fire.
//   2. The stopword-filtered phrase.
//   3. Any sliding window of 2+ tokens (raw) to catch partial phrases
//      like "show me top products please".
//   4. Any single token, content or raw, that matches a metric name
//      (catches "revenue", "leads", "orders").
// Returns the canonical name (matching BM keys + type.goodFor entries)
// or null if no metric is referenced.
function detectMetric(rawTokens, contentTokens) {
  if (!rawTokens.length) return null;
  var rawPhrase = rawTokens.join(' ');
  if (METRIC_LOOKUP.has(rawPhrase)) return METRIC_LOOKUP.get(rawPhrase);
  if (contentTokens.length) {
    var contentPhrase = contentTokens.join(' ');
    if (METRIC_LOOKUP.has(contentPhrase)) return METRIC_LOOKUP.get(contentPhrase);
  }
  // Sliding window over the raw tokens (longest first) so phrases like
  // "best chart for top products" still resolve to "Top Products".
  for (var w = rawTokens.length; w >= 2; w--) {
    for (var s = 0; s + w <= rawTokens.length; s++) {
      var win = rawTokens.slice(s, s + w).join(' ');
      if (METRIC_LOOKUP.has(win)) return METRIC_LOOKUP.get(win);
    }
  }
  // Single-token fallback. Prefer content tokens so we don't accidentally
  // grab a stopword that happens to overlap a metric (none do today, but
  // it's a defensive ordering).
  for (var i = 0; i < contentTokens.length; i++) {
    var hit = METRIC_LOOKUP.get(contentTokens[i]);
    if (hit) return hit;
  }
  for (var j = 0; j < rawTokens.length; j++) {
    var hit2 = METRIC_LOOKUP.get(rawTokens[j]);
    if (hit2) return hit2;
  }
  return null;
}

// Score a variant against a tokenized query. Two intent paths:
//
// 1. Metric-intent path — when the query references a known metric
//    name (e.g. "best chart for revenue", "show me leads", "top
//    products"). Variants whose type.goodFor includes that metric get
//    a large boost, ranked by position in the goodFor array (earlier
//    = better fit). Variants whose sample.metric uses the same metric
//    get an additional boost since they literally render with that
//    metric in the gallery. Variants outside that scope are still
//    eligible if other tokens hit their fields directly.
//
// 2. Keyword-intent path — when no metric is detected (e.g. "bar",
//    "stacked", "compare"). Falls back to the original token-vs-field
//    scoring with AND semantics across the stopword-stripped tokens
//    (each remaining content token must hit at least one field).
//
// Stopwords are filtered before either path runs so "best chart for X"
// reduces to "X", letting natural-language queries route to the right
// path without polluting the token list.
function scoreVariantMatch(entry, tokens) {
  if (!tokens.length) return 0;
  var t = entry.type, v = entry.variant;
  var contentTokens = tokens.filter(function(tok){ return !SEARCH_STOPWORDS.has(tok); });
  // If every token was a stopword, treat the query as a no-op match.
  if (!contentTokens.length) return -1;

  var detectedMetric = detectMetric(tokens, contentTokens);
  var goodForIdx = (detectedMetric && t.goodFor) ? t.goodFor.indexOf(detectedMetric) : -1;
  var metricBoost = 0;
  if (goodForIdx !== -1) {
    // Earlier in goodFor = stronger recommendation. Cap at 5 positions
    // so the curve doesn't drop to zero for long goodFor arrays.
    metricBoost = 300 - Math.min(goodForIdx, 5) * 30; // 300, 270, 240, 210, 180, 150 floor
    if (v.sample && v.sample.metric === detectedMetric) metricBoost += 60;
  }

  // Strip the matched metric phrase from contentTokens so we don't
  // require it to ALSO hit a field — it already matched via goodFor.
  // For multi-word metrics, that's the whole contentTokens array.
  var remaining = contentTokens;
  if (detectedMetric) {
    var metricLc = detectedMetric.toLowerCase();
    var metricToks = new Set(metricLc.split(' '));
    // Also forgive plural/singular variants of single-token metrics.
    if (metricToks.size === 1) {
      var only = Array.from(metricToks)[0];
      if (only.endsWith('s')) metricToks.add(only.slice(0, -1));
      else metricToks.add(only + 's');
    }
    remaining = contentTokens.filter(function(tok){ return !metricToks.has(tok); });
  }

  var kw = (t.keywords || []).concat(v.keywords || []).join(' ');
  var fields = [
    { text: normalizeText(t.label),                 w: 100 },
    { text: normalizeText(v.label),                 w: 90 },
    { text: normalizeText(kw),                      w: 60 },
    { text: normalizeText(t.description),           w: 30 },
    { text: normalizeText(v.description),           w: 25 },
    { text: normalizeText(v.example),               w: 20 },
    { text: normalizeText(t.examples),              w: 18 },
    { text: normalizeText(v.sample && v.sample.metric), w: 15 },
    { text: normalizeText(t.id),                    w: 10 },
    { text: normalizeText(v.id),                    w: 10 },
  ];

  // If a metric was detected AND the type recommends it, the variant
  // is in. Score remaining tokens against fields but don't require
  // them to hit — they're bonus signal on top of the metric match.
  if (metricBoost > 0) {
    var bonus = 0;
    for (var i = 0; i < remaining.length; i++) {
      var tok = remaining[i];
      for (var j = 0; j < fields.length; j++) {
        var f = fields[j];
        if (!f.text) continue;
        if (f.text.indexOf(tok) !== -1) { bonus += f.w * 0.3; break; }
      }
    }
    return metricBoost + bonus;
  }

  // No metric (or metric not in this type's goodFor) — fall back to
  // AND-semantics token matching across the content tokens.
  var total = 0;
  for (var ti = 0; ti < remaining.length; ti++) {
    var rt = remaining[ti];
    var bestForToken = 0;
    for (var fi = 0; fi < fields.length; fi++) {
      var ff = fields[fi];
      if (!ff.text) continue;
      var idx = ff.text.indexOf(rt);
      if (idx === -1) continue;
      var s = ff.w;
      var before = idx === 0 ? ' ' : ff.text.charAt(idx - 1);
      var after = (idx + rt.length === ff.text.length) ? ' ' : ff.text.charAt(idx + rt.length);
      if (before === ' ' && after === ' ') s = s * 1.2;
      if (s > bestForToken) bestForToken = s;
    }
    if (bestForToken === 0) return -1;  // token missed everywhere → reject
    total += bestForToken;
  }
  return total || -1;
}


// Window-width threshold at which the left nav collapses from full
// (260px with labels + count badges) to compact (64px icons-only with
// hover tooltips). 720px is the "really tight" cutoff — at this width
// the main area is ~430px which only fits a single chart column, so
// reclaiming 200px from the nav meaningfully improves the chart view.
// Above 720px, the full nav stays expanded with labels.
var LEFT_NAV_COMPACT_BREAKPOINT = 720;
// Window-width threshold at which the two header toggles collapse into
// a tri-dot (⋮) menu. 980px is just above the point where the chart
// grid drops to single-column with the full 260px nav visible, so
// collapsing the toggles frees header space before it feels cramped.
var TOGGLES_COMPACT_BREAKPOINT = 980;

export default function ChartGallery() {
  var [selectedId, setSelectedId] = useState(readType);
  var [frameOn, setFrameOn] = useState(readFrame);
  var [showOptionalAxis, setShowOptionalAxis] = useState(readOptionalAxis);
  var [search, setSearch] = useState('');
  // debouncedQuery is the value that actually drives search results — it
  // trails the raw input by 300ms so the chart grid only re-renders
  // once the user has paused, not on every keystroke.
  var [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(function() {
    var tid = setTimeout(function() { setDebouncedQuery(search.trim()); }, 300);
    return function() { clearTimeout(tid); };
  }, [search]);
  // Track whether the viewport is narrow enough to collapse the left
  // nav to icon-only. SSR-safe: defaults to false when window is
  // undefined (we expand on first client paint via the effect).
  var [navCompact, setNavCompact] = useState(function() {
    return typeof window !== 'undefined' && window.innerWidth < LEFT_NAV_COMPACT_BREAKPOINT;
  });
  // Track whether the viewport is narrow enough that the two header
  // toggles should collapse into a single tri-dot menu. Mirrors the
  // navCompact pattern — only re-renders when crossing the boundary.
  var [togglesCompact, setTogglesCompact] = useState(function() {
    return typeof window !== 'undefined' && window.innerWidth < TOGGLES_COMPACT_BREAKPOINT;
  });
  // Whether the floating search bar overlay is visible in the main area.
  // Only meaningful when navCompact is true — cleared automatically on expand.
  var [compactSearchOpen, setCompactSearchOpen] = useState(false);
  // Ref that always holds the latest search value so the navCompact
  // transition effect can read it without listing search as a dependency
  // (which would re-fire the effect on every keystroke).
  var searchRef = useRef(search);
  searchRef.current = search;

  useEffect(function() { try { localStorage.setItem(LS_TYPE, selectedId); } catch (_) {} }, [selectedId]);
  useEffect(function() { try { localStorage.setItem(LS_FRAME, frameOn ? '1' : '0'); } catch (_) {} }, [frameOn]);
  useEffect(function() { try { localStorage.setItem(LS_OPTIONAL_AXIS, showOptionalAxis ? '1' : '0'); } catch (_) {} }, [showOptionalAxis]);
  // Resize listener that toggles compact mode on the threshold. Only
  // re-renders when crossing the boundary (state stays the same below/
  // above), so this isn't a per-pixel re-render cost.
  useEffect(function() {
    function onResize() {
      var isCompact = window.innerWidth < LEFT_NAV_COMPACT_BREAKPOINT;
      setNavCompact(function(prev) { return prev === isCompact ? prev : isCompact; });
      var isTogglesCompact = window.innerWidth < TOGGLES_COMPACT_BREAKPOINT;
      setTogglesCompact(function(prev) { return prev === isTogglesCompact ? prev : isTogglesCompact; });
    }
    window.addEventListener('resize', onResize);
    return function() { window.removeEventListener('resize', onResize); };
  }, []);
  // Sync floating search bar with nav compact transitions in both directions:
  //   compact → expanded: close floating bar; query migrates to DexInput (no clear)
  //   expanded → compact: if a query was active, surface the floating bar with it
  // searchRef gives us the current query at transition time without adding
  // search to the dep array (which would re-fire on every keystroke).
  useEffect(function() {
    if (!navCompact) {
      setCompactSearchOpen(false);
    } else if (searchRef.current) {
      setCompactSearchOpen(true);
    }
  }, [navCompact]);

  // Require at least 2 characters before activating search. A single
  // letter produces near-meaningless results (every chart with "b" in
  // the name for "b") and switching the whole right pane on one char
  // is jarring. 2+ chars gives the scorer enough signal to be useful.
  var searchActive = debouncedQuery.length >= 2;
  var query = debouncedQuery;

  var matchedVariants = useMemo(function() {
    if (!searchActive) return null;
    var tokens = tokenizeQuery(query);
    if (!tokens.length) return null;
    var scored = [];
    var all = getAllVariants();
    for (var i = 0; i < all.length; i++) {
      var sc = scoreVariantMatch(all[i], tokens);
      if (sc > 0) scored.push({ entry: all[i], score: sc });
    }
    scored.sort(function(a, b) { return b.score - a.score; });
    return scored.map(function(x) { return x.entry; });
  }, [searchActive, query]);

  var selectedType = getCatalogEntry(selectedId) || CHART_CATALOG[0];

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: tokens.typography.fontFamily.sans,
      background: 'var(--dex-bgColor-canvas, #f5f5f7)',
    }}>
      <LeftPanel
        selectedId={selectedId}
        onSelect={setSelectedId}
        searchActive={searchActive}
        matchedVariants={matchedVariants}
        search={search}
        onSearchChange={setSearch}
        compact={navCompact}
        compactSearchOpen={compactSearchOpen}
        onCompactSearchOpen={function(){ setCompactSearchOpen(true); }}
        onCompactSearchClose={function(){ setCompactSearchOpen(false); setSearch(''); }}
      />
      <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {navCompact && compactSearchOpen && (
          <FloatingSearchBar
            search={search}
            onSearchChange={setSearch}
            onClose={function(){ setCompactSearchOpen(false); setSearch(''); }}
          />
        )}
      <main style={{
        flex: 1,
        minHeight: 0,
        // When compact search is open, push content below the floating bar.
        // 88px = bar top-offset (16) + bar height (40) + 32px clearance gap.
        paddingTop: compactSearchOpen ? '88px' : tokens.spacing[8],
        paddingLeft: tokens.spacing[8],
        paddingRight: tokens.spacing[8],
        paddingBottom: tokens.spacing[16],
        position: 'relative',
        overflow: 'auto',
      }}>
        {/* Floating gallery toggles — at wide widths: two inline labels
            + switches in the upper-right corner. At narrow widths (when
            charts drop to single column): collapses to a single tri-dot
            (⋮) button that opens a DEX dropdown with both toggles. */}
        {selectedId !== 'api-reference' && (togglesCompact ? (
          <ToolsMenu
            showOptionalAxis={showOptionalAxis}
            setShowOptionalAxis={setShowOptionalAxis}
            frameOn={frameOn}
            setFrameOn={setFrameOn}
          />
        ) : (
          <div style={{
            position: 'absolute', top: tokens.spacing[5], right: tokens.spacing[8],
            display: 'flex', alignItems: 'center', gap: tokens.spacing[5],
            fontSize: tokens.typography.fontSize.xs, fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.ui.bodyText,
            zIndex: 5,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2.5], cursor: 'pointer' }}>
              <span>Optional axis</span>
              <DexSwitch checked={showOptionalAxis} onCheckedChange={setShowOptionalAxis} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2.5], cursor: 'pointer' }}>
              <span>Widget frame</span>
              <DexSwitch checked={frameOn} onCheckedChange={setFrameOn} />
            </label>
          </div>
        ))}
        {searchActive
          ? <SearchResultsArea matched={matchedVariants} frameOn={frameOn} showOptionalAxis={showOptionalAxis} query={query} />
          : compactSearchOpen
            ? null
            : selectedId === 'api-reference'
              ? <ApiReferencePanel />
              : <TypeArea type={selectedType} frameOn={frameOn} showOptionalAxis={showOptionalAxis} />
        }
      </main>
      </div>
    </div>
  );
}

function ApiReferencePanel() {
  var REPO_BASE = 'https://github.com/ThryvLabs/pdx-prototypes/blob/integration/data-viz-chart-library/src';
  var FILES = [
    { name: 'ChartRenderer.jsx', desc: 'Core engine — renders all chart types via ECharts + custom DOM. Accepts the props documented below.', href: REPO_BASE + '/lib/ChartRenderer.jsx' },
    { name: 'chartTokens.js',    desc: 'Canvas-safe resolved values for colors, axis, tooltip, and animation. Import this instead of using var(--dex-...) inside ECharts option objects.', href: REPO_BASE + '/lib/chartTokens.js' },
    { name: 'chartHelpers.js',   desc: 'Chart utilities: buildMultiSeries(), buildLabels(), axis formatters, and layout helpers.', href: REPO_BASE + '/lib/chartHelpers.js' },
  ];
  var PROPS = [
    { name: 'data',           type: 'array',   req: true,  desc: 'Metric values. Length matches dates for time-series charts. 2D array for multi-series.' },
    { name: 'dates',          type: 'array',   req: true,  desc: "X-axis labels (e.g. ['Mon', 'Tue', ...])." },
    { name: 'type',           type: 'string',  req: true,  desc: 'Chart type identifier: Column, Bar, Line, Area, Donut, Pie, Gauge, Scatter, Treemap, Funnel, Heatmap, Calendar, Waterfall, Bullet, Combo, Hero, Table, Reviews.' },
    { name: 'period',         type: 'string',  req: false, desc: "Current period label shown in the tooltip (e.g. 'Last 7 days')." },
    { name: 'animTick',       type: 'number',  req: false, desc: 'Increment to re-trigger entry animations on period change.' },
    { name: 'fmt',            type: 'string',  req: false, desc: "Value format: '$', '%', or omit for plain numbers." },
    { name: 'compare',        type: 'boolean', req: false, desc: 'Renders a comparison overlay using prevData.' },
    { name: 'prevData',       type: 'array',   req: false, desc: 'Prior-period values. Required when compare is true.' },
    { name: 'stacked',        type: 'boolean', req: false, desc: 'Stack series bars or areas.' },
    { name: 'grouped',        type: 'boolean', req: false, desc: 'Group multi-series bars side-by-side.' },
    { name: 'normalize',      type: 'boolean', req: false, desc: 'Normalize to a 100% stacked view.' },
    { name: 'series',         type: 'number',  req: false, desc: 'Number of data series for multi-series variants (2–4).' },
    { name: 'categorical',    type: 'boolean', req: false, desc: 'Render a single categorical bar/column (no time axis).' },
    { name: 'categories',     type: 'array',   req: false, desc: 'Category labels used when categorical is true.' },
    { name: 'showOptionalAxis', type: 'boolean', req: false, desc: 'Show the native ECharts axis (hidden by default in widget cards).' },
    { name: 'mini',           type: 'boolean', req: false, desc: 'Compact mode — suppresses labels, tooltips, and padding. Intended for sparkline/thumbnail placements where the chart fills a small fixed-size container.' },
    { name: 'scrollable',     type: 'boolean', req: false, desc: 'Enable horizontal scroll for wide Table data. Always pair with stickyFirst for the recommended variant.' },
    { name: 'stickyFirst',   type: 'boolean', req: false, desc: 'Pin the first column while the rest scroll horizontally. The sticky column shrinks and truncates with ellipsis, locking at a minimum readable width so row identity is never lost.' },
    { name: 'engine',         type: 'string',  req: false, desc: "Force the ECharts render path for types that have a custom DOM fallback. Pass 'echarts'." },
    { name: 'metric',         type: 'string',  req: false, desc: 'Metric key — used by Hero/Table/Reviews to select the correct data shape.' },
    { name: 'sparkline',      type: 'boolean', req: false, desc: 'Hero sparkline variant (line chart inside the metric card).' },
    { name: 'multiStat',      type: 'boolean', req: false, desc: 'Hero multi-stat layout (3-stat row with tinted icon badges).' },
  ];
  var DATA_EXAMPLE = [
    '// Single-series (Column, Bar, Line, Area, Donut, Pie, Gauge ...)',
    "data:  [120, 145, 98, 210, 175, 88, 132]",
    "dates: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']",
    '',
    '// Multi-series — series prop sets count (2–4)',
    "data:  [[120, 145, 98], [80, 95, 60], [40, 55, 38]]",
    "dates: ['Week 1', 'Week 2', 'Week 3']",
    '',
    '// Comparison mode — compare + prevData',
    'compare:  true',
    'data:     [120, 145, 98, 210]  // current period',
    'prevData: [100, 130, 110, 190]  // prior period',
    '',
    '// Categorical — categorical + categories',
    'categorical: true',
    "data:        [320, 210, 185, 140, 95]",
    "categories:  ['Email', 'SMS', 'Call', 'Chat', 'Other']",
  ].join('\n');

  var codeStyle = {
    display: 'block',
    fontFamily: tokens.typography.fontFamily.mono,
    fontSize: tokens.typography.fontSize.xs,
    background: 'var(--dex-fgColor-default)',
    color: 'var(--dex-bgColor-accent-beige-subtle)',
    padding: `${tokens.spacing[4]} ${tokens.spacing[5]}`,
    borderRadius: tokens.borderRadius.md,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: tokens.typography.lineHeight.relaxed,
    margin: 0,
  };
  var sectionHeadStyle = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.ui.cardTitle,
    margin: `0 0 ${tokens.spacing[3]}`,
    paddingBottom: tokens.spacing[2],
    borderBottom: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.08))',
  };
  var inlineCode = {
    fontFamily: tokens.typography.fontFamily.mono,
    fontSize: '0.9em',
    background: 'var(--dex-bgColor-accent-beige-subtle)',
    color: 'var(--dex-fgColor-accent-beige-emphasis)',
    borderRadius: 2,
    padding: '2px 6px',
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <header style={{ marginBottom: tokens.spacing[8] }}>
        <h1 style={{ margin: 0, fontSize: tokens.typography.fontSize.xl, fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.ui.cardTitle }}>
          API Reference
        </h1>
        <p style={{ margin: `${tokens.spacing[1.5]} 0 0`, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.ui.subtleText, lineHeight: 1.5, maxWidth: 620 }}>
          This gallery is the single source of truth for chart integration in AI Chat reporting.
          Copy the files below into your project, import <code style={inlineCode}>chartTokens</code>, and render charts with <code style={inlineCode}>ChartRenderer</code>.
        </p>
      </header>

      <section style={{ marginBottom: tokens.spacing[10] }}>
        <h2 style={sectionHeadStyle}>Source files</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
          {FILES.map(function(f) {
            return (
              <div key={f.name} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: tokens.spacing[2],
                padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                background: tokens.colors.ui.whiteSurface,
                border: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.08))',
                borderRadius: tokens.borderRadius.md,
              }}>
                <span style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.ui.subtleText, lineHeight: 1.45 }}>{f.desc}</span>
                <DexLink
                  href={f.href}
                  trailingIcon="external-link"
                  external
                  style={{ fontSize: tokens.typography.fontSize.sm }}
                >{f.name}</DexLink>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ marginBottom: tokens.spacing[10] }}>
        <h2 style={sectionHeadStyle}>chartTokens</h2>
        <p style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.ui.subtleText, lineHeight: 1.5, margin: `0 0 ${tokens.spacing[3]}` }}>
          ECharts renders to <code style={inlineCode}>&lt;canvas&gt;</code> — CSS custom properties
          (<code style={inlineCode}>var(--dex-...)</code>) cannot be read by the canvas drawing context at paint time.
          Use <code style={inlineCode}>chartTokens</code> for all color, axis, tooltip, and animation values inside ECharts option objects.
          DEX tokens remain correct for surrounding DOM elements (card borders, padding, typography).
        </p>
        <pre style={codeStyle}><code>{tokenizeCode(generateDesignTokens('')).map(function(tok, idx) {
          return <span key={idx} style={{ color: SH_COLORS[tok.type] || SH_COLORS.plain }}>{tok.text}</span>;
        })}</code></pre>
      </section>

      <section style={{ marginBottom: tokens.spacing[10] }}>
        <h2 style={sectionHeadStyle}>ChartRenderer props</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: tokens.typography.fontSize.sm }}>
            <thead>
              <tr style={{ background: 'var(--dex-bgColor-canvas, #f5f5f7)' }}>
                {['Prop', 'Type', 'Req', 'Description'].map(function(h) {
                  return (
                    <th key={h} style={{
                      padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                      textAlign: 'left', fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.ui.cardTitle, whiteSpace: 'nowrap',
                      borderBottom: '2px solid var(--dex-borderColor-default, rgba(0,0,0,0.08))',
                    }}>{h}</th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PROPS.map(function(p, i) {
                return (
                  <tr key={p.name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--dex-bgColor-canvas, #f5f5f7)' }}>
                    <td style={{ padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`, verticalAlign: 'top', borderBottom: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.06))', whiteSpace: 'nowrap' }}>
                      <code style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, color: 'var(--dex-fgColor-primary, #006ceb)' }}>{p.name}</code>
                    </td>
                    <td style={{ padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`, verticalAlign: 'top', borderBottom: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.06))', whiteSpace: 'nowrap' }}>
                      <code style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.ui.subtleText }}>{p.type}</code>
                    </td>
                    <td style={{ padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`, verticalAlign: 'top', borderBottom: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.06))', textAlign: 'center' }}>
                      {p.req && (
                        <span style={{
                          display: 'inline-block',
                          fontSize: tokens.typography.fontSize['2xs'], fontWeight: tokens.typography.fontWeight.semibold,
                          padding: `1px ${tokens.spacing[1.5]}`, borderRadius: tokens.borderRadius.base,
                          background: 'var(--dex-bgColor-primary-subtle, rgba(0,108,235,0.1))',
                          color: 'var(--dex-fgColor-primary, #006ceb)',
                        }}>yes</span>
                      )}
                    </td>
                    <td style={{ padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`, verticalAlign: 'top', borderBottom: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.06))', color: tokens.colors.ui.subtleText, lineHeight: 1.45 }}>
                      {p.desc}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: tokens.spacing[10] }}>
        <h2 style={sectionHeadStyle}>Data shape</h2>
        <p style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.ui.subtleText, lineHeight: 1.5, margin: `0 0 ${tokens.spacing[3]}` }}>
          For most chart types, <code style={inlineCode}>data</code> is a flat number array and
          <code style={inlineCode}> dates</code> is a matching string array.
          Multi-series accepts a 2D array (one inner array per series). The <code style={inlineCode}>Dev Reference</code> button on each variant shows the exact data shape and ECharts config for that variant.
        </p>
        <pre style={codeStyle}><code>{tokenizeCode(DATA_EXAMPLE).map(function(tok, idx) {
          return <span key={idx} style={{ color: SH_COLORS[tok.type] || SH_COLORS.plain }}>{tok.text}</span>;
        })}</code></pre>
      </section>
    </div>
  );
}

// Tri-dot (⋮) button that opens a DEX dropdown containing both gallery
// toggles. Renders in place of the inline toggle row when the viewport
// is narrower than TOGGLES_COMPACT_BREAKPOINT. The button uses the DEX
// hover background token and the DEX primary-subtle token as the active/
// open state so it reads as a selected control while the menu is visible.
function ToolsMenu({ showOptionalAxis, setShowOptionalAxis, frameOn, setFrameOn }) {
  var [open, setOpen] = useState(false);
  var [hover, setHover] = useState(false);

  var bg = open
    ? 'var(--dex-bgColor-primary-subtle, rgba(0,108,235,0.08))'
    : hover
      ? 'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.06))'
      : 'transparent';
  var iconColor = open
    ? 'var(--dex-fgColor-primary, #006ceb)'
    : tokens.colors.ui.bodyText;

  // Both toggle rows share the same flex layout: the label takes all
  // remaining space and is right-aligned so both labels' right edges
  // sit flush against the left edge of their switch, regardless of
  // label length. Any length difference shows as extra left-side space
  // on the shorter row — never as extra gap between label and toggle.
  var menuContent = (
    <div style={{
      padding: `${tokens.spacing[2.5]} ${tokens.spacing[4]}`,
      display: 'flex', flexDirection: 'column', gap: tokens.spacing[3],
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2.5], cursor: 'pointer' }}>
        <span style={{
          flex: 1, textAlign: 'right', whiteSpace: 'nowrap',
          fontSize: tokens.typography.fontSize.xs, fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.ui.bodyText,
        }}>Optional axis</span>
        <button
          type="button" role="switch" value="on"
          aria-checked={showOptionalAxis} aria-required="false"
          data-state={showOptionalAxis ? 'checked' : 'unchecked'}
          className="dex-switch"
          onClick={function() { setShowOptionalAxis(function(v) { return !v; }); }}
          style={{ flexShrink: 0, cursor: 'pointer' }}
        >
          <span data-state={showOptionalAxis ? 'checked' : 'unchecked'} className="dex-switch-thumb" />
        </button>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2.5], cursor: 'pointer' }}>
        <span style={{
          flex: 1, textAlign: 'right', whiteSpace: 'nowrap',
          fontSize: tokens.typography.fontSize.xs, fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.ui.bodyText,
        }}>Widget frame</span>
        <button
          type="button" role="switch" value="on"
          aria-checked={frameOn} aria-required="false"
          data-state={frameOn ? 'checked' : 'unchecked'}
          className="dex-switch"
          onClick={function() { setFrameOn(function(v) { return !v; }); }}
          style={{ flexShrink: 0, cursor: 'pointer' }}
        >
          <span data-state={frameOn ? 'checked' : 'unchecked'} className="dex-switch-thumb" />
        </button>
      </label>
    </div>
  );

  return (
    <div style={{ position: 'absolute', top: 20, right: 28, zIndex: 5 }}>
      <DexDropdownMenu
        side="bottom"
        align="end"
        content={menuContent}
        open={open}
        onOpenChange={setOpen}
      >
        <button
          onMouseEnter={function() { setHover(true); }}
          onMouseLeave={function() { setHover(false); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: tokens.spacing[8], height: tokens.spacing[8],
            border: 'none',
            background: bg,
            borderRadius: tokens.borderRadius.base,
            cursor: 'pointer',
            color: iconColor,
            transition: 'background 0.12s ease, color 0.12s ease',
            flexShrink: 0,
            padding: 0,
          }}
        >
          <DexIcon name="more-vertical" size="sm" />
        </button>
      </DexDropdownMenu>
    </div>
  );
}

function LeftPanel({ selectedId, onSelect, searchActive, matchedVariants, search, onSearchChange, compact, compactSearchOpen, onCompactSearchOpen, onCompactSearchClose }) {
  // Click-outside-to-clear: when the user clicks anywhere outside the
  // search input wrapper while a query is active, reset the search so
  // the left nav returns to the full chart-types list. The wrapper
  // includes the trailing clear (X) button, so clicking that still
  // counts as "inside" — it clears via its own handler, not this one.
  var searchWrapRef = useRef(null);
  useEffect(function() {
    if (!search) return undefined;
    function onDown(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        onSearchChange('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return function() { document.removeEventListener('mousedown', onDown); };
  }, [search, onSearchChange]);
  // In compact mode we hide the brand text, search input, and the
  // "Chart types" section header — only icons remain. Search is
  // intentionally dropped at narrow widths since there's no room for an
  // input field; users can expand the window to get it back. The width
  // transition (260 ↔ 64) animates so the collapse/expand feels intentional.
  return (
    <aside id="chart-gallery-nav" style={{
      width: compact ? 64 : 260,
      flexShrink: 0,
      borderRight: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.08))',
      background: tokens.colors.ui.whiteSurface,
      padding: compact ? `${tokens.spacing[5]} ${tokens.spacing[1.5]} ${tokens.spacing[4]}` : `${tokens.spacing[5]} ${tokens.spacing[2]} ${tokens.spacing[4]}`,
      overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      gap: 0,
      transition: 'width 0.15s ease-out, padding 0.15s ease-out',
    }}>
      {!compact && (
        <div style={{
          fontSize: tokens.typography.fontSize.base, fontWeight: tokens.typography.fontWeight.bold,
          color: tokens.colors.ui.cardTitle,
          padding: `0 ${tokens.spacing[3]} ${tokens.spacing[3]}`,
        }}>
          Chart Library
        </div>
      )}
      {!compact && (
        <div ref={searchWrapRef} style={{ padding: `0 ${tokens.spacing[3]} ${tokens.spacing[4]}` }}>
          <DexInput
            size="dense"
            type="search"
            placeholder="Search…"
            value={search}
            onValueChange={onSearchChange}
            leading={<DexIcon name="search" size="sm" />}
          />
        </div>
      )}
      {compact && (
        <>
          <CompactSearchButton
            active={compactSearchOpen}
            onOpen={onCompactSearchOpen}
            onClose={onCompactSearchClose}
          />
          <div style={{
            height: 1,
            background: 'var(--dex-borderColor-default, rgba(0,0,0,0.08))',
            margin: `${tokens.spacing[1.5]} ${tokens.spacing[1.5]}`,
            flexShrink: 0,
          }} />
        </>
      )}
      <ApiRefNavItem
        isSelected={!searchActive && !compactSearchOpen && selectedId === 'api-reference'}
        compact={compact}
        onSelect={function(){
          onSelect('api-reference');
          onSearchChange('');
          if (compactSearchOpen) onCompactSearchClose();
        }}
      />
      <div style={{
        height: 1,
        background: 'var(--dex-borderColor-default, rgba(0,0,0,0.08))',
        margin: compact
          ? `${tokens.spacing[1.5]} ${tokens.spacing[1.5]}`
          : `${tokens.spacing[1]} ${tokens.spacing[3]} ${tokens.spacing[2]}`,
        flexShrink: 0,
      }} />
      {!compact && (
        <div style={{ fontSize: tokens.typography.fontSize['2xs'], fontWeight: tokens.typography.fontWeight.bold, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wider, color: tokens.colors.ui.subtleText, padding: `0 ${tokens.spacing[3]} ${tokens.spacing[2]}` }}>
          Chart types
        </div>
      )}
      {CHART_CATALOG.map(function(t) {
        var isSelected = !searchActive && !compactSearchOpen && t.id === selectedId;
        var matchCount = searchActive
          ? (matchedVariants || []).filter(function(e){ return e.type.id === t.id; }).length
          : t.variants.length;
        return (
          <LeftPanelItem
            key={t.id}
            type={t}
            isSelected={isSelected}
            badge={matchCount}
            dim={searchActive && matchCount === 0}
            onClick={function(){
              onSelect(t.id);
              // Clicking a chart type while search is active exits search mode
              // and shows the selected type's content — works in both expanded
              // and compact (floating bar) states.
              onSearchChange('');
              if (compactSearchOpen) onCompactSearchClose();
            }}
            compact={compact}
          />
        );
      })}
    </aside>
  );
}

// Icon-only search button rendered at the top of the collapsed (64px) left nav.
// Matches the visual weight and sizing of the chart-type icon buttons so it
// reads as a peer item, not an afterthought. Active state (primary blue bg +
// icon color) mirrors LeftPanelItem's selected state.
function CompactSearchButton({ active, onOpen, onClose }) {
  var [hover, setHover] = useState(false);
  var bg = active
    ? 'var(--dex-bgColor-primary-subtle, rgba(0,108,235,0.08))'
    : hover
      ? 'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.04))'
      : 'transparent';
  var color = active
    ? 'var(--dex-fgColor-primary, #006ceb)'
    : tokens.colors.ui.bodyText;
  var button = (
    <button
      onClick={function(){ active ? onClose() : onOpen(); }}
      onMouseEnter={function(){ setHover(true); }}
      onMouseLeave={function(){ setHover(false); }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%',
        padding: `${tokens.spacing[2.5]} 0`,
        marginBottom: 2,
        border: 'none', background: bg, cursor: 'pointer',
        borderRadius: tokens.borderRadius.base,
        fontFamily: 'inherit',
        transition: 'background 0.1s ease',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: tokens.spacing[4], color: color, flexShrink: 0 }}>
        <DexIcon name="search" size="sm" />
      </span>
    </button>
  );
  return <DexTooltip content="Search" side="right">{button}</DexTooltip>;
}

// Floating search bar that appears in the main content column when the user
// clicks the search icon in the collapsed left nav. Anchored 16px from the
// top of the main wrapper, centered at 50% width, with a DEX light-lift
// shadow so it stands off the canvas background. Click-outside closes it
// (excluding the nav itself so clicking the search icon to toggle works).
function FloatingSearchBar({ search, onSearchChange, onClose }) {
  var barRef = useRef(null);
  var onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Auto-focus the input on mount so the user can start typing immediately.
  useEffect(function() {
    if (barRef.current) {
      var input = barRef.current.querySelector('input');
      if (input) input.focus();
    }
  }, []);

  // Click-outside handler. Excludes the nav aside so clicking the search
  // icon button (which lives in the nav) doesn't trigger a double-close.
  useEffect(function() {
    function onDown(e) {
      var nav = document.getElementById('chart-gallery-nav');
      var inNav = nav && nav.contains(e.target);
      var inBar = barRef.current && barRef.current.contains(e.target);
      if (!inNav && !inBar) onCloseRef.current();
    }
    document.addEventListener('mousedown', onDown);
    return function() { document.removeEventListener('mousedown', onDown); };
  }, []); // stable via ref — no dep on onClose directly

  // Plain <input> instead of DexInput — gives us full style control so we
  // avoid fighting DEX's :focus-within box-shadow and internal background.
  // The wrapper div IS the visual container (border, bg, shadow, radius).
  return (
    <div
      id="chart-floating-search"
      ref={barRef}
      style={{
        position: 'absolute',
        top: tokens.spacing[4],
        left: '50%',
        transform: 'translateX(-50%)',
        width: '64%',
        zIndex: 20,
        boxShadow: tokens.shadows.md,
        borderRadius: tokens.borderRadius.md,
        background: tokens.colors.ui.whiteSurface,
        border: '1px solid var(--dex-borderColor-alpha-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        padding: `0 ${tokens.spacing[3]}`,
        height: 40,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, color: tokens.colors.ui.subtleText }}>
        <DexIcon name="search" size="sm" />
      </span>
      <input
        ref={function(el){ if (el) el.focus(); }}
        type="search"
        placeholder="Search charts…"
        value={search}
        onChange={function(e){ onSearchChange(e.target.value); }}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: tokens.typography.fontSize.sm,
          fontFamily: 'inherit',
          color: tokens.colors.ui.bodyText,
          padding: 0,
          // suppress webkit's native search-cancel glyph — we render our own below
          WebkitAppearance: 'none',
        }}
      />
      {/* DEX-matching clear button — same x-circle-fill icon + tabIndex=-1 treatment
          as DexInput's own clear button so both search states look identical */}
      {search && (
        <button
          type="button"
          aria-label="Clear"
          tabIndex={-1}
          onClick={function(){ onSearchChange(''); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: tokens.colors.ui.subtleText,
            flexShrink: 0,
          }}
        >
          <DexIcon name="x-circle-fill" size="sm" />
        </button>
      )}
    </div>
  );
}

function LeftPanelItem({ type, isSelected, badge, dim, onClick, compact }) {
  var [hover, setHover] = useState(false);
  var Icon = type.icon;
  var bg = isSelected
    ? 'var(--dex-bgColor-primary-subtle, rgba(0,108,235,0.08))'
    : hover ? 'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.04))' : 'transparent';
  var color = isSelected
    ? 'var(--dex-fgColor-primary, #006ceb)'
    : tokens.colors.ui.bodyText;
  // In compact mode the button collapses to an icon-only square: no
  // label, no count badge. A DEX tooltip on the right side shows the
  // chart type + variant count so users can still identify each icon
  // without expanding the nav. DexTooltipProvider is wired up in
  // App.jsx so DexTooltip will render correctly anywhere in the tree.
  var tooltipText = type.label + ' (' + badge + ')';
  var button = (
    <button
      onClick={onClick}
      onMouseEnter={function(){ setHover(true); }}
      onMouseLeave={function(){ setHover(false); }}
      style={{
        display: 'flex', alignItems: 'center',
        justifyContent: compact ? 'center' : 'flex-start',
        gap: compact ? 0 : tokens.spacing[2.5],
        width: '100%',
        padding: compact ? `${tokens.spacing[2.5]} 0` : `${tokens.spacing[2]} ${tokens.spacing[3]}`,
        marginBottom: 2,
        border: 'none', background: bg, cursor: 'pointer',
        borderRadius: tokens.borderRadius.base,
        textAlign: 'left',
        opacity: dim ? 0.4 : 1,
        fontFamily: 'inherit',
        transition: 'background 0.1s ease',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: tokens.spacing[4], color: color, flexShrink: 0 }}>
        <Icon color={color} />
      </span>
      {!compact && (
        <span style={{ flex: 1, fontSize: tokens.typography.fontSize.sm, fontWeight: isSelected ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.medium, color: color }}>
          {type.label}
        </span>
      )}
      {!compact && (
        <span style={{
          fontSize: tokens.typography.fontSize.xs, fontWeight: tokens.typography.fontWeight.semibold,
          color: isSelected ? color : tokens.colors.ui.subtleText,
          background: isSelected
            ? 'var(--dex-bgColor-primary-subtle, rgba(0,108,235,0.12))'
            : 'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.06))',
          padding: `${tokens.spacing[0.5]} ${tokens.spacing[2]}`, borderRadius: tokens.borderRadius.full,
          minWidth: 18, textAlign: 'center',
        }}>{badge}</span>
      )}
    </button>
  );
  // Only wrap in tooltip when compact — full-label mode doesn't need a
  // tooltip since the label is already visible. side="right" pops the
  // tooltip to the right of the icon so it doesn't get clipped by the
  // narrow 64px nav width.
  return compact
    ? <DexTooltip content={tooltipText} side="right">{button}</DexTooltip>
    : button;
}

function ApiRefNavItem({ isSelected, compact, onSelect }) {
  var [hover, setHover] = useState(false);
  var bg = isSelected
    ? 'var(--dex-bgColor-primary-subtle, rgba(0,108,235,0.08))'
    : hover ? 'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.04))' : 'transparent';
  var color = isSelected
    ? 'var(--dex-fgColor-primary, #006ceb)'
    : tokens.colors.ui.bodyText;
  var button = (
    <button
      onClick={onSelect}
      onMouseEnter={function(){ setHover(true); }}
      onMouseLeave={function(){ setHover(false); }}
      style={{
        display: 'flex', alignItems: 'center',
        justifyContent: compact ? 'center' : 'flex-start',
        gap: compact ? 0 : tokens.spacing[2.5],
        width: '100%',
        padding: compact ? `${tokens.spacing[2.5]} 0` : `${tokens.spacing[2]} ${tokens.spacing[3]}`,
        marginBottom: 2,
        border: 'none', background: bg, cursor: 'pointer',
        borderRadius: tokens.borderRadius.base,
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 0.1s ease',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: tokens.spacing[4], color: color, flexShrink: 0 }}>
        <DexIcon name="code" size="sm" />
      </span>
      {!compact && (
        <span style={{ flex: 1, fontSize: tokens.typography.fontSize.sm, fontWeight: isSelected ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.medium, color: color }}>
          API Reference
        </span>
      )}
    </button>
  );
  return compact
    ? <DexTooltip content="API Reference" side="right">{button}</DexTooltip>
    : button;
}

// localStorage key per chart type so each remembers its last sub-nav
// selection independently. Falls back to 'all' on first visit OR if the
// stored group has since been removed from the catalog.
function loadGroupSelection(typeId, groups) {
  if (!groups || !groups.length) return 'all';
  try {
    var saved = localStorage.getItem('chart-library:group:' + typeId);
    if (saved === 'all') return 'all';
    if (saved && groups.some(function(g) { return g.id === saved; })) return saved;
  } catch (_) {}
  return 'all';
}

function TypeArea({ type, frameOn, showOptionalAxis }) {
  // Per-type group selection. Re-init on type change so each type
  // remembers its own last-selected group (loaded from localStorage).
  var [selectedGroup, setSelectedGroup] = useState(function() {
    return loadGroupSelection(type.id, type.groups);
  });
  useEffect(function() {
    setSelectedGroup(loadGroupSelection(type.id, type.groups));
  }, [type.id]);
  useEffect(function() {
    if (!type.groups) return;
    try { localStorage.setItem('chart-library:group:' + type.id, selectedGroup); } catch (_) {}
  }, [type.id, selectedGroup, type.groups]);

  // Filter the variant grid by the selected group. 'all' (or types
  // without groups) shows every variant in catalog order.
  var visibleVariants = (selectedGroup === 'all' || !type.groups)
    ? type.variants
    : type.variants.filter(function(v) { return v.group === selectedGroup; });

  return (
    <div>
      <header style={{ marginBottom: tokens.spacing[5] }}>
        <h1 style={{
          margin: 0, fontSize: tokens.typography.fontSize.xl, fontWeight: tokens.typography.fontWeight.bold,
          color: tokens.colors.ui.cardTitle,
        }}>{type.label}</h1>
        <p style={{
          margin: `${tokens.spacing[1]} 0 0`, fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.ui.subtleText,
          maxWidth: 760,
          lineHeight: 1.5,
        }}>
          {type.description}
          {type.examples && (
            <span style={{
              fontStyle: 'italic',
              color: 'var(--dex-fgColor-subtle)',
            }}> ({type.examples})</span>
          )}
        </p>
        <div style={{ marginTop: tokens.spacing[1.5], fontSize: tokens.typography.fontSize.xs, color: tokens.colors.ui.subtleText, fontWeight: tokens.typography.fontWeight.medium }}>
          {type.variants.length} variant{type.variants.length === 1 ? '' : 's'}
        </div>
      </header>
      {type.groups && (
        <SubNav
          groups={type.groups}
          variants={type.variants}
          selected={selectedGroup}
          onChange={setSelectedGroup}
        />
      )}
      <VariantGrid type={type} variants={visibleVariants} frameOn={frameOn} showOptionalAxis={showOptionalAxis} />
    </div>
  );
}

// Pill-row sub-nav for types with grouped variants. "All" pill is always
// first (selected by default, no count badge — the type header already
// shows the total). Each group pill shows its label, and a count badge
// only when the group contains more than 1 variant.
function SubNav({ groups, variants, selected, onChange }) {
  var pills = [{ id: 'all', label: 'All' }].concat(groups);
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: tokens.spacing[1.5], marginBottom: tokens.spacing[6],
    }}>
      {pills.map(function(g) {
        var count = g.id === 'all'
          ? null
          : variants.filter(function(v) { return v.group === g.id; }).length;
        var isSelected = selected === g.id;
        var showBadge = count !== null && count > 1;
        return (
          <button
            key={g.id}
            type="button"
            onClick={function(){ onChange(g.id); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: tokens.spacing[1.5],
              padding: `${tokens.spacing[1.5]} ${tokens.spacing[3]}`,
              borderRadius: tokens.borderRadius.full,
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: isSelected ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.medium,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: isSelected
                ? 'var(--dex-bgColor-primary-subtle, rgba(0,108,235,0.12))'
                : 'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.06))',
              color: isSelected
                ? 'var(--dex-fgColor-primary, #006ceb)'
                : tokens.colors.ui.bodyText,
              transition: 'background 0.12s ease-out',
            }}
            onMouseEnter={function(e){
              if (!isSelected) e.currentTarget.style.background = 'var(--dex-bgColor-alpha-emphasis-hover, rgba(0,0,0,0.10))';
            }}
            onMouseLeave={function(e){
              if (!isSelected) e.currentTarget.style.background = 'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.06))';
            }}
          >
            <span>{g.label}</span>
            {showBadge && (
              <span style={{
                fontSize: tokens.typography.fontSize['2xs'], fontWeight: tokens.typography.fontWeight.semibold,
                minWidth: 16, textAlign: 'center',
                padding: '1px 6px',
                borderRadius: tokens.borderRadius.full,
                background: isSelected
                  ? 'var(--dex-fgColor-primary, #006ceb)'
                  : 'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.10))',
                color: isSelected
                  ? tokens.colors.text.inverse
                  : tokens.colors.ui.subtleText,
                lineHeight: tokens.typography.lineHeight.snug,
              }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SearchResultsArea({ matched, frameOn, showOptionalAxis, query }) {
  if (!matched || matched.length === 0) {
    return (
      <div>
        <header style={{ marginBottom: tokens.spacing[5] }}>
          <h1 style={{ margin: 0, fontSize: tokens.typography.fontSize.xl, fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.ui.cardTitle }}>No matches</h1>
          <p style={{ margin: `${tokens.spacing[1]} 0 0`, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.ui.subtleText }}>
            Nothing matched <code style={{ background:'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.05))', padding:'1px 5px', borderRadius: tokens.borderRadius.sm }}>{query}</code>.
          </p>
        </header>
      </div>
    );
  }
  // Group by type to preserve catalog ordering.
  var byType = {};
  matched.forEach(function(e) {
    if (!byType[e.type.id]) byType[e.type.id] = { type: e.type, variants: [] };
    byType[e.type.id].variants.push(e.variant);
  });
  return (
    <div>
      <header style={{ marginBottom: tokens.spacing[5] }}>
        <h1 style={{ margin: 0, fontSize: tokens.typography.fontSize.xl, fontWeight: tokens.typography.fontWeight.bold, color: tokens.colors.ui.cardTitle }}>
          Search results
        </h1>
        <p style={{ margin: `${tokens.spacing[1]} 0 0`, fontSize: tokens.typography.fontSize.sm, color: tokens.colors.ui.subtleText }}>
          {matched.length} variant{matched.length === 1 ? '' : 's'} matching <code style={{ background:'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.05))', padding:'1px 5px', borderRadius: tokens.borderRadius.sm }}>{query}</code>.
        </p>
      </header>
      {CHART_CATALOG.map(function(t) {
        var g = byType[t.id];
        if (!g) return null;
        return (
          <div key={t.id} style={{ marginBottom: tokens.spacing[6] }}>
            <h2 style={{ margin: '0 0 12px', fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.ui.bodyText, textTransform:'uppercase', letterSpacing:'0.04em' }}>
              {t.label}
            </h2>
            <VariantGrid type={t} variants={g.variants} frameOn={frameOn} showOptionalAxis={showOptionalAxis} />
          </div>
        );
      })}
    </div>
  );
}

// ─── View Code feature ────────────────────────────────────────────────────
// generateDataSample returns a representative data-shape string for each
// chart type so engineers know exactly what structure to pass in.
function generateDataSample(chartType, render) {
  var s = (render && render.series) || 1;
  if (chartType === 'Line' || chartType === 'Area') {
    if (s > 1) {
      return [
        '// Multi-series time-series data',
        'const data = {',
        '  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],',
        '  series: [',
        '    { name: "Series A", values: [120, 145, 132, 168, 185, 201] },',
        '    { name: "Series B", values: [80,  92, 105,  98, 115, 128] },',
        '  ],',
        '};',
      ].join('\n');
    }
    return [
      '// Time-series data',
      'const data = {',
      '  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],',
      '  values: [120, 145, 132, 168, 185, 201],',
      '};',
    ].join('\n');
  }
  if (chartType === 'Column' || chartType === 'Bar') {
    if (render && (render.stacked || render.grouped)) {
      return [
        '// Multi-series categorical data',
        'const data = {',
        '  categories: ["Q1", "Q2", "Q3", "Q4"],',
        '  series: [',
        '    { name: "Product A", values: [320, 410, 380, 450] },',
        '    { name: "Product B", values: [210, 285, 310, 295] },',
        '  ],',
        '};',
      ].join('\n');
    }
    return [
      '// Categorical data',
      'const data = {',
      '  categories: ["Q1", "Q2", "Q3", "Q4"],',
      '  values: [320, 410, 380, 450],',
      '};',
    ].join('\n');
  }
  if (chartType === 'Donut' || chartType === 'Pie') {
    return [
      '// Proportional data',
      'const data = [',
      '  { name: "Segment A", value: 42 },',
      '  { name: "Segment B", value: 28 },',
      '  { name: "Segment C", value: 18 },',
      '  { name: "Segment D", value: 12 },',
      '];',
    ].join('\n');
  }
  if (chartType === 'Funnel') {
    return [
      '// Funnel stage data (ordered top to bottom)',
      'const data = [',
      '  { stage: "Awareness",     value: 10000 },',
      '  { stage: "Consideration", value: 6500  },',
      '  { stage: "Decision",      value: 2800  },',
      '  { stage: "Purchase",      value: 1200  },',
      '];',
    ].join('\n');
  }
  if (chartType === 'Scatter') {
    return [
      '// Scatter plot data points',
      'const data = [',
      '  { x: 12, y: 84, label: "Point A" },',
      '  { x: 28, y: 62, label: "Point B" },',
      '  { x: 45, y: 91, label: "Point C" },',
      '  { x: 67, y: 55, label: "Point D" },',
      '];',
    ].join('\n');
  }
  if (chartType === 'Heatmap') {
    return [
      '// Heatmap data — intensity by day and hour',
      'const data = [',
      '  { day: "Mon", hour: "9am",  value: 42 },',
      '  { day: "Mon", hour: "10am", value: 87 },',
      '  { day: "Tue", hour: "9am",  value: 61 },',
      '  // ... additional day/hour cells',
      '];',
    ].join('\n');
  }
  if (chartType === 'Waterfall') {
    return [
      '// Waterfall data — positive = gain, negative = loss',
      'const data = [',
      '  { label: "Opening Value", value: 500,  type: "start"    },',
      '  { label: "New Revenue",   value: 220,  type: "increase" },',
      '  { label: "Churn",         value: -85,  type: "decrease" },',
      '  { label: "Expansion",     value: 130,  type: "increase" },',
      '  { label: "Net Result",    value: 765,  type: "total"    },',
      '];',
    ].join('\n');
  }
  if (chartType === 'Treemap') {
    return [
      '// Treemap hierarchical data',
      'const data = [',
      '  { name: "Category A", value: 420 },',
      '  { name: "Category B", value: 310 },',
      '  { name: "Category C", value: 180 },',
      '  { name: "Category D", value: 90  },',
      '];',
    ].join('\n');
  }
  if (chartType === 'Calendar') {
    return [
      '// Calendar data — one entry per date',
      'const data = [',
      '  { date: "2024-01-15", value: 42 },',
      '  { date: "2024-01-16", value: 28 },',
      '  { date: "2024-01-17", value: 67 },',
      '  // ... additional dates',
      '];',
    ].join('\n');
  }
  if (chartType === 'Gauge') {
    return [
      '// Gauge data — single value within a defined range',
      'const data = {',
      '  value: 68,',
      '  min:   0,',
      '  max:   100,',
      '  label: "Health Score",',
      '};',
    ].join('\n');
  }
  if (chartType === 'Hero') {
    return [
      '// Hero (KPI) data — primary metric with optional trend',
      'const data = {',
      '  value:  24850,',
      '  label:  "Total Revenue",',
      '  change: +12.4,',
      '  trend:  [180, 192, 205, 198, 218, 231],',
      '};',
    ].join('\n');
  }
  if (chartType === 'Bullet') {
    return [
      '// Bullet chart data — actual value vs. target goal',
      'const data = {',
      '  label:  "Q4 Revenue",',
      '  actual: 84,',
      '  target: 100,',
      '  ranges: [50, 75, 100],',
      '};',
    ].join('\n');
  }
  if (chartType === 'Combo') {
    return [
      '// Combo chart data — bars + overlay line',
      'const data = {',
      '  categories: ["Jan", "Feb", "Mar", "Apr", "May"],',
      '  bars: [320, 410, 380, 450, 490],',
      '  line: [290, 365, 395, 420, 460],',
      '};',
    ].join('\n');
  }
  if (chartType === 'Table') {
    return [
      '// Table data — column definitions + row data',
      'const data = {',
      '  columns: [',
      '    { key: "name",    label: "Name"    },',
      '    { key: "revenue", label: "Revenue" },',
      '    { key: "growth",  label: "Growth"  },',
      '  ],',
      '  rows: [',
      '    { name: "Product A", revenue: "$42,000", growth: "+12%" },',
      '    { name: "Product B", revenue: "$28,500", growth: "+8%"  },',
      '  ],',
      '};',
    ].join('\n');
  }
  if (chartType === 'Reviews') {
    return [
      '// Rating distribution data — one entry per star tier',
      'const data = [',
      '  { stars: 5, count: 412 },',
      '  { stars: 4, count: 186 },',
      '  { stars: 3, count: 74  },',
      '  { stars: 2, count: 31  },',
      '  { stars: 1, count: 18  },',
      '];',
    ].join('\n');
  }
  return [
    '// Generic metric data',
    'const data = {',
    '  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],',
    '  values: [120, 145, 132, 168, 185, 201],',
    '};',
  ].join('\n');
}

// Builds the four code-block strings shown in the modal for a given variant.
// ─── ECharts option generator ─────────────────────────────────────────────
// Returns a representative ECharts option object string for each chart type.
// Colors are resolved hex values — ECharts canvas cannot read CSS variables.
function generateEChartsOption(type, variant) {
  var t = type.type;
  var r = variant.render || {};

  // ── Line / Area ───────────────────────────────────────────────────────────
  if (t === 'Line' || t === 'Area') {
    var isArea  = t === 'Area';
    var nSeries = r.series || 1;
    var compare = r.compare;
    var colorArr = nSeries > 1
      ? "['#3392FF', '#36A635', '#9570F3', '#3E9BB6']"
      : compare ? "['#3392FF', '#0A7CFF']" : "['#3392FF']";
    var seriesStr;
    if (nSeries > 1) {
      var names   = ['Series A', 'Series B', 'Series C', 'Series D'];
      var sItems  = [];
      for (var i = 0; i < nSeries; i++) {
        sItems.push(
          '    { type: \'line\', name: \'' + names[i] + '\', data: data.series[' + i + '].values,\n' +
          '      smooth: false, symbol: \'circle\', symbolSize: 6, lineStyle: { width: 2 },' +
          (isArea ? '\n      areaStyle: { opacity: 0.12 },' : '') + ' },'
        );
      }
      seriesStr = '  series: [\n' + sItems.join('\n') + '\n  ],';
    } else if (compare) {
      seriesStr = [
        '  series: [',
        '    { type: \'line\', name: \'Current period\', data: data.values,',
        '      smooth: false, symbol: \'circle\', symbolSize: 6,',
        '      lineStyle: { width: 2, color: \'#3392FF\' },' + (isArea ? ' areaStyle: { opacity: 0.12 },' : '') + ' },',
        '    { type: \'line\', name: \'Prior period\',   data: data.compareValues,',
        '      smooth: false, symbol: \'circle\', symbolSize: 5,',
        '      lineStyle: { width: 2, color: \'#0A7CFF\', type: \'dashed\' } },',
        '  ],',
      ].join('\n');
    } else {
      seriesStr = [
        '  series: [{',
        '    type: \'line\', name: \'Current period\', data: data.values,',
        '    smooth: false, symbol: \'circle\', symbolSize: 6,',
        '    lineStyle: { width: 2, color: \'#3392FF\' },' + (isArea ? '\n    areaStyle: { color: \'rgba(51,146,255,0.12)\' },' : ''),
        '  }],',
      ].join('\n');
    }
    return [
      'const option = {',
      '  color: ' + colorArr + ',',
      '  grid: { top: 8, right: 16, bottom: 32, left: 48 },',
      '  xAxis: {',
      '    type: \'category\', data: data.labels,',
      '    axisLine: { show: false }, axisTick: { show: false },',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\', margin: 8 },',
      '  },',
      '  yAxis: {',
      '    type: \'value\', min: 0,',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\', formatter: \'{value}\' },',
      '    splitLine: { lineStyle: { color: \'rgba(0,0,0,0.06)\', type: \'dashed\' } },',
      '  },',
      '  tooltip: {',
      '    trigger: \'axis\',',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '  },',
      seriesStr,
      '  animationDuration: 1000, animationEasing: \'cubicOut\',',
      '};',
    ].join('\n');
  }

  // ── Column ────────────────────────────────────────────────────────────────
  if (t === 'Column') {
    var stacked  = r.stacked;
    var pct100   = r['100pct'];
    var grouped  = r.grouped;
    var nSeries  = (stacked || grouped || pct100) ? (r.series || 2) : 1;
    var colorArr = nSeries > 1
      ? "['#3392FF', '#36A635', '#9570F3']" : "['#3392FF']";
    var sNames   = ['Series A', 'Series B', 'Series C'];
    var seriesStr;
    if (nSeries > 1) {
      var sItems = [];
      for (var i = 0; i < nSeries; i++) {
        sItems.push(
          '    { type: \'bar\', name: \'' + sNames[i] + '\', data: data.series[' + i + '].values,' +
          (stacked || pct100 ? ' stack: \'total\',' : '') +
          ' itemStyle: { borderRadius: [2,2,0,0] } },'
        );
      }
      seriesStr = '  series: [\n' + sItems.join('\n') + '\n  ],';
    } else {
      seriesStr = [
        '  series: [{',
        '    type: \'bar\', name: \'Current period\', data: data.values, barMaxWidth: 40,',
        '    itemStyle: { color: \'#3392FF\', borderRadius: [2,2,0,0] },',
        '  }],',
      ].join('\n');
    }
    return [
      'const option = {',
      '  color: ' + colorArr + ',',
      '  grid: { top: 8, right: 16, bottom: 32, left: 48 },',
      '  xAxis: {',
      '    type: \'category\', data: data.labels,',
      '    axisLine: { show: false }, axisTick: { show: false },',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\', margin: 8 },',
      '  },',
      '  yAxis: {',
      '    type: \'value\', min: 0,' + (pct100 ? ' max: 100,' : ''),
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\',' + (pct100 ? ' formatter: \'{value}%\'' : ' formatter: \'{value}\'') + ' },',
      '    splitLine: { lineStyle: { color: \'rgba(0,0,0,0.06)\', type: \'dashed\' } },',
      '  },',
      '  tooltip: {',
      '    trigger: \'axis\',',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '  },',
      seriesStr,
      '  animationDuration: 1000, animationEasing: \'cubicOut\',',
      '};',
    ].join('\n');
  }

  // ── Bar ───────────────────────────────────────────────────────────────────
  if (t === 'Bar') {
    var normalize = !!r.normalize;
    var stacked  = r.stacked || r['100pct'] || normalize;
    var nSeries  = stacked ? (r.series || 2) : 1;
    var colorArr = nSeries > 1 ? "['#3392FF', '#36A635', '#9570F3']" : "['#3392FF']";
    var seriesStr = nSeries > 1
      ? [
          '  series: [',
          '    { type: \'bar\', name: \'Series A\', data: data.series[0].values,' + (stacked ? ' stack: \'total\',' : '') + ' itemStyle: { borderRadius: [0,2,2,0] } },',
          '    { type: \'bar\', name: \'Series B\', data: data.series[1].values,' + (stacked ? ' stack: \'total\',' : '') + ' itemStyle: { borderRadius: [0,2,2,0] } },',
          '  ],',
        ].join('\n')
      : [
          '  series: [{',
          '    type: \'bar\', name: \'Current period\', data: data.values, barMaxWidth: 32,',
          '    itemStyle: { color: \'#3392FF\', borderRadius: [0,2,2,0] },',
          '  }],',
        ].join('\n');
    // 100% stacked: X axis always visible (0→100%), grid bottom bumped to
    // leave room for labels. All other bar variants: X axis optional.
    var xAxisStr = normalize
      ? [
          '  xAxis: {',
          '    type: \'value\', min: 0, max: 100, interval: 25,',
          '    axisLine: { show: false }, axisTick: { show: false },',
          '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\', formatter: \'{value}%\' },',
          '    splitLine: { show: false },',
          '  },',
        ].join('\n')
      : [
          '  xAxis: {',
          '    type: \'value\', min: 0,',
          '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\' },',
          '    splitLine: { lineStyle: { color: \'rgba(0,0,0,0.06)\', type: \'dashed\' } },',
          '  },',
        ].join('\n');
    var tooltipStr = normalize
      ? [
          '  tooltip: {',
          '    trigger: \'axis\',',
          '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
          '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
          '    // data.series[n].values must already be pre-normalized to %',
          '    formatter: function(params) {',
          '      return params.map(function(p) {',
          '        return \'<div>\' + p.marker + \' \' + p.seriesName + \': \' + p.value + \'%</div>\';',
          '      }).join(\'\');',
          '    },',
          '  },',
        ].join('\n')
      : [
          '  tooltip: {',
          '    trigger: \'axis\',',
          '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
          '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
          '  },',
        ].join('\n');
    return [
      'const option = {',
      '  color: ' + colorArr + ',',
      '  grid: { top: 8, right: 16, bottom: ' + (normalize ? 20 : 8) + ', left: 72 },',
      xAxisStr,
      '  yAxis: {',
      '    type: \'category\', data: data.labels,',
      '    axisLine: { show: false }, axisTick: { show: false },',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\' },',
      '  },',
      tooltipStr,
      seriesStr,
      '  animationDuration: 1000, animationEasing: \'cubicOut\',',
      '};',
    ].join('\n');
  }

  // ── Donut / Pie ───────────────────────────────────────────────────────────
  if (t === 'Donut' || t === 'Pie') {
    var radius = t === 'Donut' ? "['55%', '90%']" : "['0%', '90%']";
    return [
      'const option = {',
      '  color: [\'#3392FF\', \'#36A635\', \'#9570F3\', \'#3E9BB6\', \'#7C8EB0\'],',
      '  tooltip: {',
      '    trigger: \'item\',',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '    formatter: \'{b}: {c} ({d}%)\',',
      '  },',
      '  series: [{',
      '    type: \'pie\',',
      '    radius: ' + radius + ',',
      '    center: [\'50%\', \'50%\'],',
      '    startAngle: 90,',
      '    data: data.slices,  // [{ name, value }, ...]',
      '    label: { show: false },',
      '    emphasis: { scale: false },',
      '    itemStyle: { borderRadius: 0, borderColor: \'#fff\', borderWidth: 1 },',
      '    animationDuration: 800, animationEasing: \'cubicOut\',',
      '    animationType: \'expansion\',',
      '  }],',
      '};',
    ].join('\n');
  }

  // ── Funnel ────────────────────────────────────────────────────────────────
  if (t === 'Funnel') {
    return [
      '// Stage values use a normalized scale (e.g. 0.9 → 0.7 → 0.5 → 0.2)',
      '// so the funnel tapers uniformly regardless of raw data magnitude.',
      '',
      'const option = {',
      '  color: [\'#3392FF\', \'#36A635\', \'#9570F3\', \'#EA6E55\'],',
      '  tooltip: {',
      '    trigger: \'item\',',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '    formatter: function(params) {',
      '      return params.name + \': \' + params.data.actualValue;',
      '    },',
      '  },',
      '  series: [{',
      '    type: \'funnel\',',
      '    left: \'10%\', width: \'80%\', top: \'4%\', bottom: \'4%\',',
      '    sort: \'descending\', funnelAlign: \'center\',',
      '    min: 0, max: 1, minSize: \'20%\', maxSize: \'100%\', gap: 2,',
      '    data: data.stages,  // [{ name, value (0-1), actualValue }, ...]',
      '    label: { position: \'inside\', color: \'#fff\', fontWeight: 600 },',
      '    itemStyle: { borderColor: \'#fff\', borderWidth: 1 },',
      '    // Stages reveal top-down, staggered 130ms apart',
      "    animationDelay: function(idx) { return idx * 130; },",
      '    animationDuration: 130,',
      '  }],',
      '};',
    ].join('\n');
  }

  // ── Scatter ───────────────────────────────────────────────────────────────
  if (t === 'Scatter') {
    var grouped  = r.grouped;
    var colorArr = grouped ? "['#3392FF', '#36A635', '#9570F3']" : "['#3392FF']";
    var seriesStr = grouped
      ? [
          '  series: [',
          '    { type: \'scatter\', name: \'Group A\', data: data.groups[0], symbolSize: 8 },',
          '    { type: \'scatter\', name: \'Group B\', data: data.groups[1], symbolSize: 8 },',
          '    { type: \'scatter\', name: \'Group C\', data: data.groups[2], symbolSize: 8 },',
          '  ],',
        ].join('\n')
      : [
          '  series: [{',
          '    type: \'scatter\',',
          '    data: data.points,  // [[x, y], ...]',
          '    symbolSize: 8,',
          '    itemStyle: { color: \'#3392FF\', opacity: 0.8 },',
          '  }],',
        ].join('\n');
    return [
      'const option = {',
      '  color: ' + colorArr + ',',
      '  grid: { top: 8, right: 28, bottom: 32, left: 16, containLabel: true },',
      '  xAxis: {',
      '    type: \'value\', min: 0, max: 100,',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\' },',
      '    splitLine: { lineStyle: { color: \'rgba(0,0,0,0.06)\', type: \'dashed\' } },',
      '  },',
      '  yAxis: {',
      '    type: \'value\', min: 0, max: 100,',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\' },',
      '    splitLine: { lineStyle: { color: \'rgba(0,0,0,0.06)\', type: \'dashed\' } },',
      '  },',
      '  tooltip: {',
      '    trigger: \'item\',',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '  },',
      seriesStr,
      '};',
    ].join('\n');
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────
  if (t === 'Heatmap') {
    return [
      '// Uses ECharts scatter with circle symbols sized/colored by intensity.',
      '// 56-cell grid: 8 hours (x) × 7 days (y).',
      '',
      'const option = {',
      '  grid: { top: 10, right: 16, bottom: 22, left: 40 },',
      '  xAxis: {',
      '    type: \'category\',',
      '    data: [\'8am\',\'9am\',\'10am\',\'11am\',\'12pm\',\'1pm\',\'2pm\',\'3pm\'],',
      '    axisLine: { show: false }, axisTick: { show: false },',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\' },',
      '  },',
      '  yAxis: {',
      '    type: \'category\',',
      '    data: [\'Mon\',\'Tue\',\'Wed\',\'Thu\',\'Fri\',\'Sat\',\'Sun\'],',
      '    axisLine: { show: false }, axisTick: { show: false },',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\' },',
      '  },',
      '  tooltip: {',
      '    trigger: \'item\',',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '  },',
      '  series: [{',
      '    type: \'scatter\',',
      '    // Each point: [hourIndex, dayIndex, normalizedValue 0–1]',
      '    data: data.cells.map(function(d) { return [d.hour, d.day, d.value]; }),',
      '    symbolSize: function(val) {',
      '      return 6 + val[2] * 18;  // 6px–24px',
      '    },',
      '    itemStyle: {',
      '      color: function(params) {',
      '        var opacity = 0.20 + params.value[2] * 0.80;',
      '        return \'rgba(51,146,255,\' + opacity.toFixed(2) + \')\';',
      '      },',
      '    },',
      '  }],',
      '};',
    ].join('\n');
  }

  // ── Waterfall ─────────────────────────────────────────────────────────────
  if (t === 'Waterfall') {
    return [
      '// Two stacked bar series: invisible placeholder (positions the bar)',
      '// + visible value bar (colored by segment type).',
      '',
      'const option = {',
      '  grid: { top: 8, right: 16, bottom: 24, left: 48 },',
      '  xAxis: {',
      '    type: \'category\', data: data.labels,',
      '    axisLine: { show: false }, axisTick: { show: false },',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\' },',
      '  },',
      '  yAxis: {',
      '    type: \'value\',',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\', formatter: \'{value}\' },',
      '    splitLine: { lineStyle: { color: \'rgba(0,0,0,0.06)\', type: \'dashed\' } },',
      '  },',
      '  tooltip: {',
      '    trigger: \'axis\',',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '  },',
      '  series: [',
      '    {',
      '      // Invisible placeholder — lifts the visible bar to the right Y position',
      '      type: \'bar\', stack: \'wf\',',
      '      data: data.placeholders,',
      '      itemStyle: { color: \'transparent\' },',
      '      tooltip: { show: false },',
      '    },',
      '    {',
      '      type: \'bar\', stack: \'wf\',',
      '      data: data.values.map(function(item) {',
      '        return {',
      '          value: item.value,',
      '          itemStyle: {',
      '            color: (item.type === \'start\' || item.type === \'end\')',
      '              ? \'#3392FF\'',
      '              : item.value >= 0 ? \'#36A635\' : \'#EA6E55\',',
      '            borderRadius: 2,',
      '          },',
      '        };',
      '      }),',
      '    },',
      '  ],',
      '  animationDuration: 1000, animationEasing: \'cubicOut\',',
      '};',
    ].join('\n');
  }

  // ── Treemap ───────────────────────────────────────────────────────────────
  if (t === 'Treemap') {
    return [
      'const option = {',
      '  tooltip: {',
      '    trigger: \'item\',',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '    formatter: \'{b}: {c}\',',
      '  },',
      '  series: [{',
      '    type: \'treemap\',',
      '    left: 16, right: 16, top: 8, bottom: 8,',
      '    roam: false, nodeClick: false,',
      '    breadcrumb: { show: false },',
      '    label: {',
      '      position: \'insideTopLeft\',',
      '      color: \'#fff\', fontSize: 11, fontWeight: 600,',
      '    },',
      '    upperLabel: { show: false },',
      '    itemStyle: { borderColor: \'#fff\', borderWidth: 2, gapWidth: 2, borderRadius: 2 },',
      '    levels: [',
      '      { itemStyle: { borderWidth: 0, gapWidth: 3 } },',
      '      { itemStyle: { borderWidth: 2, gapWidth: 2 } },',
      '      { itemStyle: { borderWidth: 1, gapWidth: 1 } },',
      '    ],',
      '    // data: [{ name, value, itemStyle: { color }, children: [...] }]',
      '    data: data.tree,',
      '    animationDuration: 600, animationEasing: \'cubicOut\',',
      '  }],',
      '};',
    ].join('\n');
  }

  // ── Calendar ──────────────────────────────────────────────────────────────
  if (t === 'Calendar') {
    return [
      '// Calendar heat-map is a custom DOM grid — no ECharts instance.',
      '// 35 cells (5 weeks × 7 days) rendered as <div> elements.',
      '',
      '// Cell color formula (blue intensity by normalized value 0–1):',
      'function cellColor(norm) {',
      '  var opacity = 0.08 + norm * 0.88;',
      '  return \'rgba(51,146,255,\' + opacity.toFixed(2) + \')\';',
      '  // Full blue (#3392FF) at opacity 0.08 (empty) → 0.96 (max)',
      '}',
      '',
      '// Expected data shape:',
      'const data = {',
      '  cells: [',
      '    { date: \'2024-01-01\', value: 0.72 },',
      '    // ... 35 entries total (Mon–Sun, 5 weeks)',
      '  ],',
      '};',
    ].join('\n');
  }

  // ── Gauge ─────────────────────────────────────────────────────────────────
  if (t === 'Gauge') {
    return [
      'const option = {',
      '  series: [{',
      '    type: \'gauge\',',
      '    startAngle: 225, endAngle: -45,',
      '    min: 0, max: 100,',
      '    progress: {',
      '      show: true, width: 10, roundCap: true,',
      '      itemStyle: { color: \'#3392FF\' },',
      '    },',
      '    axisLine: {',
      '      lineStyle: { width: 10, color: [[1, \'rgba(0,0,0,0.06)\']] },',
      '    },',
      '    pointer:   { show: false },',
      '    axisTick:  { show: false },',
      '    splitLine: { show: false },',
      '    axisLabel: { show: false },',
      '    anchor:    { show: false },',
      '    title:     { show: false },',
      '    detail:    { show: false },',
      '    data: [{ value: data.score }],',
      '    animationDuration: 800, animationEasing: \'cubicOut\',',
      '  }],',
      '};',
    ].join('\n');
  }

  // ── Hero ──────────────────────────────────────────────────────────────────
  if (t === 'Hero') {
    return [
      '// Hero is a pure DOM/React component — no ECharts instance.',
      '// The sparkline variant draws a minimal SVG path from an array of values.',
      '',
      '// Expected data shape:',
      'const data = {',
      '  label:    \'Total Revenue\',',
      '  value:    \'$48,291\',',
      '  delta:    \'+12.4%\',',
      '  trend:    \'up\',   // \'up\' | \'down\' | \'neutral\'',
      '  sparkline: [120, 145, 132, 168, 155, 185, 201],',
      '};',
      '',
      '// SVG path is computed from sparkline values:',
      '// normalize values → map to (x, y) coords → polyline points',
    ].join('\n');
  }

  // ── Bullet ────────────────────────────────────────────────────────────────
  if (t === 'Bullet') {
    var zones = r.zones;
    return [
      '// Two stacked bar series: invisible placeholder + visible value bar.',
      (zones ? '// Zone bands (red/yellow/green at 15% opacity) sit behind the value bar.' : ''),
      '',
      'const option = {',
      '  grid: { top: \'middle\', height: 28, left: 16, right: 24, containLabel: false },',
      '  xAxis: { type: \'value\', show: false, min: 0, max: data.goal },',
      '  yAxis: {',
      '    type: \'category\', data: [\'\'],',
      '    axisLine: { show: false }, axisTick: { show: false },',
      '  },',
      '  tooltip: {',
      '    trigger: \'axis\', axisPointer: { type: \'none\' },',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '  },',
      '  series: [',
      (zones ? [
        '    // Zone bands',
        '    { type: \'bar\', stack: \'total\', barWidth: 22, data: [data.goal * 0.40], itemStyle: { color: \'rgba(234,110,85,0.15)\' } },',
        '    { type: \'bar\', stack: \'total\', barWidth: 22, data: [data.goal * 0.30], itemStyle: { color: \'rgba(175,137,4,0.15)\' } },',
        '    { type: \'bar\', stack: \'total\', barWidth: 22, data: [data.goal * 0.30], itemStyle: { color: \'rgba(54,166,53,0.15)\', borderRadius: [0,2,2,0] } },',
      ].join('\n') : ''),
      '    // Value bar',
      '    { type: \'bar\', barWidth: ' + (zones ? '14' : '22') + ', data: [data.value], itemStyle: { color: \'#3392FF\', borderRadius: [0,2,2,0] } },',
      '  ],',
      '  animationDuration: 700, animationEasing: \'cubicOut\',',
      '};',
    ].filter(Boolean).join('\n');
  }

  // ── Combo ─────────────────────────────────────────────────────────────────
  if (t === 'Combo') {
    var stacked = r.stacked;
    var grouped = r.grouped;
    var seriesStr = (stacked || grouped)
      ? [
          '  series: [',
          '    { type: \'bar\', name: \'Channel A\', yAxisIndex: 0, data: data.series[0].values,' + (stacked ? ' stack: \'total\',' : '') + ' itemStyle: { color: \'#3392FF\', borderRadius: [2,2,0,0] } },',
          '    { type: \'bar\', name: \'Channel B\', yAxisIndex: 0, data: data.series[1].values,' + (stacked ? ' stack: \'total\',' : '') + ' itemStyle: { color: \'#36A635\', borderRadius: [2,2,0,0] } },',
          '    { type: \'line\', name: \'Rate\',      yAxisIndex: 1, data: data.line,',
          '      smooth: false, symbol: \'circle\', symbolSize: 6,',
          '      lineStyle: { width: 2, color: \'#9570F3\' }, itemStyle: { color: \'#9570F3\' } },',
          '  ],',
        ].join('\n')
      : [
          '  series: [',
          '    { type: \'bar\',  name: \'Volume\', yAxisIndex: 0, data: data.bars, barMaxWidth: 40,',
          '      itemStyle: { color: \'#3392FF\', borderRadius: [2,2,0,0] } },',
          '    { type: \'line\', name: \'Rate\',   yAxisIndex: 1, data: data.line,',
          '      smooth: false, symbol: \'circle\', symbolSize: 6,',
          '      lineStyle: { width: 2, color: \'#36A635\' }, itemStyle: { color: \'#36A635\' } },',
          '  ],',
        ].join('\n');
    return [
      'const option = {',
      '  color: [\'#3392FF\', \'#36A635\', \'#9570F3\'],',
      '  grid: { top: 8, right: 48, bottom: 32, left: 48 },',
      '  xAxis: {',
      '    type: \'category\', data: data.labels,',
      '    axisLine: { show: false }, axisTick: { show: false },',
      '    axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\', margin: 8 },',
      '  },',
      '  yAxis: [',
      '    { type: \'value\', min: 0,',
      '      axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\' },',
      '      splitLine: { lineStyle: { color: \'rgba(0,0,0,0.06)\', type: \'dashed\' } } },',
      '    { type: \'value\', min: 0, max: 100,',
      '      axisLabel: { fontSize: 10, color: \'rgba(0,0,0,0.6)\', formatter: \'{value}%\' },',
      '      splitLine: { show: false } },',
      '  ],',
      '  tooltip: {',
      '    trigger: \'axis\',',
      '    backgroundColor: \'#1a1a1a\', borderColor: \'transparent\',',
      '    textStyle: { color: \'#fff\', fontSize: 10, fontWeight: 700 },',
      '  },',
      seriesStr,
      '  animationDuration: 600, animationEasing: \'cubicOut\',',
      '};',
    ].join('\n');
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  if (t === 'Table') {
    return [
      '// Table is a custom DOM component — no ECharts instance.',
      '// Pass scrollable={true} stickyFirst={true} to enable horizontal scroll',
      '// with the first column pinned. The sticky column shrinks and truncates',
      '// with ellipsis as the user scrolls, locking at a minimum readable width.',
      '',
      '// tableConfig data shape:',
      'const tableConfig = {',
      '  columns: [',
      '    { key: \'agent\',    label: \'Agent\',    align: \'left\' },',
      '    { key: \'calls\',    label: \'Calls\',    align: \'right\', numeric: true },',
      '    { key: \'emails\',   label: \'Emails\',   align: \'right\', numeric: true },',
      '    { key: \'meetings\', label: \'Meetings\', align: \'right\', numeric: true },',
      '    { key: \'deals\',    label: \'Deals\',    align: \'right\', numeric: true },',
      '    { key: \'avgdeal\',  label: \'Avg Deal\', align: \'right\', numeric: true, format: \'dollar\' },',
      '    { key: \'pipeline\', label: \'Pipeline\', align: \'right\', numeric: true, format: \'dollar\' },',
      '    { key: \'winrate\',  label: \'Win Rate\', align: \'right\', numeric: true, format: \'pct\' },',
      '    { key: \'closed\',   label: \'Closed\',   align: \'right\', numeric: true, format: \'dollar\' },',
      '    { key: \'quota\',    label: \'Quota %\',  align: \'right\', numeric: true, format: \'pct\' },',
      '  ],',
      '  rows: [',
      '    { agent: \'Alex Pendrick\',   calls: 182, emails: 294, meetings: 18,',
      '      deals: 12, avgdeal: 964, pipeline: 12052, winrate: 44,',
      '      closed: 9641, quota: 118 },',
      '    // ...',
      '  ],',
      '};',
      '',
      '// Column format values:',
      '// "dollar" → $1,234   "pct" → 44.0%   "rating" → 4.8   (omit for plain numbers)',
    ].join('\n');
  }

  // ── Reviews ───────────────────────────────────────────────────────────────
  if (t === 'Reviews') {
    return [
      '// Reviews is a custom DOM component — no ECharts instance.',
      '// Horizontal bar per rating tier (5★ → 1★) sized by CSS width %.',
      '',
      '// Expected data shape:',
      'const data = {',
      '  overallRating: 4.3,',
      '  totalReviews:  1284,',
      '  breakdown: [',
      '    { stars: 5, count: 712 },',
      '    { stars: 4, count: 321 },',
      '    { stars: 3, count: 148 },',
      '    { stars: 2, count:  67 },',
      '    { stars: 1, count:  36 },',
      '  ],',
      '};',
      '',
      '// Bar width formula:',
      'function barWidth(count, total) {',
      '  return (count / total * 100).toFixed(1) + \'%\';',
      '}',
    ].join('\n');
  }

  return '// ECharts config is not applicable for this chart type.';
}

// ─── Design tokens reference ───────────────────────────────────────────────
// Returns a comment block listing every color, spacing, and typography value
// used by the chart, with corresponding DEX token names for reference.
function generateDesignTokens() {
  return [
    "import { chartTokens } from './chartTokens.js';",
    '',
    '// chartTokens — canvas-safe resolved values matching DEX design tokens.',
    '// ECharts renders to <canvas>; CSS custom properties (var(--dex-...)) cannot',
    '// be read at paint time. Use chartTokens for all ECharts option values.',
    '// Surrounding DOM elements (card borders, padding) still use var(--dex-...).',
    '',
    'export var chartTokens = {',
    '  colors: {',
    "    colorDataBlue100:    '#3392FF',  // --dex-color-data-blue-100",
    "    colorDataGreen100:   '#36A635',  // --dex-color-data-green-100",
    "    colorDataPurple100:  '#9570F3',  // --dex-color-data-purple-100",
    "    colorDataAqua100:    '#3E9BB6',  // --dex-color-data-aqua-100",
    "    colorDataNavy100:    '#7C8EB0',  // --dex-color-data-navy-100",
    "    colorDataEmerald100: '#00A462',  // --dex-color-data-emerald-100",
    "    colorDataYellow100:  '#AF8904',  // --dex-color-data-yellow-100",
    "    colorDataBlue200:    '#0A7CFF',  // --dex-color-data-blue-200",
    "    colorDataGreen200:   '#319530',  // --dex-color-data-green-200",
    "    colorDataPurple200:  '#8358F1',  // --dex-color-data-purple-200",
    "    colorDataAqua200:    '#377F95',  // --dex-color-data-aqua-200",
    "    colorDataNavy200:    '#667BA3',  // --dex-color-data-navy-200",
    "    colorDataEmerald200: '#008650',  // --dex-color-data-emerald-200",
    "    colorDataYellow200:  '#8F7004',  // --dex-color-data-yellow-200",
    "    colorDataBlue300:    '#006CEB',  // --dex-color-data-blue-300",
    "    colorDataGreen300:   '#2B852A',  // --dex-color-data-green-300",
    "    colorDataPurple300:  '#744ED6',  // --dex-color-data-purple-300",
    "    colorDataAqua300:    '#337285',  // --dex-color-data-aqua-300",
    "    colorDataNavy300:    '#506896',  // --dex-color-data-navy-300",
    "    colorDataEmerald300: '#007747',  // --dex-color-data-emerald-300",
    "    colorDataYellow300:  '#7F6403',  // --dex-color-data-yellow-300",
    "    colorDataRed100:     '#EA6E55',  // --dex-color-data-red-100",
    '  },',
    '  axis: {',
    "    labelColor:      'rgba(0,0,0,0.6)',  // --dex-fgColor-subtle",
    '    labelFontSize:   10,',
    '    labelFontWeight: 500,',
    "    splitLineColor:  'rgba(0,0,0,0.06)', // --dex-borderColor-default",
    '  },',
    '  tooltip: {',
    "    backgroundColor: '#1A1A1A',  // --dex-bgColor-neutral-emphasis-base",
    "    textColor:       '#FFFFFF',",
    '    fontSize:        10,',
    '    fontWeight:      700,',
    '  },',
    '  animation: {',
    '    duration:       1000,',
    "    easing:         'cubicOut',",
    '    durationUpdate: 600,',
    "    easingUpdate:   'cubicOut',",
    '  },',
    '};',
  ].join('\n');
}

// ─── Initialization + animation code generator ────────────────────────────
// Returns the chart-specific init and entry-animation code as a string.
// Appended below the option object so the ECharts Config block is complete.
function generateInitCode(type, variant) {
  var t = type.type;

  // Custom DOM charts — no ECharts instance
  if (t === 'Hero' || t === 'Table' || t === 'Reviews' || t === 'Calendar') {
    return [
      '// ── No ECharts instance ──────────────────────────────────────────────────',
      '// This chart is rendered as custom DOM — no echarts.init() needed.',
      '// Use the color and spacing values from the Design Tokens section',
      '// to keep the visual spec consistent.',
    ].join('\n');
  }

  var L = [
    '// ── Initialize ──────────────────────────────────────────────────────────',
    "const chart = echarts.init(container, null, { renderer: 'canvas' });",
  ];

  if (t === 'Line' || t === 'Area') {
    // ECharts built-in animation draws the line — no extra work needed
    L.push('chart.setOption(option);');
  } else if (t === 'Column' || t === 'Bar' || t === 'Bullet') {
    L = L.concat([
      '',
      '// Grow-from-zero: start at 0, update to real values on next frame.',
      '// ECharts animates the value transition, creating a bars-rising effect.',
      'chart.setOption({',
      '  ...option,',
      "  series: option.series.map(s => ({ ...s, data: s.data.map(() => 0), animation: false })),",
      '});',
      'setTimeout(() => chart.setOption(option), 16);',
    ]);
  } else if (t === 'Gauge') {
    L = L.concat([
      '',
      '// Grow-from-zero: needle sweeps up from 0 on entry.',
      "chart.setOption({ ...option, series: [{ ...option.series[0], data: [{ value: 0 }], animation: false }] });",
      'setTimeout(() => chart.setOption(option), 16);',
    ]);
  } else if (t === 'Donut' || t === 'Pie') {
    L = L.concat([
      '',
      '// Defer 50ms so the parent card entrance animation finishes',
      '// before the pie/donut expansion begins.',
      "setTimeout(() => chart.setOption(option), 50);",
    ]);
  } else if (t === 'Funnel') {
    L = L.concat([
      '',
      '// animationDelay in the series config handles the per-stage stagger.',
      '// No additional setup needed beyond a standard setOption.',
      'chart.setOption(option);',
    ]);
  } else if (t === 'Scatter') {
    L = L.concat([
      '',
      '// Staggered RAF reveal — points scale from 0 → 8px in sequence.',
      '// 70ms apart, 360ms per point. easeOutCubic.',
      'chart.setOption({ ...option, series: [{ ...option.series[0], data: [] }] });',
      '',
      'const STAGGER = 70, DURATION = 360;',
      'const easeOut = t => 1 - Math.pow(1 - t, 3);',
      'let rafStart = null;',
      '(function animate(ts) {',
      '  if (!rafStart) rafStart = ts;',
      '  const elapsed = ts - rafStart;',
      '  chart.setOption({ series: [{ data: data.points.map((pt, i) => ({',
      '    value: pt,',
      '    symbolSize: easeOut(Math.max(0, Math.min(1, (elapsed - i * STAGGER) / DURATION))) * 8,',
      '  }))}] });',
      '  if (elapsed < (data.points.length - 1) * STAGGER + DURATION)',
      '    requestAnimationFrame(animate);',
      '})(performance.now());',
    ]);
  } else if (t === 'Heatmap') {
    L = L.concat([
      '',
      '// Intensity-bucketed RAF cascade.',
      '// Cells are sorted into 4 buckets by value; each bucket reveals in sequence.',
      '// 130ms between buckets, 380ms per bucket. Total ≈ 770ms.',
      'chart.setOption(option);',
      '',
      'const BUCKET_DELAY = 130, DURATION = 380;',
      'const easeOut = t => 1 - Math.pow(1 - t, 3);',
      'let rafStart = null;',
      '(function animate(ts) {',
      '  if (!rafStart) rafStart = ts;',
      '  const elapsed = ts - rafStart;',
      '  chart.setOption({ series: [{ data: data.cells.map(d => {',
      '    const bucket   = Math.min(3, Math.floor(d.value * 4));',
      '    const progress = easeOut(Math.max(0, Math.min(1, (elapsed - bucket * BUCKET_DELAY) / DURATION)));',
      '    return [d.hour, d.day, d.value * progress];',
      '  })}] });',
      '  if (elapsed < 3 * BUCKET_DELAY + DURATION) requestAnimationFrame(animate);',
      '})(performance.now());',
    ]);
  } else if (t === 'Waterfall') {
    L = L.concat([
      '',
      '// Staggered bar drop — each bar grows from its base upward.',
      '// 130ms apart, 520ms per bar. Total = (nBars - 1) × 130ms + 520ms.',
      'chart.setOption(option);',
      '',
      'const BAR_DELAY = 130, BAR_DURATION = 520;',
      'const easeOut = t => 1 - Math.pow(1 - t, 3);',
      'let rafStart = null;',
      '(function animate(ts) {',
      '  if (!rafStart) rafStart = ts;',
      '  const elapsed = ts - rafStart;',
      '  chart.setOption({ series: [',
      '    { data: data.placeholders.map((p, i) =>',
      '        p * easeOut(Math.max(0, Math.min(1, (elapsed - i * BAR_DELAY) / BAR_DURATION)))) },',
      '    { data: data.values.map((item, i) => ({',
      '        value: item.value * easeOut(Math.max(0, Math.min(1,',
      '          (elapsed - i * BAR_DELAY) / BAR_DURATION))),',
      '        itemStyle: item.itemStyle,',
      '    })) },',
      '  ] });',
      '  if (elapsed < (data.values.length - 1) * BAR_DELAY + BAR_DURATION)',
      '    requestAnimationFrame(animate);',
      '})(performance.now());',
    ]);
  } else if (t === 'Treemap') {
    L = L.concat([
      '',
      '// Largest-first opacity cascade — tiles fade in sorted by value descending.',
      '// 70ms stagger, 360ms each. Smaller tiles appear last.',
      'chart.setOption(option);',
      '',
      'const allTiles = data.tree.flatMap(p => p.children || [p]).sort((a, b) => b.value - a.value);',
      'const order    = new Map(allTiles.map((d, i) => [d.name, i]));',
      '',
      'const STAGGER = 70, DURATION = 360;',
      'const easeOut = t => 1 - Math.pow(1 - t, 3);',
      'let rafStart = null;',
      '(function animate(ts) {',
      '  if (!rafStart) rafStart = ts;',
      '  const elapsed = ts - rafStart;',
      '  chart.setOption({ series: [{ data: data.tree.map(p => ({',
      '    ...p,',
      '    children: (p.children || []).map(c => {',
      '      const opacity = easeOut(Math.max(0, Math.min(1,',
      '        (elapsed - (order.get(c.name) || 0) * STAGGER) / DURATION)));',
      '      return { ...c,',
      '        itemStyle: { ...c.itemStyle, opacity },',
      '        label: { color: `rgba(255,255,255,${opacity.toFixed(2)})` },',
      '      };',
      '    }),',
      '  }))}] });',
      '  if (elapsed < allTiles.length * STAGGER + DURATION)',
      '    requestAnimationFrame(animate);',
      '})(performance.now());',
    ]);
  } else if (t === 'Combo') {
    L = L.concat([
      '',
      '// Two-phase animation:',
      '// Phase 1 — bars grow from zero (ECharts native, 600ms)',
      '// Phase 2 — line reveals left-to-right via RAF, starting at 650ms',
      '',
      '// Phase 1: grow bars from zero',
      "chart.setOption({ ...option, series: option.series.map(s =>",
      "  s.type === 'bar' ? { ...s, data: s.data.map(() => 0), animation: false } : { ...s, data: [] }",
      ') });',
      "setTimeout(() => chart.setOption({ series: option.series.filter(s => s.type === 'bar') }), 16);",
      '',
      '// Phase 2: line draws left-to-right after bars finish',
      'const LINE_START = 650, LINE_DURATION = 500;',
      'const easeOut = t => 1 - Math.pow(1 - t, 3);',
      'let rafStart = null;',
      'setTimeout(function() {',
      '  (function animate(ts) {',
      '    if (!rafStart) rafStart = ts;',
      '    const elapsed = ts - rafStart;',
      '    const n = Math.ceil(easeOut(Math.min(1, elapsed / LINE_DURATION)) * data.line.length);',
      "    chart.setOption({ series: [{ type: 'line', data:",
      '      data.line.slice(0, n).concat(data.line.slice(n).map(() => null))',
      '    }] });',
      '    if (elapsed < LINE_DURATION) requestAnimationFrame(animate);',
      '  })(performance.now());',
      '}, LINE_START);',
    ]);
  } else {
    L.push('chart.setOption(option);');
  }

  L.push("window.addEventListener('resize', () => chart.resize());");
  return L.join('\n');
}

function applyChartTokenRefs(code) {
  var map = [
    ["'#3392FF'", 'chartTokens.colors.colorDataBlue100'],
    ["'#36A635'", 'chartTokens.colors.colorDataGreen100'],
    ["'#9570F3'", 'chartTokens.colors.colorDataPurple100'],
    ["'#3E9BB6'", 'chartTokens.colors.colorDataAqua100'],
    ["'#7C8EB0'", 'chartTokens.colors.colorDataNavy100'],
    ["'#00A462'", 'chartTokens.colors.colorDataEmerald100'],
    ["'#AF8904'", 'chartTokens.colors.colorDataYellow100'],
    ["'#0A7CFF'", 'chartTokens.colors.colorDataBlue200'],
    ["'#319530'", 'chartTokens.colors.colorDataGreen200'],
    ["'#8358F1'", 'chartTokens.colors.colorDataPurple200'],
    ["'#377F95'", 'chartTokens.colors.colorDataAqua200'],
    ["'#667BA3'", 'chartTokens.colors.colorDataNavy200'],
    ["'#008650'", 'chartTokens.colors.colorDataEmerald200'],
    ["'#8F7004'", 'chartTokens.colors.colorDataYellow200'],
    ["'#006CEB'", 'chartTokens.colors.colorDataBlue300'],
    ["'#2B852A'", 'chartTokens.colors.colorDataGreen300'],
    ["'#744ED6'", 'chartTokens.colors.colorDataPurple300'],
    ["'#337285'", 'chartTokens.colors.colorDataAqua300'],
    ["'#506896'", 'chartTokens.colors.colorDataNavy300'],
    ["'#007747'", 'chartTokens.colors.colorDataEmerald300'],
    ["'#7F6403'", 'chartTokens.colors.colorDataYellow300'],
    ["'#EA6E55'", 'chartTokens.colors.colorDataRed100'],
    ["'rgba(0,0,0,0.6)'",  'chartTokens.axis.labelColor'],
    ["'rgba(0,0,0,0.06)'", 'chartTokens.axis.splitLineColor'],
    ["'#1a1a1a'", 'chartTokens.tooltip.backgroundColor'],
    ["'#1A1A1A'", 'chartTokens.tooltip.backgroundColor'],
  ];
  var result = code;
  for (var i = 0; i < map.length; i++) {
    result = result.split(map[i][0]).join(map[i][1]);
  }
  return result;
}

function generateSnippet(type, variant) {
  var render = variant.render || {};
  var echartsRaw = generateEChartsOption(type, variant) + '\n\n' + generateInitCode(type, variant);
  return {
    echarts: "import { chartTokens } from './chartTokens.js';\n\n" + applyChartTokenRefs(echartsRaw),
    data:    generateDataSample(type.type, render),
    tokens:  generateDesignTokens(),
  };
}

// ── Syntax highlighter ───────────────────────────────────────────────────────
// Lightweight hand-rolled tokenizer — no external library. Scans the code
// string once and emits typed tokens that map to DEX accent-subtle colors.
// All tokens resolve to bgColor-accent-X-subtle (the -100 palette scale) which
// are light pastels with high contrast on the near-black fgColor-default bg.

var SH_KEYWORDS = [
  'var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'new', 'this', 'true', 'false', 'null', 'undefined', 'typeof',
  'instanceof', 'class', 'extends', 'import', 'export', 'default', 'from',
  'async', 'await', 'try', 'catch', 'throw', 'switch', 'case', 'break',
  'continue', 'delete', 'in', 'of', 'void', 'yield',
];

var SH_BUILTINS = [
  'echarts', 'window', 'document', 'console', 'Math', 'setTimeout',
  'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'Array', 'Object', 'String', 'Number', 'Boolean',
  'Date', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Promise',
  'Error', 'Map', 'Set', 'Symbol', 'Infinity', 'NaN',
];

// DEX accent-subtle tokens — light pastels, high contrast on dark background.
var SH_COLORS = {
  keyword:  'var(--dex-bgColor-accent-purple-subtle)',   // purple  — keywords
  string:   'var(--dex-bgColor-accent-emerald-subtle)',  // green   — strings
  number:   'var(--dex-bgColor-accent-orange-subtle)',   // orange  — numbers
  key:      'var(--dex-bgColor-accent-aqua-subtle)',     // aqua    — object keys
  builtin:  'var(--dex-bgColor-accent-blue-subtle)',     // blue    — built-ins/globals
  comment:  'var(--dex-bgColor-accent-forest-subtle)',   // forest  — comments (muted)
  plain:    'var(--dex-bgColor-accent-beige-subtle)',    // beige   — default text
};

function tokenizeCode(code) {
  var tokens = [];
  var i = 0;
  var len = code.length;

  // Append a char to the running plain token, or start a new one.
  function pushPlain(ch) {
    var last = tokens[tokens.length - 1];
    if (last && last.type === 'plain') {
      last.text += ch;
    } else {
      tokens.push({ type: 'plain', text: ch });
    }
  }

  while (i < len) {
    var ch = code[i];

    // ── Line comment ─────────────────────────────────────────────────────────
    if (ch === '/' && code[i + 1] === '/') {
      var end = code.indexOf('\n', i);
      if (end === -1) end = len;
      tokens.push({ type: 'comment', text: code.slice(i, end) });
      i = end;
      continue;
    }

    // ── Block comment ────────────────────────────────────────────────────────
    if (ch === '/' && code[i + 1] === '*') {
      var end = code.indexOf('*/', i + 2);
      if (end === -1) end = len; else end += 2;
      tokens.push({ type: 'comment', text: code.slice(i, end) });
      i = end;
      continue;
    }

    // ── String literal (single, double, or template quote) ───────────────────
    if (ch === "'" || ch === '"' || ch === '`') {
      var quote = ch;
      var j = i + 1;
      while (j < len) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === quote) { j++; break; }
        j++;
      }
      tokens.push({ type: 'string', text: code.slice(i, j) });
      i = j;
      continue;
    }

    // ── Number literal ───────────────────────────────────────────────────────
    if (ch >= '0' && ch <= '9') {
      var j = i;
      // Hex
      if (code[j] === '0' && (code[j + 1] === 'x' || code[j + 1] === 'X')) {
        j += 2;
        while (j < len && /[0-9a-fA-F_]/.test(code[j])) j++;
      } else {
        while (j < len && (code[j] >= '0' && code[j] <= '9' || code[j] === '.' || code[j] === '_')) j++;
        // Exponent
        if (j < len && (code[j] === 'e' || code[j] === 'E')) {
          j++;
          if (j < len && (code[j] === '+' || code[j] === '-')) j++;
          while (j < len && code[j] >= '0' && code[j] <= '9') j++;
        }
      }
      tokens.push({ type: 'number', text: code.slice(i, j) });
      i = j;
      continue;
    }

    // ── Identifier, keyword, builtin, or object key ──────────────────────────
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      var j = i;
      while (j < len) {
        var c = code[j];
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
            (c >= '0' && c <= '9') || c === '_' || c === '$') {
          j++;
        } else { break; }
      }
      var word = code.slice(i, j);

      // Peek past whitespace — if a lone colon follows, it's an object key.
      var k = j;
      while (k < len && (code[k] === ' ' || code[k] === '\t')) k++;
      var isKey = code[k] === ':' && code[k + 1] !== ':';

      var type;
      if (isKey) {
        type = 'key';
      } else if (SH_KEYWORDS.indexOf(word) !== -1) {
        type = 'keyword';
      } else if (SH_BUILTINS.indexOf(word) !== -1) {
        type = 'builtin';
      } else {
        type = 'plain';
      }
      tokens.push({ type: type, text: word });
      i = j;
      continue;
    }

    // ── Everything else: punctuation, operators, whitespace ──────────────────
    pushPlain(ch);
    i++;
  }

  return tokens;
}

// A single dark-background code block with a label, monospace pre, copy
// button, and syntax-highlighted content.
function CodeBlock({ label, code }) {
  var [copied, setCopied] = useState(false);
  var { open: notify } = useNotification();
  function handleCopy() {
    // Use the synchronous execCommand approach first — it fires on the
    // user gesture before Radix's focus trap can shift focus, which is
    // what causes navigator.clipboard to fail inside modals. Fall back
    // to the async Clipboard API if execCommand isn't available.
    var textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(textarea);

    if (ok) {
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 1500);
      notify({ title: 'Copied to clipboard', variant: 'success', duration: 2000 });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function() {
        setCopied(true);
        setTimeout(function() { setCopied(false); }, 1500);
        notify({ title: 'Copied to clipboard', variant: 'success', duration: 2000 });
      }).catch(function() {
        notify({ title: 'Copy failed', description: 'Please copy the code manually.', variant: 'danger', duration: 3000 });
      });
    } else {
      notify({ title: 'Copy failed', description: 'Please copy the code manually.', variant: 'danger', duration: 3000 });
    }
  }
  return (
    <div style={{ marginBottom: tokens.spacing[5] }}>
      {label && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: tokens.spacing[1.5],
        }}>
          <span style={{
            fontSize: tokens.typography.fontSize['2xs'],
            fontWeight: tokens.typography.fontWeight.bold,
            textTransform: 'uppercase',
            letterSpacing: tokens.typography.letterSpacing.wider,
            color: tokens.colors.ui.subtleText,
          }}>{label}</span>
          <button
            onClick={handleCopy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: tokens.spacing[1],
              padding: '3px 8px',
              border: '1px solid var(--dex-borderColor-default, rgba(0,0,0,0.12))',
              borderRadius: tokens.borderRadius.base,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: tokens.typography.fontSize['2xs'],
              fontFamily: 'inherit',
              fontWeight: tokens.typography.fontWeight.medium,
              color: copied ? 'var(--dex-fgColor-success, #2b852a)' : tokens.colors.ui.bodyText,
              transition: 'color 0.12s ease',
            }}
          >
            <DexIcon name={copied ? 'check' : 'clipboard'} size="xs" />
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}
      <pre style={{
        margin: 0,
        padding: tokens.spacing[4],
        background: 'var(--dex-fgColor-default)',
        color: 'var(--dex-bgColor-accent-beige-subtle)',
        fontFamily: tokens.typography.fontFamily.mono,
        fontSize: tokens.typography.fontSize.xs,
        lineHeight: tokens.typography.lineHeight.relaxed,
        borderRadius: tokens.borderRadius.md,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        overflowX: 'hidden',
      }}>
        <code>{tokenizeCode(code).map(function(tok, idx) {
          return (
            <span key={idx} style={{ color: SH_COLORS[tok.type] || SH_COLORS.plain }}>
              {tok.text}
            </span>
          );
        })}</code>
      </pre>
    </div>
  );
}

// Modal that shows the three code blocks for a variant. Controlled by the
// open/onClose props passed from ViewCodeButton.
function CodeModal({ type, variant, open, onClose }) {
  var bodyRef = useRef(null);
  var [copyAllDone, setCopyAllDone] = useState(false);
  var { open: notify } = useNotification();
  var snippet = generateSnippet(type, variant);

  useEffect(function() {
    if (!open) return;
    var id = requestAnimationFrame(function() {
      if (bodyRef.current) bodyRef.current.focus();
    });
    return function() { cancelAnimationFrame(id); };
  }, [open]);

  function handleCopyAll() {
    var combined = [
      '// ── ECharts Config ──────────────────────────────────────────────────────',
      snippet.echarts,
      '',
      '// ── Sample Data ─────────────────────────────────────────────────────────',
      snippet.data,
      '',
      '// ── Design Tokens ───────────────────────────────────────────────────────',
      snippet.tokens,
    ].join('\n');

    var textarea = document.createElement('textarea');
    textarea.value = combined;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(textarea);

    if (ok) {
      setCopyAllDone(true);
      setTimeout(function() { setCopyAllDone(false); }, 1500);
      notify({ title: 'All code copied', variant: 'success', duration: 2000 });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(combined).then(function() {
        setCopyAllDone(true);
        setTimeout(function() { setCopyAllDone(false); }, 1500);
        notify({ title: 'All code copied', variant: 'success', duration: 2000 });
      }).catch(function() {
        notify({ title: 'Copy failed', description: 'Please copy the code manually.', variant: 'danger', duration: 3000 });
      });
    } else {
      notify({ title: 'Copy failed', description: 'Please copy the code manually.', variant: 'danger', duration: 3000 });
    }
  }

  return (
    <DexModal open={open} onOpenChange={onClose}>
      <DexModalContent size="lg">
        <DexModalHeading
          title={variant.label}
          subtitle={type.label + ' chart'}
        />
        <DexModalBody>
          <div ref={bodyRef} tabIndex={-1} style={{ outline: 'none', paddingTop: tokens.spacing[4] }}>
            <CodeBlock label="ECharts Config Example" code={snippet.echarts} />
            <CodeBlock label="Sample Data" code={snippet.data} />
            <CodeBlock label="Design Tokens" code={snippet.tokens} />
          </div>
        </DexModalBody>
        <DexModalFooter>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: tokens.spacing[2] }}>
            <DexButton variant="outline" color="neutral" onClick={onClose}>
              Cancel
            </DexButton>
            <DexButton
              variant="solid"
              leadingIcon={copyAllDone ? 'check' : 'copy'}
              onClick={handleCopyAll}
            >
              {copyAllDone ? 'Copied!' : 'Copy All Code'}
            </DexButton>
          </div>
        </DexModalFooter>
      </DexModalContent>
    </DexModal>
  );
}

// Transparent ghost-style "View Code" button that sits on the right side of
// the variant name row. Hover state uses DEX alpha token for background and
// DEX primary token for text/icon color.
function ViewCodeButton({ type, variant }) {
  var [modalOpen, setModalOpen] = useState(false);
  var [hover, setHover] = useState(false);
  return (
    <>
      <button
        onClick={function() { setModalOpen(true); }}
        onMouseEnter={function() { setHover(true); }}
        onMouseLeave={function() { setHover(false); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: tokens.spacing[1.5],
          padding: '2px 6px 2px 4px',
          border: 'none',
          background: hover ? 'var(--dex-bgColor-alpha-emphasis, rgba(0,0,0,0.06))' : 'transparent',
          borderRadius: tokens.borderRadius.base,
          cursor: 'pointer',
          color: hover ? 'var(--dex-fgColor-primary, #006ceb)' : tokens.colors.ui.subtleText,
          fontSize: tokens.typography.fontSize.xs,
          fontFamily: 'inherit',
          fontWeight: tokens.typography.fontWeight.medium,
          transition: 'background 0.12s ease, color 0.12s ease',
          flexShrink: 0,
        }}
      >
        <DexIcon name="code" size="xs" />
        <span>Dev Reference</span>
      </button>
      <CodeModal
        type={type}
        variant={variant}
        open={modalOpen}
        onClose={function() { setModalOpen(false); }}
      />
    </>
  );
}

function VariantGrid({ type, variants, frameOn, showOptionalAxis }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      columnGap: tokens.spacing[5],
      rowGap: tokens.spacing[16],
    }}>
      {variants.map(function(v) {
        return <VariantCell key={v.id} type={type} variant={v} frameOn={frameOn} showOptionalAxis={showOptionalAxis} />;
      })}
    </div>
  );
}

function VariantCell({ type, variant, frameOn, showOptionalAxis }) {
  var item = Object.assign({ chartType: type.type }, variant.sample);
  return (
    // No overflow:hidden on the outer wrapper — that would clip the
    // DexCard's drop-shadow when the widget frame is on (the shadow
    // extends a few pixels past the card's border and was getting
    // sliced off by the previous overflow clip, leaving dark hard
    // corners). overflow:hidden lives only on the frame-off branch
    // below, where it's actually needed to keep multi-series legends /
    // BareChart canvas from spilling into adjacent grid cells. The
    // frame-on path delegates containment to DexCard.
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: tokens.spacing[2] }}>
        <ViewCodeButton type={type} variant={variant} />
      </div>
      <div style={{ height: 260, marginBottom: tokens.spacing[2.5], minWidth: 0 }}>
        {frameOn ? (
          <GalleryWidget item={item} render={variant.render} showOptionalAxis={showOptionalAxis} />
        ) : (
          <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
            padding: 0,
            background: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.025) 6px, rgba(0,0,0,0.025) 7px)',
            borderRadius: tokens.borderRadius.md,
            overflow: 'hidden',
            minWidth: 0,
          }}>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <BareChart item={item} render={variant.render} showOptionalAxis={showOptionalAxis} />
            </div>
          </div>
        )}
      </div>
      <div style={{ marginBottom: 2, minWidth: 0 }}>
        <div style={{ fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.semibold, color: tokens.colors.ui.cardTitle }}>
          {variant.label}
        </div>
      </div>
      <div style={{ fontSize: tokens.typography.fontSize.xs, color: tokens.colors.ui.subtleText, lineHeight: 1.45 }}>
        {variant.description}
        {variant.example && (
          <span style={{
            fontStyle: 'italic',
            color: 'var(--dex-fgColor-subtle)',
          }}> (e.g. {variant.example})</span>
        )}
      </div>
    </div>
  );
}
