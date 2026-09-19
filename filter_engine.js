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

    // Last replacement attribution from history
    const history = Array.isArray(filter.history) ? filter.history : [];
    const lastReplacement = history.slice().reverse().find(h => h.action && h.action.startsWith('Replaced')) || null;
    const lastReplacedBy = (lastReplacement && lastReplacement.replacedBy) || filter.lastReplacedBy || 'Household';
    const lastReplacedDate = (lastReplacement && lastReplacement.date) || filter.installedDate;
    const owner = filter.owner || 'Household';

    return {
      ...filter,
      owner,
      lastReplacedBy,
      lastReplacedDate,
      lastReplacement,
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

  getAllFilters(referenceDate = new Date(), options = {}) {
    let filters = this.loadFilters().map(f => this.calculateFilterStatus(f, referenceDate));
    if (options && options.owner && options.owner !== 'all' && options.owner !== 'All') {
      filters = filters.filter(f => f.owner === options.owner || f.owner === 'Household');
    }
    if (options && options.category && options.category !== 'all') {
      filters = filters.filter(f => f.category === options.category);
    }
    if (options && options.status && options.status !== 'all') {
      filters = filters.filter(f => f.status === options.status);
    }
    return filters;
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
      owner: String(filterData.owner || 'Household').trim().slice(0, 50),
      lastReplacedBy: String(filterData.owner || 'Household').trim().slice(0, 50),
      lastSnoozeDays: 0,
      history: [
        {
          date: installedDate,
          action: 'Initial Installation',
          replacedBy: String(filterData.owner || 'Household').trim().slice(0, 50)
        }
      ]
    };

    filters.push(newFilter);
    this.saveFilters(filters);
    return this.calculateFilterStatus(newFilter);
  }

  markReplaced(id, replacedDate = new Date().toISOString().split('T')[0], notes = '', replacedBy = 'Household') {
    if (!isValidISODateString(replacedDate)) {
      throw new Error(`Invalid replacement date: "${replacedDate}". Expected format YYYY-MM-DD.`);
    }

    const filters = this.loadFilters();
    const filter = filters.find(f => f.id === id);
    if (!filter) return null;

    if (!filter.history) filter.history = [];
    const cleanReplacedBy = typeof replacedBy === 'string' && replacedBy.trim() ? replacedBy.trim().slice(0, 50) : 'Household';
    const cleanNotes = typeof notes === 'string' && notes.trim() ? `: ${notes.trim().slice(0, 200)}` : '';
    filter.history.push({
      date: replacedDate,
      action: `Replaced filter (previous was installed ${filter.installedDate})${cleanNotes}`,
      replacedBy: cleanReplacedBy,
      notes: typeof notes === 'string' ? notes.trim().slice(0, 200) : ''
    });

    if (filter.history.length > 50) {
      filter.history = filter.history.slice(-50);
    }

    filter.installedDate = replacedDate;
    filter.lastReplacedBy = cleanReplacedBy;
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

  clearAllFilters() {
    this.saveFilters([]);
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

  /**
   * Intelligently finds a filter by natural language keyword or ID.
   * Matches common nicknames (fridge, cabin, engine, hvac, furnace, fan, purifier)
   * as well as name, location, model number, and specs.
   */
  findFilter(query) {
    if (!query || typeof query !== 'string') return null;
    const q = query.toLowerCase().trim();
    const filters = this.getAllFilters();
    if (!filters.length) return null;

    // 1. Exact or partial ID match
    const directId = filters.find(f => f.id.toLowerCase() === q || f.id.toLowerCase().includes(q));
    if (directId) return directId;

    // 2. Household keyword / synonym clusters
    const SYNONYMS = [
      { keys: ['fridge', 'refrigerator', 'water', 'ice', 'kitchen', 'drinking', 'edr1rxd1'], id: 'filter-fridge-water' },
      { keys: ['hvac', 'furnace', 'ac', 'heating', 'air return', 'central', 'ceiling', 'hallway', 'filtrete', 'mpr 1500', 'merv 12'], id: 'filter-hvac-main' },
      { keys: ['cabin', 'glovebox', 'glove compartment', 'car cabin', 'vehicle cabin', 'interior air', 'bosch', 'cp134'], id: 'filter-car-cabin' },
      { keys: ['engine', 'hood', 'engine bay', 'airbox', 'car engine', 'combustion', 'vehicle engine', 'intake', 'ca10190', 'fram'], id: 'filter-car-engine' },
      { keys: ['bedroom', 'fan', 'purifier', 'hepa', 'room', 'levoit', 'dyson', 'portable', 'core 300'], id: 'filter-room-fan' }
    ];

    for (const entry of SYNONYMS) {
      if (entry.keys.some(k => q.includes(k))) {
        const match = filters.find(f => f.id === entry.id);
        if (match) return match;
      }
    }

    // 3. Multi-word fuzzy scoring (filtering out common query stop words)
    const STOP_WORDS = new Set(['what', 'is', 'due', 'when', 'the', 'filter', 'filters', 'for', 'check', 'status', 'and', 'how', 'are', 'any', 'my', 'our', 'all', 'to', 'in', 'on', 'with', 'by', 'show', 'list', 'please']);
    const words = q.split(/[\s,._-]+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
    if (words.length === 0) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (const f of filters) {
      let score = 0;
      const haystack = `${f.id} ${f.name} ${f.category} ${f.location} ${f.manufacturer} ${f.modelNumber} ${f.notes} ${f.owner || ''}`.toLowerCase();
      
      if (haystack.includes(q)) score += 10;
      for (const w of words) {
        if (f.name.toLowerCase().includes(w)) score += 6;
        if (f.location.toLowerCase().includes(w)) score += 4;
        if (f.category.toLowerCase().includes(w)) score += 3;
        if (f.manufacturer.toLowerCase().includes(w)) score += 3;
        if (haystack.includes(w)) score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = f;
      }
    }

    return bestScore > 0 ? bestMatch : null;
  }

  /**
   * Formats a single filter's status for WhatsApp / chat response.
   */
  formatFilterDetailMessage(filter) {
    if (!filter) return 'Filter not found.';
    const icon = filter.status === 'HEALTHY' ? '✅' : filter.status === 'EXPIRING_SOON' ? '⚠️' : '🚨';
    const lines = [];
    lines.push(`🛡️ *${filter.name}*`);
    lines.push(`• *Status:* ${icon} ${filter.status} (${filter.alertMessage || ''})`);
    lines.push(`• *Location:* ${filter.location} (${filter.category})`);
    lines.push(`• *Specs:* ${filter.manufacturer} — ${filter.modelNumber}`);
    lines.push(`• *Installed:* ${filter.installedDate} | *Due:* ${filter.targetDueDate}`);
    lines.push(`• *Days Left:* ${filter.daysRemaining > 0 ? `${filter.daysRemaining} days` : `${Math.abs(filter.daysRemaining)} days OVERDUE`}`);
    lines.push(`• *Last Replaced By:* ${filter.lastReplacedBy || 'Household'} on ${filter.lastReplacedDate || filter.installedDate}`);
    if (filter.reorderUrl) {
      lines.push(`• *1-Click Reorder:* ${filter.reorderUrl}`);
    }
    return lines.join('\n');
  }

  /**
   * Formats a complete household filter status message optimized for WhatsApp.
   */
  formatWhatsAppSummary(options = {}) {
    const filters = this.getAllFilters(options.referenceDate || new Date(), options);
    const overdue = filters.filter(f => f.status === 'OVERDUE');
    const soon = filters.filter(f => f.status === 'EXPIRING_SOON');
    const healthy = filters.filter(f => f.status === 'HEALTHY');

    const lines = [];
    lines.push(`🛡️ *FilterFlow — Household Filter Status*`);
    lines.push(`📅 _${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}_ | 📱 Pixel 10 Pro & iPhone`);
    lines.push(``);

    if (overdue.length > 0) {
      lines.push(`🚨 *OVERDUE FILTERS (${overdue.length}):*`);
      for (const f of overdue) {
        const days = Math.abs(f.daysRemaining);
        lines.push(`• *${f.name}* (${f.location})`);
        lines.push(`  Expired ${days === 0 ? 'today' : `${days} days ago`}! Last replaced: ${f.lastReplacedDate} by ${f.lastReplacedBy || 'Household'}`);
        if (f.reorderUrl) lines.push(`  🛒 Buy: ${f.reorderUrl}`);
      }
      lines.push(``);
    }

    if (soon.length > 0) {
      lines.push(`⚠️ *EXPIRING SOON — PRE-ORDER (${soon.length}):*`);
      for (const f of soon) {
        lines.push(`• *${f.name}* (${f.location})`);
        lines.push(`  Due in ${f.daysRemaining} days (on ${f.targetDueDate})`);
        if (f.reorderUrl) lines.push(`  🛒 Buy: ${f.reorderUrl}`);
      }
      lines.push(``);
    }

    if (overdue.length === 0 && soon.length === 0) {
      lines.push(`✅ *All ${filters.length} filters are healthy and up to date!*`);
    } else {
      lines.push(`✅ *Healthy Filters (${healthy.length}):*`);
      for (const f of healthy) {
        lines.push(`• ${f.name} — ${f.daysRemaining}d remaining (due ${f.targetDueDate})`);
      }
      lines.push(``);
    }

    lines.push(`💬 *Quick Assistant Commands:*`);
    lines.push(`• _"replaced fridge"_ — reset cycle after replacing`);
    lines.push(`• _"snooze hvac 14"_ — extend due date for vacation`);
    lines.push(`• _"buy <filter>"_ — get 1-Click Amazon buy link`);
    lines.push(`• _"who replaced <filter>"_ — check maintenance history`);

    return lines.join('\n');
  }

  /**
   * Natural Language Assistant Query Dispatcher for WhatsApp & OpenClaw chat.
   * Enables Isaac & his wife to interact seamlessly via conversational queries.
   */
  handleAssistantCommand(rawText, fromUser = 'Household') {
    if (!rawText || typeof rawText !== 'string') {
      return {
        success: false,
        actionTaken: 'error',
        reply: 'Please provide a filter query or command.'
      };
    }

    const text = rawText.trim();
    const lower = text.toLowerCase();
    const today = new Date().toISOString().split('T')[0];
    const user = String(fromUser || 'Household').trim();

    // 1. Query: "who replaced", "last replaced", "who changed"
    if (lower.includes('who replaced') || lower.includes('who changed') || lower.includes('last replaced') || lower.includes('who did')) {
      const filter = this.findFilter(lower);
      if (!filter) {
        return {
          success: false,
          actionTaken: 'not_found',
          reply: `I couldn't identify which filter you're asking about. Try specifying "fridge", "hvac", "car cabin", or "bedroom purifier".`
        };
      }
      const replacer = filter.lastReplacedBy || 'Household';
      const date = filter.lastReplacedDate || filter.installedDate;
      const history = (filter.history || []).filter(h => h.action && h.action.includes('Replaced')).slice(-3);
      let reply = `👤 *${filter.name}* was last replaced on *${date}* by *${replacer}*.\nNext due: *${filter.targetDueDate}* (${filter.daysRemaining > 0 ? `${filter.daysRemaining} days left` : `${Math.abs(filter.daysRemaining)} days overdue`}).`;
      if (history.length > 1) {
        reply += `\n\nRecent History:\n` + history.map(h => `• ${h.date}: by ${h.replacedBy || 'Household'}`).join('\n');
      }
      return {
        success: true,
        actionTaken: 'who_replaced',
        filter,
        reply
      };
    }

    // 2. Command: "mark replaced", "replaced", "changed filter", "installed new"
    if (lower.startsWith('replace ') || lower.startsWith('replaced ') || lower.includes('marked replaced') || lower.includes('mark replaced') || lower.includes('i replaced') || lower.includes('just replaced') || lower.includes('changed the')) {
      const filter = this.findFilter(lower);
      if (!filter) {
        return {
          success: false,
          actionTaken: 'not_found',
          reply: `I couldn't identify which filter you replaced. Please specify "fridge", "hvac", "car cabin", "car engine", or "bedroom purifier".`
        };
      }

      // Check if user specified a date in YYYY-MM-DD
      const dateMatch = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      const replacedDate = dateMatch ? dateMatch[1] : today;

      const updated = this.markReplaced(filter.id, replacedDate, `Replaced via WhatsApp Assistant`, user);
      return {
        success: true,
        actionTaken: 'mark_replaced',
        filter: updated,
        reply: `✅ *Marked ${updated.name} as replaced today by ${user}!* 🎉\n• New Due Date: *${updated.targetDueDate}* (${updated.serviceLifeDays} days cycle)\n• Status: *HEALTHY* (Reset to 0 days used)\n• Recorded in household history.`
      };
    }

    // 3. Command: "snooze", "delay", "extend", "vacation"
    if (lower.startsWith('snooze') || lower.includes('delay') || lower.includes('extend') || lower.includes('vacation')) {
      const filter = this.findFilter(lower);
      if (!filter) {
        return {
          success: false,
          actionTaken: 'not_found',
          reply: `I couldn't identify which filter to snooze. Try e.g. "snooze hvac 14 days" or "snooze fridge 30 days".`
        };
      }

      let days = 30; // default
      const daysMatch = lower.match(/\b(\d{1,3})\s*(?:day|days|d)?\b/);
      const weeksMatch = lower.match(/\b(\d{1,2})\s*(?:week|weeks|w)\b/);
      if (weeksMatch) {
        days = parseInt(weeksMatch[1], 10) * 7;
      } else if (daysMatch) {
        days = parseInt(daysMatch[1], 10);
      }

      const updated = this.snooze(filter.id, days, `Snoozed by ${user} via WhatsApp Assistant`);
      return {
        success: true,
        actionTaken: 'snooze',
        filter: updated,
        reply: `⏸️ *Snoozed ${updated.name} by ${days} days for vacation/low usage!* 🌴\n• New Due Date: *${updated.targetDueDate}* (${updated.daysRemaining} days remaining)\n• Requested by: ${user}`
      };
    }

    // 4. Query: "buy", "order", "reorder", "amazon", "purchase link"
    if (lower.startsWith('buy') || lower.startsWith('order') || lower.includes('reorder link') || lower.includes('buy link') || lower.includes('amazon link') || lower.includes('where to buy')) {
      const filter = this.findFilter(lower);
      if (!filter) {
        return {
          success: false,
          actionTaken: 'not_found',
          reply: `Which filter would you like to reorder? Try "buy fridge filter" or "reorder hvac".`
        };
      }
      return {
        success: true,
        actionTaken: 'buy_link',
        filter,
        reply: `🛒 *1-Click Reorder for ${filter.name}:*\n• Specs: *${filter.manufacturer} — ${filter.modelNumber}*\n• Direct Buy Link: ${filter.reorderUrl || 'https://www.amazon.com'}\n• Current Status: ${filter.status} (${filter.daysRemaining > 0 ? `${filter.daysRemaining} days left` : `${Math.abs(filter.daysRemaining)} days overdue`})`
      };
    }

    // 5. Query: "share", "iphone", "pixel", "app", "link"
    if (lower.includes('share') || lower.includes('iphone') || lower.includes('install') || lower.includes('app link') || lower.includes('how to install')) {
      return {
        success: true,
        actionTaken: 'share_info',
        reply: `📱 *FilterFlow Cross-Platform App & Sharing:*\n\n` +
          `• *Local Home Wi-Fi URL:* http://192.168.86.47:3030\n` +
          `• *Dedicated HTTPS URL:* https://192.168.86.47:3443\n\n` +
          `🍏 *Wife's iPhone:* Open Safari -> Tap Share (⎋) -> "Add to Home Screen" (➕) for instant native app experience with badge support!\n\n` +
          `🤖 *Pixel 10 Pro:* Open Chrome -> Tap "Install App" to install WebAPK in app drawer.\n\n` +
          `💬 Both of you can also query or update filters right here on WhatsApp anytime!`
      };
    }

    // 6. Query: Specific filter status check (e.g. "when is the fridge filter due", "check cabin filter")
    const specificFilter = this.findFilter(lower);
    if (specificFilter && (lower.includes('when') || lower.includes('due') || lower.includes('status') || lower.includes('check') || lower.includes('filter') || lower.includes('how is'))) {
      return {
        success: true,
        actionTaken: 'filter_status',
        filter: specificFilter,
        reply: this.formatFilterDetailMessage(specificFilter)
      };
    }

    // 7. Query: General list / what is due / summary / status
    if (lower.includes('due') || lower.includes('what') || lower.includes('status') || lower.includes('list') || lower.includes('all') || lower.includes('summary') || lower.includes('overview') || lower.includes('alert') || lower.includes('notification')) {
      return {
        success: true,
        actionTaken: 'summary',
        reply: this.formatWhatsAppSummary()
      };
    }

    // 8. Fallback / Help guide
    return {
      success: true,
      actionTaken: 'help',
      reply: `👋 Hi ${user}! I'm your *FilterFlow Assistant* for Pixel 10 Pro & iPhone.\n\n` +
        `Here is what you can ask me:\n` +
        `• *"What filters are due?"* — Overview of pending and overdue filters\n` +
        `• *"When is the fridge filter due?"* — Check specific filter status\n` +
        `• *"Replaced fridge filter today"* — Reset cycle and record your maintenance\n` +
        `• *"Who replaced the HVAC filter last?"* — Check household maintenance history\n` +
        `• *"Snooze HVAC for 14 days"* — Extend due date for vacation\n` +
        `• *"Buy car engine filter"* — Get direct 1-Click Amazon reorder link\n` +
        `• *"Share app"* — Get Wi-Fi links and iPhone/Pixel install guides`
    };
  }
}
