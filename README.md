# 🛡️ FilterFlow — Smart Filter Maintenance Tracker

A maintenance tracking and notification application designed for the **Google Pixel 10 Pro**, cross-platform household sharing (iOS/Web), and automated assistant integration via **OpenClaw (WhatsApp)**.

---

## 🌟 Features Implemented

1. **Comprehensive Filter Tracking**:
   - Central Home HVAC air returns.
   - Vehicle Cabin Air Filters (HVAC).
   - Vehicle Engine Intake Air Filters.
   - Refrigerator Water & Ice Filters.
   - Portable Room Fans & True HEPA Purifiers.
   - Custom user-defined filters.

2. **Smart Notification Engine**:
   - **T - 14 Days**: Pre-order alert so you have time to order before expiration.
   - **T - 0 Days**: Day-of replacement alert.
   - **T + 30 Days (Recurring)**: Monthly overdue reminder for skipped/forgotten replacements.
   - **Vacation Mode / Snooze**: One-tap 30-day snooze to extend due dates when HVAC was idle while away on vacation.

3. **1-Click Quick Reordering**:
   - Direct links to Amazon or manufacturer product pages to add replacement filters to cart in 1 click.

4. **Multi-Platform & OpenClaw WhatsApp Assistant**:
   - Mobile Web / PWA dashboard running locally at `http://localhost:3030`.
   - OpenClaw Architect Agent instructions configured at `~/.openclaw/workspace/architect/FILTER_TRACKER.md`, enabling WhatsApp queries (e.g. *"What filters are due?"* or *"When is the fridge filter due?"*).

---

## 🚀 Quick Start

### 1. View the Mobile Dashboard
The server supports both HTTP and HTTPS:
- **HTTP / HTTPS (Port 3030)**: `http://192.168.86.47:3030` or `https://192.168.86.47:3030`
- **Dedicated HTTPS (Port 3443)**: `https://192.168.86.47:3443`
- **Localhost**: `http://localhost:3030`

### 2. CLI Usage
Run commands from the terminal:
```bash
# List all tracked filters and expiration status
node cli.js list

# View pending pre-order warnings and overdue alerts
node cli.js notifications

# Mark a filter as replaced today (resets cycle)
node cli.js replace filter-hvac-main

# Snooze a filter for vacation / low usage (e.g. 30 days)
node cli.js snooze filter-hvac-main 30
```

### 3. OpenClaw Workboard
View current and completed cards on your OpenClaw workboard:
```bash
openclaw workboard list
# Or open the dashboard UI:
openclaw dashboard
```
