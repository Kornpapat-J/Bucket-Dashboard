function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getDataUrl() {
  return new URL('data/records.json', window.location.href).href;
}

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

function parseRecordHourNo(note) {
  if (!note) return null;
  try {
    const meta = JSON.parse(note);
    const h = parseInt(meta.hourNo, 10);
    return h >= 1 && h <= 24 ? h : null;
  } catch {
    return null;
  }
}

function getRecordHourSegments(record) {
  const start = parseTime(record.startTime);
  const end = parseTime(record.endTime);

  if (start != null && end != null && end > start) {
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
    return hours;
  }

  if (start != null) {
    return [{ hour: Math.floor(start / 60), fraction: 1 }];
  }

  return [];
}

function getRecordSmuTotal(record) {
  let meta = null;
  try {
    meta = record.note ? JSON.parse(record.note) : null;
  } catch { /* ignore */ }

  if (meta?.smuTotal > 0) return meta.smuTotal;

  const smuStart = parseFloat(meta?.smuStart);
  const smuEnd = parseFloat(meta?.smuEnd);
  if (!isNaN(smuStart) && !isNaN(smuEnd) && smuEnd > smuStart) {
    return Math.round((smuEnd - smuStart) * 100) / 100;
  }

  if (meta?.productionRate > 0 && record.volumeBCM > 0) {
    return Math.round((record.volumeBCM / meta.productionRate) * 100) / 100;
  }

  const start = parseTime(record.startTime);
  const end = parseTime(record.endTime);
  if (start != null && end != null && end > start) {
    return Math.round(((end - start) / 60) * 100) / 100;
  }

  return 0;
}

function distributeHourlyVolume(record) {
  const segments = getRecordHourSegments(record);
  let allocated = 0;
  return segments.map((seg, i) => {
    let vol;
    if (i === segments.length - 1) vol = record.volumeBCM - allocated;
    else {
      vol = Math.round(record.volumeBCM * seg.fraction);
      allocated += vol;
    }
    return { hour: seg.hour, volume: vol };
  });
}

function distributeHourlyMetrics(record) {
  const bcm = record.volumeBCM || 0;
  const smuTotal = getRecordSmuTotal(record);
  const segments = getRecordHourSegments(record);
  let allocatedBcm = 0;
  let allocatedSmu = 0;
  return segments.map((seg, i) => {
    let segBcm;
    let segSmu;
    if (i === segments.length - 1) {
      segBcm = bcm - allocatedBcm;
      segSmu = Math.round((smuTotal - allocatedSmu) * 100) / 100;
    } else {
      segBcm = Math.round(bcm * seg.fraction);
      segSmu = Math.round(smuTotal * seg.fraction * 100) / 100;
      allocatedBcm += segBcm;
      allocatedSmu += segSmu;
    }
    return { hour: seg.hour, bcm: segBcm, smu: segSmu };
  });
}

function aggregateHourlyProductivity(production) {
  const map = {};
  production.forEach(r => {
    distributeHourlyMetrics(r).forEach(({ hour, bcm, smu }) => {
      if (!map[hour]) map[hour] = {};
      if (!map[hour][r.bucketId]) map[hour][r.bucketId] = { bcm: 0, smu: 0 };
      map[hour][r.bucketId].bcm += bcm;
      map[hour][r.bucketId].smu += smu;
    });
  });
  const rates = {};
  Object.entries(map).forEach(([hour, buckets]) => {
    rates[hour] = {};
    Object.entries(buckets).forEach(([bucket, { bcm, smu }]) => {
      if (smu > 0) rates[hour][bucket] = Math.round((bcm / smu) * 100) / 100;
    });
  });
  return rates;
}

function parseRecordCutType(note) {
  if (!note) return null;
  try {
    const meta = JSON.parse(note);
    return meta?.cutType === 'highCut' || meta?.cutType === 'dropCut' ? meta.cutType : null;
  } catch {
    return null;
  }
}

function sumProductionByCutType(production) {
  const totals = { highCut: 0, dropCut: 0 };
  production.forEach(r => {
    const cut = parseRecordCutType(r.note);
    const vol = r.volumeBCM || 0;
    if (cut === 'highCut') totals.highCut += vol;
    else if (cut === 'dropCut') totals.dropCut += vol;
  });
  return totals;
}

function getCutTargets(config = {}) {
  const high = Number(config.highCutTarget);
  const drop = Number(config.dropCutTarget);
  if (high > 0 || drop > 0) {
    return {
      highCutTarget: high > 0 ? high : 0,
      dropCutTarget: drop > 0 ? drop : 0
    };
  }
  const daily = Number(config.dailyTarget) || 5000;
  const half = Math.round(daily / 2);
  return { highCutTarget: half, dropCutTarget: daily - half };
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

function getShiftStartHour(shift) {
  return shift === 'night' ? 20 : 8;
}

function getHourLabels(shift) {
  const startHour = getShiftStartHour(shift === 'night' ? 'night' : 'day');
  const labels = [];
  for (let i = 0; i < 24; i++) {
    const h = (startHour + i) % 24;
    labels.push(`${String(h).padStart(2, '0')}:00`);
  }
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
