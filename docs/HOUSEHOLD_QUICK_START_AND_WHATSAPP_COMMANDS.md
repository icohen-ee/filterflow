# 🛡️ FilterFlow: Household Quick-Start & WhatsApp Commands Guide

> **Family Filter & Vehicle Maintenance Assistant**  
> *Designed for Isaac, family, and household devices*  
> **Card ID Reference:** `3642b656-c4d2-4fa7-9574-2ee5e40d0636`

---

## 🌟 Welcome to FilterFlow

FilterFlow keeps your home and vehicle filters fresh, healthy, and on-schedule with zero manual tracking hassle. Whether you are checking filter life from your couch, reordering replacement parts with 1-click Amazon links, or letting the household know you just swapped out the fridge water filter, FilterFlow coordinates everything seamlessly across your family's phones.

```
                   ┌─────────────────────────────────────────┐
                   │          FilterFlow Core Server         │
                   │      Local Wi-Fi (HTTP 3030 / 3443)     │
                   └────────────────────┬────────────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
           ▼                            ▼                            ▼
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────────┐
│  Isaac's Pixel 10    │    │  Wife's iPhone       │    │  OpenClaw WhatsApp Bot   │
│  Android WebAPK      │    │  iOS Safari PWA      │    │  Household Assistant     │
│  • Instant sync      │    │  • Home screen icon  │    │  • Conversational chats  │
│  • Push alerts       │    │  • Real-time updates │    │  • Family attribution    │
│  • 1-Click Amazon    │    │  • QR onboarding     │    │  • Vacation snooze       │
└──────────────────────┘    └──────────────────────┘    └──────────────────────────┘
```

---

## 📱 Quick Setup for Your Devices

### 1. Isaac's Wife's iPhone (iOS 16.4+ Safari PWA)
You can install FilterFlow directly onto your iPhone home screen without needing an App Store account:

1. **Connect to Home Wi-Fi:** Ensure your iPhone is connected to the home network.
2. **Scan or Visit:** Open the Camera app and scan the QR code displayed on the home dashboard, or open Safari and go to:
   ```
   http://192.168.86.47:3030
   ```
   *(or `https://192.168.86.47:3443`)*
3. **Add to Home Screen:**
   - Tap the **Share** button (**⎋** / box with upward arrow) at the bottom of Safari.
   - Scroll down and tap **"Add to Home Screen"** (**➕**).
   - Tap **Add** in the top right corner.
4. **Done!** FilterFlow will appear as an app icon on your home screen with a clean, full-screen display, live status badges, and 1-tap reordering.

---

### 2. Isaac's Google Pixel 10 Pro (Android Chromium / WebAPK)
FilterFlow runs as a native-grade WebAPK on Android:

1. **Connect to Home Wi-Fi:** Open Google Chrome and navigate to:
   ```
   http://192.168.86.47:3030
   ```
2. **1-Tap Install:**
   - Tap the **"Install FilterFlow"** banner that appears at the bottom of the screen.
   - *(Alternative)* Tap the three dots menu (**⋮**) in the top right corner $\rightarrow$ tap **"Install app"**.
3. **Done!** FilterFlow integrates directly into your app drawer, home screen, and shares live state with your desktop.

---

## 💬 WhatsApp Assistant Cheat Sheet

The fastest way to check, update, or snooze filters is by sending a quick WhatsApp message to your OpenClaw assistant! The assistant recognizes natural language, handles nicknames, and records who performed each action.

### 📋 Common WhatsApp Commands & Examples

| What You Want to Do | What You Can Say in WhatsApp | What the Assistant Does |
| :--- | :--- | :--- |
| **Check All Filters** | *"What filters are due?"*<br>*"Filter status"*<br>*"Show all filters"* | Sends a formatted summary of all home and car filters, highlighting items due soon or overdue with 1-Click buy links. |
| **Check Specific Filter** | *"When is the fridge filter due?"*<br>*"Check HVAC"*<br>*"Cabin air filter status"* | Pulls up the exact filter, its installed date, days remaining, location, and part model number. |
| **Report a Replacement** | *"Replaced fridge filter today"*<br>*"Just changed the HVAC filter"*<br>*"Replaced cabin filter"* | Resets the filter lifecycle to Day 0, updates the new due date, and records your name in the maintenance audit history! |
| **Check Maintenance History** | *"Who replaced the fridge filter last?"*<br>*"When was HVAC last changed?"* | Tells you the exact date and family member who completed the last replacement (e.g., *"Replaced by Wife on Sep 19, 2026"*). |
| **Snooze for Vacation** | *"Snooze HVAC 14 days"*<br>*"Delay fridge filter 3 weeks"*<br>*"Snooze cabin filter 30 days"* | Extends the due date so you aren't bothered with notifications while away from home or during low vehicle usage. |
| **Get 1-Click Amazon Buy Link** | *"Buy cabin filter"*<br>*"Reorder fridge filter"*<br>*"Link for HVAC filter"* | Immediately returns the direct Amazon search/cart URL with the correct filter dimensions and model specs. |
| **Share Setup / Wi-Fi Links** | *"How do I install on wife's phone?"*<br>*"Show share link"* | Replies with the local Wi-Fi IP, web address, and step-by-step instructions for adding to home screen. |

---

### 🗣️ Example WhatsApp Conversations

#### Example 1: Checking status before shopping
> **Isaac:** *"What filters are due soon?"*  
> **Assistant:**  
> 🛡️ **FilterFlow — Household Filter Status**  
> ⚠️ **EXPIRING SOON — PRE-ORDER (1):**  
> • **Car Engine Intake Air Filter** (Under Hood Airbox)  
>   Due in 12 days (Oct 01, 2026)  
>   🛒 **1-Click Buy:** [Amazon Reorder Link](https://www.amazon.com/s?k=engine+intake+air+filter)  
>  
> ✅ **Healthy Filters (4):**  
> • Central HVAC Return Filter — 103 days remaining  
> • Car Cabin Air Filter — 57 days remaining  
> • Refrigerator Water & Ice Filter — 180 days remaining  
> • Bedroom Air Purifier — 39 days remaining  

---

#### Example 2: Swapping a filter & recording attribution
> **Wife:** *"I just replaced the fridge water filter today"*  
> **Assistant:**  
> ✅ **Marked Replaced!**  
> Refrigerator Water & Ice Filter has been updated.  
> • **Installed Date:** Sep 19, 2026  
> • **Replaced By:** Wife  
> • **Next Due Date:** Mar 18, 2027 (180-day cycle)  
> • *Vacation snooze reset to 0.* Thank you! 🎉

---

#### Example 3: Snoozing during travel
> **Isaac:** *"We're on vacation, snooze HVAC 14 days"*  
> **Assistant:**  
> ⏸️ **Snooze Confirmed!**  
> Central HVAC Return Filter has been extended by **14 days**.  
> • **New Target Due Date:** Jan 14, 2027 (was Dec 31, 2026)  
> • **Days Remaining:** 117 days  
> • Enjoy your trip! 🌴

---

## 🏷️ Understanding Status Badges

FilterFlow uses three intuitive status tiers so you always know what requires attention:

| Status Badge | Time Window | Meaning | Recommended Action |
| :--- | :--- | :--- | :--- |
| 🟢 **HEALTHY** | $> 14$ days remaining | Filter is actively filtering at peak efficiency. | No action needed. Relax! |
| 🟡 **EXPIRING SOON** | $1 \text{ to } 14$ days remaining | The filter will expire in two weeks. | **Pre-Order Replacement.** Use the 1-Click Amazon link so the new filter arrives before expiration day. |
| 🔴 **OVERDUE** | $\le 0$ days remaining | Past recommended service life. Airflow or filtration efficiency is degraded. | **Replace Filter Today.** After installing, reply *"replaced <filter>"* to start the fresh cycle. |

---

## 📅 Household Maintenance Schedule & Part Specs

Here is the current catalog of household and vehicle filters managed by your system:

| Filter Name | Location | Standard Cycle | Part / Model Specs | 1-Click Reorder |
| :--- | :--- | :--- | :--- | :--- |
| **Central HVAC Return Filter** | Main Hallway Ceiling Return | 90 Days (Quarterly) | 20x25x1 MERV 11 Pleated | [Reorder Amazon](https://www.amazon.com/s?k=20x25x1+merv+11+air+filter) |
| **Car Cabin Air Filter (HVAC)** | Behind Glove Box Compartment | 180 Days (Semi-Annual) | HEPA + Activated Carbon | [Reorder Amazon](https://www.amazon.com/s?k=car+cabin+air+filter) |
| **Car Engine Intake Air Filter** | Under Hood / Engine Airbox | 365 Days (Annual) | Extra Guard CA10190 | [Reorder Amazon](https://www.amazon.com/s?k=engine+intake+air+filter) |
| **Refrigerator Water & Ice Filter** | Lower Grille / Interior Housing | 180 Days (Semi-Annual) | NSF 42/53 Certified Cartridge | [Reorder Amazon](https://www.amazon.com/s?k=refrigerator+water+filter) |
| **Bedroom Air Purifier / Fan** | Master Bedroom Stand | 90 Days (Quarterly) | True HEPA H13 Cylindrical | [Reorder Amazon](https://www.amazon.com/s?k=hepa+h13+air+purifier+replacement+filter) |

---

## 💻 Terminal & Command-Line Quick Reference

For quick admin tasks or diagnostics on your Mac:

```bash
# View complete household status table
node cli.js list

# Filter items belonging to a specific family member
node cli.js list --owner "Wife"

# Ask the assistant a natural-language question
node cli.js query "what is due" --by "Isaac"

# Generate complete formatted WhatsApp broadcast
node cli.js whatsapp

# Check pending pre-order (T-14) and overdue alerts
node cli.js notifications

# Record a manual replacement
node cli.js replace filter-hvac-main --by "Isaac" --notes "Replaced with Filtrete MERV 11"

# Snooze an item for 14 days
node cli.js snooze filter-hvac-main 14 --by "Isaac"

# Display onboarding QR code and Wi-Fi connection info
node cli.js share
```

---

## ❓ Frequently Asked Questions (FAQ)

**Q: Can Isaac's wife mark a filter replaced without logging into a terminal?**  
**A:** Yes! She can either:
1. Tap the **"Mark Replaced"** button on the web app from her iPhone home screen, or
2. Send a WhatsApp message saying *"I replaced the fridge filter today"*. The assistant automatically attributes the action to her.

**Q: What happens when I snooze a filter?**  
**A:** The target due date is extended by the requested number of days (e.g. 14 days), and alerts are silenced. When you eventually replace the filter, the snooze extension automatically resets to 0 so the next cycle stays on the standard schedule.

**Q: Does FilterFlow keep working if the internet goes down?**  
**A:** Yes! The core server runs locally on your home Mac/Wi-Fi network (`192.168.86.47`). The web dashboards and calculations operate locally even without external internet access (Amazon links require internet to open).

---

*Document created for FilterFlow household operations and approved for Workboard Card `3642b656`.*
