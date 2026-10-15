const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = (file, dependencies = {}) => {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name in dependencies) return dependencies[name];
    throw new Error(name);
  } });
  return exports;
};
const { trimRoute, routeMeters, routeTimeline, parseRunTime } = load('src/utils/trimRun.ts');
const points = [
  { latitude: 25, longitude: -80, timestamp: 1000000, elapsedSeconds: 0 },
  { latitude: 25.01, longitude: -80, timestamp: 1600000, elapsedSeconds: 600 },
  { latitude: 25.02, longitude: -80, timestamp: 2200000, elapsedSeconds: 1200 },
  { latitude: 25.12, longitude: -80, timestamp: 2800000, elapsedSeconds: 1800 },
];

test('trimming the drive home removes its GPS distance, time, and finish point', () => {
  const trimmed = trimRoute(points, 1800, 0, 1200);
  assert.equal(trimmed.duration, 1200);
  assert.ok(Math.abs(trimmed.meters - routeMeters(points.slice(0, 3))) < 0.01);
  assert.ok(trimmed.meters < routeMeters(points) / 2);
  assert.ok(Math.abs(trimmed.points.at(-1).latitude - 25.02) < 1e-10);
  assert.equal(points.length, 4);
});

test('both ends interpolate between GPS samples and a second trim uses relative active time', () => {
  const first = trimRoute(points, 1800, 300, 900);
  assert.equal(first.duration, 600);
  assert.ok(Math.abs(first.points[0].latitude - 25.005) < 1e-10);
  assert.ok(Math.abs(first.points.at(-1).latitude - 25.015) < 1e-10);
  assert.equal(first.points[0].elapsedSeconds, 0);
  assert.equal(first.points.at(-1).elapsedSeconds, 600);
  const next = trimRoute(first.points, 600, 0, 300);
  assert.ok(Math.abs(next.points.at(-1).latitude - 25.01) < 1e-10);
});

test('active time excludes pauses instead of stretching the route over wall time', () => {
  const paused = points.map((p, i) => ({ ...p, timestamp: p.timestamp + (i > 1 ? 600000 : 0) }));
  assert.deepEqual(Array.from(routeTimeline(paused, 1800)), [0, 600, 1200, 1800]);
});

test('older imported routes use timestamps, or distance when timestamps are missing', () => {
  const old = points.map(({ elapsedSeconds, ...p }) => p);
  assert.equal(trimRoute(old, 1800, 0, 1200).duration, 1200);
  assert.ok(Number.isFinite(trimRoute(points.map(({ latitude, longitude }) => ({ latitude, longitude })), 1800, 0, 900).meters));
});

test('invalid and too-short trims are rejected and time input validates seconds', () => {
  for (const [start, end] of [[-1, 1200], [0, 1801], [400, 402], [900, 600], [NaN, 100]]) {
    assert.throws(() => trimRoute(points, 1800, start, end));
  }
  assert.equal(parseRunTime('1:20:30'), 4830);
  assert.equal(parseRunTime('27:28'), 1648);
  assert.ok(Number.isNaN(parseRunTime('12:99')));
});

test('corrections keep the original once, recompute pace, and undo without changing the name', async () => {
  const original = { id: 'run', distance: 10, duration: 1800, pace: 3, routeName: 'My run', runType: 'easy', routeCoordinates: JSON.stringify(points) };
  let saved = { ...original };
  const service = load('src/services/runService.ts', {
    uuid: { v4: () => 'unused' },
    '../database/database': {
      getFirst: async () => ({ ...saved }),
      runQuery: async (sql, params) => {
        if (sql.includes('COALESCE')) saved = { ...saved, distance: params[0], duration: params[1], pace: params[2], routeCoordinates: params[3], originalRunData: saved.originalRunData || params[4] };
        else if (sql.includes('originalRunData = NULL')) saved = { ...saved, distance: params[0], duration: params[1], pace: params[2], routeCoordinates: params[3], originalRunData: null };
        else throw new Error(sql);
      },
    },
  });
  await service.correctRun('run', 3, 1200, points.slice(0, 3));
  const backup = saved.originalRunData;
  assert.equal(saved.pace, 1200 / 60 / 3);
  await service.correctRun('run', 2, 900);
  assert.equal(saved.originalRunData, backup);
  await assert.rejects(service.correctRun('run', -1, 900));
  await service.undoRunCorrections('run');
  assert.equal(saved.distance, original.distance);
  assert.equal(saved.routeCoordinates, original.routeCoordinates);
  assert.equal(saved.routeName, 'My run');
  assert.equal(saved.originalRunData, null);
});
