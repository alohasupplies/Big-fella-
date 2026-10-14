const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('indoor timer survives reload, excludes pauses, and never starts GPS', async () => {
  let stored = null, now = 1000000, gpsStarts = 0, activityStarts = 0;
  const load = () => {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/runTrackingService.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, { exports, Date: { now: () => now }, require(name) {
      if (name === 'react-native') return { Platform: { OS: 'ios' }, NativeModules: { RunLiveActivity: { start: () => activityStarts++ } } };
      if (name === 'expo-file-system') return { documentDirectory: '/documents/', getInfoAsync: async () => ({ exists: !!stored }), readAsStringAsync: async () => stored, writeAsStringAsync: async (_, text) => { stored = text; }, deleteAsync: async () => { stored = null; } };
      if (name === 'expo-task-manager') return { isTaskDefined: () => true };
      if (name === 'expo-location') return { hasStartedLocationUpdatesAsync: async () => false, startLocationUpdatesAsync: async () => { gpsStarts++; } };
      throw new Error(name);
    } });
    return exports;
  };
  const service = load();
  const original = await service.beginActiveRun('miles', 'indoor');
  now += 90000;
  const restarted = load();
  assert.equal(restarted.elapsedForSession(await restarted.reconcileRunTracking()), 90);
  await restarted.pauseActiveRun();
  now += 60000;
  assert.equal(restarted.elapsedForSession(await restarted.readActiveRun()), 90);
  await restarted.resumeActiveRun();
  now += 30000;
  await restarted.resumeActiveRun(); // Double tap must not reset the timer.
  assert.equal(restarted.elapsedForSession(await restarted.readActiveRun()), 120);
  const protectedSession = await restarted.beginActiveRun('km', 'outdoor');
  assert.equal(protectedSession.id, original.id);
  assert.equal(protectedSession.mode, 'indoor');
  assert.equal(gpsStarts, 0);
  assert.equal(activityStarts, 0);
  await restarted.clearActiveRun();
  assert.equal(await restarted.readActiveRun(), null);
});
