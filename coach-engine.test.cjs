'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommend, live, evaluate } = require('./coach-engine.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 7, 18);

function working(weight = 10, reps = 17, rir = 5, extra = {}) {
  return { id: 'set', type: 'working', weight, reps, rir,
    restBeforeSec: 120, completedAt: NOW - DAY, ...extra };
}
function workout(index, { weight = 10, reps = [17, 16, 15], rir = [5, 5, 4], ...extra } = {}) {
  const timestamp = NOW - (28 - index * 7) * DAY;
  return {
    id: 'workout-' + index, timestamp,
    date: new Date(timestamp).toISOString().slice(0, 10),
    week: index + 1, mesocycleId: 'meso-current', gymId: 'gym-home',
    exercises: [{
      slotId: 'pull1-lateral', exerciseId: 'cable-lateral',
      setupNotes: 'Seat 3; pulley low', plannedSets: 3,
      sets: reps.map((rep, i) => working(weight, rep, Array.isArray(rir) ? rir[i] : rir,
        { id: 'set-' + index + '-' + i, completedAt: timestamp + (i + 1) * 180000,
          restBeforeSec: i ? 120 : null }))
    }], ...extra
  };
}
function input(extra = {}) {
  return {
    slotId: 'pull1-lateral', exerciseId: 'cable-lateral', gymId: 'gym-home',
    currentMesoId: 'meso-current', week: 4, targetRir: 2, range: [10, 20],
    plannedSets: 3, increment: 2.5, type: 'isolation', restSec: 120,
    setupNotes: 'Seat 3; pulley low', loadMode: 'external',
    equipmentConfirmed: true, legacyEquipmentConfirmed: true, weightBasis: 'stack',
    history: [workout(0), workout(1), workout(2)],
    recovery: { level: 'green' }, now: NOW, ...extra
  };
}
function clone(value) { return structuredClone(value); }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function assertFiniteTree(value, path = 'result') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), path + ' must be finite');
  else if (Array.isArray(value)) value.forEach((v, i) => assertFiniteTree(v, path + '[' + i + ']'));
  else if (value && typeof value === 'object')
    for (const [key, v] of Object.entries(value)) assertFiniteTree(v, path + '.' + key);
}
function assertRecommendation(result) {
  assert.ok(result && typeof result === 'object');
  assert.equal(typeof result.action, 'string');
  assert.ok(result.load === null || (Number.isFinite(result.load) && result.load >= 0));
  assert.ok(Array.isArray(result.targetReps));
  result.targetReps.forEach(rep => assert.ok(Number.isFinite(rep) && rep > 0));
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
  assert.ok(Array.isArray(result.flags));
  assert.ok(Array.isArray(result.alternatives));
  assert.ok(['low', 'medium', 'high'].includes(result.confidence.label));
  assert.ok(Number.isInteger(result.confidence.count) && result.confidence.count >= 0);
  assertFiniteTree(result);
}
function assertNoIncrease(result, ceiling = 10) {
  assert.notEqual(result.action, 'increase');
  assert.ok(result.load === null || result.load <= ceiling, 'unexpected increase to ' + result.load);
}
function decision(result) {
  return { action: result.action, load: result.load,
    targetReps: result.targetReps, confidence: result.confidence };
}

test('empty history produces an explained baseline without inventing a load', () => {
  const result = recommend(input({ history: [] }));
  assertRecommendation(result);
  assert.equal(result.action, 'baseline');
  assert.equal(result.load, null);
  assert.equal(result.confidence.count, 0);
});

test('unconfirmed equipment prevents automatic historical machine-load transfer', () => {
  const result = recommend(input({ equipmentConfirmed: false }));
  assertRecommendation(result);
  assert.equal(result.action, 'baseline');
  assert.equal(result.load, null);
});

test('recommendation is deterministic and never mutates frozen source data', () => {
  const source = input(), before = clone(source);
  freeze(source);
  const first = recommend(source), second = recommend(source);
  assertRecommendation(first);
  assert.deepEqual(first, second);
  assert.deepEqual(source, before);
});

for (const [name, foreign] of [
  ['slot', { slotId: 'pull2-lateral' }],
  ['exercise', { exerciseId: 'dumbbell-lateral' }],
  ['setup', { setupNotes: 'Seat 8; pulley high' }]
]) {
  test('history from a different ' + name + ' cannot establish a baseline', () => {
    const history = input().history.map(w => ({ ...w,
      exercises: w.exercises.map(e => ({ ...e, ...foreign })) }));
    const result = recommend(input({ history }));
    assert.equal(result.action, 'baseline');
    assert.equal(result.load, null);
    assert.equal(result.confidence.count, 0);
  });
}

test('history from another gym cannot establish a machine-load baseline', () => {
  const history = input().history.map(w => ({ ...w, gymId: 'gym-commercial' }));
  const result = recommend(input({ history }));
  assert.equal(result.action, 'baseline');
  assert.equal(result.load, null);
  assert.equal(result.confidence.count, 0);
});

test('incompatible logs cannot change a recommendation or inflate confidence', () => {
  const source = input(), expected = decision(recommend(source));
  const foreign = [
    workout(3, { weight: 500, gymId: 'gym-other' }),
    { ...workout(3), exercises: [{ ...workout(3).exercises[0], slotId: 'pull2-lateral' }] },
    { ...workout(3), exercises: [{ ...workout(3).exercises[0], exerciseId: 'other' }] },
    { ...workout(3), exercises: [{ ...workout(3).exercises[0], setupNotes: 'different setup' }] }
  ];
  assert.deepEqual(decision(recommend({ ...source, history: [...source.history, ...foreign] })), expected);
});

test('another slot inside the same workout does not cross-contaminate', () => {
  const source = input(), expected = decision(recommend(source));
  const history = clone(source.history);
  history.forEach(w => w.exercises.unshift({
    ...clone(w.exercises[0]), slotId: 'pull2-lateral', sets: [working(500, 20, 5)]
  }));
  assert.deepEqual(decision(recommend({ ...source, history })), expected);
});

test('chronological interpretation is independent of supplied history order', () => {
  const source = input();
  assert.deepEqual(recommend({ ...source, history: [...source.history].reverse() }), recommend(source));
});

test('repeatable easy exposures support an achievable load increase', () => {
  const history = [0, 1, 2].map(i => workout(i, { reps: [17, 17, 17], rir: [5, 5, 5] }));
  const result = recommend(input({ history }));
  assertRecommendation(result);
  assert.equal(result.action, 'increase');
  assert.equal(result.load, 12.5);
  assert.equal(result.targetReps.length, 3);
  assert.ok(result.targetReps.every(rep => rep >= 10 && rep <= 20));
});

test('a large equipment step refuses an unrealistic jump', () => {
  const result = recommend(input({ increment: 10 }));
  assertRecommendation(result);
  assertNoIncrease(result);
});

test('available-load constraints never return a nonexistent equipment setting', () => {
  const loads = [5, 10, 12.5, 17.5];
  const result = recommend(input({ availableLoads: loads }));
  assertRecommendation(result);
  assert.ok(result.load === null || loads.includes(result.load));
  result.alternatives.forEach(c => assert.ok(loads.includes(c.load)));
});

test('higher external-load candidates never predict more reps at the same effort', () => {
  const result = recommend(input({ availableLoads: [5, 7.5, 10, 12.5, 15, 17.5, 20] }));
  const candidates = result.alternatives.filter(c => Number.isFinite(c.load) && Number.isFinite(c.reps))
    .sort((a, b) => a.load - b.load);
  assert.ok(candidates.length >= 2, 'the candidate model should expose a usable comparison');
  for (let i = 1; i < candidates.length; i++) {
    assert.ok(candidates[i].reps <= candidates[i - 1].reps, 'higher loads must not increase expected reps');
    assert.ok(candidates[i].lowerReps <= candidates[i].reps, 'lower bound exceeds expected reps');
  }
});

test('red recovery blocks progression despite easy recent sets', () => {
  const result = recommend(input({ recovery: { level: 'red' } }));
  assertRecommendation(result);
  assertNoIncrease(result);
});

test('symptom concern blocks automatic progression despite easy recent sets', () => {
  const result = recommend(input({ symptomConcern: true }));
  assertRecommendation(result);
  assertNoIncrease(result);
});

test('missing RIR does not fabricate effort evidence for an increase', () => {
  const history = input().history;
  history.forEach(w => w.exercises[0].sets.forEach(s => { s.rir = null; }));
  const result = recommend(input({ history }));
  assertRecommendation(result);
  assertNoIncrease(result);
  assert.match(result.reasons.join(' '), /RIR|effort|missing|incomplete|uncertain/i);
});

test('one logged working set cannot justify a planned three-set progression', () => {
  const history = input().history;
  history.forEach(w => { w.exercises[0].sets = w.exercises[0].sets.slice(0, 1); });
  const result = recommend(input({ history }));
  assertRecommendation(result);
  assertNoIncrease(result);
});

test('warmups do not establish working-load evidence', () => {
  const history = input().history;
  history.forEach(w => w.exercises[0].sets.forEach(s => { s.type = 'warmup'; }));
  const result = recommend(input({ history }));
  assert.equal(result.action, 'baseline');
  assert.equal(result.load, null);
  assert.equal(result.confidence.count, 0);
});

test('invalid or unlogged sets do not establish a working-load baseline', () => {
  const history = [workout(2)];
  history[0].exercises[0].sets = [
    working(null, null, null, { completedAt: null }), working(NaN, 12, 2),
    working(Infinity, 12, 2), working(10, -1, 2), working(-10, 12, 2)
  ];
  const result = recommend(input({ history }));
  assertRecommendation(result);
  assert.equal(result.action, 'baseline');
  assert.equal(result.load, null);
});

test('week eight and explicit deload both reduce external load and effort', () => {
  for (const extra of [{ week: 8 }, { forceDeload: true }]) {
    const result = recommend(input(extra));
    assertRecommendation(result);
    assert.equal(result.action, 'deload');
    assert.ok(result.load < 10);
    assert.ok(result.targetRir >= 4);
    assert.notEqual(result.volume.action, 'add');
  }
});

test('a first exposure in a new mesocycle resets from prior harder work', () => {
  const result = recommend(input({ currentMesoId: 'meso-next', week: 1 }));
  assertRecommendation(result);
  assert.equal(result.action, 'reset');
  assert.ok(result.load <= 10);
});

test('a prior deload does not replace the harder-work anchor for a new cycle', () => {
  const source = input({ currentMesoId: 'meso-next', week: 1 });
  const expected = recommend(source);
  const deload = workout(3, { weight: 5, reps: [10, 10], rir: [5, 5], week: 8 });
  const result = recommend({ ...source, history: [...source.history, deload] });
  assert.equal(result.action, 'reset');
  assert.equal(result.load, expected.load);
});

test('one extreme load cannot hijack a stable recent load baseline', () => {
  const source = input();
  const corrupted = workout(3, { weight: 1000, reps: [20, 20, 20], rir: [5, 5, 5] });
  const result = recommend({ ...source, history: [...source.history, corrupted] });
  assertRecommendation(result);
  assert.ok(result.load === null || result.load <= 15, 'outlier hijacked load: ' + result.load);
});

test('a single implausible repetition entry cannot unlock a load increase', () => {
  const history = [0, 1, 2].map(i => workout(i, { reps: [10, 10, 10], rir: [1, 1, 1] }));
  history[2].exercises[0].sets[0] = working(10, 1000, 10);
  const result = recommend(input({ history }));
  assertRecommendation(result);
  assertNoIncrease(result);
});

test('adding planned sets lowers or preserves progression willingness', () => {
  const source = input(), ordinary = recommend(source);
  const extraVolume = recommend({ ...source, plannedSets: 5 });
  assertRecommendation(extraVolume);
  assert.ok(extraVolume.load <= ordinary.load);
  assert.equal(extraVolume.targetReps.length, extraVolume.sets);
  assert.ok(extraVolume.sets <= 5);
});

test('repeated poor exposures warrant at least as much caution as one bad day', () => {
  const good = [0, 1, 2].map(i => workout(i, { reps: [15, 14, 13], rir: [2, 2, 2] }));
  const poor = i => workout(i, { reps: [8, 6, 5], rir: [0, 0, 0] });
  const oneBad = recommend(input({ history: [...good, poor(3)] }));
  const repeated = recommend(input({ history: [good[0], poor(1), poor(2), poor(3)] }));
  assertRecommendation(oneBad);
  assertRecommendation(repeated);
  assertNoIncrease(repeated);
  assert.ok(repeated.load <= oneBad.load);
  assert.notEqual(repeated.volume.action, 'add');
});

test('assistance-mode advice does not mistake more assistance for progression', () => {
  const history = [0, 1, 2].map(i => workout(i, { weight: 40 }));
  const result = recommend(input({ history, loadMode: 'assistance', increment: 5 }));
  assertRecommendation(result);
  assert.equal(result.load, 40);
  assert.notEqual(result.action, 'increase');
  assert.match(result.reasons.join(' '), /assistan|load model|calibrat/i);
});

test('bodyweight mode does not invent an external-load arithmetic target', () => {
  const history = [0, 1, 2].map(i => workout(i, { weight: 0 }));
  const result = recommend(input({ history, loadMode: 'bodyweight' }));
  assertRecommendation(result);
  assert.ok(result.load === null || result.load === 0);
  assert.notEqual(result.action, 'increase');
});

test('null and nonfinite input fields yield conservative finite results', () => {
  const cases = [
    input({ history: null }),
    input({ history: [null, {}, { exercises: null }] }),
    input({ targetRir: null, increment: NaN, plannedSets: null, range: null, restSec: Infinity }),
    input({ recovery: null, now: null }),
    input({ availableLoads: [null, -5, NaN, Infinity, 10, 12.5] })
  ];
  for (const source of cases) {
    let result;
    assert.doesNotThrow(() => { result = recommend(source); });
    assertRecommendation(result);
  }
});

test('candidate output remains finite across realistic low and high loads', () => {
  for (const load of [2.5, 10, 100, 315]) {
    for (const increment of [2.5, 5, 25]) {
      const history = [0, 1, 2].map(i => workout(i, { weight: load }));
      assertRecommendation(recommend(input({ history, increment })));
    }
  }
});

// Public live API: live({...recommendInput, completedSets}).
// Public calibration API: evaluate(immutableStoredPrediction, observedWorkingSets).
test('live advice never mutates inputs or completed sets', () => {
  const source = input({ completedSets: [working(10, 14, 2), working(10, 11, 1)] });
  const before = clone(source);
  freeze(source);
  let result;
  assert.doesNotThrow(() => { result = live(source); });
  assert.ok(result && typeof result === 'object');
  assertFiniteTree(result);
  assert.deepEqual(source, before);
});

test('calibration handles missing effort observations without mutation', () => {
  const prediction = recommend(input()).prediction;
  const sets = [working(prediction.load, 12, null), working(prediction.load, 11, null), working(prediction.load, 10, null)];
  const predictionBefore = clone(prediction), setsBefore = clone(sets);
  freeze(prediction);
  freeze(sets);
  let result;
  assert.doesNotThrow(() => { result = evaluate(prediction, sets); });
  assert.ok(result && typeof result === 'object');
  assert.equal(result.usable, false);
  assert.equal(result.status, 'rir-missing');
  assert.equal(result.rirError, undefined, 'missing RIR cannot produce a numerical RIR error');
  assertFiniteTree(result);
  assert.deepEqual(prediction, predictionBefore);
  assert.deepEqual(sets, setsBefore);
});

test('calibration remains finite when no valid observations exist', () => {
  const prediction = recommend(input()).prediction;
  for (const sets of [[], [working(null, null, null)], [working(Infinity, NaN, null)]]) {
    let result;
    assert.doesNotThrow(() => { result = evaluate(prediction, sets); });
    assertFiniteTree(result);
  }
});


test('duplicate workout IDs do not increase independent-exposure confidence', () => {
  const source = input(), ordinary = recommend(source);
  const repeated = recommend({ ...source, history: [...source.history, ...clone(source.history)] });
  assert.deepEqual(decision(repeated), decision(ordinary));
});

test('future-dated workouts do not influence today’s recommendation', () => {
  const source = input(), ordinary = recommend(source);
  const future = workout(5, { weight: 500, reps: [20, 20, 20], rir: [5, 5, 5] });
  const result = recommend({ ...source, history: [...source.history, future] });
  assert.deepEqual(decision(result), decision(ordinary));
});

test('explicit equipment and weight-basis context remain isolated', () => {
  for (const context of [
    { equipmentId: 'machine-A', weightBasis: 'per-hand', loadMode: 'external' },
    { equipmentId: 'machine-B', weightBasis: 'stack', loadMode: 'external' },
    { equipmentId: 'machine-A', weightBasis: 'stack', loadMode: 'assistance' }
  ]) {
    const history = input().history;
    history.forEach(w => { w.exercises[0].coachContext = context; });
    const result = recommend(input({ history, equipmentId: 'machine-A' }));
    assert.equal(result.action, 'baseline');
    assert.equal(result.load, null);
    assert.equal(result.confidence.count, 0);
  }
});

test('stale exposures cannot automatically escalate load', () => {
  const history = input().history;
  history.forEach(w => { w.timestamp -= 30 * DAY; });
  const result = recommend(input({ history }));
  assertRecommendation(result);
  assertNoIncrease(result);
  assert.ok(result.flags.includes('stale-history'));
});

test('stored predictions are detached from mutable display targets', () => {
  const result = recommend(input()), stored = clone(result.prediction);
  result.targetReps[0] = 999;
  result.confidence.label = 'changed';
  if (result.alternatives[0]) result.alternatives[0].reps = 999;
  assert.deepEqual(result.prediction, stored);
});

test('a single easy completed set cannot trigger a second in-session load increase', () => {
  const source = input(), opening = recommend(source);
  const result = live({ ...source, opening, completedSets: [working(opening.load, 20, 6)] });
  assert.equal(result.action, 'hold');
  assert.ok(result.load <= opening.load);
});

test('a short-rest miss advises rest before reducing the next-set load', () => {
  const source = input({ completedSets: [
    working(10, 15, 2, { id: 'live-1' }),
    working(10, 8, 0, { id: 'live-2', restBeforeSec: 30 })
  ] });
  const result = live(source);
  assert.equal(result.action, 'rest');
  assert.equal(result.load, 10);
  assert.ok(result.restSec > source.restSec);
});

test('a full-rest miss advises an available easier load for the next set', () => {
  const result = live(input({ availableLoads: [5, 7.5, 10, 12.5],
    completedSets: [working(10, 8, 0, { restBeforeSec: 120 })] }));
  assert.equal(result.action, 'reduce');
  assert.equal(result.load, 7.5);
});

test('live missing-RIR advice uses observed reps without inventing spare capacity', () => {
  const result = live(input({ completedSets: [working(10, 12, null)] }));
  assert.equal(result.action, 'hold');
  assert.equal(result.targetReps, 12);
  assert.match(result.text, /RIR|effort|missing/i);
});

test('live symptom concern advises review and cannot escalate load', () => {
  const result = live(input({ symptomConcern: true, completedSets: [working(10, 20, 6)] }));
  assert.equal(result.action, 'review');
  assert.equal(result.load, 10);
});

test('live advice requires a completed valid set', () => {
  for (const completedSets of [[], [working(10, 12, 2, { completedAt: null })],
    [working(Infinity, 12, 2)]]) {
    assert.equal(live(input({ completedSets })), null);
  }
});

test('calibration reports signed rep and RIR errors against the stored prediction', () => {
  const prediction = recommend(input()).prediction;
  const expected = prediction.targetReps[0], load = prediction.load;
  const accurate = evaluate(prediction, [working(load, expected, prediction.targetRir)]);
  assert.equal(accurate.usable, true);
  assert.equal(accurate.capacityError, 0);
  assert.equal(accurate.repError, 0);
  assert.equal(accurate.rirError, 0);
  assert.equal(accurate.status, 'partial');
  const optimistic = evaluate(prediction, [working(load, Math.max(1, expected - 3), 0)]);
  assert.equal(optimistic.interpretation, 'overestimated');
  assert.ok(optimistic.capacityError < 0);
  const conservative = evaluate(prediction, [working(load, expected + 3, prediction.targetRir + 1)]);
  assert.equal(conservative.interpretation, 'underestimated');
  assert.ok(conservative.capacityError > 0);
});

test('calibration refuses changed-load outcomes instead of claiming prediction accuracy', () => {
  const prediction = recommend(input()).prediction;
  const result = evaluate(prediction, [working(prediction.load + 5, 12, 2)]);
  assert.equal(result.usable, false);
  assert.equal(result.status, 'load-changed');
  assert.equal(result.capacityError, undefined);
});

test('calibration cannot substitute a later set when the first set used a different load', () => {
  const prediction = recommend(input()).prediction;
  const result = evaluate(prediction, [
    working(prediction.load + 5, 12, 2), working(prediction.load, 12, 2)
  ]);
  assert.equal(result.usable, false);
  assert.equal(result.status, 'first-load-changed');
});

test('calibration does not invent a prediction when none was issued', () => {
  assert.deepEqual(evaluate(null, [working(10, 12, 2)]), { status: 'not-issued', usable: false });
});


test('missing RIR on the latest exposure blocks progression earned only by earlier logs', () => {
  const history = [0, 1, 2].map(i => workout(i, { reps: [17, 17, 17], rir: [5, 5, 5] }));
  history[2].exercises[0].sets.forEach(s => { s.rir = null; });
  const result = recommend(input({ history }));
  assertRecommendation(result);
  assertNoIncrease(result);
});

test('an incomplete latest dose cannot inherit progression permission from earlier complete doses', () => {
  const history = [0, 1, 2].map(i => workout(i, { reps: [17, 17, 17], rir: [5, 5, 5] }));
  history[2].exercises[0].sets = history[2].exercises[0].sets.slice(0, 1);
  const result = recommend(input({ history }));
  assertRecommendation(result);
  assertNoIncrease(result);
});

test('repeated stored overestimates prevent another ambitious load increase', () => {
  const history = [0, 1, 2].map(i => workout(i, { reps: [17, 17, 17], rir: [5, 5, 5] }));
  history.forEach(w => {
    w.exercises[0].coachPrediction = {
      load: 10, loadMode: 'external', targetReps: [20, 20, 20], targetRir: 5,
      engineVersion: 'historical-test'
    };
  });
  const result = recommend(input({ history }));
  assertRecommendation(result);
  assertNoIncrease(result);
  assert.equal(result.model.feedback.count, 3);
  assert.equal(result.model.feedback.overestimates, 3);
});


test('legacy history requires its own explicit equipment confirmation', () => {
  const result = recommend(input({ equipmentConfirmed: true, legacyEquipmentConfirmed: false }));
  assertRecommendation(result);
  assert.equal(result.action, 'baseline');
  assert.equal(result.load, null);
  assert.equal(result.confidence.count, 0);
});

test('matching explicit equipment context works without admitting legacy history', () => {
  const history = input().history;
  history.forEach(w => { w.exercises[0].coachContext = {
    equipmentId: 'machine-A', weightBasis: 'stack', loadMode: 'external'
  }; });
  const result = recommend(input({ history, equipmentId: 'machine-A', legacyEquipmentConfirmed: false }));
  assertRecommendation(result);
  assert.equal(result.confidence.count, 3);
  assert.ok(result.load > 0);
});

test('deload lowers dose and retains effort reserve even without load history', () => {
  for (const extra of [{ history: [], week: 8 }, { history: [], forceDeload: true },
    { equipmentConfirmed: false, week: 8 }, { equipmentConfirmed: false, forceDeload: true }]) {
    const result = recommend(input({ plannedSets: 6, baseSets: 6, ...extra }));
    assertRecommendation(result);
    assert.equal(result.load, null);
    assert.equal(result.sets, 3);
    assert.equal(result.targetReps.length, 3);
    assert.ok(result.targetRir >= 4);
    assert.equal(result.volume.action, 'reduce');
  }
});

test('new mesocycle without any comparable history requests a fresh baseline', () => {
  const result = recommend(input({ currentMesoId: 'meso-next', week: 1, history: [] }));
  assertRecommendation(result);
  assert.equal(result.action, 'baseline');
  assert.equal(result.load, null);
});

test('earned volume is capped at one new set per exposure', () => {
  const history = [
    workout(0, { reps: [12, 12, 12], rir: [3, 3, 3] }),
    workout(1, { reps: [12, 12, 12], rir: [3, 3, 3] }),
    workout(2, { reps: [15, 15, 15], rir: [3, 3, 3] }),
    workout(3, { reps: [16, 16, 16], rir: [3, 3, 3] })
  ];
  const result = recommend(input({ history, plannedSets: 8 }));
  assertRecommendation(result);
  assert.equal(result.trend.kind, 'improving');
  assert.equal(result.sets, 4);
  assert.equal(result.volume.action, 'increase');
  assert.ok(result.load <= 10, 'a dose increase should retain the current load ceiling');
});

test('one anomalous easy exposure cannot earn additional volume', () => {
  const history = [0, 1, 2].map(i => workout(i, { reps: [12, 12, 12], rir: [3, 3, 3] }));
  history.push(workout(3, { reps: [30, 30, 30], rir: [6, 6, 6] }));
  const result = recommend(input({ history, plannedSets: 5 }));
  assertRecommendation(result);
  assert.ok(result.flags.includes('outlier-protected'));
  assert.equal(result.sets, 3);
  assert.notEqual(result.volume.action, 'increase');
  assertNoIncrease(result);
});

test('coherent repeated forecast misses widen uncertainty despite zero residual spread', () => {
  const history = [0, 1, 2].map(i => workout(i, { reps: [17, 17, 17], rir: [5, 5, 5] }));
  const ordinary = recommend(input({ history }));
  const coachedHistory = clone(history);
  coachedHistory.forEach(w => { w.exercises[0].coachPrediction = {
    load: 10, loadMode: 'external', targetReps: [20, 20, 20], targetRir: 2,
    expectedCapacity: 26, engineVersion: 'historical-test'
  }; });
  const result = recommend(input({ history: coachedHistory }));
  assertRecommendation(result);
  assert.equal(result.model.feedback.count, 3);
  assert.equal(result.model.feedback.medianError, -4);
  assert.ok(result.model.uncertainty > ordinary.model.uncertainty);
  assertNoIncrease(result);
});

test('forecast calibration uses unclipped capacity rather than the programmed rep ceiling', () => {
  const history = [0, 1, 2].map(i => workout(i, { reps: [25, 25, 25], rir: [5, 5, 5] }));
  const result = recommend(input({ history })), prediction = result.prediction;
  assertRecommendation(result);
  assert.equal(prediction.targetReps[0], 20);
  assert.ok(prediction.expectedCapacity > prediction.targetReps[0] + prediction.targetRir);
  const observed = working(prediction.load, prediction.targetReps[0], prediction.targetRir);
  const feedback = evaluate(prediction, [observed]);
  const expectedResidual = Math.round((observed.reps + observed.rir - prediction.expectedCapacity) * 10) / 10;
  assert.equal(feedback.capacityError, expectedResidual);
  assert.ok(feedback.capacityError < 0);
  assert.equal(feedback.repError, 0);
  assert.equal(feedback.rirError, 0);
});

test('extra terminal sets do not create false fatigue across a dose change', () => {
  const history = [
    workout(0, { reps: [15, 14, 13], rir: [2, 2, 2] }),
    workout(1, { reps: [15, 14, 13], rir: [2, 2, 2] }),
    workout(2, { reps: [15, 14, 13, 10, 8], rir: [2, 2, 2, 2, 2] }),
    workout(3, { reps: [15, 14, 13, 10, 8], rir: [2, 2, 2, 2, 2] })
  ];
  history.slice(2).forEach(w => { w.exercises[0].plannedSets = 5; });
  const result = recommend(input({ history, plannedSets: 5 }));
  assertRecommendation(result);
  assert.equal(result.sets, 5);
  assert.notEqual(result.action, 'fatigue');
  assert.notEqual(result.action, 'reduce');
  assert.equal(result.flags.includes('repeated-fatigue'), false);
});

test('live advice evaluates effort against the opening deload reserve target', () => {
  const source = input({ week: 8 });
  const opening = recommend(source);
  assert.ok(opening.targetRir > source.targetRir);
  const result = live({ ...source, opening,
    completedSets: [working(opening.load, 12, 2, { restBeforeSec: 120 })] });
  assert.equal(result.action, 'reduce');
  assert.ok(result.load < opening.load);
});

test('live advice refuses load arithmetic for unconfirmed equipment or weight basis', () => {
  for (const extra of [{ equipmentConfirmed: false }, { weightBasis: 'unknown' }]) {
    const result = live(input({ ...extra, completedSets: [working(10, 8, 0)] }));
    assert.equal(result.action, 'review');
    assert.equal(result.load, 10);
    assert.equal(result.targetReps, null);
    assert.match(result.text, /equipment|weight|convention/i);
  }
});

test('an extraordinary latest load cannot anchor advice after varied ordinary loads', () => {
  const history = [50, 60, 75, 1000].map((weight, i) =>
    workout(i, { weight, reps: [12, 12, 12], rir: [3, 3, 3] }));
  const result = recommend(input({ history, increment: 5 }));
  assertRecommendation(result);
  assert.ok(result.load === null || result.load <= 100);
  assert.ok(result.flags.includes('anchor-needs-review'));
});

test('draft and active workouts are excluded from finalized evidence', () => {
  const source = input(), ordinary = decision(recommend(source));
  for (const status of ['draft', 'active']) {
    const incomplete = workout(3, { weight: 500, reps: [20, 20, 20], rir: [5, 5, 5], status });
    const result = recommend({ ...source, history: [...source.history, incomplete] });
    assert.deepEqual(decision(result), ordinary);
  }
});

test('even a slightly future timestamp cannot enter today’s coaching evidence', () => {
  const source = input(), ordinary = decision(recommend(source));
  const future = workout(3, { timestamp: NOW + 1, weight: 500 });
  assert.deepEqual(decision(recommend({ ...source, history: [...source.history, future] })), ordinary);
});

test('equipment with no same-or-easier setting does not force a heavier load', () => {
  const result = recommend(input({ recovery: { level: 'red' }, availableLoads: [15, 20] }));
  assertRecommendation(result);
  assert.equal(result.load, null);
  assert.equal(result.action, 'baseline');
  assert.ok(result.flags.includes('no-safe-available-load'));
});

test('fatigue observed earlier in the session blocks load escalation in later slots', () => {
  const history = [0, 1, 2].map(i => workout(i, { reps: [17, 17, 17], rir: [5, 5, 5] }));
  const result = recommend(input({ history, sessionFatigue: 1 }));
  assertRecommendation(result);
  assertNoIncrease(result);
  assert.ok(result.flags.includes('earlier-session-fatigue'));
});

for (const mode of ['assistance', 'bodyweight']) {
  for (const [label, protection] of [
    ['red recovery', { recovery: { level: 'red' } }],
    ['symptom concern', { symptomConcern: true }],
    ['earlier session fatigue', { sessionFatigue: 1 }],
    ['combined recovery flags', { recovery: { level: 'red' }, symptomConcern: true, sessionFatigue: 1 }]
  ]) {
    test(mode + ' rep progression is blocked by ' + label, () => {
      const weight = mode === 'assistance' ? 40 : 0;
      const history = [0, 1, 2].map(i => workout(i, { weight, reps: [17, 17, 17], rir: [5, 5, 5] }));
      const source = input({ history, loadMode: mode, ...protection });
      const result = recommend(source);
      assertRecommendation(result);
      assert.equal(result.load, weight);
      assert.notEqual(result.action, 'increase');
      assert.ok(result.targetReps.every((rep, i) => rep <= history[2].exercises[0].sets[i].reps));
      assert.ok(result.targetRir >= (protection.recovery?.level === 'red' ? 3 : source.targetRir));
      assert.ok(result.sets <= 3);
    });
  }
}

test('unmodeled recovery protection retains an already higher effort-reserve target', () => {
  for (const mode of ['assistance', 'bodyweight']) {
    const weight = mode === 'assistance' ? 40 : 0;
    const history = [0, 1, 2].map(i => workout(i, { weight, reps: [17, 17, 17], rir: [6, 6, 6] }));
    const result = recommend(input({ history, loadMode: mode, targetRir: 5,
      recovery: { level: 'red' }, symptomConcern: true, sessionFatigue: 1 }));
    assertRecommendation(result);
    assert.ok(result.targetRir >= 5);
    assert.ok(result.targetReps.every(rep => rep <= 17));
    assert.ok(result.flags.includes('recovery-protection'));
    assert.ok(result.flags.includes('symptom-review'));
    assert.ok(result.flags.includes('earlier-session-fatigue'));
  }
});

test('missing assistance setting requires a baseline rather than a harder assistance target', () => {
  const history = [0, 1, 2].map(i => workout(i, { weight: 40 }));
  const result = recommend(input({ history, loadMode: 'assistance', increment: 5,
    availableLoads: [30, 35] }));
  assertRecommendation(result);
  assert.equal(result.action, 'baseline');
  assert.equal(result.load, null);
  assert.ok(result.flags.includes('anchor-unavailable'));
});

test('earlier session fatigue prevents an extra set despite an otherwise improving trend', () => {
  const history = [
    workout(0, { reps: [12, 12, 12], rir: [3, 3, 3] }),
    workout(1, { reps: [12, 12, 12], rir: [3, 3, 3] }),
    workout(2, { reps: [15, 15, 15], rir: [3, 3, 3] }),
    workout(3, { reps: [16, 16, 16], rir: [3, 3, 3] })
  ];
  const source = input({ history, plannedSets: 4 });
  const ordinary = recommend(source);
  assert.equal(ordinary.volume.action, 'increase');
  assert.equal(ordinary.sets, 4);
  const protectedResult = recommend({ ...source, sessionFatigue: 1 });
  assertRecommendation(protectedResult);
  assert.ok(protectedResult.sets <= 3);
  assert.notEqual(protectedResult.volume.action, 'increase');
  assertNoIncrease(protectedResult);
});

