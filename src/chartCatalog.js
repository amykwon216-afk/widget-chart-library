// Registry of chart types and their variants. Adding a variant = adding an
// entry. Each variant declares the inputs needed; the gallery passes them
// through to <GalleryWidget> (frame ON) or <BareChart> (frame OFF). No
// per-variant components.
//
// Field reference
//   id          stable kebab-case key (URL hash, persistence)
//   label       display name
//   type        ChartRenderer `type` prop — inherited by all variants in the
//               group unless `sample.chartType` overrides it
//   icon        DEX-styled icon component from chartHelpers.js
//   description short "best for…" caption (≤ 2 lines on a 320px card).
//               Phrase generically — describe the chart's strength in
//               transferable terms, not the labels that happen to be drawn
//               in the sample art. The library is meant for any metric.
//   example     one concrete use case rendered in italic at the end of the
//               description (3–8 words). Same generic rule — describe the
//               shape of the use case, not the strings on the sample chart.
//   keywords    (type-level only) synonyms and intent terms used by the
//               gallery search to map natural-language queries onto types.
//               Add domain vocabulary a non-expert might type: e.g. 'pie'
//               for Donut, 'kpi' for Hero, 'progress' for Bullet/Gauge.
//   sample      Widget item: { metric, period, segment, compare, name, chartType? }
//   render      open-ended ChartRenderer overrides (scrollable, stacked, grouped, engine, etc.)

import { IcoLine, IcoColumn, IcoBar, IcoDonut, IcoPie, IcoArea, IcoHero, IcoTable, IcoFunnel, IcoGauge, IcoReviews, IcoBullet, IcoCombo, IcoHeatmap, IcoWaterfall, IcoTreemap, IcoScatter, IcoCalendar } from './gallery/galleryData.js';

export const CHART_CATALOG = [
  {
    id: 'line',
    label: 'Line',
    type: 'Line',
    icon: IcoLine,
    description: 'Line charts plot a metric\'s movement over time as a continuous curve — best for revealing trend direction and momentum when the overall shape matters more than any individual period\'s exact value.',
    examples: 'website traffic, conversion rate, retention over time, daily active users',
    keywords: ['trend', 'time series', 'over time', 'timeline', 'trajectory', 'direction'],
    goodFor: ['Revenue', 'Web Traffic', 'Website Traffic', 'Conversion Rate', 'Retention', 'ARR', 'Bookings', 'Orders', 'CAC', 'Email Growth', 'Email List', 'Social Followers', 'New Customers', 'Leads', 'Pipeline', 'Avg Order Value', 'Gross Margin', 'Health Score', 'Refund Rate'],
    groups: [
      { id: 'single', label: 'Single series' },
      { id: 'multi', label: 'Multi-series' },
    ],
    variants: [
      {
        id: 'line-default',
        group: 'single',
        label: 'Single series',
        description: 'Tracks one metric over a date range — best for seeing whether results are rising, falling, or flat.',
        example: 'monthly revenue tracked over 30 days',
        sample: { metric: 'Revenue', period: 'Last 30 days' },
      },
      {
        id: 'line-two',
        group: 'multi',
        label: 'Two series',
        description: 'Compares two metrics on the same time axis to reveal whether they move in tandem or diverge.',
        example: 'new signups and cancellations over 90 days',
        sample: { metric: 'Revenue', period: 'Last 30 days' },
        render: { series: 2 },
      },
      {
        id: 'line-three',
        group: 'multi',
        label: 'Three series',
        description: 'Tracks three metrics simultaneously — distinct line colors keep each one readable at a glance.',
        example: 'three marketing channels over a quarter',
        sample: { metric: 'Revenue', period: 'Last 30 days' },
        render: { series: 3 },
      },
      {
        id: 'line-four',
        group: 'multi',
        label: 'Four series',
        description: 'Tracks four metrics at once — the practical upper limit for overlapping lines that stay legible.',
        example: 'four product lines tracked side by side',
        sample: { metric: 'Revenue', period: 'Last 30 days' },
        render: { series: 4 },
      },
      {
        id: 'line-compare',
        group: 'single',
        label: 'With comparison overlay',
        description: 'Shows how the current period\'s trend compares to the prior — a dashed line marks the baseline.',
        example: 'this month\'s revenue overlaid on last month\'s',
        sample: { metric: 'Revenue', period: 'Last 30 days', compare: true },
      },
    ],
  },

  {
    id: 'area',
    label: 'Area',
    type: 'Area',
    icon: IcoArea,
    description: 'Area charts show a metric\'s trend with the space below the line filled in, giving visual weight to total volume alongside direction — best when how much matters as much as which way.',
    examples: 'cumulative revenue, total bookings over time, aggregate traffic volume, recurring MRR',
    keywords: ['trend', 'volume', 'cumulative', 'fill', 'magnitude', 'over time'],
    goodFor: ['Revenue', 'Web Traffic', 'Website Traffic', 'Email Growth', 'Email List', 'ARR', 'Pipeline', 'Bookings', 'Orders'],
    groups: [
      { id: 'single', label: 'Single series' },
      { id: 'multi', label: 'Multi-series' },
    ],
    variants: [
      {
        id: 'area-default',
        group: 'single',
        label: 'Single series',
        description: 'Shows both total volume and trend direction in one view — the filled area gives scale more weight.',
        example: 'cumulative website traffic over 30 days',
        sample: { metric: 'Website Traffic', period: 'Last 30 days' },
      },
      {
        id: 'area-two',
        group: 'multi',
        label: 'Two series',
        description: 'Compares the total volume of two metrics side by side — size and direction both read at once.',
        example: 'two products\' revenue over a quarter',
        sample: { metric: 'Website Traffic', period: 'Last 30 days' },
        render: { series: 2 },
      },
      {
        id: 'area-three',
        group: 'multi',
        label: 'Three series',
        description: 'Tracks three volume metrics simultaneously — each fill reads against the others\' scale.',
        example: 'three regions\' cumulative totals over 90 days',
        sample: { metric: 'Website Traffic', period: 'Last 30 days' },
        render: { series: 3 },
      },
      {
        id: 'area-four',
        group: 'multi',
        label: 'Four series',
        description: 'Tracks four volume metrics at once — works best when fills don\'t heavily overlap each other.',
        example: 'four channels\' total traffic over a quarter',
        sample: { metric: 'Website Traffic', period: 'Last 30 days' },
        render: { series: 4 },
      },
      {
        id: 'area-compare',
        group: 'single',
        label: 'With comparison overlay',
        description: 'Compares current volume to the prior period — the overlapping fill makes gains and losses visible.',
        example: 'this quarter\'s traffic vs. the previous quarter',
        sample: { metric: 'Website Traffic', period: 'Last 30 days', compare: true },
      },
    ],
  },

  {
    id: 'column',
    label: 'Column',
    type: 'Column',
    icon: IcoColumn,
    description: 'Column charts display one vertical bar per time period, making individual values easy to compare across a date range — best when each period\'s count is as important as the trend it forms.',
    examples: 'monthly bookings, daily orders, weekly lead counts, quarterly revenue',
    keywords: ['vertical bars', 'time period', 'per day', 'per month', 'per period', 'counts'],
    goodFor: ['Bookings', 'Orders', 'Leads', 'Estimates', 'Appointments', 'Revenue', 'New Customers', 'Reviews'],
    groups: [
      { id: 'standard', label: 'Standard' },
      { id: 'stacked', label: 'Stacked' },
      { id: 'grouped', label: 'Grouped' },
      { id: 'categorical', label: 'Categorical' },
    ],
    variants: [
      {
        id: 'column-default',
        group: 'standard',
        label: 'Standard',
        description: 'Best for comparing individual period values at a glance — each bar stands independently.',
        example: 'orders received each day of the month',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
      },
      {
        id: 'column-compare',
        group: 'standard',
        label: 'With comparison overlay',
        description: 'Pairs two bars per time slot — the current period alongside the prior — for direct comparison.',
        example: 'this month\'s bookings vs. last month, day by day',
        sample: { metric: 'Bookings', period: 'Last 30 days', compare: true },
      },
      {
        id: 'column-stacked-2',
        group: 'stacked',
        label: 'Stacked (2 series)',
        description: 'Best when a total is built from two parts — bar height shows the combined value, colors show the split.',
        example: 'new vs. returning customers stacked each week',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
        render: { stacked: true, series: 2 },
      },
      {
        id: 'column-stacked-3',
        group: 'stacked',
        label: 'Stacked (3 series)',
        description: 'Best for three segments that add up to a total — bar height shows the combined value per period.',
        example: 'three product types contributing to weekly sales',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
        render: { stacked: true, series: 3 },
      },
      {
        id: 'column-stacked-4',
        group: 'stacked',
        label: 'Stacked (4 series)',
        description: 'Best when four segments all contribute meaningfully to a combined total per period.',
        example: 'four revenue streams building a monthly total',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
        render: { stacked: true, series: 4 },
      },
      {
        id: 'column-stacked-100',
        group: 'stacked',
        label: '100% stacked (mix shift)',
        description: 'Normalizes every bar to 100% so only composition mix shows — totals are intentionally hidden.',
        example: 'each category\'s share shift month to month',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
        render: { stacked: true, series: 3, normalize: true },
      },
      {
        id: 'column-grouped-2',
        group: 'grouped',
        label: 'Grouped (2 series)',
        description: 'Displays two metrics side by side within each time period — neither is the baseline for the other.',
        example: 'online vs. in-store sales side by side each week',
        sample: { metric: 'Bookings', period: 'Last 7 days' },
        render: { grouped: true, series: 2 },
      },
      {
        id: 'column-grouped-3',
        group: 'grouped',
        label: 'Grouped (3 series)',
        description: 'Places three parallel metrics next to each other per period for direct within-period comparison.',
        example: 'three service types compared each month',
        sample: { metric: 'Bookings', period: 'Last 7 days' },
        render: { grouped: true, series: 3 },
      },
      {
        id: 'column-grouped-4',
        group: 'grouped',
        label: 'Grouped (4 series)',
        description: 'Places four metrics side by side per period — the densest grouped layout that remains readable.',
        example: 'four campaign types compared each week',
        sample: { metric: 'Bookings', period: 'Last 7 days' },
        render: { grouped: true, series: 4 },
      },
      {
        id: 'column-categorical-2',
        group: 'categorical',
        label: 'Categorical (2 series)',
        description: 'Compares two fixed categories at a single point in time — each bar is one category, color-coded.',
        example: 'two sales regions compared on total revenue',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
        render: { categorical: true, categories: 2 },
      },
      {
        id: 'column-categorical-3',
        group: 'categorical',
        label: 'Categorical (3 series)',
        description: 'Compares three fixed categories side by side — each bar is one category, color-coded for scanning.',
        example: 'three service tiers compared on total bookings',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
        render: { categorical: true, categories: 3 },
      },
      {
        id: 'column-categorical-4',
        group: 'categorical',
        label: 'Categorical (4 series)',
        description: 'Compares four fixed categories at a glance — each bar is one category, color-coded.',
        example: 'four locations compared on monthly appointments',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
        render: { categorical: true, categories: 4 },
      },
      {
        id: 'column-categorical-compare',
        group: 'categorical',
        label: 'Categorical with comparison',
        description: 'Shows each category\'s current value alongside its prior-period value — paired bars per category.',
        example: 'this quarter\'s revenue by region vs. last quarter',
        sample: { metric: 'Bookings', period: 'Last 30 days', compare: true },
        render: { categorical: true, categories: 3 },
      },
    ],
  },

  {
    id: 'bar',
    label: 'Bar',
    type: 'Bar',
    icon: IcoBar,
    description: 'Bar charts rank items from highest to lowest using horizontal bars — best when category names are long, the ranking itself is the key insight, or there are too many items for a vertical layout.',
    examples: 'top products by revenue, channels by lead count, locations by orders, agents by deals closed',
    keywords: ['ranking', 'top n', 'leaderboard', 'horizontal', 'sorted', 'rank'],
    goodFor: ['Top Products', 'Inventory', 'Pipeline', 'Reviews', 'Leads'],
    groups: [
      { id: 'standard', label: 'Standard' },
      { id: 'stacked', label: 'Stacked' },
      { id: 'grouped', label: 'Grouped' },
      { id: 'categorical', label: 'Categorical' },
    ],
    variants: [
      {
        id: 'bar-default',
        group: 'standard',
        label: 'Standard',
        description: 'Ranks items by value with the highest at the top — best for answering "what\'s leading?" quickly.',
        example: 'top 10 products ranked by total revenue',
        sample: { metric: 'Top Products', period: 'Last 30 days' },
      },
      {
        id: 'bar-compare',
        group: 'standard',
        label: 'With comparison overlay',
        description: 'Shows each item\'s current value alongside its prior-period value — the shift per row reads instantly.',
        example: 'this month\'s top products vs. last month',
        sample: { metric: 'Top Products', period: 'Last 30 days', compare: true },
      },
      {
        id: 'bar-stacked-2',
        group: 'stacked',
        label: 'Stacked (2 series)',
        description: 'Shows each item\'s total alongside its two-way breakdown — row length reflects the combined value.',
        example: 'each rep\'s revenue split by product type',
        sample: { metric: 'Top Products', period: 'Last 30 days' },
        render: { stacked: true, series: 2 },
      },
      {
        id: 'bar-stacked-3',
        group: 'stacked',
        label: 'Stacked (3 series)',
        description: 'Breaks each item\'s total into three named segments — bar length reflects the combined value.',
        example: 'each location\'s revenue across three categories',
        sample: { metric: 'Top Products', period: 'Last 30 days' },
        render: { stacked: true, series: 3 },
      },
      {
        id: 'bar-stacked-4',
        group: 'stacked',
        label: 'Stacked (4 series)',
        description: 'Breaks each item\'s total into four segments — use when all four contribute meaningfully per row.',
        example: 'each channel\'s total across four product lines',
        sample: { metric: 'Top Products', period: 'Last 30 days' },
        render: { stacked: true, series: 4 },
      },
      {
        id: 'bar-stacked-100',
        group: 'stacked',
        label: '100% stacked (mix shift)',
        description: 'Normalizes each row to 100% — use when composition mix matters more than the actual row size.',
        example: 'category mix per location, not total size',
        sample: { metric: 'Top Products', period: 'Last 30 days' },
        render: { stacked: true, series: 3, normalize: true },
      },
      {
        id: 'bar-grouped-2',
        group: 'grouped',
        label: 'Grouped (2 series)',
        description: 'Displays two metrics side by side per item — neither is a baseline for the other.',
        example: 'two metrics shown for each team member',
        sample: { metric: 'Top Products', period: 'Last 7 days' },
        render: { grouped: true, series: 2 },
      },
      {
        id: 'bar-grouped-3',
        group: 'grouped',
        label: 'Grouped (3 series)',
        description: 'Places three parallel metrics next to each other per item for direct within-row comparison.',
        example: 'three metrics compared across each product',
        sample: { metric: 'Top Products', period: 'Last 7 days' },
        render: { grouped: true, series: 3 },
      },
      {
        id: 'bar-grouped-4',
        group: 'grouped',
        label: 'Grouped (4 series)',
        description: 'Four metrics side by side per item — the densest grouped layout the format can cleanly support.',
        example: 'four performance metrics across each agent',
        sample: { metric: 'Top Products', period: 'Last 7 days' },
        render: { grouped: true, series: 4 },
      },
      {
        id: 'bar-categorical-2',
        group: 'categorical',
        label: 'Categorical (2 series)',
        description: 'Compares two fixed categories at a single point in time — each row is one category, color-coded.',
        example: 'two service types compared on total bookings',
        sample: { metric: 'Top Products', period: 'Last 30 days' },
        render: { categorical: true, categories: 2 },
      },
      {
        id: 'bar-categorical-3',
        group: 'categorical',
        label: 'Categorical (3 series)',
        description: 'Compares three fixed categories in a horizontal layout — each row is color-coded for scanning.',
        example: 'three channels compared on lead volume',
        sample: { metric: 'Top Products', period: 'Last 30 days' },
        render: { categorical: true, categories: 3 },
      },
      {
        id: 'bar-categorical-4',
        group: 'categorical',
        label: 'Categorical (4 series)',
        description: 'Compares four fixed categories at a glance — each row is one category, color-coded.',
        example: 'four regions compared on monthly revenue',
        sample: { metric: 'Top Products', period: 'Last 30 days' },
        render: { categorical: true, categories: 4 },
      },
      {
        id: 'bar-categorical-compare',
        group: 'categorical',
        label: 'Categorical with comparison',
        description: 'Shows each category\'s current value next to its prior-period value — paired rows per category.',
        example: 'this quarter\'s leads by source vs. last quarter',
        sample: { metric: 'Top Products', period: 'Last 30 days', compare: true },
        render: { categorical: true, categories: 3 },
      },
    ],
  },

  {
    id: 'donut',
    label: 'Donut',
    type: 'Donut',
    icon: IcoDonut,
    description: 'Donut charts divide a total into proportional slices with the grand total anchored in the center — best for part-of-whole breakdowns across five or fewer flat categories.',
    examples: 'revenue by segment, leads by source, traffic by channel, customers by plan tier',
    keywords: ['pie', 'slice', 'parts of a whole', 'composition', 'percentage', 'breakdown', 'share'],
    goodFor: ['Top Products', 'Pipeline', 'Leads'],
    variants: [
      {
        id: 'donut-with-legend',
        label: 'Slice composition',
        description: 'Shows each slice\'s name and percentage alongside the grand total anchored in the center.',
        example: 'revenue split across four customer segments',
        sample: { metric: 'Bookings', period: 'Last 90 days' },
      },
    ],
  },

  {
    id: 'pie',
    label: 'Pie',
    type: 'Pie',
    icon: IcoPie,
    description: 'Pie charts divide a total into proportional slices — best for part-of-whole comparisons across five or fewer categories when there\'s no need to anchor a headline total in the center.',
    examples: 'revenue by segment, leads by source, traffic by channel, customers by plan tier',
    keywords: ['pie', 'slice', 'wedge', 'parts of a whole', 'composition', 'percentage', 'breakdown', 'share'],
    goodFor: ['Top Products', 'Pipeline', 'Leads'],
    variants: [
      {
        id: 'pie-with-legend',
        label: 'Proportional slices',
        description: 'Shows each slice\'s name and percentage — best when no headline total is needed at the center.',
        example: 'lead source breakdown across four channels',
        sample: { metric: 'Bookings', period: 'Last 90 days' },
      },
    ],
  },

  {
    id: 'hero',
    label: 'Hero',
    type: 'Hero',
    icon: IcoHero,
    description: 'Hero tiles surface a single large metric without visual noise from axes or labels — best for the numbers a team checks first, and most effective when used sparingly so critical values stand out.',
    examples: 'total revenue, MRR, conversion rate, NPS, active users, customer count',
    keywords: ['kpi', 'metric tile', 'big number', 'headline', 'north star', 'summary'],
    goodFor: ['Revenue', 'ARR', 'Conversion Rate', 'Avg Order Value', 'Health Score', 'Reviews', 'Web Traffic', 'Bookings', 'Orders', 'CAC', 'Gross Margin', 'Email List', 'Social Followers', 'New Customers'],
    variants: [
      {
        id: 'hero-default',
        label: 'Standard',
        description: 'Best for a single critical number on a dashboard — most effective when used sparingly.',
        example: 'total monthly revenue as a headline figure',
        sample: { metric: 'Conversion Rate', period: 'Last 30 days' },
      },
      {
        id: 'hero-sparkline',
        label: 'With trend sparkline',
        description: 'Pairs a headline value with a trend line — best when both the number and its direction matter.',
        example: 'active users this month with a 30-day trend',
        sample: { metric: 'Website Traffic', period: 'Last 30 days' },
        render: { sparkline: true },
      },
      {
        id: 'hero-multi-stat',
        label: 'Multi-stat',
        description: 'Groups three related numbers on one card — best for metrics understood in context of each other.',
        example: 'impressions, clicks, and conversions together',
        sample: { metric: 'Website Traffic', period: 'Last 30 days' },
        render: { multiStat: true },
      },
    ],
  },

  {
    id: 'table',
    label: 'Table',
    type: 'Table',
    icon: IcoTable,
    description: 'Tables organize data into rows and columns for precise, multi-dimensional comparison — best when specific values matter more than visual patterns and completeness outweighs the need for a quick read.',
    examples: 'top products by revenue + units, leads by channel + conversion, estimates by status + value, agents by deals + close rate',
    keywords: ['rows', 'columns', 'grid', 'data table', 'list', 'breakdown', 'spreadsheet', 'scrollable', 'sticky', 'pinned', 'wide', 'horizontal scroll', 'freeze column', 'lock column'],
    goodFor: ['Top Products', 'Pipeline', 'Inventory', 'Leads', 'Reviews', 'Estimates'],
    variants: [
      {
        id: 'table-three-col',
        label: 'Three columns',
        description: 'An identifier paired with two supporting metrics — best for the simplest ranked breakdowns.',
        example: 'products listed with total sales and avg. rating',
        sample: { metric: 'Reviews', period: 'Last 30 days' },
      },
      {
        id: 'table-four-col',
        label: 'Four columns',
        description: 'An identifier paired with three supporting metrics — best when three data points tell the story.',
        example: 'agents listed with deals closed, revenue, win rate',
        sample: { metric: 'Channel Performance', period: 'Last 30 days' },
      },
      {
        id: 'table-five-col',
        label: 'Five columns',
        description: 'An identifier paired with four metrics — best for performance breakdowns across more dimensions.',
        example: 'campaigns with spend, clicks, and conversions',
        sample: { metric: 'Sales by Agent', period: 'Last 30 days' },
      },
      {
        id: 'table-six-col',
        label: 'Six columns',
        description: 'An identifier paired with five metrics — best when all five dimensions contribute to the read.',
        example: 'plans listed with pricing, users, and churn',
        sample: { metric: 'Subscription Plans', period: 'Last 30 days' },
      },
      {
        id: 'table-sticky-first',
        label: 'Scrollable w/sticky first column',
        description: 'Best for wide datasets — scrolls horizontally while the first column stays pinned so row names remain visible.',
        example: 'agent leaderboard with calls, deals, pipeline, and win rate',
        sample: { metric: 'Sales Activity', period: 'Last 30 days' },
        render: { scrollable: true, stickyFirst: true },
      },
    ],
  },

  {
    id: 'funnel',
    label: 'Funnel',
    type: 'Funnel',
    icon: IcoFunnel,
    description: 'Funnel charts track how a volume narrows through sequential stages, making drop-off points immediately visible — best for conversion paths, pipelines, or any multi-step process with a defined start and end.',
    examples: 'impressions → clicks → leads, signup → activated → paid, viewed → added-to-cart → purchased',
    keywords: ['conversion', 'drop off', 'dropoff', 'pipeline', 'stages', 'flow', 'narrowing'],
    goodFor: ['Pipeline', 'Leads', 'Conversion Rate', 'Estimates'],
    variants: [
      {
        id: 'funnel-custom',
        label: 'Styled stages',
        description: 'Best for a visually polished funnel with smooth edges — suited for presentations and client-facing dashboards.',
        example: 'a three-stage lead-to-customer flow',
        sample: { metric: 'Website Traffic', period: 'Last 30 days' },
        render: { segments: 3 },
      },
      {
        id: 'funnel-conversion-path',
        label: 'Conversion path',
        description: 'Best for tracing volume through a multi-step process and showing the percentage clearing each stage.',
        example: 'visitor → lead → demo → closed deal',
        sample: { metric: 'Website Traffic', period: 'Last 30 days' },
        render: { engine: 'echarts' },
      },
    ],
  },

  {
    id: 'reviews',
    label: 'Reviews',
    type: 'Reviews',
    icon: IcoReviews,
    description: 'Rating distribution charts show how scores spread across each level, revealing whether sentiment skews positive, negative, or polarized — a story the average score alone can\'t tell.',
    examples: 'product reviews, business listing ratings, NPS bucket distribution, course feedback',
    keywords: ['rating', 'stars', 'distribution', 'scores', 'feedback', 'polarity'],
    goodFor: ['Reviews'],
    variants: [
      {
        id: 'reviews-distribution',
        label: 'Star distribution',
        description: 'Best for revealing whether ratings are driven by top scores or a polarizing mix — an average can\'t show this.',
        example: 'business or product ratings broken down by level',
        sample: { metric: 'Rating Distribution', period: 'Last 30 days' },
      },
    ],
  },

  {
    id: 'gauge',
    label: 'Gauge',
    type: 'Gauge',
    icon: IcoGauge,
    description: 'Gauge charts display a score on a circular dial, making it immediately clear how close a metric is to its upper bound — best for bounded values on a fixed scale like health scores or completion rates.',
    examples: 'health score, NPS bucket, marketing score, account completeness, profile strength',
    keywords: ['progress', 'score', 'meter', 'dial', 'completion', 'bounded', 'ceiling', 'radial'],
    goodFor: ['Health Score', 'Conversion Rate', 'Retention', 'Gross Margin', 'Refund Rate'],
    variants: [
      {
        id: 'gauge-simple',
        label: 'Standard',
        description: 'Best for a single bounded score — the dial position communicates the value without precise numbers.',
        example: 'an account health score on a 0–100 dial',
        sample: { metric: 'Health Score', period: 'Last 30 days' },
      },
      {
        id: 'gauge-composite',
        label: 'Composite score',
        description: 'Best when an overall score is built from named sub-scores — each component is listed with the total.',
        example: 'overall health broken into reputation and activity',
        sample: { metric: 'Health Score', period: 'Last 30 days' },
        render: { composite: true },
      },
    ],
  },

  {
    id: 'bullet',
    label: 'Bullet',
    type: 'Bullet',
    icon: IcoBullet,
    description: 'Bullet charts show actual performance against a target as a bar extending toward a goal line — best for clearly communicating whether a metric is on track, behind, or exceeding its goal.',
    examples: 'monthly sales goal, quarterly lead target, appointments booked vs capacity, subscription renewals vs forecast',
    keywords: ['progress', 'goal', 'target', 'vs goal', 'vs target', 'attainment', 'pace'],
    goodFor: ['Revenue', 'Bookings', 'Pipeline', 'Orders', 'Leads'],
    variants: [
      {
        id: 'bullet-standard',
        label: 'Standard',
        description: 'Shows one metric\'s progress against a defined goal — the bar extends toward the target line.',
        example: 'monthly sales actual vs. revenue target',
        sample: { metric: 'Revenue', period: 'Last 30 days' },
      },
      {
        id: 'bullet-zones',
        label: 'With performance zones',
        description: 'Adds colored bands behind the bar — best when context for strong, acceptable, and poor ranges matters.',
        example: 'quota attainment with red, yellow, and green zones',
        sample: { metric: 'Revenue', period: 'Last 30 days' },
        render: { withZones: true },
      },
    ],
  },

  {
    id: 'combo',
    label: 'Combo',
    type: 'Combo',
    icon: IcoCombo,
    description: 'Combo charts layer two related metrics on the same canvas — bars for volume, a line for rate — each on its own scale. Best when the relationship between the two is more insightful than either alone.',
    examples: 'orders + conversion rate, web visits + bounce rate, leads + conversion %, sessions + AOV',
    keywords: ['dual axis', 'mixed', 'two metrics', 'count and rate', 'bar and line', 'secondary axis'],
    goodFor: ['Bookings', 'Orders', 'Leads', 'Conversion Rate', 'Pipeline', 'Revenue'],
    groups: [
      { id: 'standard', label: 'Standard' },
      { id: 'stacked', label: 'Stacked' },
      { id: 'grouped', label: 'Grouped' },
      { id: 'categorical', label: 'Categorical' },
    ],
    variants: [
      {
        id: 'combo-default',
        group: 'standard',
        label: 'Volume + rate',
        description: 'Pairs a volume count with a rate metric on dual scales — bars show count, the line shows rate.',
        example: 'weekly leads alongside their conversion rate',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
      },
      {
        id: 'combo-stacked',
        group: 'stacked',
        label: 'Stacked + rate',
        description: 'Best when volume is split across segments and a combined rate line runs across all of them.',
        example: 'customer segments stacked with a blended rate',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
        render: { stacked: true, series: 3 },
      },
      {
        id: 'combo-categorical',
        group: 'categorical',
        label: 'Categorical + rate',
        description: 'Compares named category totals while a rate line runs across all of them on a secondary axis.',
        example: 'three product lines with an overall margin rate',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
        render: { categorical: true, categories: 3 },
      },
      {
        id: 'combo-grouped-2',
        group: 'grouped',
        label: 'Grouped (2 series) + rate',
        description: 'Two volume metrics side by side per period with a single rate line showing the combined outcome.',
        example: 'inbound and outbound leads with a shared rate',
        sample: { metric: 'Bookings', period: 'Last 7 days' },
        render: { grouped: true, series: 2 },
      },
      {
        id: 'combo-grouped-3',
        group: 'grouped',
        label: 'Grouped (3 series) + rate',
        description: 'Three volume metrics grouped per period with one rate line showing the overall result across all.',
        example: 'three campaign types with a blended conversion rate',
        sample: { metric: 'Bookings', period: 'Last 7 days' },
        render: { grouped: true, series: 3 },
      },
    ],
  },

  {
    id: 'heatmap',
    label: 'Heatmap',
    type: 'Heatmap',
    icon: IcoHeatmap,
    description: 'Heatmaps use color intensity across a grid to reveal where activity concentrates — darker means more, lighter means less. Best for surfacing timing patterns invisible in a standard bar or line chart.',
    examples: 'bookings by day × time, email opens by hour, social engagement by day, support tickets by weekday',
    keywords: ['intensity', 'density', 'when', 'cluster', 'peak', 'schedule', 'matrix'],
    goodFor: ['Web Traffic', 'Website Traffic', 'Appointments', 'Bookings'],
    variants: [
      {
        id: 'heatmap-week',
        label: 'Day × time of day',
        description: 'Best for finding peak hours and days — the darkest cells immediately show where activity concentrates.',
        example: 'appointments by day of week and time of day',
        sample: { metric: 'Appointments', period: 'Last 30 days' },
      },
    ],
  },

  {
    id: 'waterfall',
    label: 'Waterfall',
    type: 'Waterfall',
    icon: IcoWaterfall,
    description: 'Waterfall charts trace how a starting value shifts through sequential additions and subtractions to reach a closing total — best when understanding what drove the change matters as much as the result.',
    examples: 'MRR breakdown (starting + new + expansion − churn = ending), customer count flow, revenue P&L, inventory delta',
    keywords: ['decomposition', 'flow', 'profit and loss', 'p&l', 'reconciliation', 'change', 'breakdown'],
    goodFor: ['Revenue', 'Pipeline', 'Gross Margin'],
    variants: [
      {
        id: 'waterfall-mrr',
        label: 'Opening to closing flow',
        description: 'Traces an opening value step by step — green bars add to the total, red bars subtract from it.',
        example: 'MRR built from new, expansion, and churn',
        sample: { metric: 'ARR', period: 'Last 30 days' },
      },
    ],
  },

  {
    id: 'treemap',
    label: 'Treemap',
    type: 'Treemap',
    icon: IcoTreemap,
    description: 'Treemaps fill a space with proportional tiles where each tile\'s size reflects a category\'s share of the whole — best for comparing many categories at once, including those with meaningful sub-groups.',
    examples: 'revenue by product line and SKU, traffic by channel and source, expenses by category and vendor, inventory by department',
    keywords: ['hierarchy', 'nested', 'parts of a whole', 'mosaic', 'composition', 'tiles', 'breakdown'],
    goodFor: ['Top Products', 'Pipeline', 'Revenue'],
    variants: [
      {
        id: 'treemap-revenue-mix',
        label: 'Nested breakdown',
        description: 'Best for two-level breakdowns — large tiles represent groups, smaller tiles inside are the items.',
        example: 'product lines divided into SKUs, sized by revenue',
        sample: { metric: 'Revenue', period: 'Last 30 days' },
      },
    ],
  },

  {
    id: 'scatter',
    label: 'Scatter',
    type: 'Scatter',
    icon: IcoScatter,
    description: 'Scatter plots position records as dots on a two-axis grid, surfacing correlations, clusters, and outliers across a full dataset — best when understanding how two metrics relate to each other is the goal.',
    examples: 'CAC vs LTV per customer, ad spend vs leads per campaign, deal size vs days-to-close per opportunity, page views vs conversion per page',
    keywords: ['correlation', 'cluster', 'outlier', 'distribution', 'xy', 'dot plot', 'relationship'],
    goodFor: ['Revenue', 'Avg Order Value', 'Leads', 'New Customers', 'Conversion Rate'],
    variants: [
      {
        id: 'scatter-default',
        label: 'Standard',
        description: 'Best for spotting relationships across a full population — clusters and outliers become immediately visible.',
        example: 'customers plotted by lifetime value and purchases',
        sample: { metric: 'Conversion Rate', period: 'Last 30 days' },
      },
      {
        id: 'scatter-grouped',
        label: 'Grouped (4 segments)',
        description: 'Best when records fall into named groups — each is color-coded so patterns within and between compare cleanly.',
        example: 'customers by plan, plotted by spend and engagement',
        sample: { metric: 'Conversion Rate', period: 'Last 30 days' },
        render: { segments: 4 },
      },
    ],
  },

  {
    id: 'calendar',
    label: 'Calendar',
    type: 'Calendar',
    icon: IcoCalendar,
    description: 'Calendar charts shade each day of the month by activity level, surfacing recurring weekly patterns and standout dates that a bar chart would reduce to a single aggregate value.',
    examples: 'daily sales heatmap, appointments per day, ad spend by date, support tickets per day, content publishing cadence',
    keywords: ['daily', 'date', 'month view', 'when', 'day of week', 'weekday'],
    goodFor: ['Appointments', 'Bookings', 'Estimates', 'Reviews'],
    variants: [
      {
        id: 'calendar-month',
        label: 'Daily intensity (5 weeks)',
        description: 'Best for spotting recurring day-of-week patterns and standout dates — darker cells signal higher activity.',
        example: 'daily bookings across a month, shaded by volume',
        sample: { metric: 'Bookings', period: 'Last 30 days' },
      },
    ],
  },
];

export function getCatalogEntry(id) {
  for (var i = 0; i < CHART_CATALOG.length; i++) {
    if (CHART_CATALOG[i].id === id) return CHART_CATALOG[i];
  }
  return null;
}

// Flatten variants for global search across the whole library.
export function getAllVariants() {
  var out = [];
  for (var i = 0; i < CHART_CATALOG.length; i++) {
    var t = CHART_CATALOG[i];
    for (var j = 0; j < t.variants.length; j++) {
      out.push({ type: t, variant: t.variants[j] });
    }
  }
  return out;
}
