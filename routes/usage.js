const router = require('express').Router();
const { wrapRoute } = require('../lib/file-helpers');
const { decodeSlug } = require('../lib/slug');
const { MODEL_PRICING, calcCost, calcCostMultiModel, addTokens, emptyTokens, buildIndex } = require('../lib/usage-index');

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function filterModel(req) {
  const m = req.query.model;
  return m && MODEL_PRICING[m] ? m : null;
}

function getSessionTokens(session, model) {
  if (!model) return session.totals;
  return session.byModel?.[model] || null;
}

function aggregateByPeriod(index, group, model) {
  const buckets = {};

  for (const s of Object.values(index.sessions)) {
    for (const [day, modelTokens] of Object.entries(s.daily || {})) {
      let label;
      if (group === 'day') label = day;
      else if (group === 'week') label = getISOWeek(day);
      else if (group === 'month') label = day.slice(0, 7);
      else label = day.slice(0, 4);

      if (!buckets[label]) buckets[label] = emptyTokens();

      if (typeof modelTokens === 'object' && !('input_tokens' in modelTokens)) {
        if (model) {
          if (modelTokens[model]) addTokens(buckets[label], modelTokens[model]);
        } else {
          for (const tokens of Object.values(modelTokens)) addTokens(buckets[label], tokens);
        }
      } else if (!model) {
        addTokens(buckets[label], modelTokens);
      }
    }
  }

  return Object.entries(buckets)
    .filter(([, t]) => t.input_tokens || t.output_tokens || t.cache_creation_input_tokens || t.cache_read_input_tokens)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([label, tokens]) => ({
      label,
      ...tokens,
      cost: model ? calcCost(tokens, model).total : calcCost(tokens).total
    }));
}

/** GET /api/usage/summary */
router.get('/summary', wrapRoute((req, res) => {
  const model = filterModel(req);
  const index = buildIndex();
  const sessions = Object.values(index.sessions);
  const totals = emptyTokens();
  const byModel = {};
  const slugs = new Set();
  let sessionCount = 0;

  for (const s of sessions) {
    const t = getSessionTokens(s, model);
    if (!t) continue;
    addTokens(totals, t);
    slugs.add(s.slug);
    sessionCount++;
    if (!model) {
      for (const [m, tokens] of Object.entries(s.byModel || {})) {
        if (!byModel[m]) byModel[m] = emptyTokens();
        addTokens(byModel[m], tokens);
      }
    }
  }

  const cost = model ? calcCost(totals, model) : calcCostMultiModel(byModel);

  res.json({
    totals,
    byModel: model ? { [model]: totals } : byModel,
    cost,
    sessionCount,
    projectCount: slugs.size,
    modelPricing: MODEL_PRICING,
    activeModel: model || null
  });
}));

/** GET /api/usage/by-period?group=day|week|month|year */
router.get('/by-period', wrapRoute((req, res) => {
  const group = ['day', 'week', 'month', 'year'].includes(req.query.group) ? req.query.group : 'month';
  const model = filterModel(req);
  const index = buildIndex();
  res.json({ periods: aggregateByPeriod(index, group, model) });
}));

/** GET /api/usage/by-project */
router.get('/by-project', wrapRoute((req, res) => {
  const model = filterModel(req);
  const index = buildIndex();
  const projects = {};

  for (const s of Object.values(index.sessions)) {
    const t = getSessionTokens(s, model);
    if (!t) continue;

    if (!projects[s.slug]) {
      projects[s.slug] = { slug: s.slug, name: decodeSlug(s.slug), sessionCount: 0, byModel: {}, ...emptyTokens() };
    }
    projects[s.slug].sessionCount++;
    addTokens(projects[s.slug], t);
    if (!model) {
      for (const [m, tokens] of Object.entries(s.byModel || {})) {
        if (!projects[s.slug].byModel[m]) projects[s.slug].byModel[m] = emptyTokens();
        addTokens(projects[s.slug].byModel[m], tokens);
      }
    } else {
      if (!projects[s.slug].byModel[model]) projects[s.slug].byModel[model] = emptyTokens();
      addTokens(projects[s.slug].byModel[model], t);
    }
  }

  const list = Object.values(projects)
    .map(p => ({ ...p, cost: model ? calcCost(p, model).total : calcCostMultiModel(p.byModel).total }))
    .filter(p => p.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  res.json({ projects: list });
}));

module.exports = router;
