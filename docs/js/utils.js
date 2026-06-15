const LOCAL_KEY = 'bucket_dashboard_local';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getDataUrl() {
  return new URL('data/records.json', window.location.href).href;
}

const DataStore = {
  _jsonCache: null,

  async _loadJson() {
    if (this._jsonCache) return this._jsonCache;
    const res = await fetch(getDataUrl());
    if (!res.ok) throw new Error('Failed to load data/records.json');
    this._jsonCache = await res.json();
    return this._jsonCache;
  },

  _loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : { production: [], downtime: [] };
    } catch {
      return { production: [], downtime: [] };
    }
  },

  _saveLocal(local) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      production: local.production,
      downtime: local.downtime
    }));
  },

  _merge(json, local) {
    return {
      config: json.config || {},
      production: [...(json.production || []), ...(local.production || [])],
      downtime: [...(json.downtime || []), ...(local.downtime || [])]
    };
  },

  async getData() {
    const json = await this._loadJson();
    return this._merge(json, this._loadLocal());
  },

  async getByDate(date) {
    const all = await this.getData();
    return {
      config: all.config,
      production: all.production.filter(r => r.date === date),
      downtime: all.downtime.filter(r => r.date === date)
    };
  },

  async addProduction(data) {
    const local = this._loadLocal();
    const record = { id: genId(), createdAt: new Date().toISOString(), ...data };
    local.production.push(record);
    this._saveLocal(local);
    return record;
  },

  async addDowntime(data) {
    const local = this._loadLocal();
    const record = { id: genId(), createdAt: new Date().toISOString(), ...data };
    local.downtime.push(record);
    this._saveLocal(local);
    return record;
  },

  async exportMergedJson() {
    const data = await this.getData();
    return JSON.stringify({
      config: data.config,
      production: data.production,
      downtime: data.downtime
    }, null, 2);
  },

  getLocalCount() {
    const local = this._loadLocal();
    return (local.production?.length || 0) + (local.downtime?.length || 0);
  },

  clearLocal() {
    localStorage.removeItem(LOCAL_KEY);
    this._jsonCache = null;
  }
};

const API = DataStore;
function formatDateTH(d) {
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function toISODate(d) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function calcDuration(start, end, ongoing) {
  if (ongoing || !end) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = parseTime(start);
    return Math.max(0, nowMin - startMin);
  }
  return Math.max(0, parseTime(end) - parseTime(start));
}

function showToast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

const BUCKET_COLORS = ['#e8873a', '#f5b87a', '#c86f28', '#9ca3af', '#6b7280', '#d4956a', '#4a4f54', '#fde8d4'];

function getBucketColor(name, buckets) {
  const idx = buckets.indexOf(name);
  return BUCKET_COLORS[idx >= 0 ? idx % BUCKET_COLORS.length : 0];
}

const DT_TYPES = ['OPT', 'EE', 'ME', 'Plan', 'Uncontrol', 'STB', 'PM', 'Other'];

function distributeHourlyVolume(record) {
  const start = parseTime(record.startTime);
  const end = parseTime(record.endTime);
  if (start == null || end == null || end <= start) {
    const hour = start != null ? Math.floor(start / 60) : 8;
    return [{ hour, volume: record.volumeBCM }];
  }
  const totalMin = end - start;
  const hours = [];
  let cursor = start;
  while (cursor < end) {
    const hour = Math.floor(cursor / 60);
    const hourEnd = (hour + 1) * 60;
    const segEnd = Math.min(end, hourEnd);
    const segMin = segEnd - cursor;
    hours.push({ hour, fraction: segMin / totalMin });
    cursor = segEnd;
  }
  let allocated = 0;
  return hours.map((h, i) => {
    let vol;
    if (i === hours.length - 1) vol = record.volumeBCM - allocated;
    else {
      vol = Math.round(record.volumeBCM * h.fraction);
      allocated += vol;
    }
    return { hour: h.hour, volume: vol };
  });
}

function aggregateHourly(production) {
  const map = {};
  production.forEach(r => {
    distributeHourlyVolume(r).forEach(({ hour, volume }) => {
      if (!map[hour]) map[hour] = {};
      map[hour][r.bucketId] = (map[hour][r.bucketId] || 0) + volume;
    });
  });
  return map;
}

function getHourLabels() {
  const labels = [];
  for (let h = 8; h <= 23; h++) labels.push(`${String(h).padStart(2, '0')}:00`);
  for (let h = 0; h <= 7; h++) labels.push(`${String(h).padStart(2, '0')}:00`);
  return labels;
}

function hourLabelToNum(label) {
  return parseInt(label.split(':')[0], 10);
}

function calcWorkingHours(production) {
  let totalMin = 0;
  production.forEach(r => {
    const s = parseTime(r.startTime);
    const e = parseTime(r.endTime);
    if (s != null && e != null && e > s) totalMin += e - s;
  });
  return totalMin / 60;
}

function sumByBucket(production) {
  const map = {};
  production.forEach(r => {
    map[r.bucketId] = (map[r.bucketId] || 0) + (r.volumeBCM || 0);
  });
  return map;
}

function sumDowntimeByBucket(downtime) {
  const map = {};
  downtime.forEach(r => {
    const dur = calcDuration(r.startTime, r.endTime, r.ongoing);
    if (!map[r.bucketId]) map[r.bucketId] = { count: 0, minutes: 0 };
    map[r.bucketId].count++;
    map[r.bucketId].minutes += dur;
  });
  return map;
}

function sumDowntimeByType(downtime) {
  const map = {};
  downtime.forEach(r => {
    const dur = calcDuration(r.startTime, r.endTime, r.ongoing);
    if (!map[r.type]) map[r.type] = { count: 0, minutes: 0 };
    map[r.type].count++;
    map[r.type].minutes += dur;
  });
  return map;
}

function filterByShift(items, shift) {
  if (!shift || shift === 'all') return items;
  return items.filter(i => i.shift === shift);
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('th-TH');
}
