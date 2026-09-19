/**
 * FilterFlow — Mobile Filter Maintenance Dashboard & 1-Click Reorder
 * Pixel 10 Pro / Cross-Platform Responsive Web Application
 */

let allFilters = [];
let activeCategory = 'all';
let activeStatusFilter = 'all';
let activeOwnerFilter = 'all';
let searchQuery = '';

// DOM Elements
const filterList = document.getElementById('filter-list');
const categoryTabs = document.getElementById('category-tabs');
const householdTabs = document.getElementById('household-tabs');
const searchInput = document.getElementById('filter-search');
const clearSearchBtn = document.getElementById('clear-search');
const notifBtn = document.getElementById('notif-btn');
const notifBadge = document.getElementById('notif-badge');
const shareBtn = document.getElementById('share-btn');
const addBtn = document.getElementById('add-btn');

// Dialog Elements
const replaceDialog = document.getElementById('replace-dialog');
const snoozeDialog = document.getElementById('snooze-dialog');
const historyDialog = document.getElementById('history-dialog');
const notifDialog = document.getElementById('notif-dialog');
const shareDialog = document.getElementById('share-dialog');
const addDialog = document.getElementById('add-dialog');

// Initialize light-dismiss fallbacks for modern dialogs
setupDialogLightDismiss(replaceDialog);
setupDialogLightDismiss(snoozeDialog);
setupDialogLightDismiss(historyDialog);
setupDialogLightDismiss(notifDialog);
setupDialogLightDismiss(shareDialog);
setupDialogLightDismiss(addDialog);

// ============================================================================
// Data Fetching & Sync
// ============================================================================

async function fetchFilters() {
  try {
    const res = await fetch('/api/filters');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allFilters = await res.json();
    updateStats();
    renderFilters();
    updateNotifications();
  } catch (err) {
    console.error('Failed to load filters:', err);
    filterList.innerHTML = `
      <div class="empty-state error">
        <p style="font-size: 36px; margin-bottom: 8px;">⚠️</p>
        <p><strong>Failed to load filters</strong></p>
        <p style="font-size: 13px; color: #888; margin-top: 4px;">${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary" onclick="fetchFilters()" style="margin-top: 14px;">Retry</button>
      </div>
    `;
  }
}

// ============================================================================
// Stats & Overview Counters
// ============================================================================

function updateStats() {
  const total = allFilters.length;
  const healthy = allFilters.filter(f => f.status === 'HEALTHY').length;
  const soon = allFilters.filter(f => f.status === 'EXPIRING_SOON').length;
  const overdue = allFilters.filter(f => f.status === 'OVERDUE').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-healthy').textContent = healthy;
  document.getElementById('stat-soon').textContent = soon;
  document.getElementById('stat-overdue').textContent = overdue;
}

// Click on stat cards to filter by status
document.getElementById('stats-overview').addEventListener('click', (e) => {
  const card = e.target.closest('.stat-card');
  if (!card) return;
  const stat = card.dataset.stat;
  if (activeStatusFilter === stat) {
    activeStatusFilter = 'all';
    card.classList.remove('selected');
  } else {
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    activeStatusFilter = stat;
  }
  renderFilters();
});

// ============================================================================
// Render Filter Cards
// ============================================================================

function renderFilters() {
  if (allFilters.length === 0) {
    filterList.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 48px; margin-bottom: 12px;">🛡️</div>
        <h3 style="font-size: 18px; margin-bottom: 6px;">No filters tracked yet</h3>
        <p style="font-size: 14px; color: var(--text-secondary); max-width: 300px; margin: 0 auto 16px;">
          Add your furnace, vehicle cabin, or refrigerator filter to start tracking maintenance and reorder dates.
        </p>
        <button class="btn btn-primary" onclick="openAddDialog()">+ Add Your First Filter</button>
      </div>
    `;
    return;
  }

  // Filter by category
  let filtered = activeCategory === 'all'
    ? allFilters
    : allFilters.filter(f => f.category === activeCategory);

  // Filter by status (if selected from stat cards)
  if (activeStatusFilter !== 'all') {
    filtered = filtered.filter(f => f.status === activeStatusFilter);
  }

  // Filter by household member owner
  if (activeOwnerFilter !== 'all') {
    filtered = filtered.filter(f => f.owner === activeOwnerFilter || f.owner === 'Household');
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(f =>
      (f.name && f.name.toLowerCase().includes(q)) ||
      (f.location && f.location.toLowerCase().includes(q)) ||
      (f.manufacturer && f.manufacturer.toLowerCase().includes(q)) ||
      (f.modelNumber && f.modelNumber.toLowerCase().includes(q)) ||
      (f.notes && f.notes.toLowerCase().includes(q)) ||
      (f.owner && f.owner.toLowerCase().includes(q)) ||
      (f.lastReplacedBy && f.lastReplacedBy.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    filterList.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
        <h3 style="font-size: 16px; margin-bottom: 4px;">No matching filters</h3>
        <p style="font-size: 13px; color: var(--text-secondary);">Try clearing your search, category, or household filter.</p>
        <button class="btn btn-secondary" onclick="resetFilters()" style="margin-top: 12px;">Reset Filters</button>
      </div>
    `;
    return;
  }

  filterList.innerHTML = filtered.map(f => {
    // Service life calculations
    const totalCycleDays = f.serviceLifeDays + (f.lastSnoozeDays || 0);
    const daysRemaining = f.daysRemaining !== undefined ? f.daysRemaining : 0;
    
    // Remaining health percentage (100% when freshly replaced, 0% when expired/overdue)
    let healthPercent = Math.max(0, Math.min(100, Math.round((daysRemaining / totalCycleDays) * 100)));
    if (f.status === 'OVERDUE') healthPercent = 0;

    // Amazon Reorder URL (custom or fallback search query)
    const reorderLink = f.reorderUrl && f.reorderUrl.trim()
      ? f.reorderUrl.trim()
      : `https://www.amazon.com/s?k=${encodeURIComponent((f.manufacturer || '') + ' ' + (f.modelNumber || f.name) + ' filter')}`;

    const isAmazonDirect = f.reorderUrl && f.reorderUrl.includes('amazon.com/dp');

    // Countdown Badge & Status Text
    let statusBadgeText = '';
    let countdownTitle = '';
    let countdownBadgeClass = f.status;

    if (f.status === 'HEALTHY') {
      statusBadgeText = `✅ Healthy`;
      countdownTitle = `⏱️ ${daysRemaining} days left`;
    } else if (f.status === 'EXPIRING_SOON') {
      statusBadgeText = `⏳ Order Soon`;
      countdownTitle = `⚠️ Due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
    } else {
      statusBadgeText = `🚨 OVERDUE`;
      countdownTitle = `🚨 ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} OVERDUE`;
    }

    const formattedTargetDue = formatFriendlyDate(f.targetDueDate);
    const formattedInstalled = formatFriendlyDate(f.installedDate);

    return `
      <article class="filter-card status-border-${f.status}" data-id="${escapeHtml(f.id)}">
        <!-- Card Header -->
        <div class="card-header">
          <div class="card-title-wrap">
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
              <span class="category-badge">${escapeHtml(f.category || 'General')}</span>
              <span class="owner-tag">👤 ${escapeHtml(f.owner || 'Household')}</span>
            </div>
            <h3 class="card-title">${escapeHtml(f.name)}</h3>
            <p class="card-location">📍 ${escapeHtml(f.location || 'Household')}</p>
          </div>
          <span class="status-chip ${f.status}">${statusBadgeText}</span>
        </div>

        <!-- Expiration Countdown Banner -->
        <div class="countdown-banner ${f.status}">
          <div class="countdown-main">
            <span class="countdown-value">${countdownTitle}</span>
            <span class="countdown-sub">Due: <strong>${formattedTargetDue}</strong></span>
          </div>
          ${f.status === 'EXPIRING_SOON' ? `
            <div class="countdown-alert-pill">
              🛒 Pre-order Window Open (T - 14d)
            </div>
          ` : f.status === 'OVERDUE' ? `
            <div class="countdown-alert-pill overdue-pill">
              ⚠️ Immediate Replacement Required
            </div>
          ` : ''}
        </div>

        <!-- Health Meter & Progress Bar -->
        <div class="health-meter-box">
          <div class="meter-labels">
            <span class="meter-title">Filter Health</span>
            <span class="meter-value ${f.status}">${healthPercent}% Remaining</span>
          </div>
          <div class="progress-track" role="progressbar" aria-valuenow="${healthPercent}" aria-valuemin="0" aria-valuemax="100" title="${healthPercent}% filter life remaining">
            <div class="progress-fill ${f.status}" style="width: ${healthPercent}%"></div>
          </div>
        </div>

        <!-- Technical Specs & Dates -->
        <div class="card-specs">
          <div class="spec-row">
            <span class="spec-key">Model / Size</span>
            <span class="spec-val font-mono">${escapeHtml(f.modelNumber || 'Standard Size')}</span>
          </div>
          <div class="spec-row">
            <span class="spec-key">Brand / Maker</span>
            <span class="spec-val">${escapeHtml(f.manufacturer || 'OEM')}</span>
          </div>
          <div class="spec-row">
            <span class="spec-key">Last Replaced</span>
            <span class="spec-val">${formattedInstalled} by <strong>${escapeHtml(f.lastReplacedBy || 'Household')}</strong></span>
          </div>
          <div class="spec-row">
            <span class="spec-key">Cycle Period</span>
            <span class="spec-val">${f.serviceLifeDays}d cycle${f.lastSnoozeDays ? ` (+${f.lastSnoozeDays}d snooze)` : ''}</span>
          </div>
          ${f.notes ? `
            <div class="spec-notes">
              <span class="notes-icon">📝</span>
              <span>${escapeHtml(f.notes)}</span>
            </div>
          ` : ''}
        </div>

        <!-- Quick 1-Click Actions Bar -->
        <div class="card-actions">
          <!-- 1-Click Amazon Reorder -->
          <a href="${escapeHtml(reorderLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-amazon" title="Open 1-Click Buy on Amazon">
            <span class="amazon-icon" aria-hidden="true">🛒</span>
            <span class="btn-text">1-Click Reorder</span>
            <span class="amazon-tag">${isAmazonDirect ? 'Prime' : 'Search'}</span>
          </a>

          <!-- Mark Replaced Dialog Trigger -->
          <button type="button" class="btn btn-replace" onclick="openReplaceDialog('${escapeHtml(f.id)}')" title="Mark as replaced today and reset cycle">
            <span class="btn-icon" aria-hidden="true">🔄</span>
            <span class="btn-text">Mark Replaced</span>
          </button>

          <!-- Vacation Snooze Dialog Trigger -->
          <button type="button" class="btn btn-action-icon" onclick="openSnoozeDialog('${escapeHtml(f.id)}')" title="Snooze due date for vacation">
            <span>⏸️</span>
          </button>

          <!-- Maintenance History Dialog Trigger -->
          <button type="button" class="btn btn-action-icon" onclick="openHistoryDialog('${escapeHtml(f.id)}')" title="View replacement history">
            <span>📜</span>
          </button>

          <!-- Delete Filter -->
          <button type="button" class="btn btn-action-icon btn-danger" onclick="deleteFilter('${escapeHtml(f.id)}')" title="Delete this filter">
            <span>🗑️</span>
          </button>
        </div>
      </article>
    `;
  }).join('');
}

// ============================================================================
// Dialog 1: Mark Replaced Dialog
// ============================================================================

let currentReplaceFilter = null;

function openReplaceDialog(filterId) {
  const filter = allFilters.find(f => f.id === filterId);
  if (!filter) return;
  currentReplaceFilter = filter;

  document.getElementById('replace-filter-id').value = filter.id;
  document.getElementById('replace-target-name').textContent = filter.name;
  document.getElementById('replace-target-meta').textContent = `${filter.modelNumber || 'Standard'} • ${filter.location || filter.category}`;
  document.getElementById('replace-target-cycle').textContent = `Service life: ${filter.serviceLifeDays} days • Previously installed on ${formatFriendlyDate(filter.installedDate)}`;

  // Default to today
  const todayStr = new Date().toISOString().split('T')[0];
  const replaceDateInput = document.getElementById('replace-date');
  replaceDateInput.value = todayStr;
  replaceDateInput.max = todayStr; // Cannot replace in future

  // Reset active date chip
  document.querySelectorAll('.date-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.offset === '0');
  });

  document.getElementById('replace-notes').value = '';
  const replaceBySelect = document.getElementById('replace-by');
  if (replaceBySelect) {
    replaceBySelect.value = currentReplaceFilter.owner === 'Wife' ? 'Wife' : currentReplaceFilter.owner === 'Isaac' ? 'Isaac' : 'Household';
  }
  updateReplaceNextDuePreview();

  replaceDialog.showModal();
}

function updateReplaceNextDuePreview() {
  if (!currentReplaceFilter) return;
  const dateVal = document.getElementById('replace-date').value;
  if (!dateVal) {
    document.getElementById('replace-next-due-preview').textContent = '—';
    return;
  }
  const chosenDate = new Date(dateVal + 'T00:00:00');
  chosenDate.setDate(chosenDate.getDate() + currentReplaceFilter.serviceLifeDays);
  const nextDueStr = chosenDate.toISOString().split('T')[0];
  document.getElementById('replace-next-due-preview').textContent = formatFriendlyDate(nextDueStr);
}

document.getElementById('replace-date').addEventListener('change', () => {
  updateReplaceNextDuePreview();
  // Clear date chip active states if custom picked
  document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
});

// Quick Date Chips (Today, Yesterday, 2 Days Ago, 1 Week Ago)
document.querySelectorAll('.date-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const offset = parseInt(chip.dataset.offset, 10);
    const d = new Date();
    d.setDate(d.getDate() - offset);
    document.getElementById('replace-date').value = d.toISOString().split('T')[0];
    updateReplaceNextDuePreview();
  });
});

document.getElementById('close-replace-dialog').addEventListener('click', () => replaceDialog.close());
document.getElementById('cancel-replace-btn').addEventListener('click', () => replaceDialog.close());

document.getElementById('replace-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentReplaceFilter) return;

  const filterId = document.getElementById('replace-filter-id').value;
  const replacedDate = document.getElementById('replace-date').value;
  const notes = document.getElementById('replace-notes').value.trim();
  const replacedBy = document.getElementById('replace-by') ? document.getElementById('replace-by').value : 'Household';

  const submitBtn = document.getElementById('submit-replace-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const res = await fetch(`/api/filters/${filterId}/replace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replacedDate, notes, replacedBy })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const updated = await res.json();
    replaceDialog.close();
    showToast(`✅ ${updated.name} marked replaced! Next due: ${formatFriendlyDate(updated.targetDueDate)}`);
    await fetchFilters();
  } catch (err) {
    alert('Failed to record replacement: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>✅ Confirm Replacement</span>';
  }
});

// ============================================================================
// Dialog 2: Snooze Dialog (Vacation Mode)
// ============================================================================

let currentSnoozeFilter = null;

function openSnoozeDialog(filterId) {
  const filter = allFilters.find(f => f.id === filterId);
  if (!filter) return;
  currentSnoozeFilter = filter;

  document.getElementById('snooze-filter-id').value = filter.id;
  document.getElementById('snooze-target-name').textContent = filter.name;
  document.getElementById('snooze-target-meta').textContent = `Current Due Date: ${formatFriendlyDate(filter.targetDueDate)} (${filter.daysRemaining}d remaining)`;

  // Reset radio to 30 days
  const radios = document.querySelectorAll('input[name="snooze-days"]');
  radios.forEach(r => {
    r.checked = r.value === '30';
    r.closest('.snooze-radio-card').classList.toggle('active', r.value === '30');
  });

  updateSnoozeNewDuePreview();
  snoozeDialog.showModal();
}

function updateSnoozeNewDuePreview() {
  if (!currentSnoozeFilter) return;
  const selectedRadio = document.querySelector('input[name="snooze-days"]:checked');
  const days = selectedRadio ? parseInt(selectedRadio.value, 10) : 30;

  const currentDue = new Date(currentSnoozeFilter.targetDueDate + 'T00:00:00');
  currentDue.setDate(currentDue.getDate() + days);
  const newDueStr = currentDue.toISOString().split('T')[0];
  document.getElementById('snooze-new-due-preview').textContent = `${formatFriendlyDate(newDueStr)} (+${days} days)`;
}

document.querySelectorAll('input[name="snooze-days"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.snooze-radio-card').forEach(c => c.classList.remove('active'));
    radio.closest('.snooze-radio-card').classList.add('active');
    updateSnoozeNewDuePreview();
  });
});

document.getElementById('close-snooze-dialog').addEventListener('click', () => snoozeDialog.close());
document.getElementById('cancel-snooze-btn').addEventListener('click', () => snoozeDialog.close());

document.getElementById('snooze-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentSnoozeFilter) return;

  const filterId = document.getElementById('snooze-filter-id').value;
  const selectedRadio = document.querySelector('input[name="snooze-days"]:checked');
  const days = selectedRadio ? parseInt(selectedRadio.value, 10) : 30;
  const reason = document.getElementById('snooze-reason').value.trim();

  const submitBtn = document.getElementById('submit-snooze-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const res = await fetch(`/api/filters/${filterId}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days, reason })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const updated = await res.json();
    snoozeDialog.close();
    showToast(`⏸️ Extended ${updated.name} by ${days} days! New due: ${formatFriendlyDate(updated.targetDueDate)}`);
    await fetchFilters();
  } catch (err) {
    alert('Failed to snooze filter: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>⏸️ Extend Due Date</span>';
  }
});

// ============================================================================
// Dialog 3: Filter History Dialog
// ============================================================================

function openHistoryDialog(filterId) {
  const filter = allFilters.find(f => f.id === filterId);
  if (!filter) return;

  document.getElementById('history-dialog-subtitle').textContent = `${filter.name} • ${filter.modelNumber || 'Standard'}`;
  const container = document.getElementById('history-timeline');

  const history = filter.history && filter.history.length > 0
    ? [...filter.history].reverse()
    : [
        { date: filter.installedDate, action: 'Initial Installation' }
      ];

  container.innerHTML = history.map((item, idx) => {
    const isLatest = idx === 0;
    const isReplace = item.action.toLowerCase().includes('replaced') || item.action.toLowerCase().includes('initial');
    const isSnooze = item.action.toLowerCase().includes('snooze');

    return `
      <div class="timeline-item ${isLatest ? 'timeline-latest' : ''}">
        <div class="timeline-dot ${isReplace ? 'dot-replace' : isSnooze ? 'dot-snooze' : ''}"></div>
        <div class="timeline-body">
          <div class="timeline-date">${formatFriendlyDate(item.date)}</div>
          <div class="timeline-action">${escapeHtml(item.action)}</div>
        </div>
      </div>
    `;
  }).join('');

  historyDialog.showModal();
}

document.getElementById('close-history-dialog').addEventListener('click', () => historyDialog.close());
document.getElementById('close-history-btn').addEventListener('click', () => historyDialog.close());

// ============================================================================
// Dialog 4: Smart Notifications Drawer
// ============================================================================

async function updateNotifications() {
  try {
    const res = await fetch('/api/notifications');
    if (!res.ok) return;
    const alerts = await res.json();

    notifBadge.textContent = alerts.length;
    notifBadge.style.display = alerts.length > 0 ? 'flex' : 'none';

    const notifList = document.getElementById('notif-list');
    if (alerts.length === 0) {
      notifList.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 36px; margin-bottom: 8px;">✨</div>
          <p><strong>All filters are healthy!</strong></p>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">No upcoming expirations or overdue alerts.</p>
        </div>
      `;
    } else {
      notifList.innerHTML = alerts.map(a => `
        <div class="notif-card urgency-${a.urgency || 'medium'}">
          <div class="notif-header">
            <span class="notif-title">${escapeHtml(a.title)}</span>
            <span class="notif-time">${formatFriendlyDate(a.dueDate)}</span>
          </div>
          <p class="notif-msg">${escapeHtml(a.message)}</p>
          <div class="notif-actions">
            ${a.reorderUrl ? `
              <a href="${escapeHtml(a.reorderUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-amazon btn-sm">
                🛒 1-Click Order
              </a>
            ` : ''}
            <button class="btn btn-replace btn-sm" onclick="notifDialog.close(); openReplaceDialog('${escapeHtml(a.filterId)}')">
              🔄 Mark Replaced
            </button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
}

notifBtn.addEventListener('click', () => notifDialog.showModal());
document.getElementById('close-notif-dialog').addEventListener('click', () => notifDialog.close());

// ============================================================================
// Dialog 5: Add Filter Dialog
// ============================================================================

function openAddDialog() {
  document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('add-form').reset();
  document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
  addDialog.showModal();
}

addBtn.addEventListener('click', openAddDialog);
document.getElementById('close-add-dialog').addEventListener('click', () => addDialog.close());
document.getElementById('cancel-add-btn').addEventListener('click', () => addDialog.close());

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('form-name').value.trim(),
    category: document.getElementById('form-category').value,
    location: document.getElementById('form-location').value.trim(),
    manufacturer: document.getElementById('form-mfr').value.trim(),
    modelNumber: document.getElementById('form-model').value.trim(),
    installedDate: document.getElementById('form-date').value,
    serviceLifeDays: parseInt(document.getElementById('form-life').value, 10),
    owner: document.getElementById('form-owner') ? document.getElementById('form-owner').value : 'Household',
    reorderUrl: document.getElementById('form-url').value.trim(),
    notes: document.getElementById('form-notes').value.trim()
  };

  const submitBtn = document.getElementById('submit-add-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const created = await res.json();
    addDialog.close();
    showToast(`✅ Added filter: ${created.name}`);
    await fetchFilters();
  } catch (err) {
    alert('Failed to add filter: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Filter';
  }
});

// ============================================================================
// Filter Deletion
// ============================================================================

async function deleteFilter(id) {
  const filter = allFilters.find(f => f.id === id);
  const name = filter ? filter.name : 'this filter';
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`/api/filters/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast(`🗑️ Filter deleted`);
    await fetchFilters();
  } catch (err) {
    alert('Failed to delete filter: ' + err.message);
  }
}

// ============================================================================
// Category Tabs & Search
// ============================================================================

categoryTabs.addEventListener('click', (e) => {
  const chip = e.target.closest('.tab-chip');
  if (!chip) return;
  document.querySelectorAll('.tab-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeCategory = chip.dataset.category;
  renderFilters();
});

if (householdTabs) {
  householdTabs.addEventListener('click', (e) => {
    const chip = e.target.closest('.member-chip');
    if (!chip) return;
    document.querySelectorAll('.member-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeOwnerFilter = chip.dataset.owner;
    renderFilters();
  });
}

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  clearSearchBtn.classList.toggle('hidden', !searchQuery);
  renderFilters();
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearSearchBtn.classList.add('hidden');
  renderFilters();
  searchInput.focus();
});

function resetFilters() {
  activeCategory = 'all';
  activeStatusFilter = 'all';
  activeOwnerFilter = 'all';
  searchQuery = '';
  searchInput.value = '';
  clearSearchBtn.classList.add('hidden');
  document.querySelectorAll('.tab-chip').forEach(c => c.classList.toggle('active', c.dataset.category === 'all'));
  if (householdTabs) {
    document.querySelectorAll('.member-chip').forEach(c => c.classList.toggle('active', c.dataset.owner === 'all'));
  }
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('selected'));
  renderFilters();
}

// ============================================================================
// Dialog 6: Household & Device Sharing
// ============================================================================

async function openShareDialog() {
  if (!shareDialog) return;
  shareDialog.showModal();
  try {
    const res = await fetch('/api/household/share');
    if (res.ok) {
      const data = await res.json();
      const qrContainer = document.getElementById('share-qr-container');
      const urlInput = document.getElementById('share-url-input');
      if (qrContainer && data.qrSvg) {
        qrContainer.innerHTML = data.qrSvg;
      }
      if (urlInput && data.httpUrl) {
        urlInput.value = data.httpUrl;
      }
    }
  } catch (err) {
    console.error('Failed to load household share info:', err);
  }
}

if (shareBtn) {
  shareBtn.addEventListener('click', openShareDialog);
}
const closeShareBtn = document.getElementById('close-share-dialog');
const doneShareBtn = document.getElementById('done-share-btn');
if (closeShareBtn) closeShareBtn.addEventListener('click', () => shareDialog.close());
if (doneShareBtn) doneShareBtn.addEventListener('click', () => shareDialog.close());

const copyShareUrlBtn = document.getElementById('copy-share-url-btn');
if (copyShareUrlBtn) {
  copyShareUrlBtn.addEventListener('click', async () => {
    const urlInput = document.getElementById('share-url-input');
    if (!urlInput) return;
    try {
      await navigator.clipboard.writeText(urlInput.value);
      showToast('📋 Copied home Wi-Fi URL to clipboard!');
    } catch {
      urlInput.select();
      document.execCommand('copy');
      showToast('📋 Copied home Wi-Fi URL to clipboard!');
    }
  });
}

// ============================================================================
// Real-Time Multi-Device Sync (Server-Sent Events)
// ============================================================================

function setupEventSource() {
  if (typeof EventSource === 'undefined') return;
  try {
    const es = new EventSource('/api/events');
    es.addEventListener('filter_updated', (e) => {
      fetchFilters();
      try {
        const payload = JSON.parse(e.data);
        if (payload.action === 'replace') {
          showToast(`🔄 Filter marked replaced by family member`);
        } else if (payload.action === 'snooze') {
          showToast(`⏸️ Filter snoozed by family member`);
        }
      } catch (_) {}
    });
    es.addEventListener('filter_created', () => {
      fetchFilters();
      showToast('➕ New filter added to household');
    });
    es.addEventListener('filter_deleted', () => {
      fetchFilters();
      showToast('🗑️ Filter deleted from household');
    });
    es.onerror = () => {
      // Automatic reconnection handled by browser EventSource
    };
  } catch (err) {
    console.warn('SSE note:', err);
  }
}

// ============================================================================
// Modern Web Dialog Utilities & Helpers
// ============================================================================

/**
 * Setup light-dismiss fallback for browsers lacking native `closedby="any"`
 * as recommended by Modern Web Guidance.
 */
function setupDialogLightDismiss(dialog) {
  if (!dialog) return;

  // Fallback for browsers without native closedby support (Safari)
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isInside) {
        dialog.close();
      }
    });
  }
}

function showToast(message, duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast-bubble';
  toast.textContent = message;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function formatFriendlyDate(isoDateStr) {
  if (!isoDateStr) return '—';
  try {
    const parts = isoDateStr.split('-');
    if (parts.length !== 3) return isoDateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoDateStr;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Initial Fetch
fetchFilters();

// Initialize Real-Time Sync
setupEventSource();

// Register PWA ServiceWorker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  });
}
