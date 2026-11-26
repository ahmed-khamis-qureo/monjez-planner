// Pure pomodoro state machine. Time is passed in, never read, so it is testable
// and the timer survives reloads (it stores an absolute end timestamp).
export const phaseMs = (phase, s) => ({ focus: s.focus, short: s.short, long: s.long })[phase] * 60000;

export const freshTimer = (settings, extra = {}) => ({
  phase: 'focus', status: 'idle', endsAt: null,
  remainingMs: phaseMs('focus', settings), totalMs: phaseMs('focus', settings),
  cycle: 0, subject: 'math', taskId: null, ...extra,
});

export const remaining = (t, now) => (t.status === 'running' ? Math.max(0, t.endsAt - now) : t.remainingMs);
export const progress = (t, now) => (t.totalMs ? 1 - remaining(t, now) / t.totalMs : 0);

export const nextPhase = (phase, cycleAfter) =>
  phase === 'focus' ? (cycleAfter % 4 === 0 ? 'long' : 'short') : 'focus';

function toPhase(t, phase, settings, cycle = t.cycle) {
  const ms = phaseMs(phase, settings);
  return { ...t, phase, cycle, status: 'idle', endsAt: null, remainingMs: ms, totalMs: ms };
}

/** @returns {{timer: object, completed: null | {minutes:number}}} */
export function timerReduce(t, ev, settings) {
  switch (ev.type) {
    case 'start':
      if (t.status === 'running') return { timer: t, completed: null };
      return { timer: { ...t, status: 'running', endsAt: ev.now + t.remainingMs }, completed: null };
    case 'pause':
      if (t.status !== 'running') return { timer: t, completed: null };
      return { timer: { ...t, status: 'paused', endsAt: null, remainingMs: Math.max(0, t.endsAt - ev.now) }, completed: null };
    case 'reset':
      return { timer: toPhase(t, t.phase, settings), completed: null };
    case 'phase':
      return { timer: toPhase(t, ev.phase, settings), completed: null };
    case 'skip':
      return { timer: toPhase(t, nextPhase(t.phase, t.cycle + (t.phase === 'focus' ? 1 : 0)), settings, t.cycle), completed: null };
    case 'complete': {
      if (t.status !== 'running') return { timer: t, completed: null };
      const cycle = t.cycle + (t.phase === 'focus' ? 1 : 0);
      const completed = t.phase === 'focus' ? { minutes: Math.max(1, Math.round(t.totalMs / 60000)) } : null;
      return { timer: toPhase(t, nextPhase(t.phase, cycle), settings, cycle), completed };
    }
    case 'target':
      return { timer: { ...t, subject: ev.subject ?? t.subject, taskId: ev.taskId === undefined ? t.taskId : ev.taskId }, completed: null };
    case 'sync': // settings changed while idle
      return t.status === 'idle' ? { timer: toPhase(t, t.phase, settings), completed: null } : { timer: t, completed: null };
    default:
      return { timer: t, completed: null };
  }
}
