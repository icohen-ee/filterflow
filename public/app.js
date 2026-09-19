let allFilters = [];
let activeCategory = 'all';

async function fetchFilters() {
  try {
    const res = await fetch('/api/filters');
    allFilters = await res.json();
    renderFilters();
    updateNotifications();
  } catch (err) {
    console.error('Failed to load filters:', err);
  }
}

function renderFilters() {
  const container = document.getElementById('filter-list');

  if (allFilters.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center; padding: 48px 24px; color:#555;">
        <div style="font-size: 48px; margin-bottom: 16px;">🛡️</div>
        <h3 style="font-size: 18px; color: #1e2025; margin-bottom: 8px;">No filters tracked yet</h3>
        <p style="font-size: 14px; line-height: 1.5; color: #666; max-width: 320px; margin: 0 auto 20px;">
          Tap the <strong>+ Add Filter</strong> button below to set up your home HVAC, vehicle, or refrigerator filters.
        </p>
      </div>
    `;
    return;
  }

  const filtered = activeCategory === 'all' 
    ? allFilters 
    : allFilters.filter(f => f.category === activeCategory);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="text-align:center; padding: 40px 20px; color:#777;">
      <p style="font-size: 32px; margin-bottom:8px;">🍃</p>
      <p>No filters found in category "${escapeHtml(activeCategory)}".</p>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(f => {
    // Calculate elapsed percentage
    const totalDays = f.serviceLifeDays + (f.lastSnoozeDays || 0);
    const elapsedDays = totalDays - f.daysRemaining;
    const percent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

    const statusBadgeText = f.status === 'HEALTHY' 
      ? `${f.daysRemaining} days left` 
      : f.status === 'EXPIRING_SOON'
      ? `Due in ${f.daysRemaining}d`
      : `${Math.abs(f.daysRemaining)}d OVERDUE`;

    return `
      <article class="filter-card" data-id="${f.id}">
        <div class="card-top">
          <div>
            <h3 class="card-title">${escapeHtml(f.name)}</h3>
            <p class="card-location">${escapeHtml(f.location)} • ${escapeHtml(f.category)}</p>
          </div>
          <span class="status-chip ${f.status}">${statusBadgeText}</span>
        </div>

        <div class="card-specs">
          <div class="spec-line">
            <span class="spec-label">Model / Dimensions:</span>
            <span class="spec-value">${escapeHtml(f.modelNumber || 'Standard')}</span>
          </div>
          <div class="spec-line">
            <span class="spec-label">Brand:</span>
            <span class="spec-value">${escapeHtml(f.manufacturer || 'OEM')}</span>
          </div>
          <div class="spec-line">
            <span class="spec-label">Target Due Date:</span>
            <span class="spec-value">${escapeHtml(f.targetDueDate)}</span>
          </div>
        </div>

        <!-- Life bar -->
        <div class="progress-bar-container" title="${percent}% of service life elapsed">
          <div class="progress-fill ${f.status}" style="width: ${percent}%"></div>
        </div>

        <div class="card-actions">
          ${f.reorderUrl ? `
            <a href="${escapeHtml(f.reorderUrl)}" target="_blank" rel="noopener" class="btn btn-amazon">
              🛒 1-Click Buy
            </a>
          ` : ''}
          <button class="btn btn-replace" onclick="markReplaced('${f.id}')">
            🔄 Replaced
          </button>
          <button class="btn btn-snooze" onclick="snoozeFilter('${f.id}')" title="Snooze 30 days if HVAC was idle on vacation">
            ⏸️ Snooze 30d
          </button>
          <button class="btn btn-delete" onclick="deleteFilter('${f.id}')" title="Delete filter">
            🗑️
          </button>
        </div>
      </article>
    `;
  }).join('');
}

async function markReplaced(id) {
  if (!confirm('Mark this filter as replaced today? This resets its lifecycle.')) return;
  try {
    const res = await fetch(`/api/filters/${id}/replace`, { method: 'POST' });
    if (res.ok) {
      await fetchFilters();
    }
  } catch (err) {
    alert('Failed to mark replaced: ' + err.message);
  }
}

async function snoozeFilter(id) {
  try {
    const res = await fetch(`/api/filters/${id}/snooze`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 30 })
    });
    if (res.ok) {
      await fetchFilters();
    }
  } catch (err) {
    alert('Failed to snooze: ' + err.message);
  }
}

async function deleteFilter(id) {
  if (!confirm('Delete this filter? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/filters/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchFilters();
    }
  } catch (err) {
    alert('Failed to delete: ' + err.message);
  }
}

async function updateNotifications() {
  try {
    const res = await fetch('/api/notifications');
    const alerts = await res.json();
    const badge = document.getElementById('notif-badge');
    badge.textContent = alerts.length;
    badge.style.display = alerts.length > 0 ? 'flex' : 'none';

    const notifList = document.getElementById('notif-list');
    if (alerts.length === 0) {
      notifList.innerHTML = '<p style="text-align:center; color:#666; padding:20px;">✨ All filters are good! No action needed.</p>';
    } else {
      notifList.innerHTML = alerts.map(a => `
        <div class="notif-card">
          <div class="notif-title">${escapeHtml(a.title)}</div>
          <div class="notif-msg">${escapeHtml(a.message)}</div>
          ${a.reorderUrl ? `
            <a href="${escapeHtml(a.reorderUrl)}" target="_blank" rel="noopener" class="btn btn-amazon" style="align-self: flex-start; margin-top: 6px;">
              🛒 Order from Amazon
            </a>
          ` : ''}
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
}

// Category Tabs Click
document.getElementById('category-tabs').addEventListener('click', (e) => {
  if (!e.target.classList.contains('tab-chip')) return;
  document.querySelectorAll('.tab-chip').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  activeCategory = e.target.dataset.category;
  renderFilters();
});

// Notifications modal
const notifModal = document.getElementById('notif-modal');
document.getElementById('notif-btn').addEventListener('click', () => {
  notifModal.classList.remove('hidden');
});
document.getElementById('close-notif').addEventListener('click', () => {
  notifModal.classList.add('hidden');
});

// Add modal
const addModal = document.getElementById('add-modal');
document.getElementById('add-btn').addEventListener('click', () => {
  document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
  addModal.classList.remove('hidden');
});
document.getElementById('close-add').addEventListener('click', () => {
  addModal.classList.add('hidden');
});

// Form submit
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('form-name').value,
    category: document.getElementById('form-category').value,
    location: document.getElementById('form-location').value,
    manufacturer: document.getElementById('form-mfr').value,
    modelNumber: document.getElementById('form-model').value,
    installedDate: document.getElementById('form-date').value,
    serviceLifeDays: parseInt(document.getElementById('form-life').value, 10),
    reorderUrl: document.getElementById('form-url').value,
    notes: document.getElementById('form-notes').value
  };

  try {
    const res = await fetch('/api/filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      addModal.classList.add('hidden');
      document.getElementById('add-form').reset();
      await fetchFilters();
    }
  } catch (err) {
    alert('Error adding filter: ' + err.message);
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Initial fetch
fetchFilters();

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('FilterFlow ServiceWorker registered:', reg.scope);
    }).catch((err) => {
      console.log('ServiceWorker registration failed:', err);
    });
  });
}
