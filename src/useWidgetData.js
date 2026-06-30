// Option 2: data-fetching contract for widgets. Wraps the sync mock data
// in a hook that surfaces loading / error / empty / ready states — so the
// shell can render the right treatment for any consumer's data source.
//
// In a real platform integration this hook would call into a network
// adapter; here we simulate a short async delay so the loading skeleton
// is observable. Errors are simulated when a metric is deliberately marked
// `__broken` (used by the prototype to demo the error state if needed).
import { useEffect, useState, useRef } from 'react';
import { getChartData, gPrev, seedHash } from './gallery/galleryData.js';

// `'loading' | 'ready' | 'empty' | 'error'`
export function useWidgetData(params) {
  var metric = params.metric;
  var period = params.period;
  var segment = params.segment;
  var compare = params.compare;

  var [state, setState] = useState({ status: 'loading', data: null, dates: null, fmt: null, prevData: null, error: null });
  var version = useRef(0);

  useEffect(function() {
    var thisVersion = ++version.current;
    setState(function(prev) { return { status: 'loading', data: null, dates: null, fmt: null, prevData: null, error: null }; });
    var t = setTimeout(function() {
      // If a newer fetch has started, drop this result.
      if (version.current !== thisVersion) return;
      try {
        if (!metric || metric === '__broken') {
          setState({ status: 'error', data: null, dates: null, fmt: null, prevData: null, error: new Error('Could not load this metric.') });
          return;
        }
        var result = getChartData(metric, period, segment);
        if (!result || !result.data || result.data.length === 0) {
          setState({ status: 'empty', data: [], dates: [], fmt: result && result.fmt, prevData: null, error: null });
          return;
        }
        var prev = compare ? gPrev(result.data, seedHash((metric || '').length, (period || '').length)) : null;
        setState({ status: 'ready', data: result.data, dates: result.dates, fmt: result.fmt, prevData: prev, error: null });
      } catch (e) {
        setState({ status: 'error', data: null, dates: null, fmt: null, prevData: null, error: e });
      }
    }, 220); // brief delay so the loading state is real, not flicker
    return function() { clearTimeout(t); };
  }, [metric, period, segment, compare]);

  return state;
}
