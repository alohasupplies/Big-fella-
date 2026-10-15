const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ savedRoute, linked = true, read, corrected = false } = {}) {
  const writes = [];
  let reads = 0;
  const route = [{ latitude: 25, longitude: -80, timestamp: 1700000000000 },
    { latitude: 25.01, longitude: -80.01, timestamp: 1700000060000 }];
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/healthService.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, console, require(name) {
    if (name === 'react-native') return { Platform: { OS: 'ios' }, NativeModules: {
      RunVideoExporter: { readHealthRoute: async () => { reads++; return read ? read(reads) : route; } },
    } };
    if (name === 'uuid') return { v4: () => 'generated-id' };
    if (name === '@kingstinct/react-native-healthkit') return { default: { requestAuthorization: async () => {} } };
    if (name === '../database/database') return {
      getFirst: async sql => sql.includes('synced_health_runs') ? (linked ? { healthKitId: 'health-id' } : null)
        : { id: 'run-id', routeCoordinates: savedRoute, routeName: 'My edited name', runType: 'race', originalRunData: corrected ? '{}' : undefined },
      runQuery: async (sql, params) => writes.push({ sql, params }),
    };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { service: exports, writes, route, reads: () => reads };
}

test('backfills GPS for an existing imported run without rewriting details', async () => {
  const f = fixture();
  assert.deepEqual(JSON.parse(await f.service.importHealthRoute('run-id')), f.route);
  assert.equal(f.writes.length, 1);
  assert.match(f.writes[0].sql, /SET routeCoordinates = \?, updatedAt = \? WHERE id = \?/);
  assert.equal(f.writes[0].params[2], 'run-id');
});

test('retains an existing route without querying Health', async () => {
  const savedRoute = JSON.stringify([{ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 }]);
  const f = fixture({ savedRoute });
  assert.equal(await f.service.importHealthRoute('run-id'), savedRoute);
  assert.equal(f.reads(), 0);
  assert.equal(f.writes.length, 0);
});

test('Health route sync never overwrites a corrected recording', async () => {
  const f = fixture({ corrected: true });
  assert.equal(await f.service.importHealthRoute('run-id'), undefined);
  assert.equal(f.reads(), 0);
  assert.equal(f.writes.length, 0);
});

test('manual runs are never assigned an unrelated Health route', async () => {
  const f = fixture({ linked: false });
  assert.equal(await f.service.importHealthRoute('run-id'), undefined);
  assert.equal(f.reads(), 0);
});

test('concurrent screen and sync requests share one read', async () => {
  const f = fixture();
  await Promise.all([f.service.importHealthRoute('run-id'), f.service.importHealthRoute('run-id')]);
  assert.equal(f.reads(), 1);
  assert.equal(f.writes.length, 1);
});

test('late Watch routes retry after an empty response', async () => {
  const f = fixture({ read: attempt => attempt === 1 ? [] : [{ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 }] });
  assert.equal(await f.service.importHealthRoute('run-id'), undefined);
  assert.equal(f.writes.length, 0);
  assert.ok(await f.service.importHealthRoute('run-id'));
});

test('a rejected Health query is retriable and does not save partial data', async () => {
  const f = fixture({ read: attempt => { if (attempt === 1) throw new Error('Device locked'); return []; } });
  await assert.rejects(f.service.importHealthRoute('run-id'), /Device locked/);
  assert.equal(await f.service.importHealthRoute('run-id'), undefined);
  assert.equal(f.reads(), 2);
  assert.equal(f.writes.length, 0);
});
