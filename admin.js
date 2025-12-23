// Simple admin back-office for appointments saved in localStorage.
// SECURITY NOTE: This is a lightweight client-side admin. Anyone with the passcode can view.
// For real multi-user back office, implement a server + authentication.

const APPOINTMENTS_STORAGE_KEY = 'appointments_v1';

// Change this passcode before publishing
const ADMIN_PASSCODE = 'change-me-1234';

function requireLogin() {
  const existing = sessionStorage.getItem('admin_authed');
  if (existing === '1') return true;

  const pass = prompt('Enter admin passcode:');
  if (pass === ADMIN_PASSCODE) {
    sessionStorage.setItem('admin_authed', '1');
    return true;
  }

  alert('Access denied.');
  window.location.href = 'index.html';
  return false;
}

function loadAppointments() {
  try {
    const raw = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to load appointments', e);
    return [];
  }
}

function saveAppointments(list) {
  localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(list));
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso || '';
  }
}

function serviceLabel(value) {
  const map = {
    'general': 'ייעוץ רפואי כללי',
    'home-visit': 'ביקור בית',
    'chronic': 'ניהול מחלות כרוניות',
    'preventive': 'רפואה מונעת',
    'pediatric': 'טיפול ילדים'
  };
  return map[value] || value || '';
}

function buildKpis(list) {
  const counts = { all: list.length, new: 0, confirmed: 0, cancelled: 0 };
  list.forEach(a => counts[a.status] = (counts[a.status] || 0) + 1);

  const kpis = document.getElementById('kpis');
  kpis.innerHTML = '';
  const items = [
    { label: 'סה״כ', value: counts.all },
    { label: 'חדש', value: counts.new || 0 },
    { label: 'אושר', value: counts.confirmed || 0 },
    { label: 'בוטל', value: counts.cancelled || 0 }
  ];
  items.forEach(it => {
    const div = document.createElement('div');
    div.className = 'admin-kpi';
    div.innerHTML = `<div class="admin-kpi-value">${it.value}</div><div class="admin-kpi-label">${it.label}</div>`;
    kpis.appendChild(div);
  });
}

function applyFilters(list) {
  const q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const service = document.getElementById('serviceFilter').value;

  return list.filter(a => {
    const hay = [
      a.firstName, a.lastName, a.phone, a.email, a.notes, a.service, a.date, a.time
    ].join(' ').toLowerCase();

    if (q && !hay.includes(q)) return false;
    if (status !== 'all' && a.status !== status) return false;
    if (service !== 'all' && a.service !== service) return false;

    return true;
  });
}

function render() {
  const all = loadAppointments();
  buildKpis(all);

  const list = applyFilters(all);
  const body = document.getElementById('appointmentsBody');
  body.innerHTML = '';

  if (!list.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="10" class="admin-empty">אין בקשות להצגה</td>`;
    body.appendChild(tr);
    return;
  }

  list.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(a.createdAt)}</td>
      <td><strong>${(a.firstName || '')} ${(a.lastName || '')}</strong></td>
      <td><a href="tel:${a.phone || ''}">${a.phone || ''}</a></td>
      <td><a href="mailto:${a.email || ''}">${a.email || ''}</a></td>
      <td>${serviceLabel(a.service)}</td>
      <td>${a.date || ''}</td>
      <td>${a.time || ''}</td>
      <td class="admin-notes">${(a.notes || '').replace(/</g,'&lt;')}</td>
      <td>
        <select class="admin-status" data-id="${a.id}">
          <option value="new" ${a.status === 'new' ? 'selected' : ''}>חדש</option>
          <option value="confirmed" ${a.status === 'confirmed' ? 'selected' : ''}>אושר</option>
          <option value="cancelled" ${a.status === 'cancelled' ? 'selected' : ''}>בוטל</option>
        </select>
      </td>
      <td class="admin-row-actions">
        <button class="btn-outline admin-delete" data-id="${a.id}">מחק</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function updateStatus(id, status) {
  const list = loadAppointments();
  const idx = list.findIndex(x => x.id === id);
  if (idx >= 0) {
    list[idx].status = status;
    saveAppointments(list);
  }
}

function deleteAppointment(id) {
  const list = loadAppointments().filter(x => x.id !== id);
  saveAppointments(list);
}

function exportCsv() {
  const list = loadAppointments();
  const headers = ['createdAt','status','firstName','lastName','phone','email','service','date','time','notes'];
  const rows = [headers.join(',')];

  list.forEach(a => {
    const row = headers.map(h => {
      const val = (a[h] ?? '').toString().replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
    rows.push(row);
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'appointments.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function bindEvents() {
  document.getElementById('refreshBtn').addEventListener('click', render);

  document.getElementById('exportBtn').addEventListener('click', exportCsv);

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!confirm('למחוק את כל הבקשות?')) return;
    saveAppointments([]);
    render();
  });

  ['searchInput','statusFilter','serviceFilter'].forEach(id => {
    document.getElementById(id).addEventListener('input', render);
    document.getElementById(id).addEventListener('change', render);
  });

  document.addEventListener('change', (e) => {
    if (e.target && e.target.classList.contains('admin-status')) {
      updateStatus(e.target.getAttribute('data-id'), e.target.value);
      render();
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('admin-delete')) {
      const id = e.target.getAttribute('data-id');
      if (!confirm('למחוק את הבקשה הזו?')) return;
      deleteAppointment(id);
      render();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!requireLogin()) return;
  bindEvents();
  render();
});
