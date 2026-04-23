const router = require('express').Router();
const { wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { getModelPricingMap, calcCostMultiModel, addTokens, emptyTokens, buildIndex } = require('../lib/usage-index');
const { getLastFetchedAt, PRICING_URL, resolveModelPrice } = require('../lib/pricing');

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

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
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const from = req.query.from && re.test(req.query.from) ? req.query.from : null;
  const to = req.query.to && re.test(req.query.to) ? req.query.to : null;
  return { from, to };
}

function dayInRange(day, from, to) {
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function getFilteredByModel(session, models, from, to) {
  if (!from && !to) {
    if (!models.size) return session.byModel || {};
    const out = {};
    for (const m of models) {
      if (session.byModel?.[m]) out[m] = session.byModel[m];
    }
    return out;
  }
  const out = {};
  for (const [day, modelTokens] of Object.entries(session.daily || {})) {
    if (!dayInRange(day, from, to)) continue;
    if (typeof modelTokens !== 'object' || 'input_tokens' in modelTokens) continue;
    for (const [m, tokens] of Object.entries(modelTokens)) {
      if (models.size && !models.has(m)) continue;
      if (!out[m]) out[m] = emptyTokens();
      addTokens(out[m], tokens);
    }
  }
  return out;
}

function sumByModel(byModel) {
  const t = emptyTokens();
  for (const tokens of Object.values(byModel)) addTokens(t, tokens);
  return t;
}

function aggregateByPeriod(index, group, models, projects, from, to) {
  const buckets = {};

  for (const s of Object.values(index.sessions)) {
    if (projects.size && !projects.has(s.slug)) continue;
    for (const [day, modelTokens] of Object.entries(s.daily || {})) {
      if (!dayInRange(day, from, to)) continue;
      let label;
      if (group === 'day') label = day;
      else if (group === 'week') label = getISOWeek(day);
      else if (group === 'month') label = day.slice(0, 7);
      else label = day.slice(0, 4);

      if (!buckets[label]) buckets[label] = { totals: emptyTokens(), byModel: {} };

      if (typeof modelTokens === 'object' && !('input_tokens' in modelTokens)) {
        for (const [m, tokens] of Object.entries(modelTokens)) {
          if (models.size && !models.has(m)) continue;
          if (!buckets[label].byModel[m]) buckets[label].byModel[m] = emptyTokens();
          addTokens(buckets[label].byModel[m], tokens);
          addTokens(buckets[label].totals, tokens);
        }
      } else if (!models.size) {
        addTokens(buckets[label].totals, modelTokens);
      }
    }
  }

  return Object.entries(buckets)
    .filter(([, b]) => b.totals.input_tokens || b.totals.output_tokens || b.totals.cache_creation_input_tokens || b.totals.cache_read_input_tokens)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([label, b]) => ({
      label,
      ...b.totals,
      cost: calcCostMultiModel(b.byModel).total
    }));
}

/** GET /api/usage/summary */
router.get('/summary', wrapRoute((req, res) => {
  const models = filterModels(req);
  const projects = filterProjects(req);
  const { from, to } = filterDateRange(req);
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
    const sByModel = getFilteredByModel(s, models, from, to);
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
  const { from, to } = filterDateRange(req);
  const index = buildIndex();
  const totals = emptyTokens();
  const byModel = {};
  let sessionCount = 0;

  for (const s of Object.values(index.sessions)) {
    if (s.slug !== req.params.slug) continue;
    const sByModel = getFilteredByModel(s, new Set(), from, to);
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

/** GET /api/usage/by-period?group=day|week|month|year */
router.get('/by-period', wrapRoute((req, res) => {
  const group = ['day', 'week', 'month', 'year'].includes(req.query.group) ? req.query.group : 'month';
  const models = filterModels(req);
  const projects = filterProjects(req);
  const { from, to } = filterDateRange(req);
  const index = buildIndex();
  res.json({ periods: aggregateByPeriod(index, group, models, projects, from, to) });
}));

/** GET /api/usage/by-project */
router.get('/by-project', wrapRoute((req, res) => {
  const models = filterModels(req);
  const projects = filterProjects(req);
  const { from, to } = filterDateRange(req);
  const index = buildIndex();
  const result = {};

  for (const s of Object.values(index.sessions)) {
    if (projects.size && !projects.has(s.slug)) continue;
    const sByModel = getFilteredByModel(s, models, from, to);
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
