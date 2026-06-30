// Gallery-only fork of Widget.jsx. Visually identical to the production
// Widget front face (header, title, period pill, card chrome, chart area
// with loading/error/empty states) but strips the gallery-irrelevant
// chrome: tri-dot menu, Ask AI button. Also threads any `render.*` flags
// through to ChartRenderer — the production Widget doesn't expose these
// because the dashboard has no concept of these rendering modes.
//
// Keep this file gallery-only. Do not import it from the production
// Widget surfaces — when this prototype ports back to Widgets / AI-Chat,
// the unmodified Widget.jsx is what travels.
import React, { useState } from 'react';
import { tokens } from '../styles/tokens.js';
import { PERS, getTableConfig } from './galleryData.js';
import ChartRenderer from '../lib/ChartRenderer.jsx';
import PillSelect from './PillSelect.jsx';
import WidgetFrame from './WidgetFrame.jsx';
import { useWidgetData } from '../useWidgetData.js';

export default function GalleryWidget({ item, render, showPeriodPill = true, showOptionalAxis = false }) {
  var initial = {
    metric: item.metric || 'Revenue',
    chartType: item.chartType || 'Line',
    period: item.period || 'Last 30 days',
    segment: item.segment || 'All segments',
    compare: !!item.compare,
    name: item.name || '',
  };
  var [state, setState] = useState(initial);
  var [pillOpen, setPillOpen] = useState(false);
  var [animTick, setAnimTick] = useState(0);

  function bump() { setAnimTick(function(n){ return n+1; }); }

  // Gallery convention: the real metric still drives data + table column
  // configs, but the displayed title is a generic placeholder so designers
  // evaluate the chart treatment without being distracted by metric names.
  var titleText = 'Metric Name';
  var dataState = useWidgetData({
    metric: state.metric,
    period: state.period,
    segment: state.segment,
    compare: state.compare,
  });

  var renderFlags = render || {};
  var scrollable = !!renderFlags.scrollable;
  var stickyFirst = !!renderFlags.stickyFirst;
  var stacked = !!renderFlags.stacked;
  var grouped = !!renderFlags.grouped;
  var seriesCount = renderFlags.series || 0;
  var sparkline = !!renderFlags.sparkline;
  var multiStat = !!renderFlags.multiStat;
  var composite = !!renderFlags.composite;
  var sortable = !!renderFlags.sortable;
  var segments = renderFlags.segments || 0;
  var withZones = !!renderFlags.withZones;
  var normalize = !!renderFlags.normalize;
  // categorical: single bar per category, color-coded from SERIES_COLORS
  // (no time axis). categories = how many bars (2-4). Independent of
  // stacked/grouped — when true, those flags are ignored on the Column/Bar
  // branch since the chart is a single-series categorical comparison.
  var categorical = !!renderFlags.categorical;
  var categories = renderFlags.categories || 0;
  // engine selects the rendering backend for chart types that support
  // multiple implementations (currently Treemap: 'svg' = custom SVG with
  // RAF scale-from-center, 'echarts' = native ECharts treemap series).
  // Threaded as a string so future engines can be added without
  // multiplying boolean flags.
  var engine = renderFlags.engine || 'svg';

  return (
    <WidgetFrame isActive={false} isAskAiTarget={false} panelFocusable={false}>
      <div style={{padding:`${tokens.spacing[4]} ${tokens.spacing[4]} ${tokens.spacing[2]}`, display:"flex", alignItems:"flex-start", flexShrink:0}}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize: tokens.typography.fontSize.sm, fontWeight: tokens.typography.fontWeight.bold, color:tokens.colors.ui.cardTitle, lineHeight:1.2}}>
            {titleText}
            {state.segment && state.segment !== 'All segments' && (
              <span style={{ fontWeight: tokens.typography.fontWeight.normal, color: 'var(--dex-fgColor-subtle, rgba(0,0,0,0.55))', marginLeft: tokens.spacing[1.5] }}>
                · {state.segment}
              </span>
            )}
          </div>
          {showPeriodPill && (
            <div style={{marginTop: tokens.spacing[1.5]}}>
              <PillSelect
                value={state.period}
                options={PERS}
                open={pillOpen}
                onOpenChange={setPillOpen}
                onChange={function(v){ setState(function(s){ return Object.assign({}, s, { period: v }); }); bump(); }}
              />
            </div>
          )}
        </div>
      </div>

      {/* When the chart manages its own bottom chrome (scrollable Table renders
          a custom scrollbar overlay near the card edge), drop the body padding-
          bottom so the scrollbar lands ~8px from the card edge instead of ~22px. */}
      <div style={{flex:1, minHeight:120, display:"flex", flexDirection:"column", padding: (scrollable || stickyFirst) ? 0 : `0 0 ${tokens.spacing[4]}`}}>
        <ChartArea
          status={dataState.status}
          data={dataState.data}
          dates={dataState.dates}
          fmt={dataState.fmt}
          prevData={dataState.prevData}
          state={state}
          animTick={animTick}
          metric={state.metric}
          period={state.period}
          scrollable={scrollable}
          stickyFirst={stickyFirst}
          stacked={stacked}
          grouped={grouped}
          seriesCount={seriesCount}
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
        />
      </div>
    </WidgetFrame>
  );
}

function ChartArea({ status, data, dates, fmt, prevData, state, animTick, scrollable, stickyFirst, stacked, grouped, seriesCount, sparkline, multiStat, composite, sortable, segments, withZones, normalize, categorical, categories, showOptionalAxis, engine, metric, period }) {
  if (status === 'loading') return <ChartSkeleton />;
  // Gallery uses controlled mock data — error/empty states are not reachable here.
  // Those conditions are handled by the production widget in the actual dashboard.
  var tableConfig = (state.chartType === 'Table' && data && dates)
    ? getTableConfig(metric || state.metric, data, dates, period || state.period, fmt)
    : undefined;
  var modeKey = stacked ? 'st' + seriesCount : grouped ? 'gr' + seriesCount : categorical ? 'cat' + categories : 'x';
  // Include engine in extraKey so swapping engines triggers a full remount —
  // otherwise React would keep the prior chart's RAF state alive when the
  // engine flag changes (e.g. switching between Treemap variants).
  // showOptionalAxis is included in the key so the chart fully remounts when the
  // toggle flips — ECharts' setOption merge doesn't reliably reset axis
  // chrome + grid.left + axisLabel rendering all at once, so a clean
  // remount is more predictable (and the entrance animation re-plays
  // which matches the deliberate-toggle feel).
  var extraKey = (sparkline ? 'sp' : '') + (multiStat ? 'ms' : '') + (composite ? 'cp' : '') + (sortable ? 'so' : '') + (segments ? 'sg' + segments : '') + (withZones ? 'wz' : '') + (normalize ? 'nz' : '') + (engine && engine !== 'svg' ? 'eng-' + engine : '') + (showOptionalAxis ? 'y1' : 'y0');
  return (
    <ChartRenderer
      key={state.chartType + ':' + state.metric + ':' + state.period + ':' + state.segment + ':' + (state.compare ? 'c' : 'n') + ':' + (scrollable ? 's' : 'r') + ':' + modeKey + ':' + extraKey}
      data={data}
      dates={dates}
      period={state.period}
      fmt={fmt}
      type={state.chartType}
      metric={state.metric}
      segment={state.segment}
      animTick={animTick}
      compare={state.compare}
      prevData={prevData}
      scrollable={scrollable}
      stickyFirst={stickyFirst}
      stacked={stacked}
      grouped={grouped}
      series={seriesCount}
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
    />
  );
}

function ChartSkeleton() {
  return (
    <div style={{ flex: 1, minHeight: 120, padding: `${tokens.spacing[2]} ${tokens.spacing[4]} ${tokens.spacing[1]}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: tokens.spacing[1.5] }} aria-busy="true">
      {[0.55, 0.7, 0.4, 0.85, 0.6, 0.75, 0.5].map(function(h, i) {
        return <div key={i} style={{
          height: (h * 70) + '%',
          background: 'linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.10), rgba(0,0,0,0.05))',
          backgroundSize: '400px 100%',
          animation: 'shimmer 1.2s linear infinite',
          borderRadius: 2,
        }} />;
      })}
    </div>
  );
}


// Bare ChartRenderer wrapped in the data-loading hook — used when the
// gallery's "Frame" toggle is OFF so designers can see the chart alone
// without the surrounding card chrome.
export function BareChart({ item, render, showOptionalAxis = false }) {
  var initial = {
    metric: item.metric || 'Revenue',
    chartType: item.chartType || 'Line',
    period: item.period || 'Last 30 days',
    segment: item.segment || 'All segments',
    compare: !!item.compare,
  };
  var dataState = useWidgetData(initial);
  var renderFlags = render || {};
  var scrollable = !!renderFlags.scrollable;
  var stacked = !!renderFlags.stacked;
  var grouped = !!renderFlags.grouped;
  var seriesCount = renderFlags.series || 0;
  var sparkline = !!renderFlags.sparkline;
  var multiStat = !!renderFlags.multiStat;
  var composite = !!renderFlags.composite;
  var sortable = !!renderFlags.sortable;
  var segments = renderFlags.segments || 0;
  var categorical = !!renderFlags.categorical;
  var categories = renderFlags.categories || 0;
  var engine = renderFlags.engine || 'svg';
  if (dataState.status === 'loading' || !dataState.data) {
    return <div style={{ height: '100%', minHeight: 120 }} />;
  }
  // Same React-key strategy as GalleryWidget: include showOptionalAxis (and the
  // other flags that change ChartRenderer's option shape) so the chart
  // fully remounts when the toggle flips. ECharts' setOption merge doesn't
  // reliably reset axis chrome + grid.left + axisLabel rendering all at
  // once, so a clean remount is the safer path. Without this key the
  // Optional-axis toggle is a no-op in BareChart mode.
  var modeKey = stacked ? 'st' + seriesCount : grouped ? 'gr' + seriesCount : categorical ? 'cat' + categories : 'x';
  var extraKey = (sparkline ? 'sp' : '') + (multiStat ? 'ms' : '') + (composite ? 'cp' : '') + (sortable ? 'so' : '') + (segments ? 'sg' + segments : '') + (engine && engine !== 'svg' ? 'eng-' + engine : '') + (showOptionalAxis ? 'y1' : 'y0');
  return (
    <ChartRenderer
      key={initial.chartType + ':' + initial.metric + ':' + initial.period + ':' + initial.segment + ':' + (initial.compare ? 'c' : 'n') + ':' + (scrollable ? 's' : 'r') + ':' + modeKey + ':' + extraKey}
      data={dataState.data}
      dates={dataState.dates}
      period={initial.period}
      fmt={dataState.fmt}
      type={initial.chartType}
      metric={initial.metric}
      segment={initial.segment}
      animTick={0}
      compare={initial.compare}
      prevData={dataState.prevData}
      scrollable={scrollable}
      stacked={stacked}
      grouped={grouped}
      series={seriesCount}
      sparkline={sparkline}
      multiStat={multiStat}
      composite={composite}
      sortable={sortable}
      segments={segments}
      categorical={categorical}
      categories={categories}
      showOptionalAxis={showOptionalAxis}
      engine={engine}
    />
  );
}
