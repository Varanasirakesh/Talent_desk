import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePreferences, defaultPreferences } from '../src/features/hr/preferences';

test('valid preferences trim text and preserve explicit zero limits', () => {
  const value = parsePreferences(JSON.stringify({ ...defaultPreferences, recruiterName: ' Pavan ', minExperience: 0, maxNoticeDays: 0, defaultSkills: ['Python', ' python ', 'SQL'] }));
  assert.equal(value.recruiterName, 'Pavan');
  assert.equal(value.maxNoticeDays, 0);
  assert.deepEqual(value.defaultSkills, ['Python', 'SQL']);
});
test('configuration rejects unexpected fields rather than retaining secrets', () => {
  assert.throws(() => parsePreferences(JSON.stringify({ ...defaultPreferences, password: 'never-store-this' })), /Unsupported setting/);
});
test('configuration rejects invalid numeric, URL and skill values', () => {
  for (const invalid of [{ minExperience: -1 }, { maxSalaryLpa: '20' }, { defaultSkills: 'Python' }, { linkedinProfileUrl: 'javascript:alert(1)' }, { linkedinProfileUrl: 'https://linkedin.com.evil.test/in/name' }]) {
    assert.throws(() => parsePreferences(JSON.stringify({ ...defaultPreferences, ...invalid })));
  }
  assert.throws(() => parsePreferences('null'));
  assert.throws(() => parsePreferences('{bad'));
});
