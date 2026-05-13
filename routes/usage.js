const router = require('express').Router();
const { wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { getModelPricingMap, calcCostMultiModel, addTokens, emptyTokens, buildIndex } = require('../lib/usage-index');
const { getLastFetchedAt, PRICING_URL, resolveModelPrice } = require('../lib/pricing');
const { getFilteredByModel, sumByModel, aggregateByPeriod } = require('../lib/usage-filters');

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function filterModels(req) {
  const pricingMap = getModelPricingMap();
  const out = new Set();
  for (const m of toArray(req.query.models)) {
    if (resolveModelPrice(m, pricingMap)) out.add(m);
  }
  return out;
}

function filterProjects(req) {
  return new Set(toArray(req.query.projects));
}

function filterDateRange(req) {
  const reDate = /^\d{4}-\d{2}-\d{2}$/;
  const reTime = /^\d{2}:\d{2}$/;
  const from = req.query.from && reDate.test(req.query.from) ? req.query.from : null;
  const to = req.query.to && reDate.test(req.query.to) ? req.query.to : null;
  const fromTime = req.query.fromTime && reTime.test(req.query.fromTime) ? req.query.fromTime : null;
  const toTime = req.query.toTime && reTime.test(req.query.toTime) ? req.query.toTime : null;
  return { from, to, fromTime, toTime };
}

/** GET /api/usage/summary */
router.get('/summary', wrapRoute((req, res) => {
  const models = filterModels(req);
  const projects = filterProjects(req);
  const { from, to, fromTime, toTime } = filterDateRange(req);
  const index = buildIndex();
  const sessions = Object.values(index.sessions);
  const byModel = {};
  const slugs = new Set();
  let sessionCount = 0;

  const allModels = new Set();
  const allProjects = {};
  for (const s of sessions) {
    for (const m of Object.keys(s.byModel || {})) allModels.add(m);
    if (!allProjects[s.slug]) allProjects[s.slug] = decodeSlug(s.slug);
  }

  for (const s of sessions) {
    if (projects.size && !projects.has(s.slug)) continue;
    const sByModel = getFilteredByModel(s, models, from, to, fromTime, toTime);
    if (!Object.keys(sByModel).length) continue;

    for (const [m, tokens] of Object.entries(sByModel)) {
      if (!byModel[m]) byModel[m] = emptyTokens();
      addTokens(byModel[m], tokens);
    }
    slugs.add(s.slug);
    sessionCount++;
  }

  const totals = sumByModel(byModel);
  const cost = calcCostMultiModel(byModel);

  res.json({
    totals,
    byModel,
    cost,
    sessionCount,
    projectCount: slugs.size,
    modelPricing: getModelPricingMap(),
    pricingUpdated: getLastFetchedAt(),
    pricingSource: PRICING_URL,
    activeModels: Array.from(models),
    activeProjects: Array.from(projects),
    activeFrom: from,
    activeTo: to,
    allModels: Array.from(allModels).sort(),
    allProjects: Object.entries(allProjects).map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name))
  });
}));

/** GET /api/usage/project/:slug */
router.get('/project/:slug', wrapRoute((req, res) => {
  const { from, to, fromTime, toTime } = filterDateRange(req);
  const index = buildIndex();
  const totals = emptyTokens();
  const byModel = {};
  let sessionCount = 0;

  for (const s of Object.values(index.sessions)) {
    if (s.slug !== req.params.slug) continue;
    const sByModel = getFilteredByModel(s, new Set(), from, to, fromTime, toTime);
    if (!Object.keys(sByModel).length) continue;
    sessionCount++;
    for (const [m, tokens] of Object.entries(sByModel)) {
      if (!byModel[m]) byModel[m] = emptyTokens();
      addTokens(byModel[m], tokens);
      addTokens(totals, tokens);
    }
  }

  const cost = calcCostMultiModel(byModel);

  res.json({
    slug: req.params.slug,
    totals,
    byModel,
    cost,
    sessionCount,
    activeFrom: from,
    activeTo: to
  });
}));

/** GET /api/usage/by-period?group=hour|day|week|month|year */
router.get('/by-period', wrapRoute((req, res) => {
  const group = ['hour', 'day', 'week', 'month', 'year'].includes(req.query.group) ? req.query.group : 'month';
  const models = filterModels(req);
  const projects = filterProjects(req);
  const { from, to, fromTime, toTime } = filterDateRange(req);
  const index = buildIndex();
  res.json({ periods: aggregateByPeriod(index, group, models, projects, from, to, fromTime, toTime) });
}));

/** GET /api/usage/by-project */
router.get('/by-project', wrapRoute((req, res) => {
  const models = filterModels(req);
  const projects = filterProjects(req);
  const { from, to, fromTime, toTime } = filterDateRange(req);
  const index = buildIndex();
  const result = {};

  for (const s of Object.values(index.sessions)) {
    if (projects.size && !projects.has(s.slug)) continue;
    const sByModel = getFilteredByModel(s, models, from, to, fromTime, toTime);
    if (!Object.keys(sByModel).length) continue;

    if (!result[s.slug]) {
      result[s.slug] = { slug: s.slug, name: decodeSlug(s.slug), sessionCount: 0, byModel: {}, ...emptyTokens() };
    }
    result[s.slug].sessionCount++;
    for (const [m, tokens] of Object.entries(sByModel)) {
      if (!result[s.slug].byModel[m]) result[s.slug].byModel[m] = emptyTokens();
      addTokens(result[s.slug].byModel[m], tokens);
      addTokens(result[s.slug], tokens);
    }
  }

  const list = Object.values(result)
    .map(p => ({ ...p, cost: calcCostMultiModel(p.byModel).total }))
    .filter(p => p.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  res.json({ projects: list });
}));

module.exports = router;
