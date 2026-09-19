/**
 * FilterFlow — Google Sheets Cloud Sync & Storage Script
 * 
 * Instructions:
 * 1. In Google Drive, create a new Google Sheet named "FilterFlow Data".
 * 2. Click Extensions > Apps Script.
 * 3. Replace the contents of Code.gs with this entire script.
 * 4. Click Deploy > New deployment:
 *    - Select type: Web app
 *    - Description: FilterFlow Cloud Sync
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone
 * 5. Click Deploy, authorize access, and copy the Web App URL.
 * 6. In your FilterFlow app on your phone, tap ⚙️ Settings, paste the Web App URL, and tap "Save & Sync".
 */

const SHEET_NAME = 'Filters';
const HEADERS = [
  'ID',
  'Name',
  'Category',
  'Location',
  'Manufacturer',
  'Model Number',
  'Installed Date',
  'Service Life (Days)',
  'Target Due Date',
  '1-Click Reorder URL',
  'Owner',
  'Notes',
  'Last Snooze Days',
  'Last Replaced Date',
  'Last Replaced By',
  'Updated At',
  'History JSON'
];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && defaultSheet.getLastRow() === 0) {
      try { ss.deleteSheet(defaultSheet); } catch (_) {}
    }
  }
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground('#1e293b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    // Seed initial household filters
    const sampleFilters = [
      {
        id: 'filter-hvac-main',
        name: 'Central HVAC Return Filter',
        category: 'Home HVAC',
        location: 'Main Hallway Ceiling Return',
        manufacturer: 'Filtrete',
        modelNumber: '20x25x1 MPR 1500 (MERV 12)',
        installedDate: '2026-07-01',
        serviceLifeDays: 90,
        targetDueDate: '2026-09-29',
        reorderUrl: 'https://www.amazon.com/dp/B00T4CH2DY',
        owner: 'Household',
        notes: 'Change quarterly. High filtration for allergies.',
        lastSnoozeDays: 0,
        lastReplacedDate: '2026-07-01',
        lastReplacedBy: 'Isaac',
        updatedAt: new Date().toISOString(),
        history: [{ date: '2026-07-01', action: 'Initial install', replacedBy: 'Isaac' }]
      },
      {
        id: 'filter-fridge-water',
        name: 'Refrigerator Water & Ice Filter',
        category: 'Appliance',
        location: 'Refrigerator Compartment',
        manufacturer: 'EveryDrop / OEM',
        modelNumber: 'Filter 1 (EDR1RXD1)',
        installedDate: '2026-04-10',
        serviceLifeDays: 180,
        targetDueDate: '2026-10-07',
        reorderUrl: 'https://www.amazon.com/dp/B00V5I8V0G',
        owner: 'Household',
        notes: 'Replace every 6 months to maintain water flow and NSF 53 filtration.',
        lastSnoozeDays: 0,
        lastReplacedDate: '2026-04-10',
        lastReplacedBy: 'Wife',
        updatedAt: new Date().toISOString(),
        history: [{ date: '2026-04-10', action: 'Initial install', replacedBy: 'Wife' }]
      },
      {
        id: 'filter-car-cabin',
        name: 'Car Cabin Air Filter (HVAC)',
        category: 'Vehicle',
        location: 'Behind Glove Compartment',
        manufacturer: 'EPAuto / Bosch',
        modelNumber: 'HEPA Cabin Filter CP134',
        installedDate: '2025-11-15',
        serviceLifeDays: 365,
        targetDueDate: '2026-11-15',
        reorderUrl: 'https://www.amazon.com/s?k=car+cabin+air+filter',
        owner: 'Isaac',
        notes: 'Inspect during annual maintenance.',
        lastSnoozeDays: 0,
        lastReplacedDate: '2025-11-15',
        lastReplacedBy: 'Isaac',
        updatedAt: new Date().toISOString(),
        history: [{ date: '2025-11-15', action: 'Initial install', replacedBy: 'Isaac' }]
      },
      {
        id: 'filter-car-engine',
        name: 'Car Engine Intake Air Filter',
        category: 'Vehicle',
        location: 'Under Hood Airbox',
        manufacturer: 'Fram / OEM',
        modelNumber: 'Extra Guard CA10190',
        installedDate: '2025-10-01',
        serviceLifeDays: 365,
        targetDueDate: '2026-10-01',
        reorderUrl: 'https://www.amazon.com/s?k=engine+intake+air+filter',
        owner: 'Isaac',
        notes: 'Protects engine combustion chamber.',
        lastSnoozeDays: 0,
        lastReplacedDate: '2025-10-01',
        lastReplacedBy: 'Isaac',
        updatedAt: new Date().toISOString(),
        history: [{ date: '2025-10-01', action: 'Initial install', replacedBy: 'Isaac' }]
      },
      {
        id: 'filter-room-fan',
        name: 'Bedroom Air Purifier Filter',
        category: 'Portable Appliance',
        location: 'Primary Bedroom',
        manufacturer: 'Levoit / Dyson',
        modelNumber: 'True HEPA Replacement Core 300-RF',
        installedDate: '2026-05-01',
        serviceLifeDays: 180,
        targetDueDate: '2026-10-28',
        reorderUrl: 'https://www.amazon.com/s?k=true+hepa+air+purifier+replacement+filter',
        owner: 'Wife',
        notes: 'Vacuum pre-filter screen monthly.',
        lastSnoozeDays: 0,
        lastReplacedDate: '2026-05-01',
        lastReplacedBy: 'Wife',
        updatedAt: new Date().toISOString(),
        history: [{ date: '2026-05-01', action: 'Initial install', replacedBy: 'Wife' }]
      }
    ];

    writeFiltersToSheet(sheet, sampleFilters);
  }
  return sheet;
}

function readFiltersFromSheet(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const filters = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;

    let history = [];
    try {
      if (row[16]) history = JSON.parse(row[16]);
    } catch (_) {}

    filters.push({
      id: String(row[0]),
      name: String(row[1] || ''),
      category: String(row[2] || 'Other'),
      location: String(row[3] || ''),
      manufacturer: String(row[4] || ''),
      modelNumber: String(row[5] || ''),
      installedDate: String(row[6] || ''),
      serviceLifeDays: Number(row[7]) || 90,
      targetDueDate: String(row[8] || ''),
      reorderUrl: String(row[9] || ''),
      owner: String(row[10] || 'Household'),
      notes: String(row[11] || ''),
      lastSnoozeDays: Number(row[12]) || 0,
      lastReplacedDate: String(row[13] || row[6] || ''),
      lastReplacedBy: String(row[14] || 'Household'),
      updatedAt: String(row[15] || new Date().toISOString()),
      history: history
    });
  }
  return filters;
}

function writeFiltersToSheet(sheet, filters) {
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).clearContent();
  }
  if (!filters || filters.length === 0) return;

  const rows = filters.map(f => [
    f.id || '',
    f.name || '',
    f.category || 'Other',
    f.location || '',
    f.manufacturer || '',
    f.modelNumber || '',
    f.installedDate || '',
    f.serviceLifeDays || 90,
    f.targetDueDate || '',
    f.reorderUrl || '',
    f.owner || 'Household',
    f.notes || '',
    f.lastSnoozeDays || 0,
    f.lastReplacedDate || f.installedDate || '',
    f.lastReplacedBy || 'Household',
    f.updatedAt || new Date().toISOString(),
    JSON.stringify(f.history || [])
  ]);

  sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const filters = readFiltersFromSheet(sheet);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      filters: filters,
      serverTime: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const contents = e.postData ? e.postData.contents : '{}';
    const payload = JSON.parse(contents);
    const clientFilters = payload.clientFilters || [];
    const offlineQueue = payload.offlineQueue || [];

    const sheet = getOrCreateSheet();
    let remoteFilters = readFiltersFromSheet(sheet);

    const filterMap = new Map();
    remoteFilters.forEach(f => filterMap.set(f.id, f));

    // 1. Process Offline Queue Mutations (Chronological)
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
        if (!filterMap.has(p.id)) {
          filterMap.set(p.id, p);
        }
      } else if (type === 'delete') {
        filterMap.delete(filterId);
      }
    });

    // 2. Merge any client filters that have a newer updatedAt
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

    const finalFilters = Array.from(filterMap.values());
    writeFiltersToSheet(sheet, finalFilters);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      filters: finalFilters,
      syncedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

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
