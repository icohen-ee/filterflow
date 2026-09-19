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

// 6. Replacement check
const replaced = engine.markReplaced(created.id, '2026-09-19');
assert.strictEqual(replaced.installedDate, '2026-09-19');
assert.strictEqual(replaced.lastSnoozeDays, 0); // Snooze reset
assert.strictEqual(replaced.targetDueDate, '2026-12-18');
console.log('✅ 6. Filter replacement & lifecycle reset passed.');

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

// Cleanup test db
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

console.log('\n🎉 ALL 30 UNIT, EDGE-CASE, AND SECURITY TESTS PASSED SUCCESSFULLY!\n');
