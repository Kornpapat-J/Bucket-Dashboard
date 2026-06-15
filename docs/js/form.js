/* global API, DataStore, showToast, formatDuration, calcDuration, toISODate, fmtNum */

let config = { buckets: [] };
let activeTab = 'production';

async function init() {
  try {
    const data = await API.getData();
    config = data.config || {};
    populateBucketSelects();
    document.getElementById('prodDate').value = toISODate(new Date());
    document.getElementById('dtDate').value = toISODate(new Date());
    loadRecentRecords(data);
    updateLocalCount();
  } catch (err) {
    showToast('ไม่สามารถโหลดข้อมูลได้', true);
  }
}

function updateLocalCount() {
  const count = DataStore.getLocalCount();
  const el = document.getElementById('localCount');
  if (el) {
    el.textContent = count > 0
      ? `มีข้อมูลชั่วคราว ${count} รายการ (ยังไม่ได้อัปโหลด GitHub)`
      : 'ยังไม่มีข้อมูลชั่วคราว — ข้อมูลแสดงจาก records.json บน GitHub';
  }
}

function populateBucketSelects() {
  const buckets = config.buckets || ['Bucket 1', 'Bucket 2', 'Bucket 3'];
  ['prodBucket', 'dtBucket'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = buckets.map(b => `<option value="${b}">${b}</option>`).join('');
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
  const data = {
    date: form.date.value,
    shift: form.shift.value,
    bucketId: form.bucketId.value,
    operatorName: form.operatorName.value.trim(),
    startTime: form.startTime.value,
    endTime: form.endTime.value,
    volumeBCM: parseFloat(form.volumeBCM.value),
    location: form.location.value.trim(),
    note: form.note.value.trim()
  };

  if (!data.operatorName || !data.volumeBCM || data.volumeBCM <= 0) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วน', true);
    return;
  }

  try {
    await API.addProduction(data);
    showToast('บันทึกการขุดดินสำเร็จ ✓');
    form.volumeBCM.value = '';
    form.note.value = '';
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

function loadRecentRecords(data) {
  const today = toISODate(new Date());
  const recentProd = data.production.filter(r => r.date === today).slice(-5).reverse();
  const recentDt = data.downtime.filter(r => r.date === today).slice(-5).reverse();

  document.getElementById('recentProduction').innerHTML = recentProd.length
    ? recentProd.map(r => `<div class="recent-item"><span>${r.bucketId} — ${r.operatorName}</span><span>${fmtNum(r.volumeBCM)} BCM (${r.startTime}-${r.endTime})</span></div>`).join('')
    : '<div class="dt-empty">ยังไม่มีรายการวันนี้</div>';

  document.getElementById('recentDowntime').innerHTML = recentDt.length
    ? recentDt.map(r => {
        const dur = formatDuration(calcDuration(r.startTime, r.endTime, r.ongoing));
        return `<div class="recent-item"><span>${r.bucketId} — ${r.type}</span><span>${dur}${r.ongoing ? ' (ongoing)' : ''}</span></div>`;
      }).join('')
    : '<div class="dt-empty">ยังไม่มีรายการวันนี้</div>';
}

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupOngoingToggle();
  document.getElementById('formProduction').addEventListener('submit', submitProduction);
  document.getElementById('formDowntime').addEventListener('submit', submitDowntime);
  document.getElementById('btnExportJson')?.addEventListener('click', exportJson);
  document.getElementById('btnClearLocal')?.addEventListener('click', clearLocalData);
  init();
});
