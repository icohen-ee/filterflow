#!/usr/bin/env node
import { FilterEngine } from './filter_engine.js';

const engine = new FilterEngine();
const args = process.argv.slice(2);
const command = args[0] || 'list';

// Helper to parse flags like --by "Isaac" or --owner "Wife"
function parseFlag(flagName, defaultValue = null) {
  const idx = args.indexOf(`--${flagName}`);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultValue;
}

function formatTable(filters) {
  console.log('\n🏠 FILTERFLOW DASHBOARD (Pixel 10 Pro, iPhone & Household Sharing)\n' + '='.repeat(75));
  for (const f of filters) {
    const statusIcon = f.status === 'HEALTHY' ? '✅' : f.status === 'EXPIRING_SOON' ? '⚠️ ' : '🚨';
    console.log(`${statusIcon} [${f.status}] ${f.name}`);
    console.log(`   Location:     ${f.location} (${f.category}) | Owner: ${f.owner || 'Household'}`);
    console.log(`   Model/Specs:  ${f.manufacturer} - ${f.modelNumber}`);
    console.log(`   Installed:    ${f.installedDate} | Due Date: ${f.targetDueDate} (${f.daysRemaining > 0 ? `${f.daysRemaining} days left` : `${Math.abs(f.daysRemaining)} days overdue`})`);
    console.log(`   Last Replaced:${f.lastReplacedDate || f.installedDate} by ${f.lastReplacedBy || 'Household'}`);
    console.log(`   1-Click Buy:  ${f.reorderUrl}`);
    console.log('-'.repeat(75));
  }
}

switch (command) {
  case 'list': {
    const owner = parseFlag('owner');
    const filters = engine.getAllFilters(new Date(), { owner });
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

  case 'query':
  case 'ask': {
    const queryText = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
    if (!queryText) {
      console.error('Error: specify a query (e.g. node cli.js query "what filters are due")');
      process.exit(1);
    }
    const fromUser = parseFlag('by', 'Household');
    const result = engine.handleAssistantCommand(queryText, fromUser);
    console.log('\n' + result.reply + '\n');
    break;
  }

  case 'whatsapp': {
    const fromUser = parseFlag('by', 'Household');
    const summary = engine.formatWhatsAppSummary();
    console.log('\n' + summary + '\n');
    break;
  }

  case 'share': {
    console.log(`
📱 FILTERFLOW HOUSEHOLD SHARING & DEVICE SETUP
======================================================================
• Home Network Web App: http://192.168.86.47:3030
• Dedicated HTTPS:      https://192.168.86.47:3443
• Localhost:            http://localhost:3030

🍏 FOR WIFE'S iPHONE (iOS 16.4+):
1. Connect to home Wi-Fi and open http://192.168.86.47:3030 in Safari.
2. Tap the Share button (⎋) at the bottom toolbar.
3. Scroll and select "Add to Home Screen" (➕).
4. Tap "Add" — FilterFlow launches full-screen with offline caching and app badge!

🤖 FOR GOOGLE PIXEL 10 PRO (Android Chromium / WebAPK):
1. Open http://192.168.86.47:3030 in Chrome.
2. Tap the "Install app" prompt or 3-dots menu -> "Install App".
3. FilterFlow installs as a first-class WebAPK with home screen & app drawer launcher.

💬 OPENCLAW WHATSAPP ASSISTANT:
• Isaac & Wife can both query the assistant directly on WhatsApp!
• Examples:
  - "What filters are due?"
  - "When is the fridge filter due?"
  - "Replaced fridge filter today"
  - "Snooze HVAC for 14 days"
  - "Buy cabin filter"
======================================================================
`);
    break;
  }

  case 'replace': {
    const id = args[1];
    if (!id || id.startsWith('--')) {
      console.error('Error: specify filter ID to replace (e.g. node cli.js replace filter-hvac-main --by "Isaac")');
      process.exit(1);
    }
    const by = parseFlag('by', 'Household');
    const notes = parseFlag('notes', '');
    const date = parseFlag('date', new Date().toISOString().split('T')[0]);

    const updated = engine.markReplaced(id, date, notes, by);
    if (!updated) {
      console.error(`Error: filter with ID "${id}" not found.`);
      process.exit(1);
    }
    console.log(`\n✅ Marked "${updated.name}" as replaced today by ${by}!`);
    console.log(`   New due date: ${updated.targetDueDate} (${updated.serviceLifeDays} days cycle)`);
    break;
  }

  case 'snooze': {
    const id = args[1];
    const days = parseInt(args[2] && !args[2].startsWith('--') ? args[2] : '30', 10);
    if (!id || id.startsWith('--')) {
      console.error('Error: specify filter ID and days (e.g. node cli.js snooze filter-hvac-main 30)');
      process.exit(1);
    }
    const by = parseFlag('by', 'Household');
    const updated = engine.snooze(id, days, `Snoozed by ${by} for vacation/low usage`);
    if (!updated) {
      console.error(`Error: filter with ID "${id}" not found.`);
      process.exit(1);
    }
    console.log(`\n⏸️  Snoozed "${updated.name}" by ${days} days for vacation/low usage.`);
    console.log(`   New due date: ${updated.targetDueDate} (${updated.daysRemaining} days remaining)`);
    break;
  }

  default:
    console.log(`Usage:
  node cli.js list [--owner <name>]          List all filters with status and household ownership
  node cli.js query "<natural language>"     Ask the assistant (e.g. "what is due", "when is fridge due")
  node cli.js whatsapp                       Generate WhatsApp-formatted status update
  node cli.js share                          Show Wi-Fi URLs and iPhone/Pixel setup instructions
  node cli.js notifications                  View pending 14-day pre-order and overdue alerts
  node cli.js replace <id> [--by <name>]     Mark filter as replaced today by family member
  node cli.js snooze <id> [days]             Snooze filter for vacation/low-usage
`);
}
