#!/usr/bin/env node
import { FilterEngine } from './filter_engine.js';

const engine = new FilterEngine();
const args = process.argv.slice(2);
const command = args[0] || 'list';

function formatTable(filters) {
  console.log('\n🏠 FILTER TRACKER DASHBOARD (Pixel 10 Pro & Home System)\n' + '='.repeat(70));
  for (const f of filters) {
    const statusIcon = f.status === 'HEALTHY' ? '✅' : f.status === 'EXPIRING_SOON' ? '⚠️ ' : '🚨';
    console.log(`${statusIcon} [${f.status}] ${f.name}`);
    console.log(`   Location:     ${f.location} (${f.category})`);
    console.log(`   Model/Specs:  ${f.manufacturer} - ${f.modelNumber}`);
    console.log(`   Installed:    ${f.installedDate} | Due Date: ${f.targetDueDate} (${f.daysRemaining > 0 ? `${f.daysRemaining} days left` : `${Math.abs(f.daysRemaining)} days overdue`})`);
    console.log(`   1-Click Buy:  ${f.reorderUrl}`);
    console.log('-'.repeat(70));
  }
}

switch (command) {
  case 'list': {
    const filters = engine.getAllFilters();
    formatTable(filters);
    break;
  }
  case 'notifications':
  case 'alerts': {
    const alerts = engine.getNotifications();
    console.log(`\n🔔 ACTIVE NOTIFICATIONS (${alerts.length} pending):\n`);
    if (alerts.length === 0) {
      console.log('✨ All filters are in good standing! No notifications needed.');
    } else {
      for (const a of alerts) {
        console.log(`• ${a.title}`);
        console.log(`  ${a.message}`);
        console.log(`  Reorder Link: ${a.reorderUrl}\n`);
      }
    }
    break;
  }
  case 'replace': {
    const id = args[1];
    if (!id) {
      console.error('Error: specify filter ID to replace (e.g. node cli.js replace filter-hvac-main)');
      process.exit(1);
    }
    const updated = engine.markReplaced(id);
    if (!updated) {
      console.error(`Error: filter with ID "${id}" not found.`);
      process.exit(1);
    }
    console.log(`\n✅ Marked "${updated.name}" as replaced today! New due date: ${updated.targetDueDate}`);
    break;
  }
  case 'snooze': {
    const id = args[1];
    const days = parseInt(args[2] || '30', 10);
    if (!id) {
      console.error('Error: specify filter ID and days (e.g. node cli.js snooze filter-hvac-main 30)');
      process.exit(1);
    }
    const updated = engine.snooze(id, days, 'Vacation / low usage extension');
    if (!updated) {
      console.error(`Error: filter with ID "${id}" not found.`);
      process.exit(1);
    }
    console.log(`\n⏸️  Snoozed "${updated.name}" by ${days} days for vacation/low usage. New due date: ${updated.targetDueDate}`);
    break;
  }
  default:
    console.log(`Usage:
  node cli.js list              List all filters with status and links
  node cli.js notifications     View pending 14-day pre-order and overdue alerts
  node cli.js replace <id>      Mark filter as replaced today
  node cli.js snooze <id> [days] Snooze filter for vacation/low-usage
`);
}
