# 🔔 FilterFlow: Notification Templates & Alert Messaging Guide

> **Copywriting & Multi-Channel Alert Architecture**  
> *Pre-order warnings, expiration day prompts, and recurring overdue notifications*  
> **Card ID Reference:** `5492db1f-29e7-42ea-9bc9-32c41cb873cb`

---

## 🎯 Overview & Objectives

FilterFlow's notification system prevents filter neglect without causing notification fatigue. By using an intelligent **3-tier cadence** coupled with channel-appropriate copywriting, FilterFlow ensures household members receive timely, helpful alerts across **Mobile Push (iOS Safari PWA & Android WebAPK)** and **OpenClaw WhatsApp Messages**.

### The 3-Tier Alert Lifecycle

```
    T-14 Days              T-0 Days            Days 1-3 (Overdue)     Days 30, 60, 90+ (Monthly)
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐    ┌────────────────────────┐
│  PRE-ORDER   │       │ REPLACEMENT  │       │   GRACE PERIOD   │    │  RECURRING REMINDERS   │
│   WARNING    │ ───►  │     DAY      │ ───►  │  Urgent Action   │───►│ Impact-Driven Reminder │
│ Allow ship   │       │ Fresh filter │       │  Quiet (4-29d)   │    │ Snooze / Buy options   │
│   buffer     │       │ installation │       │  avoids fatigue  │    │ Airflow / purity alert │
└──────────────┘       └──────────────┘       └──────────────────┘    └────────────────────────┘
```

---

## 🧩 Dynamic Variable Reference

All notification templates utilize standardized variables resolved dynamically at runtime by `filter_engine.js`:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `{filter_name}` | Official title of the filter | `Central HVAC Return Filter` |
| `{filter_nickname}`| Friendly colloquial name | `HVAC Filter`, `Fridge Filter` |
| `{location}` | Physical installation location | `Main Hallway Ceiling Return` |
| `{model_number}` | Part dimensions, model or specs | `20x25x1 MERV 11 Pleated` |
| `{days_remaining}`| Days until target replacement | `14`, `3`, `1` |
| `{days_overdue}` | Days past scheduled expiration | `1`, `30`, `60` |
| `{due_date}` | Formatted ISO target due date | `2026-10-01` |
| `{amazon_url}` | Pre-configured 1-Click Amazon link | `https://www.amazon.com/s?k=...` |
| `{recipient}` | Target family member | `Isaac`, `Wife`, `Household` |
| `{last_replaced}` | Person who last replaced it | `Isaac on 2026-06-15` |

---

## 📦 Tier 1: T-14 Day Pre-Order Warning

**Trigger:** `daysRemaining <= 14 && daysRemaining > 0`  
**Purpose:** Give Isaac or his wife enough lead time (typically 2–4 days for Amazon Prime shipping) so the new filter is physically sitting at the door before expiration day.  
**Tone:** Proactive, helpful, frictionless.

### A. Mobile Web Push (PWA / WebAPK)
- **Notification Title:** `📦 Order Soon: {filter_nickname}`
- **Body:** `{filter_name} ({model_number}) expires in {days_remaining} days. Tap to order with 1-click.`
- **Action Buttons:**
  - `[🛒 Buy on Amazon]` $\rightarrow$ Opens `{amazon_url}` in browser.
  - `[View Dashboard]` $\rightarrow$ Opens app detail modal.

### B. WhatsApp Assistant Messages

#### Variant 1: Default Household Heads-Up (Recommended)
> 📦 *Heads up, {recipient}!*  
> Your *{filter_name}* ({location}) is scheduled for replacement in *{days_remaining} days* (on {due_date}).  
>  
> To make sure you have the replacement on hand:  
> 🛒 *1-Click Amazon Reorder:* {amazon_url}  
>  
> _Specs: {model_number}_  
> _Reply "snooze {filter_nickname} 14" if you'll be away!_

#### Variant 2: Concise / Single Item
> 📦 *Filter Order Reminder:* Your *{filter_name}* expires in {days_remaining} days.  
> Order replacement: {amazon_url}

---

## ⚠️ Tier 2: T-0 Day Replacement Day

**Trigger:** `daysRemaining === 0`  
**Purpose:** Remind the user that today is scheduled installation day.  
**Tone:** Action-oriented, direct, encouraging.

### A. Mobile Web Push (PWA / WebAPK)
- **Notification Title:** `⚠️ Replace Today: {filter_nickname}`
- **Body:** `Your {filter_name} has reached its service life. Tap to mark replaced or snooze.`
- **Action Buttons:**
  - `[✅ Mark Replaced]` $\rightarrow$ Opens Mark Replaced modal.
  - `[⏸️ Snooze 14d]` $\rightarrow$ Extends lifecycle by 14 days.

### B. WhatsApp Assistant Messages

#### Variant 1: Interactive Assistant Prompt
> ⚠️ *Time to replace your filter today!*  
>  
> Your *{filter_name}* at *{location}* has completed its {service_life}-day service cycle.  
>  
> 🔄 *Did you swap it out?*  
> Just reply:  
> • *"replaced {filter_nickname}"* — resets your cycle and logs attribution  
> • *"snooze {filter_nickname} 14"* — if you need more time  
>  
> 🛒 *Need a replacement fast?* {amazon_url}

#### Variant 2: Multi-Item Replacement Day (When multiple filters coincide)
> ⚠️ *Household Maintenance Day!*  
> The following filters are due for replacement today:  
> 1. *{filter_name_1}* ({location_1})  
> 2. *{filter_name_2}* ({location_2})  
>  
> Reply with *"replaced <name>"* as you finish each one!

---

## 🔔 Tier 3: Overdue & Monthly Recurring Alerts

**Trigger:** `daysRemaining < 0`  
**Cadence Strategy:**  
- **Initial Grace Period (Days 1–3 overdue):** Urgent, immediate action reminder.  
- **Quiet Period (Days 4–29 overdue):** Notifications silenced to respect family focus and prevent alert blindness (the badge in the web app remains red).  
- **Recurring Monthly Milestones (Days 30, 60, 90 overdue):** Re-alert with impact explanations (strain on HVAC system, indoor air quality degradation, bacteria buildup in water filters).

### A. Days 1–3 Overdue: Grace Period Prompt

#### Mobile Web Push
- **Notification Title:** `🔔 Overdue: {filter_nickname}`
- **Body:** `{filter_name} is {days_overdue} day(s) overdue. Tap to mark replaced or snooze for vacation.`

#### WhatsApp Assistant
> 🔔 *Quick reminder:* Your *{filter_name}* is now *{days_overdue} day(s) overdue*.  
>  
> If you've already swapped it, reply *"replaced {filter_nickname}"* to update the household board.  
> If you've been traveling or haven't run the system, reply *"snooze {filter_nickname} 30"*.  
> 🛒 *Reorder:* {amazon_url}

---

### B. Days 30, 60, 90 Overdue: Monthly Recurring Impact Alerts

#### 1. Central HVAC Filter (Day 30+ Overdue)
> 🚨 *Monthly Alert: HVAC Filter 30 Days Overdue*  
>  
> Your *Central HVAC Return Filter* ({location}) is now **{days_overdue} days past due**.  
>  
> 💡 *Why it matters:*  
> A clogged air filter restricts airflow, forcing your HVAC blower motor to work harder, increasing energy bills, and circulating trapped dust/allergens.  
>  
> 🛒 *Order replacement now:* {amazon_url}  
> 🔄 *Already replaced?* Reply *"replaced hvac"*  
> ⏸️ *Vacant home?* Reply *"snooze hvac 30"*

#### 2. Refrigerator Water & Ice Filter (Day 30+ Overdue)
> 🚨 *Monthly Alert: Fridge Water Filter Overdue*  
>  
> Your *Refrigerator Water & Ice Filter* is **{days_overdue} days past due**.  
>  
> 💡 *Why it matters:*  
> Saturated carbon blocks lose their ability to filter chlorine, heavy metals, and sediment, and can reduce water dispenser flow rate.  
>  
> 🛒 *1-Click Cartridge Reorder:* {amazon_url}  
> 🔄 *Swapped it out?* Reply *"replaced fridge"*

#### 3. Car Cabin Air Filter (Day 30+ Overdue)
> 🚨 *Vehicle Maintenance: Cabin Air Filter Overdue*  
>  
> The cabin air filter in your vehicle is **{days_overdue} days past due**.  
>  
> 💡 *Why it matters:*  
> Dirty cabin filters cause window fogging, musty AC odors, and let road soot into the passenger cabin.  
>  
> 🛒 *1-Click Reorder:* {amazon_url}  
> 🔄 *Replaced?* Reply *"replaced cabin"*

#### 4. Car Engine Intake Air Filter (Day 30+ Overdue)
> 🚨 *Vehicle Maintenance: Engine Intake Air Filter Overdue*  
>  
> Your engine air intake filter is **{days_overdue} days past due**.  
>  
> 💡 *Why it matters:*  
> A dirty engine filter reduces acceleration responsiveness, wastes fuel, and can allow abrasive particles into the cylinders.  
>  
> 🛒 *1-Click Reorder:* {amazon_url}  
> 🔄 *Replaced?* Reply *"replaced engine filter"*

---

## 💬 WhatsApp Response Confirmation Templates

When family members reply to alerts or send commands, the assistant should always acknowledge them warmly:

### 1. Replacement Confirmation
> ✅ *Awesome, {recipient}!*  
> I've recorded that you replaced the *{filter_name}* today ({date}).  
>  
> • **New Due Date:** {next_due_date} ({service_life_days} days)  
> • **Attribution:** Recorded to household history as replaced by *{recipient}*  
> • **Status:** 🟢 Healthy  
>  
> The household dashboard has been updated! 🛡️

### 2. Vacation Snooze Confirmation
> ⏸️ *Snoozed!*  
> I've extended the *{filter_name}* schedule by *{days} days* for vacation / low usage.  
>  
> • **New Due Date:** {new_due_date}  
> • **Days Remaining:** {days_remaining} days  
> • **Attribution:** Snoozed by *{recipient}*  
>  
> Enjoy your time away! 🌴

### 3. Unknown Filter Nickname Help
> ❓ *I couldn't find that filter.*  
> Here are the active filters in your home and cars:  
> 1. *HVAC* (Central Return Filter)  
> 2. *Cabin* (Car Cabin Air Filter)  
> 3. *Engine* (Car Engine Air Intake)  
> 4. *Fridge* (Refrigerator Water & Ice)  
> 5. *Purifier* (Bedroom Air Purifier)  
>  
> Try saying *"when is fridge due"* or *"replaced hvac"*!

---

## ⚙️ Engineering & Integration Checklist

- [x] Evaluated in `filter_engine.js`:
  - `isOrderReminderActive` ($1 \le \text{daysRemaining} \le 14$)
  - `isDueToday` ($\text{daysRemaining} = 0$)
  - `isMonthlyRecurringReminder` ($\text{daysOverdue} \le 3 \lor \text{daysOverdue} \pmod{30} = 0$)
- [x] Verified via `test.js` (Section 4, tests 19–24).
- [x] CLI command `node cli.js notifications` emits active Tier 1 and Tier 3 alerts.
- [x] WhatsApp command `node cli.js whatsapp` renders mobile-formatted summary.
- [x] Attributed to family members (`Isaac`, `Wife`, `Household`).

---

*Document approved and delivered for Workboard Card `5492db1f`.*
