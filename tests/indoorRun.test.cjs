const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('indoor timer survives reload, excludes pauses, and never starts GPS', async () => {
  let stored = null, now = 1000000, gpsStarts = 0;
  const starts = [], restores = [], updates = [], ends = [];
  const load = () => {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/runTrackingService.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, { exports, Date: { now: () => now }, require(name) {
      if (name === 'react-native') return { Platform: { OS: 'ios' }, NativeModules: { RunLiveActivity: {
        startSession: (...args) => starts.push(args), restoreSession: (...args) => restores.push(args),
        update: (...args) => updates.push(args), end: () => ends.push(true),
      } } };
      if (name === 'expo-file-system') return { documentDirectory: '/documents/', getInfoAsync: async () => ({ exists: !!stored }), readAsStringAsync: async () => stored, writeAsStringAsync: async (_, text) => { stored = text; }, deleteAsync: async () => { stored = null; } };
      if (name === 'expo-task-manager') return { isTaskDefined: () => true };
      if (name === 'expo-location') return { hasStartedLocationUpdatesAsync: async () => false, startLocationUpdatesAsync: async () => { gpsStarts++; } };
      throw new Error(name);
    } });
    return exports;
  };
  const service = load();
  const original = await service.beginActiveRun('miles', 'indoor');
  assert.deepEqual(starts[0], [1000000, 'miles', 'indoor']);
  now += 90000;
  const restarted = load();
  assert.equal(restarted.elapsedForSession(await restarted.reconcileRunTracking()), 90);
  assert.equal(restores[0][2], 90);
  assert.equal(restores[0][5], 'indoor');
  await restarted.pauseActiveRun();
  assert.equal(updates.at(-1)[0], 90);
  assert.equal(updates.at(-1)[2], true);
  now += 60000;
  assert.equal(restarted.elapsedForSession(await restarted.readActiveRun()), 90);
  await restarted.resumeActiveRun();
  assert.equal(updates.at(-1)[0], 90);
  assert.equal(updates.at(-1)[2], false);
  now += 30000;
  await restarted.resumeActiveRun(); // Double tap must not reset the timer.
  assert.equal(restarted.elapsedForSession(await restarted.readActiveRun()), 120);
  const protectedSession = await restarted.beginActiveRun('km', 'outdoor');
  assert.equal(protectedSession.id, original.id);
  assert.equal(protectedSession.mode, 'indoor');
  assert.equal(gpsStarts, 0);
  assert.equal(starts.length, 1);
  await restarted.clearActiveRun();
  assert.equal(await restarted.readActiveRun(), null);
  assert.equal(ends.length, 1);
});

test('outdoor sessions start and restore a GPS Live Activity, then end on completion', async () => {
  let stored = null, now = 1000000, gpsStarts = 0;
  const calls = [];
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/runTrackingService.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, Date: { now: () => now }, require(name) {
    if (name === 'react-native') return { Platform: { OS: 'ios' }, NativeModules: { RunLiveActivity: {
      startSession: (...args) => calls.push(['start', ...args]),
      restoreSession: (...args) => calls.push(['restore', ...args]),
      update: (...args) => calls.push(['update', ...args]), end: () => calls.push(['end']),
    } } };
    if (name === 'expo-file-system') return { documentDirectory: '/documents/', getInfoAsync: async () => ({ exists: !!stored }), readAsStringAsync: async () => stored, writeAsStringAsync: async (_, text) => { stored = text; }, deleteAsync: async () => { stored = null; } };
    if (name === 'expo-task-manager') return { isTaskDefined: () => true };
    if (name === 'expo-location') return { Accuracy: { BestForNavigation: 6 }, ActivityType: { Fitness: 3 }, hasStartedLocationUpdatesAsync: async () => false, startLocationUpdatesAsync: async () => { gpsStarts++; } };
    throw new Error(name);
  } });
  await exports.beginActiveRun('km', 'outdoor');
  assert.equal(gpsStarts, 1);
  assert.deepEqual(calls[0], ['start', 1000000, 'km', 'outdoor']);
  const active = JSON.parse(stored);
  active.points = [{ latitude: 25, longitude: -80 }, { latitude: 25.01, longitude: -80 }];
  stored = JSON.stringify(active);
  now += 120000;
  await exports.reconcileRunTracking();
  const restored = calls.at(-1);
  assert.equal(restored[0], 'restore');
  assert.equal(restored[3], 120);
  assert.equal(restored[4].length, 2);
  assert.equal(restored[6], 'outdoor');
  await exports.pauseActiveRun();
  assert.equal(calls.at(-1)[3], true);
  await exports.clearActiveRun();
  assert.deepEqual(calls.at(-1), ['end']);
});
