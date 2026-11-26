// Run: node test.mjs  (logic only, no DOM)
import assert from 'node:assert/strict';
import { reducer, initialState, normalize, streak, visibleTasks, minutesByDay } from './store.js';
import { timerReduce, freshTimer, remaining } from './timer.js';
import { addDays } from './utils.js';

const S = initialState(); const T0 = new Date(2026, 10, 26, 12).getTime(); const today = '2026-11-26';
let s = reducer(S, { type: 'task/add', id: 'a', title: ' مراجعة ', subject: 'math', priority: 3, due: today, now: T0 });
assert.equal(s.tasks[0].title, 'مراجعة');
s = reducer(s, { type: 'task/toggle', id: 'a', now: T0 }); assert.ok(s.tasks[0].done);
s = reducer(s, { type: 'task/toggle', id: 'a', now: T0 }); assert.equal(s.tasks[0].doneAt, null);
assert.equal(visibleTasks(s, 'today', '', today).length, 1);
assert.equal(visibleTasks(s, 'done', '', today).length, 0);
// timer
s = reducer(s, { type: 'timer', sessionId: 'x', event: { type: 'start', now: T0 } });
assert.equal(remaining(s.timer, T0 + 60000), 24 * 60000);
s = reducer(s, { type: 'timer', sessionId: 'x', event: { type: 'pause', now: T0 + 60000 } });
assert.equal(s.timer.remainingMs, 24 * 60000);
s = reducer(s, { type: 'timer', sessionId: 'x', event: { type: 'start', now: T0 + 120000 } });
s = reducer(s, { type: 'timer', sessionId: 's1', event: { type: 'complete', now: T0 + 120000 + 24 * 60000 } });
assert.equal(s.sessions.length, 1); assert.equal(s.sessions[0].minutes, 25);
assert.equal(s.timer.phase, 'short'); assert.equal(s.timer.cycle, 1);
let t = freshTimer(s.settings, { cycle: 3 });
t = timerReduce(timerReduce(t, { type: 'start', now: 0 }, s.settings).timer, { type: 'complete', now: 1 }, s.settings).timer;
assert.equal(t.phase, 'long');
assert.equal(timerReduce(freshTimer(s.settings), { type: 'complete', now: 1 }, s.settings).completed, null); // not running
// settings clamp + normalize garbage
s = reducer(s, { type: 'settings', patch: { focus: 9999, theme: 'x' } });
assert.equal(s.settings.focus, 120); assert.equal(s.settings.theme, 'auto');
assert.deepEqual(normalize('junk').tasks, []); assert.equal(normalize({ tasks: [{ id: 1, title: 'x', due: 'bad' }] }).tasks[0].due, null);
// streak and stats
let st = { ...initialState(), sessions: [0, 1, 2].map((i) => ({ id: i, ts: new Date(2026, 10, 26 - i, 10).getTime(), minutes: 10, subject: 'math' })) };
assert.equal(streak(st, today), 3); assert.equal(streak(st, addDays(today, 2)), 0);
assert.deepEqual(minutesByDay(st, ['2026-11-25', '2026-11-26']), [10, 10]);
console.log('all tests passed');
