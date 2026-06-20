/* global API, DataStore, showToast, formatDuration, calcDuration, toISODate, fmtNum, formatDateTH, parseTime, getShiftStartHour */

const BUCKETS = ['Bucket 1', 'Bucket 2'];
const LEVELS = ['b1', 'b2', 'b3'];
const PLAN_DOWNTIME_DESC = 'หยุดตรวจเช็คเครื่องจักรประจำวัน';

let config = { buckets: BUCKETS };
let activeTab = 'production';
let editingProductionId = null;
let editingDowntimeId = null;
let recentBucketFilter = 'all';
let recentDateFilter = toISODate(new Date());
let cachedData = { production: [], downtime: [] };

async function init() {
  try {
    await DataStore.init();
    updateModeNotice();
    const data = await API.getData();
    config = data.config || {};
    cachedData = data;
    document.getElementById('prodDate').value = toISODate(new Date());
    document.getElementById('dtDate').value = toISODate(new Date());
    recentDateFilter = toISODate(new Date());
    const recentDateInput = document.getElementById('recentDateFilter');
    if (recentDateInput) recentDateInput.value = recentDateFilter;
    loadRecentRecords(data);
    updateLocalCount();
    updateCalculations();
  } catch (err) {
    showToast('ไม่สามารถโหลดข้อมูลได้', true);
  }
}

function updateModeNotice() {
  const notice = document.getElementById('githubNotice');
  if (!notice) return;

  if (DataStore.isCloud()) {
    notice.style.display = 'none';
    return;
  }

  notice.style.display = '';
  notice.className = 'github-notice';
  notice.innerHTML = `
    <strong>📌 โหมดทดสอบ (ยังไม่มี Database)</strong>
    <p>ข้อมูลจากฟอร์มเก็บในเครื่องนี้เท่านั้น — คนอื่นยังไม่เห็น</p>
    <p>ตั้งค่า Supabase ตาม <code>docs/SUPABASE-SETUP.md</code> เพื่อให้ทุกเครื่องเห็นข้อมูลร่วมกันอัตโนมัติ</p>
    <details class="upload-steps">
      <summary>📖 วิธีอัปโหลด JSON ชั่วคราว (คลิกเปิด)</summary>
      <ol>
        <li>กรอกฟอร์ม → กดบันทึก</li>
        <li>กดดาวน์โหลด records.json</li>
        <li>อัปโหลดแทนที่ docs/data/records.json บน GitHub</li>
      </ol>
    </details>
    <div class="form-actions" style="margin-top:8px">
      <button type="button" class="btn-primary" id="btnExportJson">⬇️ ดาวน์โหลด records.json</button>
      <button type="button" class="btn-secondary" id="btnClearLocal">🗑️ ล้างข้อมูลชั่วคราวในเครื่อง</button>
    </div>
    <p class="local-count" id="localCount"></p>`;

  document.getElementById('btnExportJson')?.addEventListener('click', exportJson);
  document.getElementById('btnClearLocal')?.addEventListener('click', clearLocalData);
}

function updateLocalCount() {
  const el = document.getElementById('localCount');
  if (!el || DataStore.isCloud()) return;
  const count = DataStore.getLocalCount();
  el.textContent = count > 0
    ? `มีข้อมูลชั่วคราว ${count} รายการ (ยังไม่ได้อัปโหลด GitHub)`
    : 'ยังไม่มีข้อมูลชั่วคราว — ข้อมูลแสดงจาก records.json บน GitHub';
}

function populateBucketSelects() {
  /* buckets hardcoded in HTML — Bucket 1 & 2 only */
}

function calcLevelProd(w, l, h) {
  const prod = (parseFloat(w) || 0) * (parseFloat(l) || 0) * (parseFloat(h) || 0);
  return Math.round(prod * 100) / 100;
}

function getLevelDims(level) {
  const form = document.getElementById('formProduction');
  return {
    width: parseFloat(form[`${level}Width`]?.value) || 0,
    length: parseFloat(form[`${level}Length`]?.value) || 0,
    height: parseFloat(form[`${level}Height`]?.value) || 0
  };
}

function fillTime24Select(select, max) {
  select.innerHTML = '<option value="">--</option>';
  for (let i = 0; i <= max; i++) {
    const v = String(i).padStart(2, '0');
    select.add(new Option(v, v));
  }
}

function syncTime24Picker(picker) {
  const hourSel = picker.querySelector('.time-24h-hour');
  const minSel = picker.querySelector('.time-24h-min');
  const hidden = picker.querySelector('input[type="hidden"]');
  if (!hourSel || !minSel || !hidden) return;
  hidden.value = (hourSel.value && minSel.value) ? `${hourSel.value}:${minSel.value}` : '';
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
  hidden.dispatchEvent(new Event('input', { bubbles: true }));
}

function setTime24Value(inputId, time) {
  const hidden = document.getElementById(inputId);
  if (!hidden) return;
  const picker = hidden.closest('.time-24h-picker');
  if (!picker) {
    hidden.value = time || '';
    return;
  }
  const hourSel = picker.querySelector('.time-24h-hour');
  const minSel = picker.querySelector('.time-24h-min');
  if (!time) {
    hourSel.value = '';
    minSel.value = '';
  } else {
    const [h, m] = time.split(':');
    const hi = parseInt(h, 10);
    const mi = parseInt(m || 0, 10);
    if (isNaN(hi) || isNaN(mi) || hi < 0 || hi > 23 || mi < 0 || mi > 59) {
      hourSel.value = '';
      minSel.value = '';
    } else {
      hourSel.value = String(hi).padStart(2, '0');
      minSel.value = String(mi).padStart(2, '0');
    }
  }
  syncTime24Picker(picker);
}

function setTime24Disabled(inputId, disabled) {
  const hidden = document.getElementById(inputId);
  const picker = hidden?.closest('.time-24h-picker');
  if (!picker) return;
  picker.classList.toggle('is-disabled', disabled);
  picker.querySelectorAll('select').forEach(s => { s.disabled = disabled; });
  if (disabled) setTime24Value(inputId, '');
}

function setupTime24Pickers() {
  document.querySelectorAll('.time-24h-picker').forEach(picker => {
    const hourSel = picker.querySelector('.time-24h-hour');
    const minSel = picker.querySelector('.time-24h-min');
    if (!hourSel || !minSel || hourSel.options.length > 1) return;
    fillTime24Select(hourSel, 23);
    fillTime24Select(minSel, 59);
    const onChange = () => syncTime24Picker(picker);
    hourSel.addEventListener('change', onChange);
    minSel.addEventListener('change', onChange);
  });

  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('reset', () => {
      setTimeout(() => {
        form.querySelectorAll('.time-24h-picker input[type="hidden"]').forEach(hidden => {
          setTime24Value(hidden.id, hidden.value);
        });
      }, 0);
    });
  });
}

function hourNoFromStartTime(startTime, shift) {
  const startMin = parseTime(startTime);
  if (startMin == null) return null;
  const baseHour = getShiftStartHour(shift);
  let slot = Math.floor(startMin / 60) - baseHour + 1;
  if (slot < 1) slot += 24;
  return Math.min(24, Math.max(1, slot));
}

function syncHourNoFromTime() {
  const form = document.getElementById('formProduction');
  const hourEl = document.getElementById('prodHour');
  if (!form || !hourEl) return;
  const val = hourNoFromStartTime(form.startTime.value, form.shift.value);
  hourEl.value = val != null ? String(val) : '';
}

function updateCalculations() {
  let totalProduct = 0;

  LEVELS.forEach(level => {
    const dims = getLevelDims(level);
    const prod = calcLevelProd(dims.width, dims.length, dims.height);
    const el = document.getElementById(`${level}Prod`);
    if (el) el.value = prod > 0 ? fmtNum(prod) : '';
    totalProduct += prod;
  });

  const smuStart = parseFloat(document.getElementById('smuStart')?.value) || 0;
  const smuEnd = parseFloat(document.getElementById('smuEnd')?.value) || 0;
  const smuTotal = smuEnd > smuStart ? Math.round((smuEnd - smuStart) * 100) / 100 : 0;
  const rate = smuTotal > 0 ? Math.round((totalProduct / smuTotal) * 100) / 100 : 0;

  const setDisplay = (id, val, hiddenId) => {
    const display = document.getElementById(id);
    const hidden = document.getElementById(hiddenId);
    const text = val > 0 ? fmtNum(val) : '—';
    if (display) display.textContent = text;
    if (hidden) hidden.value = val > 0 ? String(val) : '';
  };

  setDisplay('prodTotalBCMDisplay', totalProduct, 'prodTotalBCM');
  setDisplay('smuTotalDisplay', smuTotal, 'smuTotal');
  setDisplay('prodRateDisplay', rate, 'prodRate');
}

function setupProductionCalc() {
  const onProdInput = () => {
    updateCalculations();
    syncHourNoFromTime();
  };
  document.querySelectorAll('.perf-dim, #smuStart, #smuEnd, #prodStart, #prodShift').forEach(el => {
    el.addEventListener('input', onProdInput);
    el.addEventListener('change', onProdInput);
  });
  document.getElementById('formProduction')?.addEventListener('reset', () => {
    setTimeout(() => {
      updateCalculations();
      syncHourNoFromTime();
    }, 0);
  });
}

function parsePerfNote(note) {
  if (!note) return null;
  try { return JSON.parse(note); } catch { return null; }
}

function buildPerfNote(form) {
  const levels = {};
  LEVELS.forEach(level => {
    const dims = getLevelDims(level);
    levels[level] = { ...dims, production: calcLevelProd(dims.width, dims.length, dims.height) };
  });

  const smuStart = parseFloat(form.smuStart.value) || 0;
  const smuEnd = parseFloat(form.smuEnd.value) || 0;
  const smuTotal = smuEnd > smuStart ? Math.round((smuEnd - smuStart) * 100) / 100 : 0;
  const totalProduct = LEVELS.reduce((sum, lv) => sum + levels[lv].production, 0);
  const productionRate = smuTotal > 0 ? Math.round((totalProduct / smuTotal) * 100) / 100 : 0;

  return JSON.stringify({
    hourNo: hourNoFromStartTime(form.startTime.value, form.shift.value)
      ?? (parseInt(form.hourNo.value, 10) || null),
    levels,
    smuStart,
    smuEnd,
    smuTotal,
    productionRate
  });
}

function setupTabs() {
  document.querySelectorAll('.form-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panelProduction').style.display = activeTab === 'production' ? 'block' : 'none';
      document.getElementById('panelDowntime').style.display = activeTab === 'downtime' ? 'block' : 'none';
    });
  });
}

function setupOngoingToggle() {
  const chk = document.getElementById('dtOngoing');
  chk.addEventListener('change', () => {
    setTime24Disabled('dtEndTime', chk.checked);
  });
}

function applyDowntimeTypeDefault() {
  const typeEl = document.getElementById('dtType');
  const descEl = document.getElementById('dtDesc');
  if (!typeEl || !descEl) return;
  if (typeEl.value === 'Plan') {
    descEl.value = PLAN_DOWNTIME_DESC;
  } else if (descEl.value === PLAN_DOWNTIME_DESC) {
    descEl.value = '';
  }
}

function setupDowntimeTypeDefault() {
  document.getElementById('dtType')?.addEventListener('change', applyDowntimeTypeDefault);
}

async function submitProduction(e) {
  e.preventDefault();
  const form = e.target;
  updateCalculations();

  const totalProduct = LEVELS.reduce((sum, lv) => {
    const dims = getLevelDims(lv);
    return sum + calcLevelProd(dims.width, dims.length, dims.height);
  }, 0);

  const data = {
    date: form.date.value,
    shift: form.shift.value,
    bucketId: form.querySelector('input[name="bucketId"]:checked')?.value || 'Bucket 1',
    operatorName: form.operatorName.value.trim(),
    startTime: form.startTime.value,
    endTime: form.endTime.value,
    volumeBCM: totalProduct,
    location: form.recordedBy.value.trim(),
    note: buildPerfNote(form)
  };

  if (!data.operatorName || !data.location) {
    showToast('กรุณากรอก Operator และผู้บันทึก', true);
    return;
  }
  if (totalProduct <= 0) {
    showToast('กรุณากรอกขนาด B1/B2/B3 อย่างน้อย 1 ช่อง', true);
    return;
  }
  if (!form.startTime.value || !form.endTime.value) {
    showToast('กรุณากรอกเวลาเริ่มและเวลาจบ', true);
    return;
  }

  syncHourNoFromTime();

  try {
    if (editingProductionId) {
      await API.updateProduction(editingProductionId, data);
      showToast('แก้ไขข้อมูลสำเร็จ ✓');
      clearProductionEdit();
    } else {
      await API.addProduction(data);
      showToast('บันทึกสำเร็จ ✓');
    }
    LEVELS.forEach(lv => {
      form[`${lv}Width`].value = '';
      form[`${lv}Length`].value = '';
      form[`${lv}Height`].value = '';
    });
    form.smuStart.value = '';
    form.smuEnd.value = '';
    form.hourNo.value = '';
    updateCalculations();
    const allData = await API.getData();
    cachedData = allData;
    loadRecentRecords(allData);
    updateLocalCount();
  } catch {
    showToast(editingProductionId ? 'แก้ไขไม่สำเร็จ' : 'บันทึกไม่สำเร็จ กรุณาลองใหม่', true);
  }
}

async function submitDowntime(e) {
  e.preventDefault();
  const form = e.target;
  const ongoing = form.ongoing.checked;
  const data = {
    date: form.date.value,
    shift: form.shift.value,
    bucketId: form.bucketId.value,
    startTime: form.startTime.value,
    endTime: ongoing ? '' : form.endTime.value,
    type: form.type.value,
    description: form.description.value.trim(),
    ongoing
  };

  if (!data.description) {
    showToast('กรุณากรอกรายละเอียด Downtime', true);
    return;
  }

  try {
    if (editingDowntimeId) {
      await API.updateDowntime(editingDowntimeId, data);
      showToast('แก้ไข Downtime สำเร็จ ✓');
      clearDowntimeEdit();
    } else {
      await API.addDowntime(data);
      showToast('บันทึก Downtime สำเร็จ ✓');
    }
    form.description.value = '';
    form.ongoing.checked = false;
    setTime24Disabled('dtEndTime', false);
    const allData = await API.getData();
    cachedData = allData;
    loadRecentRecords(allData);
    updateLocalCount();
  } catch {
    showToast(editingDowntimeId ? 'แก้ไขไม่สำเร็จ' : 'บันทึกไม่สำเร็จ กรุณาลองใหม่', true);
  }
}

async function exportJson() {
  try {
    const json = await DataStore.exportMergedJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'records.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลด records.json แล้ว — อัปโหลดแทนที่ docs/data/records.json บน GitHub');
  } catch {
    showToast('ดาวน์โหลดไม่สำเร็จ', true);
  }
}

function clearLocalData() {
  if (!confirm('ลบข้อมูลชั่วคราวในเบราว์เซอร์? (ข้อมูลใน records.json บน GitHub ไม่หาย)')) return;
  DataStore.clearLocal();
  updateLocalCount();
  init();
  showToast('ล้างข้อมูลชั่วคราวแล้ว');
}

function setProductionEditMode(editing) {
  const btn = document.getElementById('btnProdSubmit');
  const cancel = document.getElementById('btnProdCancelEdit');
  if (btn) btn.textContent = editing ? '💾 บันทึกการแก้ไข' : '💾 บันทึกข้อมูล';
  if (cancel) cancel.hidden = !editing;
}

function setDowntimeEditMode(editing) {
  const btn = document.getElementById('btnDtSubmit');
  const cancel = document.getElementById('btnDtCancelEdit');
  if (btn) btn.textContent = editing ? '💾 บันทึกการแก้ไข' : '💾 บันทึก Downtime';
  if (cancel) cancel.hidden = !editing;
}

function clearProductionEdit() {
  editingProductionId = null;
  setProductionEditMode(false);
}

function clearDowntimeEdit() {
  editingDowntimeId = null;
  setDowntimeEditMode(false);
}

function fillProductionForm(record) {
  const form = document.getElementById('formProduction');
  const meta = parsePerfNote(record.note);
  form.date.value = record.date;
  form.shift.value = record.shift;
  const bucketRadio = form.querySelector(`input[name="bucketId"][value="${CSS.escape(record.bucketId)}"]`);
  if (bucketRadio) bucketRadio.checked = true;
  form.hourNo.value = meta?.hourNo ?? '';
  LEVELS.forEach(lv => {
    const lvData = meta?.levels?.[lv];
    form[`${lv}Width`].value = lvData?.width ?? '';
    form[`${lv}Length`].value = lvData?.length ?? '';
    form[`${lv}Height`].value = lvData?.height ?? '';
  });
  form.smuStart.value = meta?.smuStart ?? '';
  form.smuEnd.value = meta?.smuEnd ?? '';
  form.startTime.value = record.startTime || '';
  form.endTime.value = record.endTime || '';
  setTime24Value('prodStart', record.startTime);
  setTime24Value('prodEnd', record.endTime);
  form.operatorName.value = record.operatorName || '';
  form.recordedBy.value = record.location || '';
  syncHourNoFromTime();
  updateCalculations();
}

function fillDowntimeForm(record) {
  const form = document.getElementById('formDowntime');
  form.date.value = record.date;
  form.shift.value = record.shift;
  form.bucketId.value = record.bucketId;
  form.type.value = record.type;
  form.startTime.value = record.startTime || '';
  form.ongoing.checked = !!record.ongoing;
  setTime24Value('dtStart', record.startTime);
  setTime24Disabled('dtEndTime', !!record.ongoing);
  setTime24Value('dtEndTime', record.ongoing ? '' : (record.endTime || ''));
  form.description.value = record.description || '';
}

function recentActionsHtml(id, kind, canMutate) {
  if (!canMutate) return '';
  return `<div class="recent-item-actions">
    <button type="button" class="btn-recent btn-recent-edit" data-kind="${kind}" data-id="${id}" title="แก้ไข">✎ แก้ไข</button>
    <button type="button" class="btn-recent btn-recent-delete" data-kind="${kind}" data-id="${id}" title="ลบ">🗑 ลบ</button>
  </div>`;
}

function formatProdRecent(r) {
  const meta = parsePerfNote(r.note);
  const hour = (r.startTime && r.endTime)
    ? `${r.startTime.slice(0, 5)}-${r.endTime.slice(0, 5)}`
    : (meta?.hourNo ? `Hr.${meta.hourNo}` : '—');
  const canMutate = DataStore.canMutateRecord(r.id, 'production');
  return `<div class="recent-item">
    <div class="recent-item-main">
      <span>${r.bucketId} — ${hour}</span>
      <span>${fmtNum(r.volumeBCM)} BCM (${r.operatorName})</span>
    </div>
    ${recentActionsHtml(r.id, 'production', canMutate)}
  </div>`;
}

function updateRecentTodayBtn() {
  const btn = document.getElementById('btnRecentToday');
  if (!btn) return;
  btn.classList.toggle('is-active', recentDateFilter === toISODate(new Date()));
}

function updateRecentListTitle() {
  const el = document.getElementById('recentListTitle');
  if (!el) return;
  const today = toISODate(new Date());
  el.textContent = recentDateFilter === today
    ? '📋 รายการที่บันทึกวันนี้'
    : `📋 รายการวันที่ ${formatDateTH(recentDateFilter)}`;
}

function recentDayLabel() {
  const today = toISODate(new Date());
  return recentDateFilter === today ? 'วันนี้' : formatDateTH(recentDateFilter);
}

function matchesRecentBucket(record) {
  if (recentBucketFilter === 'all') return true;
  return record.bucketId === recentBucketFilter;
}

function recentEmptyMessage() {
  const day = recentDayLabel();
  if (recentBucketFilter === 'all') {
    return day === 'วันนี้' ? 'ยังไม่มีรายการวันนี้' : `ยังไม่มีรายการวันที่ ${day}`;
  }
  return day === 'วันนี้'
    ? `ไม่มีรายการ ${recentBucketFilter} วันนี้`
    : `ไม่มีรายการ ${recentBucketFilter} วันที่ ${day}`;
}

function loadRecentRecords(data) {
  cachedData = data;
  const recentProd = data.production
    .filter(r => r.date === recentDateFilter && matchesRecentBucket(r))
    .slice()
    .reverse();
  const recentDt = data.downtime
    .filter(r => r.date === recentDateFilter && matchesRecentBucket(r))
    .slice()
    .reverse();

  const empty = recentEmptyMessage();
  document.getElementById('recentProduction').innerHTML = recentProd.length
    ? recentProd.map(formatProdRecent).join('')
    : `<div class="dt-empty">${empty}</div>`;

  document.getElementById('recentDowntime').innerHTML = recentDt.length
    ? recentDt.map(r => {
        const dur = formatDuration(calcDuration(r.startTime, r.endTime, r.ongoing));
        const canMutate = DataStore.canMutateRecord(r.id, 'downtime');
        return `<div class="recent-item">
          <div class="recent-item-main">
            <span>${r.bucketId} — ${r.type}</span>
            <span>${dur}${r.ongoing ? ' (ongoing)' : ''}</span>
          </div>
          ${recentActionsHtml(r.id, 'downtime', canMutate)}
        </div>`;
      }).join('')
    : `<div class="dt-empty">${empty}</div>`;

  updateRecentListTitle();
  updateRecentTodayBtn();
}

function setupRecentDateFilter() {
  const input = document.getElementById('recentDateFilter');
  const btnToday = document.getElementById('btnRecentToday');
  if (input) {
    input.value = recentDateFilter;
    input.addEventListener('change', () => {
      recentDateFilter = input.value || toISODate(new Date());
      loadRecentRecords(cachedData);
    });
  }
  btnToday?.addEventListener('click', () => {
    recentDateFilter = toISODate(new Date());
    if (input) input.value = recentDateFilter;
    loadRecentRecords(cachedData);
  });
}

function setupRecentBucketFilter() {
  const wrap = document.getElementById('recentBucketFilter');
  if (!wrap) return;
  wrap.addEventListener('change', (e) => {
    if (e.target.name !== 'recentBucketFilter') return;
    recentBucketFilter = e.target.value;
    loadRecentRecords(cachedData);
  });
}

async function handleRecentEdit(kind, id) {
  if (kind === 'production') {
    const record = cachedData.production.find(r => r.id === id);
    if (!record) return;
    clearDowntimeEdit();
    editingProductionId = id;
    setProductionEditMode(true);
    fillProductionForm(record);
    document.querySelector('.form-tab[data-tab="production"]')?.click();
    document.getElementById('panelProduction')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('โหลดข้อมูลเพื่อแก้ไข — แก้แล้วกดบันทึกการแก้ไข');
    return;
  }
  const record = cachedData.downtime.find(r => r.id === id);
  if (!record) return;
  clearProductionEdit();
  editingDowntimeId = id;
  setDowntimeEditMode(true);
  fillDowntimeForm(record);
  document.querySelector('.form-tab[data-tab="downtime"]')?.click();
  document.getElementById('panelDowntime')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('โหลดข้อมูลเพื่อแก้ไข — แก้แล้วกดบันทึกการแก้ไข');
}

function deleteErrorMessage(err) {
  if (err?.message === 'NOT_LOGGED_IN') {
    return 'กรุณา Login ใหม่แล้วลองลบอีกครั้ง';
  }
  if (err?.message === 'DELETE_BLOCKED' || err?.code === '42501') {
    return 'ยังไม่มีสิทธิ์ลบใน Supabase — แจ้ง Admin รัน SQL ใน docs/supabase/schema-delete-policies.sql';
  }
  return err?.message || 'ลบไม่สำเร็จ';
}

async function handleRecentDelete(kind, id) {
  const list = kind === 'production' ? cachedData.production : cachedData.downtime;
  const record = list.find(r => String(r.id) === String(id));
  if (!record) {
    showToast('ไม่พบรายการนี้ — กำลังโหลดข้อมูลใหม่', true);
    try {
      const allData = await API.getData();
      loadRecentRecords(allData);
    } catch { /* ignore */ }
    return;
  }
  const label = kind === 'production'
    ? `${record.bucketId} ${fmtNum(record.volumeBCM)} BCM`
    : `${record.bucketId} ${record.type}`;
  if (!confirm(`ลบรายการนี้?\n${label}`)) return;
  try {
    if (kind === 'production') {
      if (editingProductionId === id) clearProductionEdit();
      await API.deleteProduction(id);
    } else {
      if (editingDowntimeId === id) clearDowntimeEdit();
      await API.deleteDowntime(id);
    }
    showToast('ลบรายการแล้ว ✓');
    const allData = await API.getData();
    loadRecentRecords(allData);
    updateLocalCount();
  } catch (err) {
    console.error('delete failed', err);
    showToast(deleteErrorMessage(err), true);
  }
}

function setupRecentActions() {
  const listEl = document.querySelector('.recent-list');
  if (!listEl) return;
  listEl.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-recent-edit');
    const delBtn = e.target.closest('.btn-recent-delete');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      void handleRecentEdit(editBtn.dataset.kind, editBtn.dataset.id);
      return;
    }
    if (delBtn) {
      e.preventDefault();
      e.stopPropagation();
      void handleRecentDelete(delBtn.dataset.kind, delBtn.dataset.id);
    }
  });
}

function setupEditCancel() {
  document.getElementById('btnProdCancelEdit')?.addEventListener('click', () => {
    clearProductionEdit();
    document.getElementById('formProduction')?.reset();
    document.getElementById('prodDate').value = toISODate(new Date());
    updateCalculations();
    showToast('ยกเลิกการแก้ไข');
  });
  document.getElementById('btnDtCancelEdit')?.addEventListener('click', () => {
    clearDowntimeEdit();
    document.getElementById('formDowntime')?.reset();
    document.getElementById('dtDate').value = toISODate(new Date());
    setTime24Disabled('dtEndTime', false);
    showToast('ยกเลิกการแก้ไข');
  });
  document.getElementById('btnProdReset')?.addEventListener('click', () => {
    setTimeout(() => {
      clearProductionEdit();
      document.getElementById('prodDate').value = toISODate(new Date());
      updateCalculations();
    }, 0);
  });
  document.getElementById('btnDtReset')?.addEventListener('click', () => {
    setTimeout(() => {
      clearDowntimeEdit();
      document.getElementById('dtDate').value = toISODate(new Date());
      setTime24Disabled('dtEndTime', false);
    }, 0);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupOngoingToggle();
  setupTime24Pickers();
  setupDowntimeTypeDefault();
  setupProductionCalc();
  syncHourNoFromTime();
  setupRecentActions();
  setupRecentDateFilter();
  setupRecentBucketFilter();
  setupEditCancel();
  document.getElementById('formProduction').addEventListener('submit', submitProduction);
  document.getElementById('formDowntime').addEventListener('submit', submitDowntime);

  (async () => {
    await Auth.requireAdmin('index.html');
    document.getElementById('btnLogout')?.addEventListener('click', () => Auth.logout());
    init();
  })();
});
