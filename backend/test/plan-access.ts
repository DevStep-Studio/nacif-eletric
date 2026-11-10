import assert from 'node:assert/strict';
import { test } from 'node:test';
import { env } from '../src/config/env.js';
import { effectivePlanCode, getServerPlan, checkServerModuleAccess, checkServerProjectCreation, projectPayloadAccess } from '../src/lib/planGovernance.js';

const paid = (planCode: string, start = Date.now()-86400000, end = Date.now()+86400000) => ({
  role: 'user', plan: planCode, customPermissions: {
    billingProvider: 'asaas', billingEnvironment: env.ASAAS_ENVIRONMENT,
    billingEntitlements: [{ planCode, start: new Date(start).toISOString(), end: new Date(end).toISOString() }],
    academicStatus: 'approved', academicValidUntil: new Date(Date.now()+86400000).toISOString(),
  },
});
test('only confirmed current paid periods unlock plans', () => {
  assert.equal(effectivePlanCode({ plan: 'completo' }), 'gratuito');
  assert.equal(effectivePlanCode(paid('solar')), 'solar');
  assert.equal(effectivePlanCode(paid('solar', Date.now()-86400000, Date.now()-1)), 'gratuito');
  assert.equal(effectivePlanCode(paid('solar', Date.now()+10000)), 'gratuito');
  assert.equal(effectivePlanCode({ ...paid('solar'), customPermissions: { ...paid('solar').customPermissions, subscriptionStatus: 'cancelled' } }), 'solar');
});
test('commercial limits and project boundaries match the comparison', () => {
  for (const [code, projects, storageMb, teamMembers, exports, aiScans] of [
    ['estudante',5,1000,1,20,20], ['eletrico',30,5000,3,100,100],
    ['solar',30,5000,3,100,100], ['completo',Infinity,50000,15,Infinity,500],
  ] as const) {
    const plan = getServerPlan(code);
    assert.deepEqual([plan.projects,plan.storageMb,plan.teamMembers,plan.exports,plan.aiScans], [projects,storageMb,teamMembers,exports,aiScans]);
    const type = code === 'solar' ? 'solar' : 'electrical';
    assert.equal(checkServerProjectCreation(paid(code), projects === Infinity ? 500 : projects-1, type).allowed, true);
    if (projects !== Infinity) assert.equal(checkServerProjectCreation(paid(code), projects, type).allowed, false);
  }
});
test('modules, academic validity, and payload bypasses are enforced', () => {
  assert.equal(checkServerModuleAccess(paid('eletrico'), 'solar').allowed, false);
  assert.equal(checkServerModuleAccess(paid('solar'), 'panel').allowed, false);
  assert.equal(checkServerModuleAccess(paid('solar'), 'solar').allowed, true);
  assert.equal(checkServerModuleAccess(paid('estudante'), 'team').allowed, false);
  assert.equal(checkServerModuleAccess(paid('estudante'), 'unifilar').watermark, 'Versão Acadêmica — Uso Educacional');
  const student = paid('estudante'); student.customPermissions.academicStatus = 'pending';
  assert.equal(checkServerModuleAccess(student, 'plant').allowed, false);
  assert.equal(projectPayloadAccess(paid('eletrico'), { solar_config: { modules_count: 20 } }).allowed, false);
  assert.equal(projectPayloadAccess(paid('solar'), { project_type:'electrical' }, 'solar').allowed, false);
  assert.equal(projectPayloadAccess({ plan: 'completo' }, { panel_layout: { boards: [1] } }).allowed, false);
  assert.equal(checkServerModuleAccess(paid('completo'), 'unknown-module').allowed, false);
  assert.equal(checkServerProjectCreation({ role:'admin' }, 9999, 'solar').allowed, true);
});
