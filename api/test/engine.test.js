const assert = require('assert');
const { evaluate } = require('../src/lib/engine');
const load = (n) => require(`../scenarios/${n}.json`);
const c = evaluate(load('compliant')); assert.strictEqual(c.verdict, 'compliant'); assert.deepStrictEqual(c.requiredApprovers, ['platform']);
const b = evaluate(load('blocked')); assert.strictEqual(b.verdict, 'blocked'); assert.deepStrictEqual(b.failed.sort(), ['GG-002','GG-003','GG-004','GG-006','GG-007']);
const a = evaluate(load('approved')); assert.strictEqual(a.verdict, 'compliant'); assert.deepStrictEqual(a.requiredApprovers.sort(), ['platform','security']);
assert.strictEqual(c.model.tier, 'low'); assert.strictEqual(b.model.tier, 'critical'); assert.strictEqual(a.model.tier, 'medium'); assert.ok(a.model.summary.human <= 2);
assert.deepStrictEqual(evaluate(load('blocked')), evaluate(load('blocked')), 'deterministic');
// Cardholder data that passes every rule still needs the compliance officer (the only path that reaches that role)
const r = evaluate({ ...load('approved'), dataClass: 'restricted' }); assert.strictEqual(r.verdict, 'compliant'); assert.strictEqual(r.model.tier, 'high'); assert.deepStrictEqual(r.requiredApprovers.sort(), ['compliance','platform','security']);
console.log('engine tests passed: compliant, blocked (5 rules named), approved (security + platform), restricted (+ compliance), deterministic');
