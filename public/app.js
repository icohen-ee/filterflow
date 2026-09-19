/**
 * FilterFlow — Mobile Filter Maintenance Dashboard & 1-Click Reorder
 * Pixel 10 Pro / Cross-Platform Responsive Web Application
 * Offline-First & Google Sheets Cloud Sync Architecture
 */

// ============================================================================
// Storage & Identity Constants
// ============================================================================

const KEY_FILTERS = 'filterflow_filters';
const KEY_QUEUE = 'filterflow_offline_queue';
const KEY_SHEETS_URL = 'filterflow_sheets_url';
const KEY_USER_ROLE = 'filterflow_user_role';
const KEY_LAST_SYNC = 'filterflow_last_sync';

const KEY_THEME = 'filterflow_theme';
const DEFAULT_SAMPLE_FILTERS = [];

// ============================================================================
// Theme Management (Light / Dark / Follow System)
// ============================================================================

function getStoredTheme() {
  return localStorage.getItem(KEY_THEME) || 'system';
}

function setStoredTheme(theme) {
  localStorage.setItem(KEY_THEME, theme);
}

function applyTheme(theme) {
  let effectiveTheme = theme;
  if (theme === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    effectiveTheme = prefersDark ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', effectiveTheme);

  const metaTheme = document.getElementById('meta-theme-color');
  if (metaTheme) {
    metaTheme.setAttribute('content', effectiveTheme === 'dark' ? '#161b22' : '#ffffff');
  }
}

// Apply stored theme immediately on script execution
applyTheme(getStoredTheme());

// Listen for dynamic OS theme changes when in 'system' mode
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
    }
  });
}

// ============================================================================
// PWA Installation & App Lifecycle
// ============================================================================

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  updatePwaInstallUI();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  showToast('🎉 FilterFlow installed as standalone app!');
  updatePwaInstallUI();
});

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

function updatePwaInstallUI() {
  const pwaBtn = document.getElementById('pwa-install-btn');
  const pwaTitle = document.getElementById('pwa-status-title');
  const pwaDesc = document.getElementById('pwa-status-desc');
  if (!pwaBtn || !pwaTitle || !pwaDesc) return;

  if (isStandalone()) {
    pwaTitle.textContent = 'Installed as Standalone App';
    pwaDesc.textContent = 'FilterFlow is running in native app mode on this device.';
    pwaBtn.textContent = 'Installed ✅';
    pwaBtn.disabled = true;
    pwaBtn.style.opacity = '0.6';
  } else if (deferredPrompt) {
    pwaTitle.textContent = 'Install FilterFlow App';
    pwaDesc.textContent = 'Install directly to your home screen or desktop with offline access.';
    pwaBtn.textContent = '📲 Install App';
    pwaBtn.disabled = false;
    pwaBtn.style.opacity = '1';
  } else {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      pwaTitle.textContent = 'Add to Home Screen (iOS)';
      pwaDesc.textContent = 'In Safari: Tap Share (⎋) at the bottom, then scroll and select "Add to Home Screen" (➕).';
      pwaBtn.textContent = 'Share > Add (+)';
      pwaBtn.disabled = false;
      pwaBtn.style.opacity = '1';
    } else {
      pwaTitle.textContent = 'App Shortcut / Install';
      pwaDesc.textContent = 'Tap browser menu (⋮) -> "Install FilterFlow" or "Create Shortcut / Add to Home Screen".';
      pwaBtn.textContent = 'Install App';
      pwaBtn.disabled = false;
      pwaBtn.style.opacity = '1';
    }
  }
}

// ============================================================================
// State Variables
// ============================================================================

let allFilters = [];
let activeCategory = 'all';
let activeStatusFilter = 'all';
let activeOwnerFilter = 'all';
let searchQuery = '';
let isSyncing = false;

// DOM Elements
const filterList = document.getElementById('filter-list');
const categoryTabs = document.getElementById('category-tabs');
const householdTabs = document.getElementById('household-tabs');
const searchInput = document.getElementById('filter-search');
const clearSearchBtn = document.getElementById('clear-search');
const notifBtn = document.getElementById('notif-btn');
const notifBadge = document.getElementById('notif-badge');
const shareBtn = document.getElementById('share-btn');
const settingsBtn = document.getElementById('settings-btn');
const addBtn = document.getElementById('add-btn');

// Sync Banner Elements
const syncBanner = document.getElementById('sync-banner');
const syncIndicatorDot = document.getElementById('sync-indicator-dot');
const syncStatusText = document.getElementById('sync-status-text');
const syncQuickBtn = document.getElementById('sync-quick-btn');

// Dialog Elements
const replaceDialog = document.getElementById('replace-dialog');
const snoozeDialog = document.getElementById('snooze-dialog');
const historyDialog = document.getElementById('history-dialog');
const notifDialog = document.getElementById('notif-dialog');
const shareDialog = document.getElementById('share-dialog');
const settingsDialog = document.getElementById('settings-dialog');
const addDialog = document.getElementById('add-dialog');

// Initialize light-dismiss fallbacks
setupDialogLightDismiss(replaceDialog);
setupDialogLightDismiss(snoozeDialog);
setupDialogLightDismiss(historyDialog);
setupDialogLightDismiss(notifDialog);
setupDialogLightDismiss(shareDialog);
setupDialogLightDismiss(settingsDialog);
setupDialogLightDismiss(addDialog);

// ============================================================================
// Local Storage & Offline Queue Helpers
// ============================================================================

function getSheetsUrl() {
  return localStorage.getItem(KEY_SHEETS_URL) || '';
}

function setSheetsUrl(url) {
  if (url) {
    localStorage.setItem(KEY_SHEETS_URL, url.trim());
  } else {
    localStorage.removeItem(KEY_SHEETS_URL);
  }
}

function getUserRole() {
  return localStorage.getItem(KEY_USER_ROLE) || 'Isaac';
}

function setUserRole(role) {
  localStorage.setItem(KEY_USER_ROLE, role || 'Household');
}

function getLastSyncTime() {
  return localStorage.getItem(KEY_LAST_SYNC) || null;
}

function setLastSyncTime(isoStr) {
  localStorage.setItem(KEY_LAST_SYNC, isoStr || new Date().toISOString());
}

function loadOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue) {
  localStorage.setItem(KEY_QUEUE, JSON.stringify(queue || []));
  updateSyncUI();
}

function enqueueOfflineAction(action) {
  const queue = loadOfflineQueue();
  action.id = 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  action.timestamp = action.timestamp || new Date().toISOString();
  queue.push(action);
  saveOfflineQueue(queue);

  // If online and sheets URL is configured, push sync
  if (navigator.onLine && getSheetsUrl()) {
    syncWithGoogleSheets();
  }
}

function loadStoredFilters() {
  try {
    const samplesCleared = localStorage.getItem('filterflow_samples_cleared_v2');
    if (!samplesCleared) {
      localStorage.setItem(KEY_FILTERS, '[]');
      localStorage.setItem('filterflow_samples_cleared_v2', 'true');
      return [];
    }
    const raw = localStorage.getItem(KEY_FILTERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(f => !f.id || (!f.id.startsWith('filter-hvac-main') && !f.id.startsWith('filter-fridge-water') && !f.id.startsWith('filter-car-cabin') && !f.id.startsWith('filter-car-engine') && !f.id.startsWith('filter-room-fan')));
      }
    }
  } catch (e) {
    console.warn('Error reading localStorage filters:', e);
  }
  return [];
}

function saveStoredFilters(filters) {
  localStorage.setItem(KEY_FILTERS, JSON.stringify(filters || []));
}

// ============================================================================
// Calculation Engine (Client-Side)
// ============================================================================

function enrichFilter(f, refDate = new Date()) {
  if (!f.installedDate) f.installedDate = new Date().toISOString().split('T')[0];
  if (!f.serviceLifeDays) f.serviceLifeDays = 90;
  if (!f.lastSnoozeDays) f.lastSnoozeDays = 0;

  if (!f.targetDueDate) {
    const d = new Date(f.installedDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + parseInt(f.serviceLifeDays, 10) + parseInt(f.lastSnoozeDays, 10));
    f.targetDueDate = d.toISOString().split('T')[0];
  }

  const dueDate = new Date(f.targetDueDate + 'T00:00:00Z');
  const ref = new Date(refDate.toISOString ? refDate.toISOString().split('T')[0] + 'T00:00:00Z' : refDate);
  const diffMs = dueDate.getTime() - ref.getTime();
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  f.daysRemaining = daysRemaining;
  f.daysOverdue = daysRemaining < 0 ? Math.abs(daysRemaining) : 0;
  f.isDueToday = daysRemaining === 0;
  f.isOrderReminderActive = daysRemaining <= 14 && daysRemaining > 0;
  f.isOverdue = daysRemaining < 0;
  f.isMonthlyRecurringReminder = f.isOverdue && (f.daysOverdue <= 3 || f.daysOverdue % 30 === 0);

  if (daysRemaining < 0) {
    f.status = 'OVERDUE';
  } else if (daysRemaining <= 14) {
    f.status = 'EXPIRING_SOON';
  } else {
    f.status = 'HEALTHY';
  }

  return f;
}

function enrichAllFilters() {
  allFilters.forEach(f => enrichFilter(f));
}

// ============================================================================
// Sync UI & Status Updates
// ============================================================================

function updateSyncUI() {
  const queue = loadOfflineQueue();
  const sheetsUrl = getSheetsUrl();
  const isOnline = navigator.onLine;

  if (!syncStatusText || !syncIndicatorDot) return;

  if (isSyncing) {
    syncIndicatorDot.className = 'sync-dot blue';
    syncStatusText.textContent = 'Syncing with Google Sheets...';
    return;
  }

  if (sheetsUrl) {
    if (!isOnline) {
      syncIndicatorDot.className = 'sync-dot yellow';
      syncStatusText.textContent = `Offline · ${queue.length} pending change(s)`;
    } else if (queue.length > 0) {
      syncIndicatorDot.className = 'sync-dot yellow';
      syncStatusText.textContent = `${queue.length} change(s) ready to sync`;
    } else {
      syncIndicatorDot.className = 'sync-dot green';
      const last = getLastSyncTime();
      syncStatusText.textContent = last ? `Synced with Google Sheets` : `Connected to Google Sheets`;
    }
  } else {
    if (queue.length > 0) {
      syncIndicatorDot.className = 'sync-dot yellow';
      syncStatusText.textContent = `Offline Local Storage (${queue.length} changes)`;
    } else {
      syncIndicatorDot.className = 'sync-dot green';
      syncStatusText.textContent = `Local Storage · Offline Ready`;
    }
  }

  // Update Settings Dialog fields if open
  const settingsBadge = document.getElementById('settings-sync-status-badge');
  const settingsLastSync = document.getElementById('settings-last-synced-time');
  const settingsPending = document.getElementById('settings-pending-count');

  if (settingsBadge) {
    settingsBadge.textContent = sheetsUrl ? (isOnline ? 'Connected to Google Sheets' : 'Offline') : 'Local Storage Only';
  }
  if (settingsLastSync) {
    const last = getLastSyncTime();
    settingsLastSync.textContent = last ? formatFriendlyDate(last.split('T')[0]) + ' ' + (new Date(last)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never';
  }
  if (settingsPending) {
    settingsPending.textContent = `${queue.length} change(s) queued`;
  }
}

// ============================================================================
// Google Sheets Cloud Sync & Conflict Resolution Engine
// ============================================================================

async function syncWithGoogleSheets(force = false) {
  const sheetsUrl = getSheetsUrl();
  if (!sheetsUrl) {
    // If no sheets URL is set, try local server if reachable
    try {
      const res = await fetch('/api/filters');
      if (res.ok) {
        allFilters = await res.json();
        saveStoredFilters(allFilters);
        enrichAllFilters();
        updateStats();
        renderFilters();
        updateNotifications();
      }
    } catch (_) {}
    updateSyncUI();
    return;
  }

  if (!navigator.onLine && !force) {
    updateSyncUI();
    return;
  }

  if (isSyncing) return;
  isSyncing = true;
  updateSyncUI();

  const queue = loadOfflineQueue();
  const payload = {
    clientFilters: allFilters,
    offlineQueue: queue,
    clientId: getUserRole(),
    clientTime: new Date().toISOString()
  };

  try {
    // Note: Use text/plain;charset=utf-8 to avoid browser CORS OPTIONS preflight
    const res = await fetch(sheetsUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.status === 'ok' && Array.isArray(data.filters)) {
      allFilters = data.filters;
      saveStoredFilters(allFilters);
      saveOfflineQueue([]); // Successfully pushed queue
      setLastSyncTime(data.syncedAt || new Date().toISOString());

      enrichAllFilters();
      updateStats();
      renderFilters();
      updateNotifications();
      showToast('☁️ Synced with Google Sheets!');
    } else {
      throw new Error(data.error || 'Invalid response from Google Sheets');
    }
  } catch (err) {
    console.warn('Google Sheets sync warning:', err);
    updateSyncUI();
  } finally {
    isSyncing = false;
    updateSyncUI();
  }
}

// ============================================================================
// Main Fetch & Startup
// ============================================================================

async function fetchFilters() {
  // 1. Instant render from local cache (0ms latency, works 100% offline)
  allFilters = loadStoredFilters();
  enrichAllFilters();
  updateStats();
  renderFilters();
  updateNotifications();
  updateSyncUI();

  // 2. Sync with cloud or fallback to local Node server
  const sheetsUrl = getSheetsUrl();
  if (sheetsUrl) {
    await syncWithGoogleSheets();
  } else {
    try {
      const res = await fetch('/api/filters');
      if (res.ok) {
        allFilters = await res.json();
        saveStoredFilters(allFilters);
        enrichAllFilters();
        updateStats();
        renderFilters();
        updateNotifications();
      }
    } catch (_) {}
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

  const elTotal = document.getElementById('stat-total');
  const elHealthy = document.getElementById('stat-healthy');
  const elSoon = document.getElementById('stat-soon');
  const elOverdue = document.getElementById('stat-overdue');

  if (elTotal) elTotal.textContent = total;
  if (elHealthy) elHealthy.textContent = healthy;
  if (elSoon) elSoon.textContent = soon;
  if (elOverdue) elOverdue.textContent = overdue;
}

const statsOverview = document.getElementById('stats-overview');
if (statsOverview) {
  statsOverview.addEventListener('click', (e) => {
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
}

// ============================================================================
// Render Filter Cards
// ============================================================================

function renderFilters() {
  if (!filterList) return;

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

  let filtered = activeCategory === 'all'
    ? allFilters
    : allFilters.filter(f => f.category === activeCategory);

  if (activeStatusFilter !== 'all') {
    filtered = filtered.filter(f => f.status === activeStatusFilter);
  }

  if (activeOwnerFilter !== 'all') {
    filtered = filtered.filter(f => f.owner === activeOwnerFilter || f.owner === 'Household');
  }

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
    const totalCycleDays = (f.serviceLifeDays || 90) + (f.lastSnoozeDays || 0);
    const daysRemaining = f.daysRemaining !== undefined ? f.daysRemaining : 0;
    
    let healthPercent = Math.max(0, Math.min(100, Math.round((daysRemaining / totalCycleDays) * 100)));
    if (f.status === 'OVERDUE') healthPercent = 0;

    const reorderLink = f.reorderUrl && f.reorderUrl.trim()
      ? f.reorderUrl.trim()
      : `https://www.amazon.com/s?k=${encodeURIComponent((f.manufacturer || '') + ' ' + (f.modelNumber || f.name) + ' filter')}`;

    const isAmazonDirect = f.reorderUrl && f.reorderUrl.includes('amazon.com/dp');

    let statusBadgeText = '';
    let countdownTitle = '';

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
        <div class="card-header">
          <div class="card-title-wrap">
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
              <span class="category-badge">${escapeHtml(f.category || 'General')}</span>
            </div>
            <h3 class="card-title">${escapeHtml(f.name)}</h3>
            <p class="card-location">📍 ${escapeHtml(f.location || 'Home')}</p>
          </div>
          <span class="status-pill ${f.status}">${statusBadgeText}</span>
        </div>

        <div class="specs-grid">
          <div class="spec-item">
            <span class="spec-label">Brand &amp; Model</span>
            <span class="spec-value">${escapeHtml(f.manufacturer || '—')} ${escapeHtml(f.modelNumber || '')}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Installed Date</span>
            <span class="spec-value">${formattedInstalled}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Target Due Date</span>
            <span class="spec-value highlight-due">${formattedTargetDue}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Service Life</span>
            <span class="spec-value">${f.serviceLifeDays || 90} days${f.lastSnoozeDays ? ` (+${f.lastSnoozeDays}d snooze)` : ''}</span>
          </div>
        </div>

        <div class="progress-wrap" aria-label="Filter Lifecycle Progress">
          <div class="progress-info">
            <span class="countdown-badge ${f.status}">${countdownTitle}</span>
            <span class="progress-percent">${healthPercent}% health</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${f.status}" style="width: ${healthPercent}%"></div>
          </div>
        </div>

        ${f.notes ? `<p class="filter-notes">💬 ${escapeHtml(f.notes)}</p>` : ''}
        ${f.lastReplacedBy ? `<p class="attribution-note">🕒 Last replaced by <strong>${escapeHtml(f.lastReplacedBy)}</strong> on ${formatFriendlyDate(f.lastReplacedDate || f.installedDate)}</p>` : ''}

        <div class="card-actions">
          <a href="${escapeHtml(reorderLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-amazon" title="Reorder replacement filter">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            <span>${isAmazonDirect ? '1-Click Buy' : 'Find Part'}</span>
          </a>

          <button class="btn btn-replace" onclick="openReplaceDialog('${escapeHtml(f.id)}')" title="Mark filter replaced today">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Replaced</span>
          </button>

          <button class="btn btn-snooze" onclick="openSnoozeDialog('${escapeHtml(f.id)}')" title="Vacation snooze due date">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Snooze</span>
          </button>

          <button class="btn btn-icon-secondary btn-history" onclick="openHistoryDialog('${escapeHtml(f.id)}')" title="View maintenance history" aria-label="View history">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </button>

          <button class="btn btn-icon-secondary btn-delete" onclick="deleteFilter('${escapeHtml(f.id)}')" title="Delete filter" aria-label="Delete filter">
            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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
  document.getElementById('replace-target-meta').textContent = `${filter.manufacturer || ''} ${filter.modelNumber || ''} • Service Life: ${filter.serviceLifeDays || 90} days`;

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('replace-date').value = todayStr;
  document.getElementById('replace-notes').value = '';

  const replaceByEl = document.getElementById('replace-by');
  if (replaceByEl) {
    replaceByEl.value = getUserRole();
  }

  document.querySelectorAll('.date-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.offset === '0');
  });

  updateReplacePreviewDate(todayStr, filter.serviceLifeDays || 90);
  replaceDialog.showModal();
}

function updateReplaceNextDuePreview(baseDateStr, serviceLifeDays) {
  try {
    const d = new Date(baseDateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + parseInt(serviceLifeDays, 10));
    const previewEl = document.getElementById('replace-next-due-preview');
    if (previewEl) {
      previewEl.textContent = formatFriendlyDate(d.toISOString().split('T')[0]);
    }
  } catch (_) {}
}

const replaceDateInput = document.getElementById('replace-date');
if (replaceDateInput) {
  replaceDateInput.addEventListener('change', (e) => {
    if (currentReplaceFilter) {
      updateReplaceNextDuePreview(e.target.value, currentReplaceFilter.serviceLifeDays || 90);
    }
  });
}

const quickDateChips = document.getElementById('quick-date-chips');
if (quickDateChips) {
  quickDateChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.date-chip');
    if (!chip || !currentReplaceFilter) return;

    document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const offset = parseInt(chip.dataset.offset, 10);
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const dateStr = d.toISOString().split('T')[0];

    document.getElementById('replace-date').value = dateStr;
    updateReplaceNextDuePreview(dateStr, currentReplaceFilter.serviceLifeDays || 90);
  });
}

const closeReplaceDialog = document.getElementById('close-replace-dialog');
const cancelReplaceBtn = document.getElementById('cancel-replace-btn');
if (closeReplaceDialog) closeReplaceDialog.addEventListener('click', () => replaceDialog.close());
if (cancelReplaceBtn) cancelReplaceBtn.addEventListener('click', () => replaceDialog.close());

const replaceForm = document.getElementById('replace-form');
if (replaceForm) {
  replaceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentReplaceFilter) return;

    const filterId = document.getElementById('replace-filter-id').value;
    const replacedDate = document.getElementById('replace-date').value;
    const notes = document.getElementById('replace-notes').value.trim();
    const replacedBy = document.getElementById('replace-by') ? document.getElementById('replace-by').value : getUserRole();

    const submitBtn = document.getElementById('submit-replace-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    // 1. Update filter locally
    const filter = allFilters.find(f => f.id === filterId);
    if (filter) {
      filter.installedDate = replacedDate;
      filter.lastReplacedDate = replacedDate;
      filter.lastReplacedBy = replacedBy;
      if (notes) filter.notes = notes;
      filter.lastSnoozeDays = 0;

      const d = new Date(replacedDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + parseInt(filter.serviceLifeDays || 90, 10));
      filter.targetDueDate = d.toISOString().split('T')[0];
      filter.updatedAt = new Date().toISOString();

      if (!filter.history) filter.history = [];
      filter.history.push({
        date: replacedDate,
        action: `Replaced by ${replacedBy}${notes ? ': ' + notes : ''}`,
        replacedBy: replacedBy,
        notes: notes || ''
      });

      enrichFilter(filter);
      saveStoredFilters(allFilters);

      // 2. Enqueue offline mutation
      enqueueOfflineAction({
        type: 'replace',
        filterId,
        timestamp: filter.updatedAt,
        payload: { replacedDate, notes, replacedBy }
      });
    }

    replaceDialog.close();
    showToast(`✅ ${filter.name} marked replaced!`);
    updateStats();
    renderFilters();
    updateNotifications();

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>✅ Confirm Replacement</span>';

    // 3. Fallback to local server if running
    try {
      fetch(`/api/filters/${filterId}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replacedDate, notes, replacedBy })
      }).catch(() => {});
    } catch (_) {}
  });
}

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

  const currentDue = new Date((currentSnoozeFilter.targetDueDate || currentSnoozeFilter.installedDate) + 'T00:00:00Z');
  currentDue.setUTCDate(currentDue.getUTCDate() + days);
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

const closeSnoozeBtn = document.getElementById('close-snooze-dialog');
const cancelSnoozeBtn = document.getElementById('cancel-snooze-btn');
if (closeSnoozeBtn) closeSnoozeBtn.addEventListener('click', () => snoozeDialog.close());
if (cancelSnoozeBtn) cancelSnoozeBtn.addEventListener('click', () => snoozeDialog.close());

const snoozeForm = document.getElementById('snooze-form');
if (snoozeForm) {
  snoozeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSnoozeFilter) return;

    const filterId = document.getElementById('snooze-filter-id').value;
    const selectedRadio = document.querySelector('input[name="snooze-days"]:checked');
    const days = selectedRadio ? parseInt(selectedRadio.value, 10) : 30;
    const reason = document.getElementById('snooze-reason').value.trim();
    const userRole = getUserRole();

    const submitBtn = document.getElementById('submit-snooze-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const filter = allFilters.find(f => f.id === filterId);
    if (filter) {
      filter.lastSnoozeDays = (parseInt(filter.lastSnoozeDays || 0, 10)) + days;
      const curDue = new Date((filter.targetDueDate || filter.installedDate) + 'T00:00:00Z');
      curDue.setUTCDate(curDue.getUTCDate() + days);
      filter.targetDueDate = curDue.toISOString().split('T')[0];
      filter.updatedAt = new Date().toISOString();

      if (!filter.history) filter.history = [];
      filter.history.push({
        date: new Date().toISOString().split('T')[0],
        action: `Snoozed ${days} days by ${userRole} (${reason || 'Vacation / low usage'})`,
        snoozedBy: userRole
      });

      enrichFilter(filter);
      saveStoredFilters(allFilters);

      enqueueOfflineAction({
        type: 'snooze',
        filterId,
        timestamp: filter.updatedAt,
        payload: { days, reason, snoozedBy: userRole }
      });
    }

    snoozeDialog.close();
    showToast(`⏸️ Extended ${filter.name} by ${days} days!`);
    updateStats();
    renderFilters();
    updateNotifications();

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>⏸️ Extend Schedule</span>';

    try {
      fetch(`/api/filters/${filterId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, reason })
      }).catch(() => {});
    } catch (_) {}
  });
}

// ============================================================================
// Dialog 3: Maintenance History Dialog
// ============================================================================

function openHistoryDialog(filterId) {
  const filter = allFilters.find(f => f.id === filterId);
  if (!filter) return;

  document.getElementById('history-target-name').textContent = filter.name;
  document.getElementById('history-target-meta').textContent = `${filter.manufacturer || ''} ${filter.modelNumber || ''} • Location: ${filter.location || 'Home'}`;

  const list = document.getElementById('history-timeline-list');
  const history = filter.history || [];

  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p style="font-size: 28px; margin-bottom: 6px;">📜</p>
        <p>No logged maintenance actions yet.</p>
      </div>
    `;
  } else {
    list.innerHTML = history.slice().reverse().map(item => `
      <div class="history-item">
        <div class="history-date">${formatFriendlyDate(item.date)}</div>
        <div class="history-action">${escapeHtml(item.action)}</div>
        ${item.replacedBy ? `<div class="history-attribution">👤 Logged by: <strong>${escapeHtml(item.replacedBy)}</strong></div>` : ''}
        ${item.notes ? `<div class="history-notes">"${escapeHtml(item.notes)}"</div>` : ''}
      </div>
    `).join('');
  }

  historyDialog.showModal();
}

const closeHistDialog = document.getElementById('close-history-dialog');
const closeHistBtn = document.getElementById('close-history-btn');
if (closeHistDialog) closeHistDialog.addEventListener('click', () => historyDialog.close());
if (closeHistBtn) closeHistBtn.addEventListener('click', () => historyDialog.close());

// ============================================================================
// Dialog 4: Smart Notifications Drawer
// ============================================================================

function updateNotifications() {
  const notifs = [];
  for (const f of allFilters) {
    if (f.isDueToday) {
      notifs.push({
        id: `due-${f.id}`,
        filterId: f.id,
        filterName: f.name,
        type: 'DUE_TODAY',
        urgency: 'high',
        title: `⚠️ Replace Today: ${f.name}`,
        message: `Has reached its ${f.serviceLifeDays || 90}-day service life.`,
        dueDate: f.targetDueDate,
        reorderUrl: f.reorderUrl
      });
    } else if (f.isOrderReminderActive) {
      notifs.push({
        id: `order-${f.id}`,
        filterId: f.id,
        filterName: f.name,
        type: 'ORDER_REMINDER',
        urgency: 'medium',
        title: `📦 Order Soon: ${f.name}`,
        message: `Expires in ${f.daysRemaining} days (${formatFriendlyDate(f.targetDueDate)}).`,
        dueDate: f.targetDueDate,
        reorderUrl: f.reorderUrl
      });
    } else if (f.isMonthlyRecurringReminder) {
      notifs.push({
        id: `overdue-${f.id}`,
        filterId: f.id,
        filterName: f.name,
        type: 'RECURRING_OVERDUE',
        urgency: 'high',
        title: `🚨 Overdue: ${f.name}`,
        message: `${f.daysOverdue} days past due! Please replace as soon as possible.`,
        dueDate: f.targetDueDate,
        reorderUrl: f.reorderUrl
      });
    }
  }

  if (notifBadge) {
    notifBadge.textContent = notifs.length;
    notifBadge.style.display = notifs.length > 0 ? 'flex' : 'none';
  }

  const notifList = document.getElementById('notif-list');
  if (notifList) {
    if (notifs.length === 0) {
      notifList.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 36px; margin-bottom: 8px;">✨</div>
          <p><strong>All filters are healthy!</strong></p>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">No upcoming expirations or overdue alerts.</p>
        </div>
      `;
    } else {
      notifList.innerHTML = notifs.map(a => `
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
              Mark Replaced
            </button>
            <button class="btn btn-snooze btn-sm" onclick="notifDialog.close(); openSnoozeDialog('${escapeHtml(a.filterId)}')">
              Snooze
            </button>
          </div>
        </div>
      `).join('');
    }
  }
}

if (notifBtn) {
  notifBtn.addEventListener('click', () => notifDialog.showModal());
}
const closeNotifBtn = document.getElementById('close-notif-dialog');
if (closeNotifBtn) closeNotifBtn.addEventListener('click', () => notifDialog.close());

// ============================================================================
// Dialog 5: Add New Filter Dialog
// ============================================================================

function openAddDialog() {
  document.getElementById('add-form').reset();
  document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
  const formOwner = document.getElementById('form-owner');
  if (formOwner) formOwner.value = getUserRole();
  addDialog.showModal();
}

if (addBtn) addBtn.addEventListener('click', openAddDialog);
const closeAddBtn = document.getElementById('close-add-dialog');
const cancelAddBtn = document.getElementById('cancel-add-btn');
if (closeAddBtn) closeAddBtn.addEventListener('click', () => addDialog.close());
if (cancelAddBtn) cancelAddBtn.addEventListener('click', () => addDialog.close());

const addForm = document.getElementById('add-form');
if (addForm) {
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      id: 'filter-' + Date.now(),
      name: document.getElementById('form-name').value.trim(),
      category: document.getElementById('form-category').value,
      location: document.getElementById('form-location').value.trim(),
      manufacturer: document.getElementById('form-mfr').value.trim(),
      modelNumber: document.getElementById('form-model').value.trim(),
      installedDate: document.getElementById('form-date').value,
      serviceLifeDays: parseInt(document.getElementById('form-life').value, 10) || 90,
      owner: document.getElementById('form-owner') ? document.getElementById('form-owner').value : getUserRole(),
      reorderUrl: document.getElementById('form-url').value.trim(),
      notes: document.getElementById('form-notes').value.trim(),
      lastSnoozeDays: 0,
      updatedAt: new Date().toISOString(),
      history: [{
        date: document.getElementById('form-date').value,
        action: `Initial install by ${document.getElementById('form-owner') ? document.getElementById('form-owner').value : getUserRole()}`
      }]
    };

    const d = new Date(payload.installedDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + payload.serviceLifeDays);
    payload.targetDueDate = d.toISOString().split('T')[0];
    payload.lastReplacedDate = payload.installedDate;
    payload.lastReplacedBy = payload.owner;

    enrichFilter(payload);
    allFilters.push(payload);
    saveStoredFilters(allFilters);

    enqueueOfflineAction({
      type: 'add',
      filterId: payload.id,
      timestamp: payload.updatedAt,
      payload
    });

    addDialog.close();
    showToast(`✅ Added filter: ${payload.name}`);
    updateStats();
    renderFilters();
    updateNotifications();

    try {
      fetch('/api/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (_) {}
  });
}

// ============================================================================
// Filter Deletion
// ============================================================================

async function deleteFilter(id) {
  const filter = allFilters.find(f => f.id === id);
  const name = filter ? filter.name : 'this filter';
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  allFilters = allFilters.filter(f => f.id !== id);
  saveStoredFilters(allFilters);

  enqueueOfflineAction({
    type: 'delete',
    filterId: id,
    timestamp: new Date().toISOString(),
    payload: {}
  });

  showToast(`🗑️ Filter deleted`);
  updateStats();
  renderFilters();
  updateNotifications();

  try {
    fetch(`/api/filters/${id}`, { method: 'DELETE' }).catch(() => {});
  } catch (_) {}
}

// ============================================================================
// Category Tabs & Search
// ============================================================================

if (categoryTabs) {
  categoryTabs.addEventListener('click', (e) => {
    const chip = e.target.closest('.tab-chip');
    if (!chip) return;
    document.querySelectorAll('.tab-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCategory = chip.dataset.category;
    renderFilters();
  });
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !searchQuery);
    renderFilters();
  });
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderFilters();
    searchInput.focus();
  });
}

function resetFilters() {
  activeCategory = 'all';
  activeStatusFilter = 'all';
  activeOwnerFilter = 'all';
  searchQuery = '';
  if (searchInput) searchInput.value = '';
  if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
  document.querySelectorAll('.tab-chip').forEach(c => c.classList.toggle('active', c.dataset.category === 'all'));
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
    // If local server is not running, provide current browser location
    const urlInput = document.getElementById('share-url-input');
    if (urlInput) urlInput.value = window.location.href;
  }
}

if (shareBtn) shareBtn.addEventListener('click', openShareDialog);
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
      showToast('📋 Copied URL to clipboard!');
    } catch {
      urlInput.select();
      document.execCommand('copy');
      showToast('📋 Copied URL to clipboard!');
    }
  });
}

// ============================================================================
// Dialog 7: Google Sheets Cloud Sync Settings Dialog
// ============================================================================

function openSettingsDialog() {
  if (!settingsDialog) return;
  const sheetsUrlInput = document.getElementById('settings-sheets-url');
  const userRoleSelect = document.getElementById('settings-user-role');
  const themeSelect = document.getElementById('settings-theme');

  if (sheetsUrlInput) sheetsUrlInput.value = getSheetsUrl();
  if (userRoleSelect) userRoleSelect.value = getUserRole();
  if (themeSelect) themeSelect.value = getStoredTheme();

  updatePwaInstallUI();
  updateSyncUI();
  settingsDialog.showModal();
}

if (settingsBtn) settingsBtn.addEventListener('click', openSettingsDialog);
if (syncQuickBtn) syncQuickBtn.addEventListener('click', () => syncWithGoogleSheets(true));

// Theme live selector
const themeSelect = document.getElementById('settings-theme');
if (themeSelect) {
  themeSelect.addEventListener('change', (e) => {
    const newTheme = e.target.value;
    setStoredTheme(newTheme);
    applyTheme(newTheme);
    showToast(`Theme updated: ${newTheme === 'system' ? 'Follow System' : newTheme.toUpperCase()}`);
  });
}

// PWA Install Button handler
const pwaInstallBtn = document.getElementById('pwa-install-btn');
if (pwaInstallBtn) {
  pwaInstallBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        showToast('🚀 Installing FilterFlow...');
      } else {
        showToast('Installation cancelled');
      }
      deferredPrompt = null;
      updatePwaInstallUI();
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        showToast('In Safari: tap Share (⎋) at bottom, then "Add to Home Screen" (➕)');
      } else {
        showToast('Tap browser menu (⋮) -> "Install FilterFlow" or "Create Shortcut / Add to Home screen"');
      }
    }
  });
}

// Clear All Filters Button handler
const clearAllDataBtn = document.getElementById('clear-all-data-btn');
if (clearAllDataBtn) {
  clearAllDataBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all tracked filters? This will delete all example and tracked filters so you can add your own from scratch.')) {
      return;
    }
    allFilters = [];
    saveStoredFilters([]);
    localStorage.setItem('filterflow_samples_cleared_v2', 'true');
    renderFilters();
    updateStats();
    updateNotifications();

    try {
      await fetch('/api/filters/clear', { method: 'POST' });
    } catch (_) {}

    settingsDialog.close();
    showToast('🗑️ All filters cleared! You can now add your own.');
  });
}

const saveSettingsBtn = document.getElementById('save-settings-btn');
if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', async () => {
    const sheetsUrlInput = document.getElementById('settings-sheets-url');
    const userRoleSelect = document.getElementById('settings-user-role');
    const themeSel = document.getElementById('settings-theme');

    if (sheetsUrlInput) setSheetsUrl(sheetsUrlInput.value.trim());
    if (userRoleSelect) setUserRole(userRoleSelect.value);
    if (themeSel) {
      setStoredTheme(themeSel.value);
      applyTheme(themeSel.value);
    }

    settingsDialog.close();
    showToast('💾 Preferences saved!');
    await syncWithGoogleSheets(true);
  });
}

const forceSyncBtn = document.getElementById('force-sync-now-btn');
if (forceSyncBtn) {
  forceSyncBtn.addEventListener('click', async () => {
    await syncWithGoogleSheets(true);
  });
}

// Auto-sync when internet comes back online
window.addEventListener('online', () => {
  showToast('🌐 Internet reconnected! Syncing changes...');
  syncWithGoogleSheets(true);
});

window.addEventListener('offline', () => {
  updateSyncUI();
});

// Periodic sync every 2 minutes when online
setInterval(() => {
  if (navigator.onLine && getSheetsUrl()) {
    syncWithGoogleSheets();
  }
}, 120000);

// ============================================================================
// Real-Time Multi-Device Sync (Server-Sent Events Fallback)
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
    es.addEventListener('filters_cleared', () => {
      allFilters = [];
      saveStoredFilters([]);
      renderFilters();
      updateStats();
      updateNotifications();
      showToast('🗑️ Filter list cleared');
    });
    es.onerror = () => {};
  } catch (_) {}
}

// ============================================================================
// Modern Web Dialog Utilities & Helpers
// ============================================================================

function setupDialogLightDismiss(dialog) {
  if (!dialog) return;

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
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-bubble';
  toast.textContent = message;
  container.appendChild(toast);

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

// Initial Fetch & Render
fetchFilters();

// Initialize Local SSE if local server is running
setupEventSource();

// Register PWA ServiceWorker using relative path
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  });
}
