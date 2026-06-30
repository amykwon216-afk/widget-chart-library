// Gallery-only demo data, metric configs, and chart icons.
// Nothing in this file is needed to render charts in production —
// it exists to populate the gallery with realistic mock data.
// Engineers integrating ChartRenderer into their project should
// supply their own data and ignore this file entirely.

import { tokens } from '../styles/tokens.js';
import { ce } from '../lib/chartHelpers.js';

// Base multipliers — scale the raw revenue seed data to realistic
// magnitudes for each metric so the gallery renders believable values.
export var BM = {Revenue:1,Bookings:0.85,Orders:0.85,"Avg Order Value":0.92,Pipeline:2.4,ARR:0.92,Retention:0.92,"CAC":0.7,"Gross Margin":1.2,"Web Traffic":18,"Website Traffic":18,"Conversion Rate":0.08,"Refund Rate":0.05,"Email Growth":11,"Email List":11,"Social Followers":380,"Top Products":5,Appointments:1,Estimates:1.2,"Health Score":0.9,Reviews:1,Leads:1,"New Customers":1.1,Inventory:3.5};

// Fallback segments for any metric not in METRIC_SEGS below.
export var SEGS = ["All segments","Enterprise","Mid-market","SMB"];

// Metric-specific filter options. First entry is always the "no filter" default.
export var METRIC_SEGS = {
  Revenue:            ["All segments","Paid","Unpaid","New customers","Existing customers"],
  Bookings:           ["All segments","Confirmed","Pending","Cancelled"],
  Orders:             ["All segments","Paid","Unpaid","New customers","Existing customers"],
  "Avg Order Value":  ["All segments","Online","In store","New customers","Existing customers"],
  Pipeline:           ["All segments","Open","Won","Lost","Stalled"],
  ARR:                ["All segments","New ARR","Renewals","Expansions","Churn"],
  Retention:          ["All segments","New customers","Existing customers","At risk"],
  CAC:                ["All segments","Paid ads","Organic","Referral","Outbound"],
  "Gross Margin":     ["All segments","Online","In store","By category"],
  "Website Traffic":  ["All segments","Organic","Paid","Social","Direct","Referral"],
  "Conversion Rate":  ["All segments","New visitors","Returning visitors","Mobile","Desktop"],
  "Refund Rate":      ["All segments","Product issues","Service issues","Customer request"],
  "Email List":       ["All segments","Active subscribers","Recent signups","Unsubscribed"],
  "Social Followers": ["All segments","Instagram","Facebook","Twitter","LinkedIn"],
  "Top Products":     ["All segments","Best sellers","New products","By category"],
  Appointments:       ["All segments","Completed","Upcoming","Recurring","New clients"],
  Estimates:          ["All segments","Accepted","Pending","Rejected"],
  "Health Score":     ["All segments","Champions","Healthy","At risk","Churning"],
  Reviews:            ["All segments","Google","Facebook","Yelp","Responded"],
  Leads:              ["All segments","Calls","Forms","Chat","Email"],
  "New Customers":    ["All segments","Online","In store","Referral","Paid ad"],
  Inventory:          ["All segments","In stock","Low stock","Out of stock"],
};

export function getSegments(metric) {
  return METRIC_SEGS[metric] || SEGS;
}

export function pickCompareSafeChart(metric) {
  var allowed = METRIC_CHARTS[metric] || ['Line'];
  if (allowed.indexOf('Column') !== -1) return 'Column';
  for (var i = 0; i < allowed.length; i++) {
    if (allowed[i] !== 'Hero') return allowed[i];
  }
  return allowed[0];
}

export var PERS = ["Last 7 days","Last 30 days","Last 90 days","Year to date"];
export var METRICS = ["Revenue","Bookings","Orders","Avg Order Value","Pipeline","ARR","Retention","CAC","Gross Margin","Website Traffic","Conversion Rate","Refund Rate","Email List","Social Followers","Top Products","Appointments","Estimates","Health Score","Reviews","Leads","New Customers","Inventory"];

export var METRIC_CHARTS = {
  Revenue:["Column","Line","Area","Hero"],
  Bookings:["Line","Bar","Column","Donut","Hero"],
  Orders:["Line","Bar","Column","Donut","Hero"],
  "Avg Order Value":["Line","Area","Column","Hero"],
  Pipeline:["Line","Area","Bar","Donut"],
  ARR:["Line","Area","Column","Hero"],
  Retention:["Line","Area","Column","Hero"],
  "CAC":["Line","Area","Column","Hero"],
  "Gross Margin":["Line","Area","Column"],
  "Website Traffic":["Area","Line","Column","Hero"],
  "Conversion Rate":["Line","Area","Hero"],
  "Refund Rate":["Line","Column","Bar"],
  "Email List":["Column","Area","Line","Table"],
  "Social Followers":["Area","Line","Hero"],
  "Top Products":["Bar","Column","Donut","Table"],
  Appointments:["Line","Column","Area","Bar","Donut","Hero","Table"],
  Estimates:["Line","Column","Area","Bar","Donut","Hero","Table"],
  "Health Score":["Line","Area","Column","Bar","Donut","Hero"],
  Reviews:["Line","Column","Area","Bar","Donut","Hero","Table"],
  Leads:["Line","Column","Area","Bar","Donut","Hero","Table"],
  "New Customers":["Line","Column","Area","Bar","Hero"],
  Inventory:["Line","Column","Area","Bar","Table"],
};

export function getMetricFmt(metric) {
  var PCT = ["Conversion Rate","Refund Rate","Retention","Gross Margin","Health Score"];
  return PCT.indexOf(metric) !== -1 ? "in percent" : "in dollars";
}

export function gD(c, db, sd) {
  var d = [], now = new Date(2026, 2, 19);
  for (var i = 0; i < c; i++) {
    var x = new Date(now);
    x.setDate(now.getDate() - db + i*sd);
    d.push(x);
  }
  return d;
}

export function gMD(c) {
  var d = [], now = new Date(2026, 2, 19), sm = now.getMonth() - c + 1, sy = now.getFullYear();
  for (var i = 0; i < c; i++) {
    var m = sm + i, y = sy;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    d.push(new Date(y, m, 1));
  }
  return d;
}

export function gR(c, s, v, t) {
  var d = [], val = s;
  for (var i = 0; i < c; i++) {
    val = val + t + (Math.sin(i*0.7)*v*2.2) + (Math.sin(i*0.23)*v*1.4);
    d.push(Math.round(Math.max(1, val)));
  }
  return d;
}

export function bD(br, met, fmt) {
  var m = BM[met] || 1;
  return br.map(function(v) {
    var val = Math.round(v * m);
    if (fmt === "in percent") return Math.round((val / br[br.length-1]) * 100);
    if (fmt === "in units") return Math.round(val / 10);
    return val;
  });
}

export function seedHash(a, b) {
  var h = ((a * 2654435761) ^ (b * 2246822519)) >>> 0;
  return (h % 10000) / 10000;
}

export function applyVariance(data, seed1, seed2) {
  return data.map(function(v, i) {
    var h1 = seedHash(seed1*13+i, seed2*7+i*3);
    var h2 = seedHash(seed1*31+i*5, seed2*11+i*7);
    var wave = Math.sin((i + seed1*2.3)*0.9 + seed2*1.7)*0.18;
    var spike = (h1 > 0.75 ? 0.22 : h1 < 0.2 ? -0.18 : 0);
    var jitter = (h2 - 0.5)*0.16;
    var factor = 1.0 + wave + spike + jitter;
    return Math.max(1, Math.round(v * Math.max(0.6, Math.min(1.4, factor))));
  });
}

export function gPrev(cur, seed) {
  var s = seed || 0;
  return cur.map(function(v, i) {
    var h = seedHash(s*17+i*3, i*11+7);
    var wave = Math.sin((i + s*1.4)*0.7 + 2.1)*0.06;
    return Math.round(v * (0.80 + wave + h*0.08));
  });
}

export function getPL(per) {
  if (per === "Last 7 days") return "Prev 7 days";
  if (per === "Last 30 days") return "Prev 30 days";
  if (per === "Last 90 days") return "Prev 90 days";
  if (per === "Year to date") return "Prior year";
  return "Previous period";
}

export var SD = {};
SD["All segments"] = {
  "Last 7 days":  {revenue:[42,45,41,48,52,49,55],   dates:gD(7,6,1)},
  "Last 30 days": {revenue:gR(30,180,8,4.3),          dates:gD(30,29,1)},
  "Last 90 days": {revenue:gR(90,720,12,2.9),          dates:gD(90,89,1)},
  "Year to date": {revenue:[620,680,720,780,810,850,920,980,1020,1080,1150,1240], dates:gMD(12)},
};
SD["Enterprise"] = {
  "Last 7 days":  {revenue:[28,30,27,32,35,33,38],    dates:gD(7,6,1)},
  "Last 30 days": {revenue:gR(30,120,5,3.1),           dates:gD(30,29,1)},
  "Last 90 days": {revenue:gR(90,480,8,2.1),           dates:gD(90,89,1)},
  "Year to date": {revenue:[410,450,480,520,545,575,620,665,695,735,785,850], dates:gMD(12)},
};
SD["Mid-market"] = {
  "Last 7 days":  {revenue:[10,11,10,12,12,11,12],    dates:gD(7,6,1)},
  "Last 30 days": {revenue:gR(30,42,3,0.75),           dates:gD(30,29,1)},
  "Last 90 days": {revenue:gR(90,165,5,0.6),           dates:gD(90,89,1)},
  "Year to date": {revenue:[140,155,162,175,182,190,205,215,225,238,252,270], dates:gMD(12)},
};
SD["SMB"] = {
  "Last 7 days":  {revenue:[4,4,4,4,5,5,5],           dates:gD(7,6,1)},
  "Last 30 days": {revenue:gR(30,18,2,0.55),           dates:gD(30,29,1)},
  "Last 90 days": {revenue:gR(90,75,3,0.28),           dates:gD(90,89,1)},
  "Year to date": {revenue:[70,75,78,85,83,85,95,100,100,107,113,120], dates:gMD(12)},
};

function _segHash(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getChartData(metric, period, segment) {
  var seg = (segment === "Enterprise" || segment === "Mid-market" || segment === "SMB") ? segment : "All segments";
  var chartD = SD[seg][period];
  var fmt = getMetricFmt(metric);
  var raw = bD(chartD.revenue, metric, fmt);

  var segMults = [1.0, 0.72, 0.58, 0.45, 0.38];
  var legacyList = ["All segments","Enterprise","Mid-market","SMB"];
  var legacyIdx = legacyList.indexOf(segment);
  var segM;
  var segVarianceIdx;
  if (segment === "All segments" || !segment) {
    segM = 1.0;
    segVarianceIdx = 0;
  } else if (legacyIdx > 0) {
    segM = segMults[legacyIdx];
    segVarianceIdx = legacyIdx;
  } else {
    var h = _segHash(metric + '::' + segment);
    segM = 0.45 + (h % 50) / 100;
    segVarianceIdx = 1 + (h % 4);
  }
  var perMults = {"Last 7 days":1.0,"Last 30 days":4.2,"Last 90 days":11.5,"Year to date":18.0};
  var perM = perMults[period] || 1.0;
  var combined = segM * perM;
  var scaled = raw.map(function(v) { return Math.round(v * combined); });
  var data = (segVarianceIdx > 0 || perMults[period] !== 1.0)
    ? applyVariance(scaled, segVarianceIdx + 1, ["Last 7 days","Last 30 days","Last 90 days","Year to date"].indexOf(period) + 1)
    : scaled;
  return { data: data, dates: chartD.dates, fmt: fmt };
}

// Demo table configurations per metric. Returns { columns, rows } shaped for
// the ChartRenderer tableConfig prop. In production, engineers supply their
// own tableConfig from real data instead of calling this function.
export function getTableConfig(metric, data, dates, period, fmt) {
  var n = data.length;
  if (metric === "Top Products") {
    var names = ["Maple Desk Pro","Oak Shelf Unit","Walnut Console","Cedar Planter","Pine Bookcase"];
    return {columns:[{key:"name",label:"Product",align:"left"},{key:"revenue",label:"Revenue",align:"right",numeric:true,format:"dollar"},{key:"units",label:"Units",align:"right",numeric:true}],rows:names.map(function(nm,i){var v=data[Math.min(i,n-1)];return{name:nm,revenue:Math.round(v*0.8),units:Math.round(v/8)};})};
  }
  if (metric === "Reviews") {
    var sources = [{n:"Google",w:0.42},{n:"Yelp",w:0.24},{n:"Facebook",w:0.18},{n:"Thumbtack",w:0.10},{n:"BBB",w:0.06}];
    var tot = data.reduce(function(a,b){return a+b;},0);
    return {columns:[{key:"source",label:"Source",align:"left"},{key:"count",label:"Count",align:"right",numeric:true},{key:"rating",label:"Avg Rating",align:"right",numeric:true,format:"rating"}],rows:sources.map(function(s){return{source:s.n,count:Math.round(tot*s.w/10),rating:Math.round((38+Math.random()*12))/10};})};
  }
  if (metric === "Appointments") {
    var step = Math.max(1, Math.floor(n/5));
    var rows = [];
    for (var i = 0; i < n && rows.length < 5; i += step) {
      rows.push({day:dates[i].toLocaleDateString("en-US",{month:"short",day:"numeric"}),booked:Math.round(data[i]*0.6),revenue:data[i]});
    }
    return {columns:[{key:"day",label:"Day",align:"left"},{key:"booked",label:"Booked",align:"right",numeric:true},{key:"revenue",label:"Revenue",align:"right",numeric:true,format:"dollar"}],rows:rows};
  }
  if (metric === "Estimates") {
    var tot2 = data.reduce(function(a,b){return a+b;},0);
    return {columns:[{key:"status",label:"Status",align:"left"},{key:"count",label:"Count",align:"right",numeric:true},{key:"value",label:"Value",align:"right",numeric:true,format:"dollar"}],rows:[{status:"Accepted",count:Math.round(tot2*0.52/10),value:Math.round(tot2*0.52)},{status:"Pending",count:Math.round(tot2*0.28/10),value:Math.round(tot2*0.28)},{status:"Declined",count:Math.round(tot2*0.12/10),value:Math.round(tot2*0.12)},{status:"Expired",count:Math.round(tot2*0.08/10),value:Math.round(tot2*0.08)}]};
  }
  if (metric === "Leads") {
    var tot3 = data.reduce(function(a,b){return a+b;},0);
    return {columns:[{key:"channel",label:"Channel",align:"left"},{key:"count",label:"Count",align:"right",numeric:true},{key:"conv",label:"Conv %",align:"right",numeric:true,format:"pct"}],rows:[{channel:"Organic Search",count:Math.round(tot3*0.35/10),conv:4.2},{channel:"Paid Ads",count:Math.round(tot3*0.28/10),conv:3.1},{channel:"Referral",count:Math.round(tot3*0.20/10),conv:6.8},{channel:"Social",count:Math.round(tot3*0.12/10),conv:2.4},{channel:"Direct",count:Math.round(tot3*0.05/10),conv:5.1}]};
  }
  if (metric === "Subscription Plans") {
    var plans = [
      {n:"Enterprise Plus",  users:1287, mrr:4920,  arr:59040,  churn:1.2, nps:9},
      {n:"Professional",     users:842,  mrr:2840,  arr:34080,  churn:1.8, nps:8},
      {n:"Business Pro",     users:614,  mrr:1720,  arr:20640,  churn:2.4, nps:8},
      {n:"Starter Pack",     users:398,  mrr:720,   arr:8640,   churn:3.6, nps:7},
      {n:"Free Trial",       users:1492, mrr:0,     arr:0,      churn:14.8,nps:5},
    ];
    return {
      columns:[
        {key:"plan",   label:"Plan",   align:"left"},
        {key:"users",  label:"Users",  align:"right", numeric:true},
        {key:"mrr",    label:"MRR",    align:"right", numeric:true, format:"dollar"},
        {key:"arr",    label:"ARR",    align:"right", numeric:true, format:"dollar"},
        {key:"churn",  label:"Churn",  align:"right", numeric:true, format:"pct"},
        {key:"nps",    label:"NPS",    align:"right", numeric:true},
      ],
      rows: plans.map(function(p){
        return {plan:p.n, users:p.users, mrr:p.mrr, arr:p.arr, churn:p.churn, nps:p.nps};
      }),
    };
  }
  if (metric === "Sales Activity") {
    var atot = data.reduce(function(a,b){return a+b;},0);
    var rows8 = [
      {agent:"Alex Pendrick",   calls:182, emails:294, meetings:18, deals:12, pipe:0.30, closed:0.24, quota:118, dsf:1.20, winrate:44},
      {agent:"Maria Hoffmann",  calls:156, emails:240, meetings:15, deals:10, pipe:0.24, closed:0.20, quota:96,  dsf:1.05, winrate:40},
      {agent:"Jordan Lee",      calls:134, emails:208, meetings:13, deals:9,  pipe:0.20, closed:0.18, quota:88,  dsf:0.95, winrate:38},
      {agent:"Priya Ramaswamy", calls:122, emails:188, meetings:11, deals:7,  pipe:0.16, closed:0.14, quota:74,  dsf:0.88, winrate:35},
      {agent:"Devon Carter",    calls:98,  emails:152, meetings:9,  deals:5,  pipe:0.10, closed:0.10, quota:62,  dsf:0.72, winrate:32},
    ];
    return {
      columns:[
        {key:"agent",    label:"Agent",     align:"left"},
        {key:"calls",    label:"Calls",     align:"right", numeric:true},
        {key:"emails",   label:"Emails",    align:"right", numeric:true},
        {key:"meetings", label:"Meetings",  align:"right", numeric:true},
        {key:"deals",    label:"Deals",     align:"right", numeric:true},
        {key:"avgdeal",  label:"Avg Deal",  align:"right", numeric:true, format:"dollar"},
        {key:"pipeline", label:"Pipeline",  align:"right", numeric:true, format:"dollar"},
        {key:"winrate",  label:"Win Rate",  align:"right", numeric:true, format:"pct"},
        {key:"closed",   label:"Closed",    align:"right", numeric:true, format:"dollar"},
        {key:"quota",    label:"Quota %",   align:"right", numeric:true, format:"pct"},
      ],
      rows: rows8.map(function(r){
        return {
          agent:r.agent, calls:r.calls, emails:r.emails, meetings:r.meetings, deals:r.deals,
          avgdeal:  Math.round((atot * r.closed * r.dsf) / r.deals),
          pipeline: Math.round(atot * r.pipe),
          winrate:  r.winrate,
          closed:   Math.round(atot * r.closed),
          quota:    r.quota,
        };
      }),
    };
  }
  if (metric === "Channel Performance") {
    var ctot = data.reduce(function(a,b){return a+b;},0);
    var channels = [
      {n:"Google Ads",       share:0.32, conv:4.8, rev:0.41},
      {n:"Organic Search",   share:0.24, conv:5.6, rev:0.28},
      {n:"Email Campaign",   share:0.18, conv:6.2, rev:0.16},
      {n:"Direct Referral",  share:0.14, conv:8.1, rev:0.10},
      {n:"Social Media",     share:0.12, conv:3.4, rev:0.05},
    ];
    return {
      columns:[
        {key:"channel", label:"Channel",  align:"left"},
        {key:"leads",   label:"Leads",    align:"right", numeric:true},
        {key:"conv",    label:"Conv %",   align:"right", numeric:true, format:"pct"},
        {key:"revenue", label:"Revenue",  align:"right", numeric:true, format:"dollar"},
      ],
      rows: channels.map(function(c){
        return {
          channel: c.n,
          leads: Math.round(ctot * c.share / 10),
          conv: c.conv,
          revenue: Math.round(ctot * c.rev),
        };
      }),
    };
  }
  if (metric === "Sales by Agent") {
    var stot = data.reduce(function(a,b){return a+b;},0);
    var agents = [
      {n:"Alexandra Pendrickson",  deals:142, pipe:5.4, closed:4.2, quota:124},
      {n:"Maria-Elena Hofmann",    deals:118, pipe:4.3, closed:3.4, quota:102},
      {n:"Jonathan Lee-Hutchings", deals:96,  pipe:2.8, closed:2.5, quota:88},
      {n:"Priya Ramaswamy-Chen",   deals:78,  pipe:2.2, closed:1.9, quota:76},
      {n:"Devon Carter-Patel",     deals:58,  pipe:1.4, closed:1.2, quota:62},
    ];
    return {
      columns:[
        {key:"agent",    label:"Agent",    align:"left"},
        {key:"deals",    label:"Deals",    align:"right", numeric:true},
        {key:"pipeline", label:"Pipeline", align:"right", numeric:true, format:"dollar"},
        {key:"closed",   label:"Closed",   align:"right", numeric:true, format:"dollar"},
        {key:"quota",    label:"Quota %",  align:"right", numeric:true, format:"pct"},
      ],
      rows: agents.map(function(a){
        return {
          agent: a.n,
          deals: a.deals,
          pipeline: Math.round(stot * a.pipe),
          closed:   Math.round(stot * a.closed),
          quota:    a.quota,
        };
      }),
    };
  }
  if (metric === "Email List") {
    var tot4 = data.reduce(function(a,b){return a+b;},0);
    return {columns:[{key:"campaign",label:"Campaign",align:"left"},{key:"subs",label:"Subscribers",align:"right",numeric:true},{key:"open",label:"Open %",align:"right",numeric:true,format:"pct"}],rows:[{campaign:"Welcome Series",subs:Math.round(tot4*0.3),open:42.1},{campaign:"Weekly Newsletter",subs:Math.round(tot4*0.25),open:28.4},{campaign:"Promo Blast",subs:Math.round(tot4*0.20),open:18.7},{campaign:"Re-engagement",subs:Math.round(tot4*0.15),open:22.3},{campaign:"Seasonal Offer",subs:Math.round(tot4*0.10),open:31.5}]};
  }
  return {columns:[{key:"date",label:"Date",align:"left"},{key:"value",label:"Value",align:"right",numeric:true}],rows:data.slice(0,7).map(function(v,i){return{date:dates[i]?dates[i].toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—",value:v};})};
}

// Chart type icons — used only in the gallery's left panel.
export function IcoLine(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none",stroke:c,strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"},ce("path",{d:"M2 12l4-5 3 3 5-6"}));
}
export function IcoBar(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("div",{style:{display:"flex",flexDirection:"column",gap:2,width:14,height:14,justifyContent:"center",flexShrink:0}},
    ce("div",{style:{height:2,width:9,borderRadius:1,background:c}}),
    ce("div",{style:{height:2,width:13,borderRadius:1,background:c}}),
    ce("div",{style:{height:2,width:6,borderRadius:1,background:c}})
  );
}
export function IcoArea(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none",stroke:c,strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"},
    ce("path",{d:"M2 12l4-5 3 3 5-6"}),
    ce("path",{d:"M2 12l4-5 3 3 5-6V13H2z",fill:c,opacity:"0.15",stroke:"none"})
  );
}
export function IcoColumn(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("div",{style:{display:"flex",flexDirection:"row",gap:2,width:14,height:14,alignItems:"flex-end",justifyContent:"center",flexShrink:0,position:"relative",top:"-2px"}},
    ce("div",{style:{width:2,height:5,borderRadius:1,background:c}}),
    ce("div",{style:{width:2,height:8,borderRadius:1,background:c}}),
    ce("div",{style:{width:2,height:10,borderRadius:1,background:c}})
  );
}
export function IcoDonut(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none",stroke:c,strokeWidth:"1.5"},
    ce("circle",{cx:"8",cy:"8",r:"5.5"}),
    ce("circle",{cx:"8",cy:"8",r:"2.5"}),
    ce("path",{d:"M8 2.5A5.5 5.5 0 0113.5 8",strokeWidth:"2.2",strokeLinecap:"round"})
  );
}
export function IcoPie(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none",stroke:c,strokeWidth:"1.5"},
    ce("circle",{cx:"8",cy:"8",r:"5.5"}),
    ce("path",{d:"M8 8 L8 2.5 A5.5 5.5 0 0 1 13.5 8 Z",fill:c,stroke:"none"})
  );
}
export function IcoHero(p) {
  return ce("span",{style:{fontSize:10,fontWeight:700,color:p.color||tokens.colors.ui.textPrimary,letterSpacing:"-0.5px",lineHeight:1}},"123");
}
export function IcoTable(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("rect",{x:"1",y:"2",width:"14",height:"3",rx:"1",fill:c}),
    ce("rect",{x:"1",y:"6",width:"4",height:"3",fill:c,opacity:"0.5"}),
    ce("rect",{x:"6",y:"6",width:"4",height:"3",fill:c,opacity:"0.5"}),
    ce("rect",{x:"11",y:"6",width:"4",height:"3",fill:c,opacity:"0.5"}),
    ce("rect",{x:"1",y:"10",width:"4",height:"3",fill:c,opacity:"0.5"}),
    ce("rect",{x:"6",y:"10",width:"4",height:"3",fill:c,opacity:"0.5"}),
    ce("rect",{x:"11",y:"10",width:"4",height:"3",fill:c,opacity:"0.5"})
  );
}
export function IcoFunnel(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("path",{d:"M2 3 H14 L12.5 6 H3.5 Z",fill:c}),
    ce("path",{d:"M3.8 7 H12.2 L10.8 10 H5.2 Z",fill:c,opacity:"0.7"}),
    ce("path",{d:"M5.5 11 H10.5 L9.2 13.5 H6.8 Z",fill:c,opacity:"0.5"})
  );
}
export function IcoGauge(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none",stroke:c,strokeWidth:"1.8",strokeLinecap:"round"},
    ce("path",{d:"M4 12.5 A5.5 5.5 0 1 1 12 12.5"}),
    ce("circle",{cx:"12",cy:"12.5",r:"0.6",fill:c,stroke:"none"})
  );
}
export function IcoReviews(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("path",{d:"M8 1.6 L9.85 5.95 L14.5 6.35 L10.95 9.4 L12.05 13.95 L8 11.5 L3.95 13.95 L5.05 9.4 L1.5 6.35 L6.15 5.95 Z",fill:c})
  );
}
export function IcoBullet(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("rect",{x:"1",y:"6",width:"14",height:"4",rx:"1",fill:c,opacity:"0.3"}),
    ce("rect",{x:"1",y:"6",width:"9",height:"4",rx:"1",fill:c}),
    ce("rect",{x:"11",y:"3.5",width:"1.5",height:"9",rx:"0.5",fill:c})
  );
}
export function IcoCombo(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("rect",{x:"1.5",y:"9",width:"2.5",height:"5",rx:"0.4",fill:c,opacity:"0.55"}),
    ce("rect",{x:"5",y:"6",width:"2.5",height:"8",rx:"0.4",fill:c,opacity:"0.55"}),
    ce("rect",{x:"8.5",y:"7.5",width:"2.5",height:"6.5",rx:"0.4",fill:c,opacity:"0.55"}),
    ce("rect",{x:"12",y:"4.5",width:"2.5",height:"9.5",rx:"0.4",fill:c,opacity:"0.55"}),
    ce("path",{d:"M2.75 7.5 L6.25 4.5 L9.75 6 L13.25 3",stroke:c,strokeWidth:"1.4",fill:"none",strokeLinecap:"round",strokeLinejoin:"round"})
  );
}
export function IcoHeatmap(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  var r = 0.5;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("rect",{x:"1.5",y:"1.5",width:"3.5",height:"3.5",rx:r,fill:c,opacity:"0.25"}),
    ce("rect",{x:"6.25",y:"1.5",width:"3.5",height:"3.5",rx:r,fill:c,opacity:"0.55"}),
    ce("rect",{x:"11",y:"1.5",width:"3.5",height:"3.5",rx:r,fill:c,opacity:"0.85"}),
    ce("rect",{x:"1.5",y:"6.25",width:"3.5",height:"3.5",rx:r,fill:c,opacity:"0.55"}),
    ce("rect",{x:"6.25",y:"6.25",width:"3.5",height:"3.5",rx:r,fill:c,opacity:"0.85"}),
    ce("rect",{x:"11",y:"6.25",width:"3.5",height:"3.5",rx:r,fill:c,opacity:"0.35"}),
    ce("rect",{x:"1.5",y:"11",width:"3.5",height:"3.5",rx:r,fill:c,opacity:"0.40"}),
    ce("rect",{x:"6.25",y:"11",width:"3.5",height:"3.5",rx:r,fill:c,opacity:"0.65"}),
    ce("rect",{x:"11",y:"11",width:"3.5",height:"3.5",rx:r,fill:c,opacity:"0.75"})
  );
}
export function IcoWaterfall(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("rect",{x:"1",y:"2",width:"2.5",height:"12",rx:"0.5",fill:c}),
    ce("rect",{x:"4.5",y:"4",width:"2.5",height:"4",rx:"0.5",fill:c,opacity:"0.6"}),
    ce("rect",{x:"8",y:"8",width:"2.5",height:"3",rx:"0.5",fill:c,opacity:"0.6"}),
    ce("rect",{x:"11.5",y:"5",width:"2.5",height:"9",rx:"0.5",fill:c})
  );
}
export function IcoTreemap(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("rect",{x:"1",y:"1",width:"8",height:"8.5",rx:"0.5",fill:c}),
    ce("rect",{x:"10",y:"1",width:"5",height:"4.5",rx:"0.5",fill:c,opacity:"0.65"}),
    ce("rect",{x:"10",y:"6.5",width:"5",height:"3",rx:"0.5",fill:c,opacity:"0.40"}),
    ce("rect",{x:"1",y:"10.5",width:"5",height:"4.5",rx:"0.5",fill:c,opacity:"0.55"}),
    ce("rect",{x:"7",y:"10.5",width:"8",height:"4.5",rx:"0.5",fill:c,opacity:"0.30"})
  );
}
export function IcoScatter(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("circle",{cx:"3",cy:"11.5",r:"1.4",fill:c,opacity:"0.85"}),
    ce("circle",{cx:"5.5",cy:"7",r:"1.1",fill:c}),
    ce("circle",{cx:"8",cy:"9.5",r:"1.7",fill:c,opacity:"0.90"}),
    ce("circle",{cx:"10.5",cy:"4.5",r:"1.3",fill:c}),
    ce("circle",{cx:"12",cy:"8",r:"1",fill:c,opacity:"0.85"}),
    ce("circle",{cx:"13",cy:"3",r:"1.4",fill:c})
  );
}
export function IcoCalendar(p) {
  var c = p.color || tokens.colors.ui.textPrimary;
  return ce("svg",{width:14,height:14,viewBox:"0 0 16 16",fill:"none"},
    ce("rect",{x:"1.5",y:"3",width:"13",height:"11.5",rx:"1.5",stroke:c,strokeWidth:"1.3",fill:"none"}),
    ce("rect",{x:"1.5",y:"3",width:"13",height:"3",rx:"1.5",fill:c,opacity:"0.18"}),
    ce("line",{x1:"5",y1:"1.5",x2:"5",y2:"4.5",stroke:c,strokeWidth:"1.3",strokeLinecap:"round"}),
    ce("line",{x1:"11",y1:"1.5",x2:"11",y2:"4.5",stroke:c,strokeWidth:"1.3",strokeLinecap:"round"}),
    ce("circle",{cx:"4.5",cy:"9",r:"0.7",fill:c}),
    ce("circle",{cx:"8",cy:"9",r:"0.7",fill:c}),
    ce("circle",{cx:"11.5",cy:"9",r:"0.7",fill:c}),
    ce("circle",{cx:"4.5",cy:"12",r:"0.7",fill:c,opacity:"0.55"}),
    ce("circle",{cx:"8",cy:"12",r:"0.7",fill:c}),
    ce("circle",{cx:"11.5",cy:"12",r:"0.7",fill:c,opacity:"0.55"})
  );
}
export var CHART_ICONS = {Line:IcoLine,Bar:IcoBar,Area:IcoArea,Column:IcoColumn,Donut:IcoDonut,Pie:IcoPie,Hero:IcoHero,Table:IcoTable,Funnel:IcoFunnel,Gauge:IcoGauge,Reviews:IcoReviews,Bullet:IcoBullet,Combo:IcoCombo,Heatmap:IcoHeatmap,Waterfall:IcoWaterfall,Treemap:IcoTreemap,Scatter:IcoScatter,Calendar:IcoCalendar};
