/**
 * Lantern Engine E0 — tests unitaires du moteur générique.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const lantern = require('../src/lib/lanternEngine');
const { evaluateCondition } = require('../src/lib/lanternEngine/condition');

function loadFixture(name) {
  const p = path.join(__dirname, '../src/lib/lanternEngine/fixtures', name);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('lanternEngine — schémas', () => {
  it('valide la fixture Magellan', () => {
    const def = loadFixture('magellan.json');
    const r = lantern.validateDefinition(def);
    assert.equal(r.ok, true);
  });

  it('valide la fixture Appel 20h17', () => {
    const def = loadFixture('appel20h17.json');
    const r = lantern.validateDefinition(def);
    assert.equal(r.ok, true);
  });

  it('rejette une Rule sans listen', () => {
    assert.throws(() => {
      lantern.validateDefinition({
        id: 'x',
        engineSchemaVersion: 1,
        rules: [
          {
            id: 'r1',
            enabled: true,
            priority: 1,
            condition: { op: 'true' },
            actions: [],
            occurrence: { kind: 'always' },
          },
        ],
      });
    }, /listen/);
  });
});

describe('lanternEngine — ConditionExpr AND/OR/NOT', () => {
  it('évalue AND / OR / NOT imbriqués', () => {
    const runtime = lantern.createRuntime({ vars: { a: true, b: false, c: true } });
    const ctx = {
      definition: { timezone: 'Europe/Paris' },
      runtime,
      event: { type: 'manual.simulate', payload: {} },
      now: '2026-08-09T15:07:00.000Z',
      resolvedZones: [],
    };
    const expr = {
      op: 'and',
      children: [
        { type: 'var.truthy', varId: 'a' },
        {
          op: 'or',
          children: [
            { type: 'var.truthy', varId: 'b' },
            { type: 'var.truthy', varId: 'c' },
          ],
        },
        { op: 'not', child: { type: 'var.truthy', varId: 'b' } },
      ],
    };
    const r = evaluateCondition(expr, ctx);
    assert.equal(r.value, true);
    assert.equal(r.trace.op, 'and');
  });
});

describe('lanternEngine — idempotence', () => {
  it('ignore un clientEventId déjà traité', () => {
    const def = loadFixture('magellan.json');
    const runtime = lantern.createRuntime({ channel: 'lab' });
    const event = {
      type: 'media.discovered',
      clientEventId: 'evt-1',
      source: 'mobile',
      at: '2026-08-09T15:07:00.000Z',
      payload: { mediaItemId: 'talkie_magellan', lat: 48.8322, lng: 2.3561 },
    };
    const a = lantern.handleEvent(def, runtime, event);
    const b = lantern.handleEvent(def, runtime, event);
    assert.equal(a.duplicate, false);
    assert.equal(b.duplicate, true);
    assert.equal(b.uiPlan.length, 0);
    // une seule branche X
    assert.equal(runtime.vars.talkie_branch, 'X');
  });
});

describe('lanternEngine — channel production', () => {
  it('refuse source forced en production', () => {
    const def = loadFixture('magellan.json');
    const runtime = lantern.createRuntime({ channel: 'production' });
    assert.throws(
      () =>
        lantern.handleEvent(def, runtime, {
          type: 'media.discovered',
          source: 'forced',
          payload: { mediaItemId: 'talkie_magellan' },
        }),
      /interdit/
    );
  });
});

describe('lanternEngine — catalogues', () => {
  it('expose predicates et actions enregistrés', () => {
    assert.ok(lantern.predicates.list().includes('geo.inAnyZone'));
    assert.ok(lantern.predicates.list().includes('time.inWindow'));
    assert.ok(lantern.actions.list().includes('device.ringTalkie'));
    assert.ok(lantern.actions.list().includes('device.ringPhone'));
  });
});
