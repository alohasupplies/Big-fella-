const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/workoutDraftService.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const load = (database) => {
  const exports = {};
  vm.runInNewContext(code, { exports, require: () => database });
  return exports;
};
const draft = () => ({
  weightUnit: 'lbs', notes: 'Lat pulldown felt strong',
  exercises: Array.from({ length: 5 }, (_, i) => ({
    id: `exercise-${i}`, exerciseLibraryId: `library-${i}`, exerciseName: `Exercise ${i}`,
    muscleGroups: ['back'], sets: [
      { id: `set-${i}-1`, weight: '47.5', reps: '6', rpe: '8', isWarmup: false, completed: true },
      { id: `set-${i}-2`, weight: '42.', reps: '', rpe: '', isWarmup: true, completed: false },
    ],
  })),
});
const storage = () => {
  let data = null;
  return {
    runQuery: async (sql, params) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      data = sql.startsWith('DELETE') ? null : params[1];
    },
    getFirst: async () => data === null ? null : { data },
  };
};

test('five exercises, unfinished inputs, completed sets and notes survive a process restart', async () => {
  const database = storage();
  const service = load(database);
  await service.saveWorkoutDraft(draft());
  const restarted = load(database);
  assert.deepEqual(JSON.parse(JSON.stringify(await restarted.readWorkoutDraft())), draft());
});

test('reopening immediately after rapid edits waits for the latest snapshot', async () => {
  const service = load(storage());
  const original = draft();
  const firstWrite = service.saveWorkoutDraft(original);
  original.notes = 'Latest note';
  original.exercises[4].sets[1].reps = '8';
  const lastWrite = service.saveWorkoutDraft(original);
  const restored = await service.readWorkoutDraft();
  await Promise.all([firstWrite, lastWrite]);
  assert.equal(restored.notes, 'Latest note');
  assert.equal(restored.exercises[4].sets[1].reps, '8');
});

test('discard or successful completion clears the draft after any pending autosaves', async () => {
  const service = load(storage());
  const write = service.saveWorkoutDraft(draft());
  const clear = service.clearWorkoutDraft();
  assert.equal(await service.readWorkoutDraft(), null);
  await Promise.all([write, clear]);
});

test('a failed autosave does not poison the queue and a retry keeps the latest data', async () => {
  const database = storage();
  const write = database.runQuery;
  let fail = true;
  database.runQuery = async (...args) => {
    if (fail) { fail = false; throw new Error('disk unavailable'); }
    return write(...args);
  };
  const service = load(database);
  await assert.rejects(service.saveWorkoutDraft(draft()), /disk unavailable/);
  await service.saveWorkoutDraft(draft());
  assert.equal((await service.readWorkoutDraft()).exercises.length, 5);
});
