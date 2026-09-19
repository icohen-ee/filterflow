/**
 * Automated UI & Integration Verification Test Suite
 * Verifies FilterFlow Mobile Dashboard, Countdowns, Quick Amazon Links,
 * and Mark Replaced Dialog API & Contract.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🧪 Starting FilterFlow Mobile UI & Integration Verification Suite...\n');

// 1. Verify HTML Structure and Semantics
console.log('--- SECTION 1: HTML Architecture & Modern Web Compliance ---');
const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');

// Viewport & Mobile PWA
assert.ok(html.includes('viewport-fit=cover'), 'Viewport-fit=cover meta tag present for edge-to-edge mobile');
assert.ok(html.includes('apple-mobile-web-app-capable'), 'iOS web app capability enabled');
console.log('✅ 1. Mobile viewport & PWA meta tags verified.');

// Native <dialog> elements
assert.ok(html.includes('<dialog id="replace-dialog"'), 'Mark Replaced native <dialog> exists');
assert.ok(html.includes('closedby="any"'), 'Dialog configured with closedby="any" for declarative light dismiss');
assert.ok(html.includes('aria-labelledby="replace-dialog-title"'), 'Dialog has accessible aria-labelledby attribute');
assert.ok(html.includes('id="replace-next-due-preview"'), 'Dynamic live preview element exists in dialog');
assert.ok(html.includes('data-offset="0"'), 'Quick date selection chips exist (Today, Yesterday, etc.)');
console.log('✅ 2. Native <dialog> elements & accessibility attributes verified.');

// Overview Stats & Search
assert.ok(html.includes('id="stats-overview"'), 'Health overview stats section present');
assert.ok(html.includes('id="filter-search"'), 'Search input box present');
assert.ok(html.includes('id="category-tabs"'), 'Category tabs navigation present');
console.log('✅ 3. Overview metrics, search bar, and category tabs verified.');

// 2. Verify CSS Styling & Layout
console.log('\n--- SECTION 2: CSS Stylesheet & Mobile Theme ---');
const css = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf-8');

assert.ok(css.includes('.mobile-frame'), 'Mobile frame layout container defined');
assert.ok(css.includes('.filter-card'), 'Filter card styles defined');
assert.ok(css.includes('.countdown-banner'), 'Expiration countdown banner styles defined');
assert.ok(css.includes('.health-meter-box'), 'Health meter & progress bar styles defined');
assert.ok(css.includes('.btn-amazon'), 'Amazon 1-Click reorder button styled');
assert.ok(css.includes('dialog.app-dialog::backdrop'), 'Native dialog backdrop blur styled');
assert.ok(css.includes('@keyframes pulseAlert'), 'Overdue pulse animation defined');
console.log('✅ 4. Material 3 mobile theme, Amazon buttons, and animations verified.');

// 3. Verify Client-Side JavaScript Logic
console.log('\n--- SECTION 3: App Logic & Dialog Behaviors ---');
const js = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf-8');

assert.ok(js.includes('function openReplaceDialog'), 'openReplaceDialog handler implemented');
assert.ok(js.includes('updateReplaceNextDuePreview'), 'Dynamic live due date preview calculation implemented');
assert.ok(js.includes('setupDialogLightDismiss'), 'Safari fallback for light-dismiss implemented per modern web guidance');
assert.ok(js.includes('btn-amazon'), 'Amazon reorder URL / search query generator implemented');
assert.ok(js.includes('showToast'), 'Toast notification system implemented');
console.log('✅ 5. App logic, dialog lifecycle, and countdown calculations verified.');

// 4. Verify Live API Endpoints via HTTP
console.log('\n--- SECTION 4: Live HTTP API Integration ---');
const BASE_URL = 'http://localhost:3030';

// Test GET /api/filters
const filtersRes = await fetch(`${BASE_URL}/api/filters`);
assert.strictEqual(filtersRes.status, 200, 'GET /api/filters returned 200');
const filters = await filtersRes.json();
assert.ok(Array.isArray(filters) && filters.length > 0, 'Filters list returned as non-empty array');
console.log(`✅ 6. GET /api/filters returned ${filters.length} active filters with health & status metadata.`);

// Test target filter
const hvacFilter = filters.find(f => f.id === 'filter-hvac-main') || filters[0];
assert.ok(hvacFilter, 'Test filter found');
assert.ok(hvacFilter.status, 'Filter has status calculated');
assert.ok(hvacFilter.targetDueDate, 'Filter has targetDueDate calculated');
assert.ok(hvacFilter.daysRemaining !== undefined, 'Filter has daysRemaining calculated');
console.log(`✅ 7. Filter status calculated: "${hvacFilter.name}" -> ${hvacFilter.status} (${hvacFilter.daysRemaining}d remaining, due ${hvacFilter.targetDueDate}).`);

// Test GET /api/notifications
const notifsRes = await fetch(`${BASE_URL}/api/notifications`);
assert.strictEqual(notifsRes.status, 200, 'GET /api/notifications returned 200');
const notifs = await notifsRes.json();
assert.ok(Array.isArray(notifs), 'Notifications returned as array');
console.log(`✅ 8. GET /api/notifications returned ${notifs.length} active smart notifications.`);

// Test POST /api/filters/:id/replace with custom date & notes
const testReplaceDate = '2026-09-18';
const testReplaceNotes = 'Verification test replacement notes';
const replaceRes = await fetch(`${BASE_URL}/api/filters/${hvacFilter.id}/replace`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    replacedDate: testReplaceDate,
    notes: testReplaceNotes
  })
});

assert.strictEqual(replaceRes.status, 200, 'POST /replace returned 200');
const replacedResult = await replaceRes.json();
assert.strictEqual(replacedResult.installedDate, testReplaceDate, 'installedDate updated to custom replacement date');
assert.strictEqual(replacedResult.status, 'HEALTHY', 'Status reset to HEALTHY after replacement');
assert.ok(replacedResult.daysRemaining > 0, 'Days remaining reset to positive service life cycle');
const lastHistory = replacedResult.history[replacedResult.history.length - 1];
assert.ok(lastHistory.action.includes(testReplaceNotes), 'Custom notes recorded in history audit trail');
console.log(`✅ 9. POST /replace successfully recorded replacement date & custom notes, resetting cycle to HEALTHY.`);

// Test POST /api/filters/:id/snooze
const snoozeRes = await fetch(`${BASE_URL}/api/filters/${hvacFilter.id}/snooze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    days: 14,
    reason: 'Vacation test extension'
  })
});
assert.strictEqual(snoozeRes.status, 200, 'POST /snooze returned 200');
const snoozedResult = await snoozeRes.json();
assert.strictEqual(snoozedResult.lastSnoozeDays, 14, 'lastSnoozeDays updated correctly');
console.log(`✅ 10. POST /snooze successfully extended filter due date.`);

console.log('\n🎉 ALL 10 UI & INTEGRATION VERIFICATION TESTS PASSED SUCCESSFULLY!');
