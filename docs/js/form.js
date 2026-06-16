/* global API, DataStore, showToast, formatDuration, calcDuration, toISODate, fmtNum */

const BUCKETS = ['Bucket 1', 'Bucket 2'];
const LEVELS = ['b1', 'b2', 'b3'];

let config = { buckets: BUCKETS };
let activeTab = 'production';

async function init() {
  try {
    await DataStore.init();
    updateModeNotice();
    const data = await API.getData();
    config = data.config || {};
    document.getElementById('prodDate').value = toISODate(new Date());
    document.getElementById('dtDate').value = toISODate(new Date());
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
  document.querySelectorAll('.perf-dim, #smuStart, #smuEnd').forEach(el => {
    el.addEventListener('input', updateCalculations);
  });
  document.getElementById('formProduction')?.addEventListener('reset', () => {
    setTimeout(updateCalculations, 0);
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
    hourNo: parseInt(form.hourNo.value, 10),
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
  const endInput = document.getElementById('dtEndTime');
  chk.addEventListener('change', () => {
    endInput.disabled = chk.checked;
    if (chk.checked) endInput.value = '';
  });
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
  if (!form.hourNo.value) {
    showToast('กรุณากรอก Hr. ที่', true);
    return;
  }
  if (totalProduct <= 0) {
    showToast('กรุณากรอกขนาด B1/B2/B3 อย่างน้อย 1 ช่อง', true);
    return;
  }

  try {
    await API.addProduction(data);
    showToast('บันทึกสำเร็จ ✓');
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
    loadRecentRecords(allData);
    updateLocalCount();
  } catch {
    showToast('บันทึกไม่สำเร็จ กรุณาลองใหม่', true);
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
    await API.addDowntime(data);
    showToast('บันทึก Downtime สำเร็จ ✓');
    form.description.value = '';
    form.ongoing.checked = false;
    form.endTime.disabled = false;
    const allData = await API.getData();
    loadRecentRecords(allData);
    updateLocalCount();
  } catch {
    showToast('บันทึกไม่สำเร็จ กรุณาลองใหม่', true);
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

function formatProdRecent(r) {
  const meta = parsePerfNote(r.note);
  const hour = meta?.hourNo ? `Hr.${meta.hourNo}` : `${r.startTime}-${r.endTime}`;
  return `<div class="recent-item"><span>${r.bucketId} — ${hour}</span><span>${fmtNum(r.volumeBCM)} BCM (${r.operatorName})</span></div>`;
}

function loadRecentRecords(data) {
  const today = toISODate(new Date());
  const recentProd = data.production.filter(r => r.date === today).slice(-5).reverse();
  const recentDt = data.downtime.filter(r => r.date === today).slice(-5).reverse();

  document.getElementById('recentProduction').innerHTML = recentProd.length
    ? recentProd.map(formatProdRecent).join('')
    : '<div class="dt-empty">ยังไม่มีรายการวันนี้</div>';

  document.getElementById('recentDowntime').innerHTML = recentDt.length
    ? recentDt.map(r => {
        const dur = formatDuration(calcDuration(r.startTime, r.endTime, r.ongoing));
        return `<div class="recent-item"><span>${r.bucketId} — ${r.type}</span><span>${dur}${r.ongoing ? ' (ongoing)' : ''}</span></div>`;
      }).join('')
    : '<div class="dt-empty">ยังไม่มีรายการวันนี้</div>';
}

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAdmin('index.html');
  document.getElementById('btnLogout')?.addEventListener('click', () => Auth.logout());
  setupTabs();
  setupOngoingToggle();
  setupProductionCalc();
  document.getElementById('formProduction').addEventListener('submit', submitProduction);
  document.getElementById('formDowntime').addEventListener('submit', submitDowntime);
  init();
});
