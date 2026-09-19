import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'filters.json');

/**
 * Validates that an input string is a valid calendar date in ISO format (YYYY-MM-DD).
 * Accurately catches leap year edge cases (e.g. rejects 2025-02-29, accepts 2024-02-29).
 */
export function isValidISODateString(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = str.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

/**
 * Validates that an optional URL uses safe http or https protocols.
 */
export function isValidHttpUrl(str) {
  if (!str || typeof str !== 'string' || str.trim() === '') return true;
  try {
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export class FilterEngine {
  constructor(dbPath = DB_PATH) {
    this.dbPath = dbPath;
    this.ensureDb();
  }

  ensureDb() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  loadFilters() {
    this.ensureDb();
    try {
      const raw = fs.readFileSync(this.dbPath, 'utf-8');
      if (!raw || !raw.trim()) return [];
      return JSON.parse(raw);
    } catch (err) {
      console.error(`[FilterEngine] Error loading database at ${this.dbPath}:`, err.message);
      return [];
    }
  }

  saveFilters(filters) {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Atomic write via temp file rename to prevent database corruption on unexpected exit
    const tempPath = `${this.dbPath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(filters, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.dbPath);
  }

  /**
   * Calculates dynamic status for a filter relative to reference date (defaults to today)
   */
  calculateFilterStatus(filter, referenceDate = new Date()) {
    if (!filter || typeof filter !== 'object') {
      throw new TypeError('Filter must be an object');
    }

    if (!isValidISODateString(filter.installedDate)) {
      throw new Error(`Invalid installedDate: "${filter.installedDate}". Expected valid YYYY-MM-DD date.`);
    }

    const install = new Date(filter.installedDate);
    const serviceLifeDays = parseInt(filter.serviceLifeDays, 10) || 90;
    const lastSnoozeDays = parseInt(filter.lastSnoozeDays, 10) || 0;
    const totalLifeDays = serviceLifeDays + lastSnoozeDays;
    const targetDue = new Date(install.getTime() + totalLifeDays * 24 * 60 * 60 * 1000);
    
    const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (isNaN(ref.getTime())) {
      throw new Error(`Invalid referenceDate: "${referenceDate}"`);
    }

    const diffMs = targetDue.getTime() - ref.getTime();
    const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    
    let status = 'HEALTHY';
    let urgency = 'normal';
    let alertMessage = null;

    if (daysRemaining <= 0) {
      status = 'OVERDUE';
      urgency = 'high';
      const daysOverdue = Math.abs(daysRemaining);
      alertMessage = `Expired ${daysOverdue === 0 ? 'today' : `${daysOverdue} days ago`}!`;
    } else if (daysRemaining <= 14) {
      status = 'EXPIRING_SOON';
      urgency = 'medium';
      alertMessage = `Order replacement now — expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`;
    } else {
      status = 'HEALTHY';
      urgency = 'normal';
      alertMessage = `Healthy — ${daysRemaining} days remaining.`;
    }

    // Monthly recurring reminder logic for overdue items:
    // Triggers on initial days (1 to 3 days overdue) and recurring every 30 days thereafter (day 30, 60, 90...)
    const isMonthlyRecurringReminder = daysRemaining < 0 && (Math.abs(daysRemaining) % 30 === 0 || Math.abs(daysRemaining) <= 3);

    return {
      ...filter,
      targetDueDate: targetDue.toISOString().split('T')[0],
      daysRemaining,
      status,
      urgency,
      alertMessage,
      isOrderReminderActive: daysRemaining <= 14 && daysRemaining > 0,
      isDueToday: daysRemaining === 0,
      isOverdue: daysRemaining < 0,
      isMonthlyRecurringReminder
    };
  }

  getAllFilters(referenceDate = new Date()) {
    const filters = this.loadFilters();
    return filters.map(f => this.calculateFilterStatus(f, referenceDate));
  }

  getFilterById(id) {
    if (!id || typeof id !== 'string') return null;
    const filters = this.loadFilters();
    const found = filters.find(f => f.id === id);
    return found ? this.calculateFilterStatus(found) : null;
  }

  addFilter(filterData = {}) {
    if (!filterData || typeof filterData !== 'object') {
      throw new TypeError('Filter data must be an object');
    }

    if (!filterData.name || typeof filterData.name !== 'string' || !filterData.name.trim()) {
      throw new Error('Filter name is required');
    }

    let id = filterData.id;
    if (id) {
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
        throw new Error(`Invalid filter ID: "${id}". Must be 1-64 alphanumeric characters, underscores, or hyphens.`);
      }
    } else {
      id = `filter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }

    const installedDate = filterData.installedDate || new Date().toISOString().split('T')[0];
    if (!isValidISODateString(installedDate)) {
      throw new Error(`Invalid installedDate: "${installedDate}". Expected valid YYYY-MM-DD date.`);
    }

    const serviceLifeDays = parseInt(filterData.serviceLifeDays !== undefined ? filterData.serviceLifeDays : 90, 10);
    if (isNaN(serviceLifeDays) || serviceLifeDays <= 0) {
      throw new Error(`Invalid serviceLifeDays: "${filterData.serviceLifeDays}". Must be a positive integer.`);
    }

    const reorderUrl = filterData.reorderUrl ? String(filterData.reorderUrl).trim() : '';
    if (reorderUrl && !isValidHttpUrl(reorderUrl)) {
      throw new Error(`Invalid reorderUrl: "${reorderUrl}". Must start with http:// or https://.`);
    }

    const filters = this.loadFilters();
    if (filters.some(f => f.id === id)) {
      throw new Error(`Filter with ID "${id}" already exists.`);
    }

    const newFilter = {
      id,
      name: String(filterData.name).trim().slice(0, 100),
      category: String(filterData.category || 'General').trim().slice(0, 50),
      location: String(filterData.location || '').trim().slice(0, 100),
      manufacturer: String(filterData.manufacturer || '').trim().slice(0, 100),
      modelNumber: String(filterData.modelNumber || '').trim().slice(0, 100),
      installedDate,
      serviceLifeDays,
      reorderUrl,
      notes: String(filterData.notes || '').trim().slice(0, 500),
      lastSnoozeDays: 0,
      history: [
        {
          date: installedDate,
          action: 'Initial Installation'
        }
      ]
    };

    filters.push(newFilter);
    this.saveFilters(filters);
    return this.calculateFilterStatus(newFilter);
  }

  markReplaced(id, replacedDate = new Date().toISOString().split('T')[0]) {
    if (!isValidISODateString(replacedDate)) {
      throw new Error(`Invalid replacement date: "${replacedDate}". Expected format YYYY-MM-DD.`);
    }

    const filters = this.loadFilters();
    const filter = filters.find(f => f.id === id);
    if (!filter) return null;

    if (!filter.history) filter.history = [];
    filter.history.push({
      date: replacedDate,
      action: `Replaced filter (previous was installed ${filter.installedDate})`
    });

    if (filter.history.length > 50) {
      filter.history = filter.history.slice(-50);
    }

    filter.installedDate = replacedDate;
    filter.lastSnoozeDays = 0; // Reset any vacation snooze on fresh replacement
    this.saveFilters(filters);
    return this.calculateFilterStatus(filter);
  }

  snooze(id, extensionDays = 30, reason = 'Vacation / low usage') {
    const parsedDays = parseInt(extensionDays, 10);
    if (isNaN(parsedDays) || parsedDays <= 0) {
      throw new Error(`Extension days must be a positive integer, received: ${extensionDays}`);
    }

    const filters = this.loadFilters();
    const filter = filters.find(f => f.id === id);
    if (!filter) return null;

    filter.lastSnoozeDays = (filter.lastSnoozeDays || 0) + parsedDays;
    if (!filter.history) filter.history = [];
    const cleanReason = String(reason || 'Vacation / low usage').trim().slice(0, 200);
    filter.history.push({
      date: new Date().toISOString().split('T')[0],
      action: `Snoozed ${parsedDays} days (${cleanReason})`
    });

    if (filter.history.length > 50) {
      filter.history = filter.history.slice(-50);
    }

    this.saveFilters(filters);
    return this.calculateFilterStatus(filter);
  }

  deleteFilter(id) {
    if (!id || typeof id !== 'string') return false;
    const filters = this.loadFilters();
    const initialLen = filters.length;
    const remaining = filters.filter(f => f.id !== id);
    if (remaining.length === initialLen) return false;
    this.saveFilters(remaining);
    return true;
  }

  /**
   * Generates active notifications.
   * Supports either referenceDate (Date or ISO string) or an options object:
   * { referenceDate: Date|string, recurringOnly: boolean }
   * When recurringOnly is true, overdue alerts are only emitted on recurring reminder days.
   */
  getNotifications(referenceDateOrOptions = new Date()) {
    let referenceDate = new Date();
    let recurringOnly = false;

    if (referenceDateOrOptions instanceof Date || typeof referenceDateOrOptions === 'string') {
      referenceDate = new Date(referenceDateOrOptions);
    } else if (referenceDateOrOptions && typeof referenceDateOrOptions === 'object') {
      if (referenceDateOrOptions.referenceDate) {
        referenceDate = new Date(referenceDateOrOptions.referenceDate);
      }
      if (typeof referenceDateOrOptions.recurringOnly === 'boolean') {
        recurringOnly = referenceDateOrOptions.recurringOnly;
      }
    }

    const evaluated = this.getAllFilters(referenceDate);
    const notifications = [];

    for (const item of evaluated) {
      if (item.isOrderReminderActive) {
        notifications.push({
          type: 'ORDER_REMINDER',
          filterId: item.id,
          title: `📦 Order Replacement: ${item.name}`,
          message: `${item.name} (${item.modelNumber || 'Standard'}) expires in ${item.daysRemaining} days. Order replacement today.`,
          reorderUrl: item.reorderUrl,
          urgency: 'medium',
          daysRemaining: item.daysRemaining
        });
      } else if (item.isDueToday) {
        notifications.push({
          type: 'EXPIRATION_TODAY',
          filterId: item.id,
          title: `⚠️ Filter Expired Today: ${item.name}`,
          message: `Replace your ${item.name} (${item.location || 'General'}) today.`,
          reorderUrl: item.reorderUrl,
          urgency: 'high',
          daysRemaining: 0
        });
      } else if (item.isOverdue) {
        if (recurringOnly && !item.isMonthlyRecurringReminder) {
          continue;
        }
        const days = Math.abs(item.daysRemaining);
        notifications.push({
          type: 'OVERDUE_ALERT',
          filterId: item.id,
          title: `🔔 Overdue: ${item.name} (${days} days overdue)`,
          message: `${item.name} is ${days} days past recommended service life. Tap to mark replaced or snooze for vacation.`,
          reorderUrl: item.reorderUrl,
          urgency: 'high',
          daysRemaining: item.daysRemaining,
          isMonthlyRecurringReminder: item.isMonthlyRecurringReminder
        });
      }
    }

    return notifications;
  }
}
