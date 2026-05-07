const fs = require('fs');
const path = require('path');
const { PROJECTS_DIR, USAGE_DB } = require('./paths');
const { readJson, writeDataJson } = require('./file-helpers');
const { getCurrentPricing, resolveModelPrice, FALLBACK_PRICING } = require('./pricing');

function resolveModel(model) {
  if (!model || model === '<synthetic>') return null;
  const pricing = getCurrentPricing();
  if (resolveModelPrice(model, pricing)) return model;
  return null;
}

function getPricing(model) {
  const pricing = getCurrentPricing();
  return resolveModelPrice(model, pricing) || FALLBACK_PRICING['claude-sonnet-4-6'];
}

function getModelPricingMap() {
  return getCurrentPricing();
}

function calcCost(tokens, model) {
  const r = getPricing(model);
  const input = (tokens.input_tokens || 0) * r.input / 1_000_000;
  const output = (tokens.output_tokens || 0) * r.output / 1_000_000;
  const cache_write = (tokens.cache_creation_input_tokens || 0) * r.cache_write / 1_000_000;
  const cache_read = (tokens.cache_read_input_tokens || 0) * r.cache_read / 1_000_000;
  return { input, output, cache_write, cache_read, total: input + output + cache_write + cache_read };
}

function calcCostMultiModel(byModel) {
  let total = { input: 0, output: 0, cache_write: 0, cache_read: 0, total: 0 };
  for (const [model, tokens] of Object.entries(byModel)) {
    const c = calcCost(tokens, model);
    total.input += c.input;
    total.output += c.output;
    total.cache_write += c.cache_write;
    total.cache_read += c.cache_read;
    total.total += c.total;
  }
  return total;
}

function addTokens(target, usage) {
  target.input_tokens = (target.input_tokens || 0) + (usage.input_tokens || 0);
  target.output_tokens = (target.output_tokens || 0) + (usage.output_tokens || 0);
  target.cache_creation_input_tokens = (target.cache_creation_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  target.cache_read_input_tokens = (target.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
}

function emptyTokens() {
  return { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
}

function parseSessionUsage(filePath) {
  const byModel = {};
  const daily = {};
  const hourly = {};

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant' || !entry.message?.usage) continue;
      const usage = entry.message.usage;
      const model = resolveModel(entry.message.model);
      if (!model) continue;

      if (!byModel[model]) byModel[model] = emptyTokens();
      addTokens(byModel[model], usage);

      const ts = entry.timestamp || '';
      const day = ts.slice(0, 10);
      if (day) {
        if (!daily[day]) daily[day] = {};
        if (!daily[day][model]) daily[day][model] = emptyTokens();
        addTokens(daily[day][model], usage);
      }

      const hour = ts.slice(0, 13); // "YYYY-MM-DDTHH"
      if (hour.length === 13) {
        if (!hourly[hour]) hourly[hour] = {};
        if (!hourly[hour][model]) hourly[hour][model] = emptyTokens();
        addTokens(hourly[hour][model], usage);
      }
    } catch (_) {}
  }

  const totals = emptyTokens();
  for (const t of Object.values(byModel)) addTokens(totals, t);

  return { totals, byModel, daily, hourly };
}

function buildIndex() {
  const index = readJson(USAGE_DB, { version: 3, sessions: {} });
  if (!index.sessions) index.sessions = {};

  const forceReindex = index.version !== 3;

  const seen = new Set();
  let dirs;
  try { dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()); }
  catch (_) { return index; }

  for (const d of dirs) {
    const slug = d.name;
    const projectDir = path.join(PROJECTS_DIR, slug);
    let files;
    try { files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl')); }
    catch (_) { continue; }

    for (const f of files) {
      const sessionId = f.replace('.jsonl', '');
      const key = slug + '/' + sessionId;
      seen.add(key);

      const filePath = path.join(projectDir, f);
      let mtime;
      try { mtime = fs.statSync(filePath).mtimeMs; }
      catch (_) { continue; }

      if (!forceReindex && index.sessions[key] && index.sessions[key].mtime === mtime) continue;

      const { totals, byModel, daily, hourly } = parseSessionUsage(filePath);
      index.sessions[key] = { mtime, slug, sessionId, totals, byModel, daily, hourly };
    }
  }

  for (const key of Object.keys(index.sessions)) {
    if (!seen.has(key)) delete index.sessions[key];
  }

  index.version = 3;
  writeDataJson(USAGE_DB, index);
  return index;
}

function getSessionUsage(slug, sessionId) {
  const index = buildIndex();
  const entry = index.sessions[slug + '/' + sessionId];
  if (!entry) return null;
  return { totals: entry.totals, byModel: entry.byModel, cost: calcCostMultiModel(entry.byModel || {}) };
}

function getProjectUsageMap(slug) {
  const index = buildIndex();
  const map = {};
  for (const [key, entry] of Object.entries(index.sessions)) {
    if (entry.slug === slug) {
      map[entry.sessionId] = {
        totals: entry.totals,
        byModel: entry.byModel,
        cost: calcCostMultiModel(entry.byModel || {}).total
      };
    }
  }
  return map;
}

function removeSessionFromIndex(slug, sessionId) {
  const index = readJson(USAGE_DB, { version: 2, sessions: {} });
  const key = slug + '/' + sessionId;
  if (index.sessions && index.sessions[key]) {
    delete index.sessions[key];
    writeDataJson(USAGE_DB, index);
  }
}

module.exports = { getModelPricingMap, calcCost, calcCostMultiModel, addTokens, emptyTokens, buildIndex, getSessionUsage, getProjectUsageMap, removeSessionFromIndex };
