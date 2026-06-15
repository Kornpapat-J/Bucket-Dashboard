/* global API, showToast, formatDuration, calcDuration, toISODate, fmtNum */

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
  } catch (err) {
    showToast('ไม่สามารถโหลดข้อมูลได้', true);
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
  } catch {
    showToast('บันทึกไม่สำเร็จ กรุณาลองใหม่', true);
  }
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
  init();
});
