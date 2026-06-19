/* global Chart, API, DataStore, Auth, showToast, formatDateTH, toISODate, calcDuration, formatDuration, filterByShift,
   aggregateHourly, aggregateHourlyProductivity, getHourLabels, hourLabelToNum, calcWorkingHours, sumByBucket,
   sumDowntimeByBucket, sumDowntimeByType, getBucketColor, fmtNum, DT_TYPES */

let state = {
  date: toISODate(new Date()),
  shift: 'all',
  dtFilter: 'All',
  config: {},
  production: [],
  downtime: [],
  charts: { barByBucket: {}, lineByBucket: {} }
};

const REFRESH_SEC = 120;
let countdown = REFRESH_SEC;
let countdownTimer = null;

async function loadData() {
  try {
    if (typeof closeTargetEditor === 'function') closeTargetEditor();
    const data = await API.getByDate(state.date);
    state.production = data.production;
    state.downtime = data.downtime;
    state.config = data.config || {};
    renderAll();
    document.getElementById('footerTime').textContent = `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`;
  } catch (err) {
    console.error(err);
  }
}

function getFilteredProduction() {
  return filterByShift(state.production, state.shift);
}

function getFilteredDowntime() {
  let items = filterByShift(state.downtime, state.shift);
  if (state.dtFilter !== 'All') items = items.filter(d => d.type === state.dtFilter);
  return items;
}

function renderAll() {
  renderBarChart();
  renderLineChart();
  renderPieChart();
  renderRadarBuckets();
  renderRadarTypes();
  renderDowntimeTable();
  updateBadges();
  updateTargetDisplay();
}

function updateTargetDisplay() {
  const daily = state.config.dailyTarget || 5000;
  const hourly = state.config.hourlyTarget || 400;
  const dailyEl = document.getElementById('dailyTarget');
  const hourlyEl = document.getElementById('hourlyTargetView');
  const dateEl = document.getElementById('targetDateView');
  if (dailyEl) dailyEl.textContent = fmtNum(daily);
  if (hourlyEl) hourlyEl.textContent = fmtNum(hourly);
  if (dateEl) dateEl.textContent = formatDateTH(state.date);
}

function openTargetEditor() {
  if (!Auth.isAdmin()) return;
  document.getElementById('targetView').hidden = true;
  document.getElementById('targetEditor').hidden = false;
  const hint = document.getElementById('targetHint');
  if (hint) hint.hidden = true;
  document.getElementById('targetDateLabel').textContent = formatDateTH(state.date);
  document.getElementById('inputDailyTarget').value = state.config.dailyTarget || 5000;
  document.getElementById('inputHourlyTarget').value = state.config.hourlyTarget || 400;
  document.getElementById('inputDailyTarget').focus();
}

function closeTargetEditor() {
  document.getElementById('targetEditor').hidden = true;
  document.getElementById('targetView').hidden = false;
  const hint = document.getElementById('targetHint');
  if (hint && Auth.isAdmin()) hint.hidden = false;
}

async function saveTargetEditor() {
  const daily = parseFloat(document.getElementById('inputDailyTarget').value);
  const hourly = parseFloat(document.getElementById('inputHourlyTarget').value);
  if (!daily || daily <= 0) {
    showToast('กรุณากรอกเป้า BCM/วัน', true);
    return;
  }
  if (!hourly || hourly <= 0) {
    showToast('กรุณากรอกเป้า BCM/ชม.', true);
    return;
  }
  try {
    await DataStore.saveTargets(state.date, daily, hourly);
    state.config.dailyTarget = daily;
    state.config.hourlyTarget = hourly;
    closeTargetEditor();
    renderBarChart();
    renderPieChart();
    updateTargetDisplay();
    showToast('บันทึกเป้าหมายแล้ว ✓');
  } catch {
    showToast('บันทึกเป้าหมายไม่สำเร็จ', true);
  }
}

function setupTargetEditor() {
  const card = document.getElementById('targetCard');
  const btnEdit = document.getElementById('btnEditTarget');
  const hint = document.getElementById('targetHint');
  if (!Auth.isAdmin()) {
    btnEdit?.remove();
    hint?.remove();
    return;
  }
  card?.classList.add('target-panel--editable');
  if (hint) {
    hint.hidden = false;
    hint.textContent = 'คลิกเพื่อแก้ไข Target';
  }
  btnEdit?.addEventListener('click', (e) => { e.stopPropagation(); openTargetEditor(); });
  card?.addEventListener('click', () => {
    if (!document.getElementById('targetEditor').hidden) return;
    openTargetEditor();
  });
  document.getElementById('btnSaveTarget')?.addEventListener('click', (e) => {
    e.stopPropagation();
    saveTargetEditor();
  });
  document.getElementById('btnCancelTarget')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTargetEditor();
  });
  document.getElementById('targetEditor')?.addEventListener('click', (e) => e.stopPropagation());
}

function updateBadges() {
  const prod = getFilteredProduction();
  const dt = filterByShift(state.downtime, state.shift);
  const totalBCM = prod.reduce((s, r) => s + (r.volumeBCM || 0), 0);
  const workHrs = calcWorkingHours(prod);
  const productivity = workHrs > 0 ? Math.round(totalBCM / workHrs) : 0;

  document.getElementById('productivityBadge').textContent = productivity > 0 ? `${fmtNum(productivity)} BCM/Hr` : '—';
  document.getElementById('dtCount').textContent = `${dt.length} records`;
  const ongoing = dt.filter(d => d.ongoing).length;
  document.getElementById('dtOngoing').textContent = `${ongoing} Ongoing`;
}

function bucketChartId(bucket) {
  return 'barBucket_' + bucket.replace(/\s+/g, '_');
}

function getHourlyScaleDisparity(datasets) {
  const positives = datasets.flatMap(d => d.data).filter(v => v > 0);
  if (positives.length < 2) return 1;
  const maxV = Math.max(...positives);
  const minV = Math.min(...positives);
  return minV > 0 ? maxV / minV : maxV;
}

function bcmTooltipLabel(ctx) {
  const val = ctx.parsed.y;
  if (val == null || val <= 0) return null;
  return `${ctx.dataset.label}: ${fmtNum(val)} BCM`;
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawBarValueBadge(ctx, x, barTop, text, accentColor, chartArea) {
  const accent = accentColor || '#e8873a';
  const font = '600 10px "Chakra Petch", Arial, sans-serif';
  ctx.font = font;
  const padX = 7;
  const padY = 4;
  const textW = ctx.measureText(text).width;
  const badgeW = textW + padX * 2;
  const badgeH = 18;
  const left = x - badgeW / 2;
  let top = barTop - badgeH - 5;
  if (top < chartArea.top + 2) top = barTop + 6;

  ctx.save();
  roundRect(ctx, left, top + 1.5, badgeW, badgeH, 6);
  ctx.fillStyle = 'rgba(45, 50, 54, 0.1)';
  ctx.fill();

  roundRect(ctx, left, top, badgeW, badgeH, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  ctx.fillStyle = accent;
  roundRect(ctx, left + 1, top + 1, 3, badgeH - 2, 2);
  ctx.fill();

  ctx.fillStyle = '#2d3236';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font;
  ctx.fillText(text, x, top + badgeH / 2);
  ctx.restore();
}

const barValueLabelPlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx, data, chartArea } = chart;
    if (!chartArea) return;
    const yScale = chart.scales.y;
    const base = yScale.getPixelForValue(yScale.min ?? 0);
    ctx.save();
    data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      const barColor = ds.backgroundColor || '#e8873a';
      meta.data.forEach((bar, i) => {
        const val = ds.data[i];
        if (!val || val <= 0) return;
        const { x, y } = bar.getProps(['x', 'y'], true);
        const barTop = Math.min(y, base);
        drawBarValueBadge(ctx, x, barTop, fmtNum(val), barColor, chartArea);
      });
    });
    ctx.restore();
  }
};

function renderBarByBucketCharts(buckets, hourly, labels) {
  const wrap = document.getElementById('barByBucketWrap');
  const grid = document.getElementById('barByBucketGrid');
  if (!wrap || !grid) return;

  Object.values(state.charts.barByBucket || {}).forEach(c => c.destroy());
  state.charts.barByBucket = {};

  const activeBuckets = buckets.filter(b =>
    labels.some(l => {
      const h = hourLabelToNum(l);
      return (hourly[h] && hourly[h][b]) > 0;
    })
  );

  if (activeBuckets.length <= 1) {
    wrap.hidden = true;
    grid.innerHTML = '';
    return;
  }

  wrap.hidden = false;
  grid.innerHTML = activeBuckets.map(b => `
    <div class="bar-bucket-mini">
      <div class="bar-bucket-mini-head">
        <span class="legend-dot" style="background:${getBucketColor(b, buckets)}"></span>${b}
      </div>
      <div class="bar-bucket-mini-wrap"><canvas id="${bucketChartId(b)}"></canvas></div>
    </div>
  `).join('');

  activeBuckets.forEach(b => {
    const ctx = document.getElementById(bucketChartId(b));
    if (!ctx) return;
    const data = labels.map(l => {
      const h = hourLabelToNum(l);
      return (hourly[h] && hourly[h][b]) || 0;
    });
    state.charts.barByBucket[b] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: b,
          data,
          backgroundColor: getBucketColor(b, buckets),
          borderRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22 } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: bcmTooltipLabel } }
        },
        scales: {
          x: { ticks: { font: { size: 8 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } },
          y: { beginAtZero: true, title: { display: true, text: 'BCM', font: { size: 9 } } }
        }
      },
      plugins: [barValueLabelPlugin]
    });
  });
}

function renderBarChart() {
  const prod = getFilteredProduction();
  const buckets = state.config.buckets || [...new Set(prod.map(p => p.bucketId))];
  const hourly = aggregateHourly(prod);
  const labels = getHourLabels();
  const target = state.config.hourlyTarget || 400;

  const datasets = buckets.map(b => ({
    label: b,
    data: labels.map(l => {
      const h = hourLabelToNum(l);
      return (hourly[h] && hourly[h][b]) || 0;
    }),
    backgroundColor: getBucketColor(b, buckets),
    borderRadius: 2
  }));

  const disparity = getHourlyScaleDisparity(datasets);
  const useLog = disparity >= 20;

  if (useLog) {
    datasets.forEach(ds => {
      ds.data = ds.data.map(v => (v > 0 ? v : null));
    });
  }

  const ctx = document.getElementById('barChart');
  if (state.charts.bar) state.charts.bar.destroy();

  state.charts.bar = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: { label: bcmTooltipLabel }
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 9 }, maxRotation: 45 },
          categoryPercentage: 0.82,
          barPercentage: 0.9
        },
        y: {
          beginAtZero: !useLog,
          type: useLog ? 'logarithmic' : 'linear',
          min: useLog ? 1 : undefined,
          title: { display: true, text: useLog ? 'BCM (log)' : 'BCM' }
        }
      }
    },
    plugins: [{
      id: 'targetLine',
      afterDraw(chart) {
        const { ctx: c, chartArea, scales } = chart;
        if (!chartArea || target <= 0) return;
        const y = scales.y.getPixelForValue(target);
        if (y < chartArea.top || y > chartArea.bottom) return;
        c.save();
        c.strokeStyle = '#e8873a';
        c.setLineDash([6, 4]);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(chartArea.left, y);
        c.lineTo(chartArea.right, y);
        c.stroke();
        c.fillStyle = '#e8873a';
        c.font = 'bold 10px Chakra Petch';
        c.fillText(`Target ${fmtNum(target)} BCM/Hr`, chartArea.right - 120, y - 4);
        c.restore();
      }
    }, barValueLabelPlugin]
  });

  renderBarByBucketCharts(buckets, hourly, labels);

  const legend = document.getElementById('barLegend');
  legend.innerHTML = buckets.map(b =>
    `<span class="legend-item"><span class="legend-dot" style="background:${getBucketColor(b, buckets)}"></span>${b}</span>`
  ).join('');
}

function lineBucketChartId(bucket) {
  return 'lineBucket_' + bucket.replace(/\s+/g, '_');
}

function productivityTooltipLabel(ctx) {
  const v = ctx.parsed.y;
  if (v == null) return `${ctx.dataset.label}: — (ไม่มี SMU)`;
  return `${ctx.dataset.label}: ${fmtNum(v)} BCM/SMU`;
}

function renderLineByBucketCharts(buckets, hourlyProd, labels) {
  const wrap = document.getElementById('lineByBucketWrap');
  const grid = document.getElementById('lineByBucketGrid');
  if (!wrap || !grid) return;

  Object.values(state.charts.lineByBucket || {}).forEach(c => c.destroy());
  state.charts.lineByBucket = {};

  const activeBuckets = buckets.filter(b =>
    labels.some(l => {
      const h = hourLabelToNum(l);
      const rate = hourlyProd[h]?.[b];
      return rate != null && rate > 0;
    })
  );

  if (activeBuckets.length <= 1) {
    wrap.hidden = true;
    grid.innerHTML = '';
    return;
  }

  wrap.hidden = false;
  grid.innerHTML = activeBuckets.map(b => `
    <div class="bar-bucket-mini">
      <div class="bar-bucket-mini-head">
        <span class="legend-dot" style="background:${getBucketColor(b, buckets)}"></span>${b}
      </div>
      <div class="bar-bucket-mini-wrap"><canvas id="${lineBucketChartId(b)}"></canvas></div>
    </div>
  `).join('');

  activeBuckets.forEach(b => {
    const ctx = document.getElementById(lineBucketChartId(b));
    if (!ctx) return;
    const color = getBucketColor(b, buckets);
    const data = labels.map(l => {
      const h = hourLabelToNum(l);
      const rate = hourlyProd[h]?.[b];
      return rate != null && rate > 0 ? rate : null;
    });
    state.charts.lineByBucket[b] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: b,
          data,
          borderColor: color,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          spanGaps: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: productivityTooltipLabel } }
        },
        scales: {
          x: { ticks: { font: { size: 8 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } },
          y: { beginAtZero: true, title: { display: true, text: 'BCM/SMU', font: { size: 9 } } }
        }
      }
    });
  });
}

function renderLineChart() {
  const prod = getFilteredProduction();
  const buckets = state.config.buckets || [...new Set(prod.map(p => p.bucketId))];
  const hourlyProd = aggregateHourlyProductivity(prod);
  const labels = getHourLabels();

  const datasets = buckets.map(b => ({
    label: b,
    data: labels.map(l => {
      const h = hourLabelToNum(l);
      const rate = hourlyProd[h]?.[b];
      return rate != null && rate > 0 ? rate : null;
    }),
    borderColor: getBucketColor(b, buckets),
    backgroundColor: 'transparent',
    fill: false,
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5,
    spanGaps: false
  }));

  const ctx = document.getElementById('lineChart');
  if (state.charts.line) state.charts.line.destroy();

  state.charts.line = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: { label: productivityTooltipLabel }
        }
      },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'BCM/SMU', font: { size: 10 } }
        }
      }
    }
  });

  const legend = document.getElementById('lineLegend');
  if (legend) {
    legend.innerHTML = buckets.map(b =>
      `<span class="legend-item"><span class="legend-dot" style="background:${getBucketColor(b, buckets)}"></span>${b}</span>`
    ).join('');
  }

  renderLineByBucketCharts(buckets, hourlyProd, labels);
}

function renderPieChart() {
  const prod = getFilteredProduction();
  const byBucket = sumByBucket(prod);
  const buckets = Object.keys(byBucket);
  const values = buckets.map(b => byBucket[b]);
  const total = values.reduce((s, v) => s + v, 0);
  const workHrs = calcWorkingHours(prod);
  const productivity = workHrs > 0 ? Math.round(total / workHrs) : 0;
  const target = state.config.dailyTarget || 5000;

  document.getElementById('totalProduction').textContent = total > 0 ? `${fmtNum(total)} BCM` : '—';
  document.getElementById('workingHours').textContent = workHrs > 0 ? `${workHrs.toFixed(1)} Hr.` : '—';
  document.getElementById('productivityTotal').textContent = productivity > 0 ? `${fmtNum(productivity)} BCM/Hr` : '—';

  const legendEl = document.getElementById('pieLegend');
  legendEl.innerHTML = buckets.map((b, i) =>
    `<div class="pie-legend-item"><span class="pie-legend-left"><span class="pie-legend-dot" style="background:${getBucketColor(b, state.config.buckets || buckets)}"></span>${b}</span><span>${fmtNum(byBucket[b])} BCM</span></div>`
  ).join('') || '<div class="dt-empty">ไม่มีข้อมูล</div>';

  const ctx = document.getElementById('pieChart');
  if (state.charts.pie) state.charts.pie.destroy();
  if (buckets.length === 0) return;

  state.charts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: buckets,
      datasets: [{
        data: values,
        backgroundColor: buckets.map(b => getBucketColor(b, state.config.buckets || buckets)),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: { legend: { display: false } }
    }
  });

  renderDonut(total, target);
}

function renderDonut(actual, target) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const gap = target - actual;

  document.getElementById('donutPct').textContent = `${pct.toFixed(1)}%`;
  document.getElementById('donutActual').textContent = `${fmtNum(actual)} BCM`;
  document.getElementById('donutTarget').textContent = `${fmtNum(target)} BCM`;
  const gapEl = document.getElementById('donutGap');
  gapEl.textContent = gap > 0 ? `${fmtNum(gap)} BCM BELOW TARGET` : `${fmtNum(Math.abs(gap))} BCM ABOVE TARGET`;
  gapEl.className = 'donut-stat-val ' + (gap > 0 ? 'red' : 'green');

  const ctx = document.getElementById('donutChart');
  if (state.charts.donut) state.charts.donut.destroy();

  state.charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, Math.max(0, 100 - pct)],
        backgroundColor: ['#e8873a', '#e8eaed'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function renderRadarBuckets() {
  const dt = filterByShift(state.downtime, state.shift);
  const byBucket = sumDowntimeByBucket(dt);
  const buckets = Object.keys(byBucket);
  const totalEvents = dt.length;
  const totalMin = dt.reduce((s, r) => s + calcDuration(r.startTime, r.endTime, r.ongoing), 0);

  document.getElementById('radarBucketTotal').textContent = `Total: ${totalEvents} events`;
  document.getElementById('radarBucketDur').textContent = `⏱ ${formatDuration(totalMin)} รวม Downtime`;

  const legend = document.getElementById('radarBucketLegend');
  legend.innerHTML = buckets.map(b =>
    `<div class="radar-legend-item"><span class="radar-legend-left"><span class="radar-legend-dot" style="background:${getBucketColor(b, state.config.buckets || buckets)}"></span><span>${b}</span></span><span>${byBucket[b].count}</span><span class="radar-legend-dur">${formatDuration(byBucket[b].minutes)}</span></div>`
  ).join('') || '<div class="dt-empty">ไม่มี Downtime</div>';

  const ctx = document.getElementById('radarBucketChart');
  if (state.charts.radarBucket) state.charts.radarBucket.destroy();
  if (buckets.length === 0) return;

  state.charts.radarBucket = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: buckets,
      datasets: [{
        label: 'Downtime (min)',
        data: buckets.map(b => byBucket[b].minutes),
        backgroundColor: 'rgba(232, 135, 58, 0.2)',
        borderColor: '#e8873a',
        pointBackgroundColor: '#c86f28'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { r: { beginAtZero: true, ticks: { display: false } } }
    }
  });
}

function renderRadarTypes() {
  const dt = filterByShift(state.downtime, state.shift);
  const byType = sumDowntimeByType(dt);
  const types = Object.keys(byType);
  const totalMin = dt.reduce((s, r) => s + calcDuration(r.startTime, r.endTime, r.ongoing), 0);

  document.getElementById('radarTypeTotal').textContent = `Total: ${dt.length} events`;
  document.getElementById('radarTypeDur').textContent = `⏱ ${formatDuration(totalMin)} รวม Downtime`;

  const legend = document.getElementById('radarTypeLegend');
  legend.innerHTML = types.map(t =>
    `<div class="radar-legend-item"><span class="radar-legend-left"><span>${t}</span></span><span>${byType[t].count}</span><span class="radar-legend-dur">${formatDuration(byType[t].minutes)}</span></div>`
  ).join('') || '<div class="dt-empty">ไม่มี Downtime</div>';

  const ctx = document.getElementById('radarTypeChart');
  if (state.charts.radarType) state.charts.radarType.destroy();
  if (types.length === 0) return;

  state.charts.radarType = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: types,
      datasets: [{
        label: 'Downtime (min)',
        data: types.map(t => byType[t].minutes),
        backgroundColor: 'rgba(107, 114, 128, 0.2)',
        borderColor: '#6b7280',
        pointBackgroundColor: '#4a4f54'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { r: { beginAtZero: true, ticks: { display: false } } }
    }
  });
}

function renderDowntimeTable() {
  const dt = getFilteredDowntime();
  const tbody = document.getElementById('dtTableBody');
  if (dt.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="dt-empty">ไม่มีข้อมูล Downtime สำหรับวันที่เลือก</td></tr>';
    return;
  }

  tbody.innerHTML = dt.map(r => {
    const shiftBadge = r.shift === 'night'
      ? '<span class="shift-badge shift-badge-n">🌙 Night</span>'
      : '<span class="shift-badge shift-badge-d">☀️ Day</span>';
    const endCell = r.ongoing
      ? '<span class="end-unknown" title="กำลังดำเนินการ">?</span>'
      : `<span class="time-cell">${r.endTime || '—'}</span>`;
    const dur = calcDuration(r.startTime, r.endTime, r.ongoing);
    const rowClass = r.ongoing ? 'row-no-end' : '';
    return `<tr class="${rowClass}">
      <td class="machine-cell">${r.bucketId}</td>
      <td>${shiftBadge}</td>
      <td class="time-cell">${r.startTime}</td>
      <td>${endCell}</td>
      <td class="desc-cell">${r.description || '—'}</td>
      <td><span class="type-badge type-${r.type}">${r.type}</span></td>
      <td class="dur-cell">${formatDuration(dur)}</td>
    </tr>`;
  }).join('');
}

function setupShiftButtons() {
  document.querySelectorAll('.btn-shift').forEach(btn => {
    btn.addEventListener('click', () => {
      state.shift = btn.dataset.shift;
      document.querySelectorAll('.btn-shift').forEach(b => {
        b.classList.remove('active-all', 'active-day', 'active-night');
      });
      if (state.shift === 'all') btn.classList.add('active-all');
      else if (state.shift === 'day') btn.classList.add('active-day');
      else btn.classList.add('active-night');
      renderAll();
    });
  });
}

function setupDtFilters() {
  document.querySelectorAll('.dt-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.dtFilter = btn.dataset.filter;
      document.querySelectorAll('.dt-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDowntimeTable();
    });
  });
}

function setupDateNav() {
  const input = document.getElementById('dateInput');
  input.value = state.date;
  input.addEventListener('change', () => {
    state.date = input.value;
    loadData();
  });
  document.getElementById('btnPrevDate').addEventListener('click', () => {
    const d = new Date(state.date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    state.date = toISODate(d);
    input.value = state.date;
    loadData();
  });
  document.getElementById('btnNextDate').addEventListener('click', () => {
    const d = new Date(state.date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    state.date = toISODate(d);
    input.value = state.date;
    loadData();
  });
  document.getElementById('btnRefresh').addEventListener('click', () => {
    countdown = REFRESH_SEC;
    loadData();
  });
}

function startAutoRefresh() {
  countdownTimer = setInterval(() => {
    countdown--;
    document.getElementById('countdown').textContent = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;
    if (countdown <= 0) {
      countdown = REFRESH_SEC;
      loadData();
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', async () => {
  await window.authReady;
  document.getElementById('btnLogout')?.addEventListener('click', () => Auth.logout());
  if (!Auth.isAdmin()) {
    document.querySelector('a[href="form.html"]')?.remove();
  } else {
    setupTargetEditor();
  }
  await DataStore.init();
  setupShiftButtons();
  setupDtFilters();
  setupDateNav();
  await loadData();
  DataStore.subscribeRealtime();
  DataStore.onChange(() => loadData());
  startAutoRefresh();
  document.getElementById('footerTime').textContent = `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`;
});
