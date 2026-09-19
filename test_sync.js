import assert from 'node:assert';

/**
 * FilterFlow Sync & Deconfliction Unit Tests
 * Simulates offline mutation queues and multi-user concurrent edits (Isaac & Wife)
 */

function mergeHistoryArrays(h1, h2) {
  const map = new Map();
  [...h1, ...h2].forEach(item => {
    if (!item || !item.date || !item.action) return;
    const key = `${item.date}::${item.action.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values()).sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
}

function processSync(remoteFilters, clientFilters, offlineQueue) {
  const filterMap = new Map();
  remoteFilters.forEach(f => filterMap.set(f.id, JSON.parse(JSON.stringify(f))));

  // 1. Process offline queue
  offlineQueue.forEach(item => {
    const { type, filterId, timestamp, payload: p } = item;
    const f = filterMap.get(filterId);
    const actionTime = timestamp ? new Date(timestamp).getTime() : Date.now();

    if (type === 'replace' && f) {
      const curTime = f.updatedAt ? new Date(f.updatedAt).getTime() : 0;
      if (actionTime >= curTime) {
        f.installedDate = p.replacedDate;
        f.lastReplacedDate = p.replacedDate;
        f.lastReplacedBy = p.replacedBy || 'Household';
        if (p.notes) f.notes = p.notes;
        f.lastSnoozeDays = 0;
        f.updatedAt = new Date(actionTime).toISOString();
        
        const d = new Date(p.replacedDate + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + parseInt(f.serviceLifeDays || 90, 10));
        f.targetDueDate = d.toISOString().split('T')[0];
      }
      if (!f.history) f.history = [];
      const histKey = `${p.replacedDate}::${p.replacedBy || 'Household'}::${(p.notes || '').trim().toLowerCase()}`;
      if (!f.history.some(h => `${h.date}::${h.replacedBy || ''}::${(h.notes || '').trim().toLowerCase()}` === histKey)) {
        f.history.push({
          date: p.replacedDate,
          action: `Replaced by ${p.replacedBy || 'Household'}${p.notes ? ': ' + p.notes : ''}`,
          replacedBy: p.replacedBy || 'Household',
          notes: p.notes || ''
        });
      }
    } else if (type === 'snooze' && f) {
      const days = parseInt(p.days, 10) || 14;
      f.lastSnoozeDays = (parseInt(f.lastSnoozeDays || 0, 10)) + days;
      const curDue = new Date((f.targetDueDate || f.installedDate) + 'T00:00:00Z');
      curDue.setUTCDate(curDue.getUTCDate() + days);
      f.targetDueDate = curDue.toISOString().split('T')[0];
      f.updatedAt = new Date(actionTime).toISOString();

      if (!f.history) f.history = [];
      f.history.push({
        date: new Date(actionTime).toISOString().split('T')[0],
        action: `Snoozed ${days} days by ${p.snoozedBy || 'Household'} (${p.notes || 'Vacation'})`,
        snoozedBy: p.snoozedBy || 'Household'
      });
    } else if (type === 'add' && p && p.id) {
      filterMap.set(p.id, p);
    } else if (type === 'delete') {
      filterMap.delete(filterId);
    }
  });

  // 2. Merge remaining client filters
  clientFilters.forEach(cf => {
    if (!filterMap.has(cf.id)) {
      filterMap.set(cf.id, cf);
    } else {
      const rf = filterMap.get(cf.id);
      const cTime = cf.updatedAt ? new Date(cf.updatedAt).getTime() : 0;
      const rTime = rf.updatedAt ? new Date(rf.updatedAt).getTime() : 0;

      if (cTime > rTime) {
        const mergedHist = mergeHistoryArrays(rf.history || [], cf.history || []);
        Object.assign(rf, cf);
        rf.history = mergedHist;
      } else {
        rf.history = mergeHistoryArrays(rf.history || [], cf.history || []);
      }
    }
  });

  return Array.from(filterMap.values());
}

console.log('🧪 Starting Google Sheets Offline & Deconfliction Test Suite...\n');

// TEST 1: Independent offline edits on different filters merge cleanly
const initialRemote = [
  {
    id: 'filter-hvac',
    name: 'HVAC Filter',
    installedDate: '2026-06-01',
    serviceLifeDays: 90,
    targetDueDate: '2026-08-30',
    updatedAt: '2026-06-01T12:00:00.000Z',
    history: []
  },
  {
    id: 'filter-fridge',
    name: 'Fridge Water Filter',
    installedDate: '2026-03-01',
    serviceLifeDays: 180,
    targetDueDate: '2026-08-28',
    updatedAt: '2026-03-01T12:00:00.000Z',
    history: []
  }
];

// Isaac replaces HVAC offline
const isaacQueue = [
  {
    type: 'replace',
    filterId: 'filter-hvac',
    timestamp: '2026-09-19T14:00:00.000Z',
    payload: {
      replacedDate: '2026-09-19',
      replacedBy: 'Isaac',
      notes: 'New Filtrete MERV 12 installed'
    }
  }
];

// Wife snoozes Fridge filter offline
const wifeQueue = [
  {
    type: 'snooze',
    filterId: 'filter-fridge',
    timestamp: '2026-09-19T14:30:00.000Z',
    payload: {
      days: 30,
      snoozedBy: 'Wife',
      notes: 'Vacation extension'
    }
  }
];

// Wife syncs first
let master = processSync(initialRemote, initialRemote, wifeQueue);
assert.strictEqual(master.find(f => f.id === 'filter-fridge').lastSnoozeDays, 30);
assert.strictEqual(master.find(f => f.id === 'filter-hvac').installedDate, '2026-06-01');
console.log('✅ 1. Wife offline snooze synced to master.');

// Isaac syncs second (replaces HVAC)
master = processSync(master, master, isaacQueue);
const hvac = master.find(f => f.id === 'filter-hvac');
const fridge = master.find(f => f.id === 'filter-fridge');

assert.strictEqual(hvac.installedDate, '2026-09-19');
assert.strictEqual(hvac.lastReplacedBy, 'Isaac');
assert.strictEqual(fridge.lastSnoozeDays, 30);
assert.strictEqual(fridge.history.length, 1);
assert.strictEqual(hvac.history.length, 1);
console.log('✅ 2. Isaac offline replacement merged without overwriting Wife snooze.');

// TEST 2: Concurrent replacement on the same filter (Last Write Wins, history preserved)
const conflictingQueue = [
  {
    type: 'replace',
    filterId: 'filter-hvac',
    timestamp: '2026-09-19T15:00:00.000Z', // 1 hour after Isaac
    payload: {
      replacedDate: '2026-09-19',
      replacedBy: 'Wife',
      notes: 'Wife verified and tightened filter frame'
    }
  }
];

master = processSync(master, master, conflictingQueue);
const hvacAfterConflict = master.find(f => f.id === 'filter-hvac');
assert.strictEqual(hvacAfterConflict.lastReplacedBy, 'Wife'); // Later timestamp wins
assert.strictEqual(hvacAfterConflict.history.length, 2); // BOTH Isaac and Wife history entries preserved!
console.log('✅ 3. Same-filter conflict: later write wins status, ALL family history events preserved.');

// TEST 3: History deduplication
const dupHistory1 = [
  { date: '2026-09-19', action: 'Replaced by Isaac' },
  { date: '2026-07-01', action: 'Initial install' }
];
const dupHistory2 = [
  { date: '2026-09-19', action: 'Replaced by Isaac' }, // Duplicate
  { date: '2026-05-01', action: 'Purchased filter' }
];

const mergedHistory = mergeHistoryArrays(dupHistory1, dupHistory2);
assert.strictEqual(mergedHistory.length, 3);
assert.strictEqual(mergedHistory[0].date, '2026-05-01');
assert.strictEqual(mergedHistory[1].date, '2026-07-01');
assert.strictEqual(mergedHistory[2].date, '2026-09-19');
console.log('✅ 4. History array successfully deduplicated and sorted chronologically.');

console.log('\n🎉 ALL GOOGLE SHEETS OFFLINE & DECONFLICTION TESTS PASSED!\n');
