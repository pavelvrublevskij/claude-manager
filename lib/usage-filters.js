const { addTokens, emptyTokens, calcCostMultiModel } = require('./usage-index');

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function dayInRange(day, from, to) {
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function hourKeyInRange(hourKey, from, to, fromTime, toTime) {
  const day = hourKey.slice(0, 10);
  const hour = hourKey.slice(11, 13);
  if (from && day < from) return false;
  if (to && day > to) return false;
  if (fromTime && hour < fromTime.slice(0, 2)) return false;
  if (toTime && hour > toTime.slice(0, 2)) return false;
  return true;
}

function getFilteredByModel(session, models, from, to, fromTime, toTime) {
  const hasTimeFilter = fromTime || toTime;
  if (!from && !to && !hasTimeFilter) {
    if (!models.size) return session.byModel || {};
    const out = {};
    for (const m of models) {
      if (session.byModel?.[m]) out[m] = session.byModel[m];
    }
    return out;
  }
  const out = {};
  if (hasTimeFilter) {
    for (const [hourKey, modelTokens] of Object.entries(session.hourly || {})) {
      if (!hourKeyInRange(hourKey, from, to, fromTime, toTime)) continue;
      if (typeof modelTokens !== 'object') continue;
      for (const [m, tokens] of Object.entries(modelTokens)) {
        if (models.size && !models.has(m)) continue;
        if (!out[m]) out[m] = emptyTokens();
        addTokens(out[m], tokens);
      }
    }
  } else {
    for (const [day, modelTokens] of Object.entries(session.daily || {})) {
      if (!dayInRange(day, from, to)) continue;
      if (typeof modelTokens !== 'object' || 'input_tokens' in modelTokens) continue;
      for (const [m, tokens] of Object.entries(modelTokens)) {
        if (models.size && !models.has(m)) continue;
        if (!out[m]) out[m] = emptyTokens();
        addTokens(out[m], tokens);
      }
    }
  }
  return out;
}

function sumByModel(byModel) {
  const t = emptyTokens();
  for (const tokens of Object.values(byModel)) addTokens(t, tokens);
  return t;
}

function aggregateByPeriod(index, group, models, projects, from, to, fromTime, toTime) {
  const buckets = {};
  const hasTimeFilter = fromTime || toTime;
  const useHourly = group === 'hour' || hasTimeFilter;

  for (const s of Object.values(index.sessions)) {
    if (projects.size && !projects.has(s.slug)) continue;

    if (useHourly) {
      for (const [hourKey, modelTokens] of Object.entries(s.hourly || {})) {
        if (!hourKeyInRange(hourKey, from, to, fromTime, toTime)) continue;
        const day = hourKey.slice(0, 10);
        let label;
        if (group === 'hour') label = day + ' ' + hourKey.slice(11, 13) + ':00';
        else if (group === 'day') label = day;
        else if (group === 'week') label = getISOWeek(day);
        else if (group === 'month') label = day.slice(0, 7);
        else label = day.slice(0, 4);

        if (!buckets[label]) buckets[label] = { totals: emptyTokens(), byModel: {} };
        if (typeof modelTokens === 'object') {
          for (const [m, tokens] of Object.entries(modelTokens)) {
            if (models.size && !models.has(m)) continue;
            if (!buckets[label].byModel[m]) buckets[label].byModel[m] = emptyTokens();
            addTokens(buckets[label].byModel[m], tokens);
            addTokens(buckets[label].totals, tokens);
          }
        }
      }
    } else {
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

module.exports = { getISOWeek, dayInRange, hourKeyInRange, getFilteredByModel, sumByModel, aggregateByPeriod };
