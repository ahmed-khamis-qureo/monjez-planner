# منجز (Monjez)

مخطط مذاكرة بيشتغل أوفلاين: مهام، مؤقت تركيز (بومودورو)، وإحصائيات. كل البيانات على جهازك.

## Structure
- `store.js` pure reducer + versioned persistence (`normalize` accepts any/corrupt input)
- `timer.js` pure pomodoro state machine, absolute end timestamps (survives reloads, background tabs)
- `ui.js` / `views.js` DOM builders, each view builds once then patches on state change
- `main.js` router (hash + View Transitions), theme, wake lock, audio, PWA/update flow
- `sw.js` versioned cache, stale-while-revalidate, offline shell
- `test.mjs` logic tests: `node test.mjs`

No build step, no dependencies.
