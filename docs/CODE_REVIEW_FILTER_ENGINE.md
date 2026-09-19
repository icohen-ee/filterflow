# 🛡️ Code & Security Review: Filter Calculation Engine & Snooze Logic

**Card ID:** `3f1ee783-4f73-45cb-bb9e-7af4cf8c41c5`  
**Target:** `filter_engine.js`, `server.js`, `public/app.js`, `test.js`  
**Reviewer:** reviewer (Google Antigravity autonomous agent)  
**Date:** September 19, 2026  
**Status:** PASSED (Remediated & Verified)

---

## 1. Executive Summary

A comprehensive code, architecture, and security audit was conducted on `filter_engine.js` and its integrating modules (`server.js`, `public/app.js`, `test.js`) under Workboard card `3f1ee783-4f73-45cb-bb9e-7af4cf8c41c5`. 

The review focused specifically on verifying edge cases specified in the card notes:
1. **Leap year calculations** and calendar boundary arithmetic.
2. **Multi-month snoozes** and cumulative vacation extension tracking.
3. **Overdue recurrences** and alert cadence spam mitigation.
4. **Automated test coverage**, expanding testing from 7 basic checks to 30 comprehensive edge-case and security unit tests.
5. **Security vulnerability remediation** (Stored XSS, attribute injection, URL protocol hijacking, and file system atomicity).

All identified deficiencies have been remediated in `filter_engine.js`, `server.js`, and `public/app.js`, and validated with a newly expanded automated test suite in `test.js`.

---

## 2. Edge Case Analysis & Findings

### 2.1 Leap Years & Calendar Boundary Math
* **Issue Identified:**
  - Standard JavaScript `Date` constructor parses ISO date strings (`YYYY-MM-DD`) in UTC, but silently rolls over invalid calendar dates (e.g. `new Date("2025-02-29")` silently rolls over to `2025-03-01`).
  - Without strict calendar verification, malformed dates in user inputs could corrupt due dates or cause silent drift across non-leap years.
  - Furthermore, malformed date strings (e.g. `"invalid"`) resulted in `NaN` timestamp arithmetic, leading to uncaught `RangeError: Invalid time value` exceptions in `calculateFilterStatus`, crashing the server and CLI.
* **Remediation & Behavior:**
  - Implemented `isValidISODateString(str)` which checks regex formatting, month/day bounds, and round-trips through `Date.UTC(y, m - 1, d)` to guarantee calendar validity.
  - Verified leap day installations (e.g. `2024-02-29 + 1 day` advances to `2024-03-01`).
  - Verified non-leap year eve (e.g. `2023-02-28 + 1 day` advances to `2023-03-01`).
  - Verified 365-day service life spanning a leap year (e.g. `2023-02-28 + 365 days` lands on `2024-02-28`).
  - Enforced century leap year rules (2000 was a leap year; 2100 is not).

### 2.2 Multi-Month Snooze Logic
* **Issue Identified:**
  - `snooze(id, extensionDays)` previously accepted any raw value without type checks or positive number constraints. Passing `-30` would advance the due date backward, and passing strings or `NaN` permanently corrupted `lastSnoozeDays` in the database to `null` while crashing `calculateFilterStatus`.
  - The history array was unbounded, posing memory and disk bloat over repeated snoozes.
* **Remediation & Behavior:**
  - Validated `extensionDays` to strictly enforce positive integer inputs (`parseInt(extensionDays, 10) > 0`), throwing an error on invalid, zero, or negative inputs.
  - Supported multi-month snoozes in a single action (e.g. `+60`, `+90`, `+180` days).
  - Supported successive chained snoozes (e.g. `+30d` followed by `+30d` accumulates to `+60d` in `lastSnoozeDays`).
  - Maintained structured audit log entries in `filter.history` with timestamp, duration, and sanitized user reason, bounded to a maximum of 50 entries to prevent memory exhaustion.
  - Ensured `markReplaced` resets `lastSnoozeDays` to 0 upon filter replacement.

### 2.3 Overdue Recurrences & Notification Cadence
* **Issue Identified:**
  - In `calculateFilterStatus`, `isMonthlyRecurringReminder` was defined as:
    ```javascript
    const isMonthlyRecurringReminder = daysRemaining < 0 && (Math.abs(daysRemaining) % 30 === 0 || Math.abs(daysRemaining) <= 3);
    ```
  - However, in `getNotifications()`, the logic was:
    ```javascript
    } else if (item.isOverdue) {
      notifications.push({ type: 'OVERDUE_ALERT', ... });
    }
    ```
  - This caused `getNotifications()` to emit `OVERDUE_ALERT` **every single day** an item was overdue, regardless of whether it was a recurrence day. For automated push notifications or messaging bots (WhatsApp/OpenClaw), this resulted in daily alert spam.
* **Remediation & Behavior:**
  - Updated `getNotifications(options)` to support an options object `{ referenceDate, recurringOnly }`:
    - `recurringOnly: false` (default for web dashboard): Displays all active overdue items with an alert badge in the UI.
    - `recurringOnly: true` (for WhatsApp bots and push schedulers): Silences overdue alerts on non-recurring days (-4 through -29, -31 through -59), only triggering during the initial 3-day window (-1, -2, -3) and monthly milestones (-30, -60, -90).
  - Attached `isMonthlyRecurringReminder` and `daysRemaining` directly to each notification payload.

---

## 3. Security Vulnerability Assessment

| Vulnerability | Severity | Location | Status | Description & Fix |
|---|---|---|---|---|
| **Stored XSS / Attribute Breakout** | **High** | `public/app.js:91`, `filter_engine.js:88` | **Fixed** | Unsanitized `filter.id` rendered directly into inline `onclick="markReplaced('${f.id}')"`. An ID containing `'` broke out of the attribute string to execute arbitrary JS. Strict validation `^[a-zA-Z0-9_-]{1,64}$` added in `addFilter`, and `escapeHtml` updated to escape single quotes `&#39;`. |
| **Protocol Injection / URL Spoofing** | **Medium** | `filter_engine.js:100`, `public/app.js:87` | **Fixed** | `reorderUrl` accepted `javascript:` or `data:` schemes, enabling XSS on "1-Click Buy" link clicks. Added `isValidHttpUrl()` to enforce `http:` or `https:`. |
| **Database Corruption on Crash** | **Medium** | `filter_engine.js:27` | **Fixed** | Synchronous non-atomic writes to `filters.json` risked corrupting or truncating JSON if interrupted. Replaced with atomic write via temp file rename (`tempPath -> renameSync`). |
| **Denial of Service (DoS)** | **Low** | `filter_engine.js:93` | **Fixed** | Unbounded strings in `name`, `location`, `notes`, and unbounded `history` array. Added bounded slicing and length caps. |
| **Path Traversal in Static Server** | **Low** | `server.js:143` | **Fixed** | Static file serving did not verify `filePath` stayed within the `public/` directory root. Added `path.resolve` check against `publicDir`. |

---

## 4. Automated Test Coverage

The test suite in `test.js` was expanded from 7 happy-path assertions to **30 automated unit, edge-case, and security tests**.

```
🧪 Starting Filter Tracker Unit & Security Test Suite...

--- SECTION 1: Core Lifecycle & Status Calculations ---
✅ 1. Filter creation & target due date calculation passed.
✅ 2. 14-day pre-order warning calculation passed (10 days remaining).
✅ 3. Expiration day alert calculation passed.
✅ 4. Overdue alert calculation passed (-20 days).
✅ 5. Vacation snooze (+30 days) extension passed.
✅ 6. Filter replacement & lifecycle reset passed.
✅ 7. Filter deletion passed.

--- SECTION 2: Leap Year Calculations & Edge Cases ---
✅ 8. Leap day (2024-02-29) + 1 day correctly advances to 2024-03-01.
✅ 9. Leap year eve (2024-02-28) + 1 day lands on Feb 29.
✅ 10. Non-leap year eve (2023-02-28) + 1 day lands on March 1.
✅ 11. Leap day (2024-02-29) + 365 days correctly lands on 2025-02-28.
✅ 12. 365 days spanning leap year correctly accounts for February 29.
✅ 13. Leap year date validator accurately rejects non-leap Feb 29 dates.

--- SECTION 3: Multi-Month Snooze Logic ---
✅ 14. Single multi-month snooze (+60 days) calculated correctly.
✅ 15. Successive multi-month snoozes correctly accumulate days and history.
✅ 16. Negative, zero, and NaN snooze inputs properly rejected without DB corruption.
✅ 17. Snooze on non-existent filter safely returns null.
✅ 18. History array bounded successfully (length = 50).

--- SECTION 4: Overdue Recurrences & Reminder Engine ---
✅ 19. Day 0 expiration flags correctly evaluated.
✅ 20. Initial 3-day overdue window triggers reminder.
✅ 21. Non-recurring overdue days (-4, -15, -29) are quiet.
✅ 22. Monthly recurring reminders correctly trigger at 30, 60, and 90 days overdue.
✅ 23. Day 31 returns to quiet state.
✅ 24. Notification filtering (recurringOnly) prevents alert spam while supporting UI badges.

--- SECTION 5: Security, Validation & Fault Tolerance ---
✅ 25. Malicious filter IDs containing quotes/scripts rejected.
✅ 26. Malicious reorderUrl protocols (javascript:) rejected.
✅ 27. Invalid calendar dates (e.g. 2026-04-31) rejected.
✅ 28. Non-positive service life days properly rejected.
✅ 29. Duplicate filter ID collisions properly prevented.
✅ 30. Corrupted database file handled gracefully without crashing.

🎉 ALL 30 UNIT, EDGE-CASE, AND SECURITY TESTS PASSED SUCCESSFULLY!
```

---

## 5. Verification Commands

To re-run the automated test suite at any time:
```bash
cd "/Users/isaac/Library/CloudStorage/GoogleDrive-icohen.ee@gmail.com/My Drive/Projects/FilterApp"
npm test
```

To test CLI commands:
```bash
node cli.js list
node cli.js notifications
```
