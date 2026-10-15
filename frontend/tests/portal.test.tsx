import test from "node:test";
import assert from "node:assert/strict";
import { adaptPortalResponse, demoCandidateProvider } from "../src/features/hr/portal";
import { demoPortalResponse, dataEngineerSkills } from "../src/features/hr/portal-fixture";
import { filterCandidates, evaluateCandidate } from "../src/features/hr/model";

test("portal adapter preserves salary units, unknowns and explicit resume evidence", () => {
  const candidates = adaptPortalResponse(demoPortalResponse);
  assert.equal(candidates.length, 6);
  assert.equal(evaluateCandidate(candidates[0], dataEngineerSkills).coverage, 100);
  assert.equal(candidates[0].salaryLpa, 18);
  assert.equal(candidates[0].portalProfile?.currentSalaryLpa, 14);
  assert.equal(candidates[4].salaryLpa, null);
  assert.equal(candidates[4].noticeDays, null);
  assert.equal(candidates[0].source, "sample");
  const filtered = filterCandidates(candidates, dataEngineerSkills, { skill: "", minExperience: 3, location: "", maxNoticeDays: 45, maxSalaryLpa: 20, source: "all" });
  assert.deepEqual(filtered.map(c => c.candidate.id), ["DEMO-101", "DEMO-102", "DEMO-106"]);
});

test("adapter rejects unsupported contracts, duplicate ids and invalid currency", () => {
  assert.throws(() => adaptPortalResponse({}), /Unsupported/);
  assert.throws(() => adaptPortalResponse({ ...demoPortalResponse, profiles: [demoPortalResponse.profiles[0], demoPortalResponse.profiles[0]] }), /duplicate/);
  const invalid = structuredClone(demoPortalResponse);
  (invalid.profiles[0].compensation as { currency: string }).currency = "USD";
  assert.throws(() => adaptPortalResponse(invalid), /incomplete/);
});

test("provider fetches API profiles and reports failures without substituting fixtures", async () => {
  const original = globalThis.fetch;
  try {
    let requested = "";
    globalThis.fetch = async (input) => { requested = String(input); return Response.json(demoPortalResponse); };
    assert.equal((await demoCandidateProvider.search()).length, 6);
    assert.match(requested, /api\/demo-candidates\.json$/);
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    await assert.rejects(() => demoCandidateProvider.search(), /503/);
  } finally { globalThis.fetch = original; }
});
