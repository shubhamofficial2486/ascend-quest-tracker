// ============================================================
// SOLO LEVELING QUEST TRACKER — Apps Script backend
// ============================================================
// SETUP:
// 1. Create a new blank Google Sheet.
// 2. Extensions > Apps Script. Delete any starter code, paste this file in.
// 3. Deploy > New deployment > type "Web app".
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Copy the resulting /exec URL into the app's Settings screen.
// The sheet tabs (Profile, Stats, Goals, WeeklyPlans, Tasks) are created
// automatically the first time the app calls this backend — no manual
// sheet setup needed beyond the blank spreadsheet itself.
// ============================================================

const SHEET_NAMES = {
  PROFILE: 'Profile',
  STATS: 'Stats',
  GOALS: 'Goals',
  PLANS: 'WeeklyPlans',
  TASKS: 'Tasks'
};

const STAT_KEYS = ['STR', 'INT', 'VIT', 'AGI', 'PER'];

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let profile = ss.getSheetByName(SHEET_NAMES.PROFILE);
  if (!profile) {
    profile = ss.insertSheet(SHEET_NAMES.PROFILE);
    profile.appendRow(['level', 'totalExp', 'rank', 'updatedAt']);
    profile.getRange('D:D').setNumberFormat('@');
    profile.appendRow([1, 0, 'E', new Date().toISOString()]);
  }

  let stats = ss.getSheetByName(SHEET_NAMES.STATS);
  if (!stats) {
    stats = ss.insertSheet(SHEET_NAMES.STATS);
    stats.appendRow(['stat', 'exp', 'level']);
    STAT_KEYS.forEach(k => stats.appendRow([k, 0, 1]));
  }

  let goals = ss.getSheetByName(SHEET_NAMES.GOALS);
  if (!goals) {
    goals = ss.insertSheet(SHEET_NAMES.GOALS);
    goals.appendRow(['id', 'title', 'category', 'targetDetail', 'status', 'createdAt']);
    goals.getRange('F:F').setNumberFormat('@');
  }

  let plans = ss.getSheetByName(SHEET_NAMES.PLANS);
  if (!plans) {
    plans = ss.insertSheet(SHEET_NAMES.PLANS);
    plans.appendRow(['id', 'goalId', 'weekStart', 'weekEnd', 'status', 'createdAt']);
    plans.getRange('C:D').setNumberFormat('@');
    plans.getRange('F:F').setNumberFormat('@');
  }

  let tasks = ss.getSheetByName(SHEET_NAMES.TASKS);
  if (!tasks) {
    tasks = ss.insertSheet(SHEET_NAMES.TASKS);
    tasks.appendRow(['id', 'weeklyPlanId', 'goalId', 'day', 'date', 'title', 'detail', 'expValue', 'status', 'completedAt']);
    tasks.getRange('D:E').setNumberFormat('@');
    tasks.getRange('J:J').setNumberFormat('@');
  }

  const def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(def);
  }

  return { profile, stats, goals, plans, tasks };
}

function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(c => c === '')) continue;
    const obj = {};
    headers.forEach((h, idx) => obj[h] = row[idx]);
    rows.push(obj);
  }
  return rows;
}

// Fields that must never be auto-converted to a Sheets Date type. Prefixing
// with an apostrophe forces literal text on write (a standard Sheets/Apps
// Script trick) — this works regardless of the column's display format or
// whether the tab existed before this fix, unlike setNumberFormat alone.
const TEXT_FORCE_FIELDS = new Set(['day', 'date', 'weekStart', 'weekEnd', 'createdAt', 'completedAt', 'updatedAt']);

function coerceForSheet(field, value) {
  if (TEXT_FORCE_FIELDS.has(field) && value !== '' && value !== undefined && value !== null) {
    return "'" + value;
  }
  return value;
}

function appendObject(sheet, obj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => coerceForSheet(h, obj[h] !== undefined ? obj[h] : ''));
  sheet.appendRow(row);
}

function updateRowByField(sheet, idField, idValue, updates) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf(idField);
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === idValue) {
      Object.keys(updates).forEach(k => {
        const col = headers.indexOf(k);
        if (col > -1) sheet.getRange(i + 1, col + 1).setValue(coerceForSheet(k, updates[k]));
      });
      return true;
    }
  }
  return false;
}

// Level curve: level = floor(sqrt(exp/40)) + 1  →  exp needed for level L = 40*(L-1)^2
function levelFromExp(exp) {
  return Math.max(1, Math.floor(Math.sqrt(exp / 40)) + 1);
}

function rankFromLevel(level) {
  if (level >= 30) return 'S';
  if (level >= 20) return 'A';
  if (level >= 15) return 'B';
  if (level >= 10) return 'C';
  if (level >= 5) return 'D';
  return 'E';
}

function recomputeProfile(sheets) {
  const statsRows = sheetToObjects(sheets.stats);
  let totalExp = 0;
  statsRows.forEach(r => {
    const exp = Number(r.exp) || 0;
    totalExp += exp;
    updateRowByField(sheets.stats, 'stat', r.stat, { level: levelFromExp(exp) });
  });
  const level = levelFromExp(totalExp);
  const rank = rankFromLevel(level);
  sheets.profile.getRange(2, 1, 1, 4).setValues([[level, totalExp, rank, new Date().toISOString()]]);
  return { level, totalExp, rank };
}

function getFullState() {
  const sheets = ensureSheets();
  const profileRows = sheetToObjects(sheets.profile);
  return {
    profile: profileRows[0] || { level: 1, totalExp: 0, rank: 'E' },
    stats: sheetToObjects(sheets.stats),
    goals: sheetToObjects(sheets.goals),
    plans: sheetToObjects(sheets.plans),
    tasks: sheetToObjects(sheets.tasks)
  };
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const CODE_VERSION = 'fix-2-text-dates';

// doGet exists mainly so you can sanity-check the deployment by pasting
// ?action=ping or ?action=getState straight into a browser address bar.
// The app itself calls everything via doPost (see below) — GET requests to
// Apps Script Web Apps go through an internal redirect that browsers often
// block under CORS when called from fetch(), even though the same URL
// works fine when you navigate to it directly. POST avoids that.
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'getState';
  ensureSheets();
  try {
    if (action === 'ping') return jsonOut({ ok: true, time: new Date().toISOString(), version: CODE_VERSION });
    if (action === 'getState') return jsonOut({ ok: true, data: getFullState() });
    return jsonOut({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const sheets = ensureSheets();
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'invalid JSON body' });
  }
  const action = body.action;

  try {
    if (action === 'ping') {
      return jsonOut({ ok: true, time: new Date().toISOString(), version: CODE_VERSION });

    } else if (action === 'getState') {
      return jsonOut({ ok: true, data: getFullState() });

    } else if (action === 'addGoal') {
      const id = Utilities.getUuid();
      appendObject(sheets.goals, {
        id, title: body.title, category: body.category,
        targetDetail: body.targetDetail || '', status: 'active',
        createdAt: new Date().toISOString()
      });
      return jsonOut({ ok: true, id, data: getFullState() });

    } else if (action === 'importWeek') {
      // If this goal already has an active plan, archive it first — otherwise
      // re-importing (or importing a fresh week) leaves the old plan's tasks
      // sitting alongside the new ones, duplicating everything on Today's Quest.
      const existingActive = sheetToObjects(sheets.plans).filter(p => p.goalId === body.goalId && p.status === 'active');
      existingActive.forEach(p => updateRowByField(sheets.plans, 'id', p.id, { status: 'superseded' }));

      const planId = Utilities.getUuid();
      appendObject(sheets.plans, {
        id: planId, goalId: body.goalId, weekStart: body.weekStart,
        weekEnd: body.weekEnd, status: 'active', createdAt: new Date().toISOString()
      });
      (body.days || []).forEach(day => {
        (day.tasks || []).forEach(t => {
          appendObject(sheets.tasks, {
            id: Utilities.getUuid(), weeklyPlanId: planId, goalId: body.goalId,
            day: day.day || '', date: day.date || '', title: t.title,
            detail: t.detail || '', expValue: t.exp || 10,
            status: 'pending', completedAt: ''
          });
        });
      });
      return jsonOut({ ok: true, planId, data: getFullState() });

    } else if (action === 'updateTaskStatus') {
      const tasksRows = sheetToObjects(sheets.tasks);
      const task = tasksRows.find(t => t.id === body.taskId);
      if (!task) return jsonOut({ ok: false, error: 'task not found' });

      const wasDone = task.status === 'done';
      const nowDone = body.status === 'done';

      updateRowByField(sheets.tasks, 'id', body.taskId, {
        status: body.status,
        completedAt: nowDone ? new Date().toISOString() : ''
      });

      if (nowDone !== wasDone) {
        const goalsRows = sheetToObjects(sheets.goals);
        const goal = goalsRows.find(g => g.id === task.goalId);
        const category = goal ? goal.category : 'STR';
        const statsRows = sheetToObjects(sheets.stats);
        const statRow = statsRows.find(s => s.stat === category);
        const delta = Number(task.expValue || 10) * (nowDone ? 1 : -1);
        const newExp = Math.max(0, (statRow ? Number(statRow.exp) : 0) + delta);
        updateRowByField(sheets.stats, 'stat', category, { exp: newExp });
      }

      const profile = recomputeProfile(sheets);
      return jsonOut({ ok: true, profile, data: getFullState() });

    } else if (action === 'completeWeek') {
      const tasksRows = sheetToObjects(sheets.tasks).filter(t => t.weeklyPlanId === body.weeklyPlanId);
      const total = tasksRows.length;
      const done = tasksRows.filter(t => t.status === 'done').length;
      const ratio = total > 0 ? done / total : 0;
      const bonus = Math.round(ratio * 100);

      updateRowByField(sheets.plans, 'id', body.weeklyPlanId, { status: 'completed' });

      const goalsRows = sheetToObjects(sheets.goals);
      const plansRows = sheetToObjects(sheets.plans);
      const plan = plansRows.find(p => p.id === body.weeklyPlanId);
      const goal = goalsRows.find(g => g.id === (plan ? plan.goalId : null));
      const category = goal ? goal.category : 'STR';
      const statsRows = sheetToObjects(sheets.stats);
      const statRow = statsRows.find(s => s.stat === category);
      const newExp = (statRow ? Number(statRow.exp) : 0) + bonus;
      updateRowByField(sheets.stats, 'stat', category, { exp: newExp });

      const profile = recomputeProfile(sheets);
      return jsonOut({ ok: true, completion: ratio, bonus, profile, data: getFullState() });

    } else if (action === 'deleteGoal') {
      updateRowByField(sheets.goals, 'id', body.goalId, { status: 'archived' });
      return jsonOut({ ok: true, data: getFullState() });

    } else {
      return jsonOut({ ok: false, error: 'unknown action: ' + action });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}
