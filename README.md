# Ascend — Solo Leveling Quest Tracker

A self-improvement tracker themed after Solo Leveling's "System": set long-term
Main Quests, use Claude to generate a week of daily tasks for each one, check
them off day by day, and level up. Your data lives entirely in a Google Sheet
you own.

## 1. Set up the Google Sheet backend

1. Create a new blank Google Sheet (sheets.google.com → Blank).
2. Extensions → Apps Script. Delete the placeholder code in the editor.
3. Open **Code.gs** from this folder, copy all of it, paste it into the Apps
   Script editor. Save (Ctrl/Cmd+S).
4. Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" → choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, authorize the permissions it asks for (it's your own
     script acting on your own Sheet).
5. Copy the **Web app URL** it gives you (ends in `/exec`).

The Sheet tabs (Profile, Stats, Goals, WeeklyPlans, Tasks) are created
automatically the first time the app talks to this script — no manual sheet
setup needed.

## 2. Install the app on your phone

1. Upload **index.html, manifest.json, sw.js, icon-192.png, icon-512.png,
   apple-touch-icon.png** together (same folder) to any free HTTPS host —
   GitHub Pages, Netlify, or Vercel all work with drag-and-drop.
2. Open the hosted URL in Chrome on your phone.
3. Tap the **Settings** tab in the app, paste your `/exec` URL from step 1,
   tap **Save & Connect**.
4. In Chrome: menu → **Add to Home screen** / **Install app**. It now opens
   like a native app, full screen, its own icon.

## 3. Using it

- **Main Quests** tab → add a long-term goal (e.g. "Strong Arm" tagged STR,
  or "Master Azure DevOps" tagged INT) with optional target details.
- Tap **Copy Claude Prompt** on a goal — this builds a ready-made prompt with
  your goal, category, and current stat level. Paste it into a Claude chat.
- Claude replies with a week of daily tasks as JSON. Copy that reply.
- Back in the app, tap **Import Week (JSON)** on the same goal, paste it in.
- **Today** tab shows whatever's scheduled for today across all goals — tap
  to mark done (awards EXP to that goal's stat and your overall level), or
  "skip" if you're not doing it.
- Once a week's dates have passed, tap **Complete Week** on the goal card to
  close it out and claim a completion bonus based on how much you finished.
- **Status** tab shows your level, rank, stat bars, and history of completed
  weeks.

## Stat categories

| Stat | Covers |
|------|--------|
| STR  | Strength / Fitness |
| INT  | Intellect / Study & Learning |
| VIT  | Vitality / Health & Habits |
| AGI  | Agility / Skill Practice |
| PER  | Perception / Creativity & Focus |

## Notes

- This is a **personal-use** setup: the Apps Script deployment ("Anyone" can
  call it) has no login — anyone with the exact `/exec` URL could read/write
  your sheet. Don't publish that URL publicly; treat it like a password.
- Leveling curve: `level = floor(sqrt(totalExp / 40)) + 1`. Ranks: E (1-4),
  D (5-9), C (10-14), B (15-19), A (20-29), S (30+). Tweak the numbers in
  `Code.gs` (`levelFromExp` / `rankFromLevel`) if you want a different pace.
