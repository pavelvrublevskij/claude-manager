function makeDateFilter(fromInputId, toInputId, presetInputId) {
  const df = {
    fromDate: null,
    toDate: null,
    fromTime: null,
    toTime: null,
    datePreset: null,

    applyPreset(preset) {
      df.datePreset = preset;
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const fmtDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const fmtDT = (d, h, m) => fmtDate(d) + 'T' + pad(h) + ':' + pad(m);

      let fromDT = null, toDT = null;
      if (preset === 'today') { fromDT = fmtDT(now, 0, 0); toDT = fmtDT(now, 23, 59); }
      else if (preset === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); fromDT = fmtDT(y, 0, 0); toDT = fmtDT(y, 23, 59); }
      else if (preset === '7d') { const f = new Date(now); f.setDate(f.getDate() - 6); fromDT = fmtDT(f, 0, 0); toDT = fmtDT(now, 23, 59); }
      else if (preset === '30d') { const f = new Date(now); f.setDate(f.getDate() - 29); fromDT = fmtDT(f, 0, 0); toDT = fmtDT(now, 23, 59); }
      else if (preset === 'month') { fromDT = fmtDT(new Date(now.getFullYear(), now.getMonth(), 1), 0, 0); toDT = fmtDT(now, 23, 59); }
      else if (preset === 'year') { fromDT = fmtDT(new Date(now.getFullYear(), 0, 1), 0, 0); toDT = fmtDT(now, 23, 59); }

      df.fromDate = fromDT ? fromDT.slice(0, 10) : null;
      df.toDate = toDT ? toDT.slice(0, 10) : null;
      df.fromTime = null;
      df.toTime = null;

      const presetEl = document.getElementById(presetInputId);
      if (presetEl) presetEl.value = preset;
      const fromEl = document.getElementById(fromInputId);
      if (fromEl) fromEl.value = fromDT || '';
      const toEl = document.getElementById(toInputId);
      if (toEl) toEl.value = toDT || '';
    },

    applyCustom() {
      const f = (document.getElementById(fromInputId) || {}).value || null;
      const t = (document.getElementById(toInputId) || {}).value || null;
      df.fromDate = f ? f.slice(0, 10) : null;
      df.toDate = t ? t.slice(0, 10) : null;
      df.fromTime = f && f.length > 10 ? f.slice(11, 16) : null;
      df.toTime = t && t.length > 10 ? t.slice(11, 16) : null;
      df.datePreset = 'custom';
      const presetEl = document.getElementById(presetInputId);
      if (presetEl) presetEl.value = 'custom';
    },

    queryParts() {
      const parts = [];
      if (df.fromDate) parts.push('from=' + encodeURIComponent(df.fromDate));
      if (df.toDate) parts.push('to=' + encodeURIComponent(df.toDate));
      if (df.fromTime) parts.push('fromTime=' + encodeURIComponent(df.fromTime));
      if (df.toTime) parts.push('toTime=' + encodeURIComponent(df.toTime));
      return parts;
    },

    queryString() {
      const parts = df.queryParts();
      return parts.length ? '?' + parts.join('&') : '';
    }
  };

  return df;
}
