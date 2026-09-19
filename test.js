import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FilterEngine, isValidISODateString, isValidHttpUrl } from './filter_engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, 'data', 'test_filters.json');

// Clean test db
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

const engine = new FilterEngine(TEST_DB);

console.log('🧪 Starting Filter Tracker Unit & Security Test Suite...\n');

// ============================================================================
// SECTION 1: Baseline Core Functionality
// ============================================================================
console.log('--- SECTION 1: Core Lifecycle & Status Calculations ---');

// 1. Add filter
const created = engine.addFilter({
  name: 'Test Furnace Filter',
  category: 'Home HVAC',
  location: 'Basement',
  manufacturer: 'Filtrete',
  modelNumber: '20x25x1',
  installedDate: '2026-06-01',
  serviceLifeDays: 90,
  reorderUrl: 'https://amazon.com/dp/test'
});

assert.strictEqual(created.name, 'Test Furnace Filter');
assert.strictEqual(created.targetDueDate, '2026-08-30');
console.log('✅ 1. Filter creation & target due date calculation passed.');

// 2. Status verification with simulated reference date
const refDate = new Date('2026-08-20'); // 10 days before Aug 30
const status10DaysBefore = engine.calculateFilterStatus(engine.loadFilters()[0], refDate);
assert.strictEqual(status10DaysBefore.status, 'EXPIRING_SOON');
assert.strictEqual(status10DaysBefore.isOrderReminderActive, true);
assert.strictEqual(status10DaysBefore.daysRemaining, 10);
console.log('✅ 2. 14-day pre-order warning calculation passed (10 days remaining).');

// 3. Due today check
const refDateToday = new Date('2026-08-30');
const statusToday = engine.calculateFilterStatus(engine.loadFilters()[0], refDateToday);
assert.strictEqual(statusToday.status, 'OVERDUE');
assert.strictEqual(statusToday.isDueToday, true);
console.log('✅ 3. Expiration day alert calculation passed.');

// 4. Overdue check
const refDateOverdue = new Date('2026-09-19'); // 20 days overdue
const statusOverdue = engine.calculateFilterStatus(engine.loadFilters()[0], refDateOverdue);
assert.strictEqual(statusOverdue.status, 'OVERDUE');
assert.strictEqual(statusOverdue.daysRemaining, -20);
console.log('✅ 4. Overdue alert calculation passed (-20 days).');

// 5. Vacation Snooze check
const snoozed = engine.snooze(created.id, 30, 'Summer vacation');
assert.strictEqual(snoozed.targetDueDate, '2026-09-29'); // Extended by 30 days
const statusAfterSnooze = engine.calculateFilterStatus(snoozed, refDateOverdue);
assert.strictEqual(statusAfterSnooze.status, 'EXPIRING_SOON');
assert.strictEqual(statusAfterSnooze.daysRemaining, 10);
console.log('✅ 5. Vacation snooze (+30 days) extension passed.');

// 6. Replacement check with custom notes
const replaced = engine.markReplaced(created.id, '2026-09-19', 'Cleaned intake grill');
assert.strictEqual(replaced.installedDate, '2026-09-19');
assert.strictEqual(replaced.lastSnoozeDays, 0); // Snooze reset
assert.strictEqual(replaced.targetDueDate, '2026-12-18');
assert.strictEqual(replaced.history[replaced.history.length - 1].action.includes('Cleaned intake grill'), true);
console.log('✅ 6. Filter replacement & lifecycle reset with notes passed.');

// 7. Delete check
const deleted = engine.deleteFilter(created.id);
assert.strictEqual(deleted, true);
assert.strictEqual(engine.loadFilters().length, 0);
console.log('✅ 7. Filter deletion passed.');

// ============================================================================
// SECTION 2: Leap Year Edge Cases
// ============================================================================
console.log('\n--- SECTION 2: Leap Year Calculations & Edge Cases ---');

// 8. Installation on Leap Day (2024-02-29) with 1 day service life -> 2024-03-01
const leapDayPlus1 = engine.calculateFilterStatus({
  installedDate: '2024-02-29',
  serviceLifeDays: 1,
  lastSnoozeDays: 0
});
assert.strictEqual(leapDayPlus1.targetDueDate, '2024-03-01');
console.log('✅ 8. Leap day (2024-02-29) + 1 day correctly advances to 2024-03-01.');

// 9. Installation on Leap Year Eve (2024-02-28) + 1 day -> 2024-02-29
const leapEvePlus1 = engine.calculateFilterStatus({
  installedDate: '2024-02-28',
  serviceLifeDays: 1,
  lastSnoozeDays: 0
});
assert.strictEqual(leapEvePlus1.targetDueDate, '2024-02-29');
console.log('✅ 9. Leap year eve (2024-02-28) + 1 day lands on Feb 29.');

// 10. Installation on non-leap year eve (2023-02-28) + 1 day -> 2023-03-01
const nonLeapEvePlus1 = engine.calculateFilterStatus({
  installedDate: '2023-02-28',
  serviceLifeDays: 1,
  lastSnoozeDays: 0
});
assert.strictEqual(nonLeapEvePlus1.targetDueDate, '2023-03-01');
console.log('✅ 10. Non-leap year eve (2023-02-28) + 1 day lands on March 1.');

// 11. Leap day (2024-02-29) with 365 days service life -> 2025-02-28
const leapYearPlus365 = engine.calculateFilterStatus({
  installedDate: '2024-02-29',
  serviceLifeDays: 365,
  lastSnoozeDays: 0
});
assert.strictEqual(leapYearPlus365.targetDueDate, '2025-02-28');
console.log('✅ 11. Leap day (2024-02-29) + 365 days correctly lands on 2025-02-28.');

// 12. Non-leap year (2023-02-28) with 365 days spanning leap day -> 2024-02-28
const spanningLeapPlus365 = engine.calculateFilterStatus({
  installedDate: '2023-02-28',
  serviceLifeDays: 365,
  lastSnoozeDays: 0
});
assert.strictEqual(spanningLeapPlus365.targetDueDate, '2024-02-28');
console.log('✅ 12. 365 days spanning leap year correctly accounts for February 29.');

// 13. Rejection of invalid leap dates (e.g. 2025-02-29 in non-leap year)
assert.strictEqual(isValidISODateString('2024-02-29'), true, '2024 is leap year');
assert.strictEqual(isValidISODateString('2025-02-29'), false, '2025 is NOT a leap year');
assert.strictEqual(isValidISODateString('2000-02-29'), true, '2000 was a century leap year (divisible by 400)');
assert.strictEqual(isValidISODateString('2100-02-29'), false, '2100 is NOT a leap year (divisible by 100 but not 400)');
assert.throws(() => {
  engine.addFilter({
    name: 'Invalid Leap Filter',
    installedDate: '2025-02-29',
    serviceLifeDays: 90
  });
}, /Invalid installedDate/, 'Should reject invalid leap day 2025-02-29');
console.log('✅ 13. Leap year date validator accurately rejects non-leap Feb 29 dates.');

// ============================================================================
// SECTION 3: Multi-Month Snoozes & Overdue Snooze Logic
// ============================================================================
console.log('\n--- SECTION 3: Multi-Month Snooze Logic ---');

// 14. Single multi-month snooze (+60 days, +90 days)
const multiFilter = engine.addFilter({
  id: 'multi-snooze-test',
  name: 'Multi Snooze Filter',
  installedDate: '2026-01-01',
  serviceLifeDays: 90 // Initial due: 2026-04-01
});
assert.strictEqual(multiFilter.targetDueDate, '2026-04-01');

const snoozed60 = engine.snooze('multi-snooze-test', 60, 'Extended winter vacation');
assert.strictEqual(snoozed60.lastSnoozeDays, 60);
assert.strictEqual(snoozed60.targetDueDate, '2026-05-31'); // 90 + 60 = 150 days from Jan 1
console.log('✅ 14. Single multi-month snooze (+60 days) calculated correctly.');

// 15. Chained successive snoozes (30d + 30d = 60d cumulative)
const chainedFilter = engine.addFilter({
  id: 'chained-snooze-test',
  name: 'Chained Snooze Filter',
  installedDate: '2026-01-01',
  serviceLifeDays: 90
});
engine.snooze('chained-snooze-test', 30, 'Vacation part 1');
const chainedFinal = engine.snooze('chained-snooze-test', 30, 'Vacation part 2');
assert.strictEqual(chainedFinal.lastSnoozeDays, 60);
assert.strictEqual(chainedFinal.targetDueDate, '2026-05-31');
assert.strictEqual(chainedFinal.history.length, 3); // initial + 2 snoozes
console.log('✅ 15. Successive multi-month snoozes correctly accumulate days and history.');

// 16. Rejection of zero, negative, or NaN snooze values
assert.throws(() => {
  engine.snooze('chained-snooze-test', -30);
}, /Extension days must be a positive integer/);
assert.throws(() => {
  engine.snooze('chained-snooze-test', 0);
}, /Extension days must be a positive integer/);
assert.throws(() => {
  engine.snooze('chained-snooze-test', 'abc');
}, /Extension days must be a positive integer/);
console.log('✅ 16. Negative, zero, and NaN snooze inputs properly rejected without DB corruption.');

// 17. Snooze on non-existent filter ID returns null
const nullSnooze = engine.snooze('non-existent-filter-id', 30);
assert.strictEqual(nullSnooze, null);
console.log('✅ 17. Snooze on non-existent filter safely returns null.');

// 18. Snooze history bounding (caps at 50 to prevent unbounded storage)
for (let i = 0; i < 55; i++) {
  engine.snooze('chained-snooze-test', 1, `Test snooze ${i}`);
}
const boundedFilter = engine.getFilterById('chained-snooze-test');
assert.ok(boundedFilter.history.length <= 50, 'History should be bounded at max 50 entries');
console.log(`✅ 18. History array bounded successfully (length = ${boundedFilter.history.length}).`);

// Cleanup section 3 filters
engine.deleteFilter('multi-snooze-test');
engine.deleteFilter('chained-snooze-test');

// ============================================================================
// SECTION 4: Overdue Recurrences & Notification Cadence
// ============================================================================
console.log('\n--- SECTION 4: Overdue Recurrences & Reminder Engine ---');

// 19. Status flags on day of expiration (Day 0)
const dueTodayFilter = {
  id: 'due-today-test',
  name: 'Due Today Filter',
  installedDate: '2026-01-01',
  serviceLifeDays: 90, // targetDue: 2026-04-01
  lastSnoozeDays: 0
};
const day0Status = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-04-01'));
assert.strictEqual(day0Status.daysRemaining, 0);
assert.strictEqual(day0Status.isDueToday, true);
assert.strictEqual(day0Status.isOverdue, false);
console.log('✅ 19. Day 0 expiration flags correctly evaluated.');

// 20. Overdue recurrence cadence: Initial 3-day grace period (Days -1, -2, -3)
const day1Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-04-02'));
const day2Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-04-03'));
const day3Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-04-04'));
assert.strictEqual(day1Overdue.daysRemaining, -1);
assert.strictEqual(day1Overdue.isMonthlyRecurringReminder, true);
assert.strictEqual(day2Overdue.daysRemaining, -2);
assert.strictEqual(day2Overdue.isMonthlyRecurringReminder, true);
assert.strictEqual(day3Overdue.daysRemaining, -3);
assert.strictEqual(day3Overdue.isMonthlyRecurringReminder, true);
console.log('✅ 20. Initial 3-day overdue window triggers reminder.');

// 21. Overdue recurrence quiet period (Days -4 through -29)
const day4Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-04-05'));
const day15Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-04-16'));
const day29Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-04-30'));
assert.strictEqual(day4Overdue.isMonthlyRecurringReminder, false);
assert.strictEqual(day15Overdue.isMonthlyRecurringReminder, false);
assert.strictEqual(day29Overdue.isMonthlyRecurringReminder, false);
console.log('✅ 21. Non-recurring overdue days (-4, -15, -29) are quiet.');

// 22. Monthly recurring reminders: Day -30, Day -60, Day -90
const day30Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-05-01'));
const day60Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-05-31'));
const day90Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-06-30'));
assert.strictEqual(day30Overdue.daysRemaining, -30);
assert.strictEqual(day30Overdue.isMonthlyRecurringReminder, true);
assert.strictEqual(day60Overdue.daysRemaining, -60);
assert.strictEqual(day60Overdue.isMonthlyRecurringReminder, true);
assert.strictEqual(day90Overdue.daysRemaining, -90);
assert.strictEqual(day90Overdue.isMonthlyRecurringReminder, true);
console.log('✅ 22. Monthly recurring reminders correctly trigger at 30, 60, and 90 days overdue.');

// 23. Days immediately following recurrence (e.g. Day -31) return to quiet
const day31Overdue = engine.calculateFilterStatus(dueTodayFilter, new Date('2026-05-02'));
assert.strictEqual(day31Overdue.daysRemaining, -31);
assert.strictEqual(day31Overdue.isMonthlyRecurringReminder, false);
console.log('✅ 23. Day 31 returns to quiet state.');

// 24. Notification Engine filtering: recurringOnly option
engine.addFilter({
  id: 'notif-overdue-filter',
  name: 'Overdue Filter Notification Test',
  installedDate: '2026-01-01',
  serviceLifeDays: 90 // Target due: 2026-04-01
});

// On Day -4 (April 5):
// Default mode (for dashboard UI) shows overdue alert
const dashboardAlerts = engine.getNotifications(new Date('2026-04-05'));
assert.strictEqual(dashboardAlerts.length, 1);
assert.strictEqual(dashboardAlerts[0].type, 'OVERDUE_ALERT');
assert.strictEqual(dashboardAlerts[0].isMonthlyRecurringReminder, false);

// recurringOnly mode (for WhatsApp / push scheduler) silences Day -4
const recurringAlertsQuiet = engine.getNotifications({
  referenceDate: new Date('2026-04-05'),
  recurringOnly: true
});
assert.strictEqual(recurringAlertsQuiet.length, 0);

// recurringOnly mode on Day -30 (May 1) triggers monthly alert
const recurringAlertsDay30 = engine.getNotifications({
  referenceDate: new Date('2026-05-01'),
  recurringOnly: true
});
assert.strictEqual(recurringAlertsDay30.length, 1);
assert.strictEqual(recurringAlertsDay30[0].type, 'OVERDUE_ALERT');
assert.strictEqual(recurringAlertsDay30[0].isMonthlyRecurringReminder, true);
console.log('✅ 24. Notification filtering (recurringOnly) prevents alert spam while supporting UI badges.');

engine.deleteFilter('notif-overdue-filter');

// ============================================================================
// SECTION 5: Security, Validation & Error Handling
// ============================================================================
console.log('\n--- SECTION 5: Security, Validation & Fault Tolerance ---');

// 25. Rejection of Malicious Filter IDs (single quote / XSS attribute breakout)
assert.throws(() => {
  engine.addFilter({
    id: "test'--><script>alert(1)</script>",
    name: 'XSS Filter',
    installedDate: '2026-06-01',
    serviceLifeDays: 90
  });
}, /Invalid filter ID/);
console.log('✅ 25. Malicious filter IDs containing quotes/scripts rejected.');

// 26. Safe URL validation (rejection of javascript: / data: schemes)
assert.strictEqual(isValidHttpUrl('https://amazon.com/dp/12345'), true);
assert.strictEqual(isValidHttpUrl('http://filters.com/spec'), true);
assert.strictEqual(isValidHttpUrl('javascript:alert(document.cookie)'), false);
assert.strictEqual(isValidHttpUrl('data:text/html,<script>alert(1)</script>'), false);
assert.throws(() => {
  engine.addFilter({
    name: 'XSS URL Filter',
    installedDate: '2026-06-01',
    serviceLifeDays: 90,
    reorderUrl: 'javascript:alert(document.cookie)'
  });
}, /Invalid reorderUrl/);
console.log('✅ 26. Malicious reorderUrl protocols (javascript:) rejected.');

// 27. Rejection of invalid calendar dates (e.g. month 13, day 32, April 31)
assert.strictEqual(isValidISODateString('2026-04-31'), false, 'April only has 30 days');
assert.strictEqual(isValidISODateString('2026-13-01'), false, 'Month 13 does not exist');
assert.strictEqual(isValidISODateString('not-a-date'), false, 'Invalid string format');
assert.throws(() => {
  engine.addFilter({
    name: 'Invalid Date Filter',
    installedDate: '2026-04-31',
    serviceLifeDays: 90
  });
}, /Invalid installedDate/);
console.log('✅ 27. Invalid calendar dates (e.g. 2026-04-31) rejected.');

// 28. Rejection of non-positive service life
assert.throws(() => {
  engine.addFilter({
    name: 'Negative Life Filter',
    installedDate: '2026-06-01',
    serviceLifeDays: -10
  });
}, /Invalid serviceLifeDays/);
assert.throws(() => {
  engine.addFilter({
    name: 'Zero Life Filter',
    installedDate: '2026-06-01',
    serviceLifeDays: 0
  });
}, /Invalid serviceLifeDays/);
console.log('✅ 28. Non-positive service life days properly rejected.');

// 29. Rejection of duplicate filter IDs
engine.addFilter({
  id: 'unique-id-123',
  name: 'First Filter',
  installedDate: '2026-06-01',
  serviceLifeDays: 90
});
assert.throws(() => {
  engine.addFilter({
    id: 'unique-id-123',
    name: 'Duplicate Filter',
    installedDate: '2026-06-01',
    serviceLifeDays: 90
  });
}, /already exists/);
engine.deleteFilter('unique-id-123');
console.log('✅ 29. Duplicate filter ID collisions properly prevented.');

// 30. Safe recovery on corrupted or empty database JSON
const corruptDbPath = path.join(__dirname, 'data', 'corrupt_test.json');
fs.writeFileSync(corruptDbPath, '{ corrupted json :::: }}}', 'utf-8');
const corruptEngine = new FilterEngine(corruptDbPath);
const loadedCorrupt = corruptEngine.loadFilters();
assert.deepStrictEqual(loadedCorrupt, [], 'Should recover gracefully with empty array on JSON syntax error');
if (fs.existsSync(corruptDbPath)) fs.unlinkSync(corruptDbPath);
console.log('✅ 30. Corrupted database file handled gracefully without crashing.');

console.log('\n--- SECTION 6: Cross-Platform & Household Sharing Suite ---');

// 31. Filter creation with household owner assignment
const isaacFilter = engine.addFilter({
  name: "Isaac's Garage Workshop Purifier",
  category: 'Portable Appliance',
  installedDate: '2026-08-01',
  serviceLifeDays: 90,
  owner: 'Isaac'
});
assert.strictEqual(isaacFilter.owner, 'Isaac');
assert.strictEqual(isaacFilter.lastReplacedBy, 'Isaac');

const wifeFilter = engine.addFilter({
  name: "Wife's Office Desk Air Filter",
  category: 'Portable Appliance',
  installedDate: '2026-08-01',
  serviceLifeDays: 90,
  owner: 'Wife'
});
assert.strictEqual(wifeFilter.owner, 'Wife');
assert.strictEqual(wifeFilter.lastReplacedBy, 'Wife');
console.log('✅ 31. Filter creation with household owner assignment passed.');

// 32. Filtering by household member owner
const wifeFilters = engine.getAllFilters(new Date('2026-09-19'), { owner: 'Wife' });
assert(wifeFilters.some(f => f.name === "Wife's Office Desk Air Filter"), 'Wife should see her own filter');
assert(!wifeFilters.some(f => f.name === "Isaac's Garage Workshop Purifier"), 'Wife should not see Isaac-only filter');

const isaacFilters = engine.getAllFilters(new Date('2026-09-19'), { owner: 'Isaac' });
assert(isaacFilters.some(f => f.name === "Isaac's Garage Workshop Purifier"), 'Isaac should see his own filter');
assert(!isaacFilters.some(f => f.name === "Wife's Office Desk Air Filter"), 'Isaac should not see Wife-only filter');
console.log('✅ 32. Household owner filtering in getAllFilters passed.');

// 33. Mark replaced records attribution and history
const replacedByWife = engine.markReplaced(wifeFilter.id, '2026-09-19', 'Installed fresh HEPA cartridge', 'Wife');
assert.strictEqual(replacedByWife.lastReplacedBy, 'Wife');
assert.strictEqual(replacedByWife.installedDate, '2026-09-19');
const latestHistory = replacedByWife.history[replacedByWife.history.length - 1];
assert.strictEqual(latestHistory.replacedBy, 'Wife');
assert(latestHistory.action.includes('Installed fresh HEPA cartridge'), 'Action notes should reference notes');
console.log('✅ 33. Mark replaced with family member attribution passed.');

// 34. Natural language fuzzy filter matching on production filter catalog
const prodEngine = new FilterEngine();
const matchedFridge = prodEngine.findFilter('refrigerator ice filter');
assert(matchedFridge && matchedFridge.id === 'filter-fridge-water', 'Should match fridge filter');

const matchedHvac = prodEngine.findFilter('hallway return ac filter');
assert(matchedHvac && matchedHvac.id === 'filter-hvac-main', 'Should match central HVAC return');

const matchedCabin = prodEngine.findFilter('glovebox cabin air');
assert(matchedCabin && matchedCabin.id === 'filter-car-cabin', 'Should match car cabin filter');

const matchedEngine = prodEngine.findFilter('car engine intake under hood');
assert(matchedEngine && matchedEngine.id === 'filter-car-engine', 'Should match car engine filter');

const matchedPurifier = prodEngine.findFilter('bedroom purifier fan');
assert(matchedPurifier && matchedPurifier.id === 'filter-room-fan', 'Should match bedroom purifier');
console.log('✅ 34. Natural language keyword and synonym fuzzy matching passed.');

// 35. Stop words rejection prevents false-matching in general queries
const stopWordsMatch = prodEngine.findFilter('what is due');
assert.strictEqual(stopWordsMatch, null, 'Generic queries with only stop words must return null');
console.log('✅ 35. Query stop words correctly prevent false-positive filter matches.');

// 36. Assistant query handler: general summary
const summaryResult = prodEngine.handleAssistantCommand('what filters are due?');
assert.strictEqual(summaryResult.success, true);
assert.strictEqual(summaryResult.actionTaken, 'summary');
assert(summaryResult.reply.includes('FilterFlow — Household Filter Status'));
assert(summaryResult.reply.includes('Pixel 10 Pro & iPhone'));
console.log('✅ 36. Assistant command: general summary with WhatsApp formatting passed.');

// 37. Assistant query handler: specific filter status
const statusResult = prodEngine.handleAssistantCommand('when is the fridge filter due?');
assert.strictEqual(statusResult.success, true);
assert.strictEqual(statusResult.actionTaken, 'filter_status');
assert(statusResult.reply.includes('Refrigerator Water & Ice Filter'));
assert(statusResult.reply.includes('EveryDrop'));
console.log('✅ 37. Assistant command: specific filter status inquiry passed.');

// 38. Assistant query handler: conversational replacement command
const replaceResult = prodEngine.handleAssistantCommand('replaced fridge filter today', 'Wife');
assert.strictEqual(replaceResult.success, true);
assert.strictEqual(replaceResult.actionTaken, 'mark_replaced');
assert(replaceResult.reply.includes('Marked Refrigerator Water & Ice Filter as replaced today by Wife'));
const refetchedFridge = prodEngine.getFilterById('filter-fridge-water');
assert.strictEqual(refetchedFridge.lastReplacedBy, 'Wife');
console.log('✅ 38. Assistant command: conversational replacement by Wife passed.');

// 39. Assistant query handler: history and attribution inquiry
const historyResult = prodEngine.handleAssistantCommand('who replaced the fridge filter last?');
assert.strictEqual(historyResult.success, true);
assert.strictEqual(historyResult.actionTaken, 'who_replaced');
assert(historyResult.reply.includes('was last replaced on'));
assert(historyResult.reply.includes('Wife'));
console.log('✅ 39. Assistant command: who replaced inquiry with attribution passed.');

// 40. Assistant query handler: vacation snooze command
const snoozeResult = prodEngine.handleAssistantCommand('snooze hvac 14 days', 'Isaac');
assert.strictEqual(snoozeResult.success, true);
assert.strictEqual(snoozeResult.actionTaken, 'snooze');
assert(snoozeResult.reply.includes('Snoozed Central HVAC Return Filter by 14 days'));
assert(snoozeResult.reply.includes('Requested by: Isaac'));
console.log('✅ 40. Assistant command: vacation snooze with attribution passed.');

// 41. Assistant query handler: 1-click reorder link command
const buyResult = prodEngine.handleAssistantCommand('buy car cabin filter');
assert.strictEqual(buyResult.success, true);
assert.strictEqual(buyResult.actionTaken, 'buy_link');
assert(buyResult.reply.includes('1-Click Reorder for Car Cabin Air Filter (HVAC)'));
assert(buyResult.reply.includes('https://www.amazon.com/s?k=car+cabin+air+filter'));
console.log('✅ 41. Assistant command: 1-Click Amazon reorder link query passed.');

// 42. Assistant query handler: cross-platform sharing guide
const shareResult = prodEngine.handleAssistantCommand("how to install on wife's iphone");
assert.strictEqual(shareResult.success, true);
assert.strictEqual(shareResult.actionTaken, 'share_info');
assert(shareResult.reply.includes("Wife's iPhone"));
assert(shareResult.reply.includes('Pixel 10 Pro'));
assert(shareResult.reply.includes('http://192.168.86.47:3030'));
console.log('✅ 42. Assistant command: cross-platform sharing guide query passed.');

// 43. Pure JS QR code SVG generation
import('./qr.js').then(({ generateQrSvg, encodeQrCode }) => {
  const qrSvg = generateQrSvg('http://192.168.86.47:3030', { size: 240, margin: 3 });
  assert(qrSvg.includes('<svg'), 'Should contain <svg tag');
  assert(qrSvg.includes('viewBox="0 0 240 240"'), 'Should have matching viewBox');
  assert(qrSvg.includes('<path d='), 'Should render QR modules as SVG path');
  
  const encoded = encodeQrCode('http://192.168.86.47:3030', 'M');
  assert(encoded.size > 20, 'QR matrix dimension should be > 20');
  console.log('✅ 43. Pure JS zero-dependency QR code SVG generation passed.');

  // Cleanup test db
  engine.deleteFilter(isaacFilter.id);
  engine.deleteFilter(wifeFilter.id);
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

  console.log('\n🎉 ALL 43 UNIT, EDGE-CASE, AND HOUSEHOLD SHARING TESTS PASSED SUCCESSFULLY!\n');
});

