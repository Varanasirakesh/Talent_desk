import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveSkills,
  evaluateCandidate,
  filterCandidates,
  candidatesToCsv,
  buildExternalSearch,
  type Candidate,
} from "../src/features/hr/model";
import { readResume, fingerprintBytes } from "../src/features/hr/imports";

const candidate: Candidate = {
  id: "c1",
  name: "Aster Vale",
  source: "upload",
  resumeText: "Built React and TypeScript interfaces for 4 years in Pune.",
  fileName: "aster.txt",
  yearsExperience: null,
  location: null,
  noticeDays: null,
  salaryLpa: null,
};

test("JD skills are suggestions and coverage cites only explicit resume evidence", () => {
  assert.deepEqual(deriveSkills("Need React, TypeScript, and Kubernetes"), [
    "React",
    "TypeScript",
    "Kubernetes",
  ]);
  const result = evaluateCandidate(candidate, [
    "React",
    "TypeScript",
    "Kubernetes",
  ]);
  assert.equal(result.coverage, 67);
  assert.deepEqual(result.matched, ["React", "TypeScript"]);
  assert.deepEqual(result.missing, ["Kubernetes"]);
  assert.equal(
    result.evidence.React,
    "Built React and TypeScript interfaces for 4 years in Pune.",
  );
  assert.equal(result.candidate.yearsExperience, null);
});

test("evidence excerpt contains a skill found late in a long extracted line", () => {
  const long = {
    ...candidate,
    resumeText: `${"Project delivery ".repeat(30)}Kubernetes migration`,
  };
  const result = evaluateCandidate(long, ["Kubernetes"]);
  assert.equal(result.coverage, 100);
  assert.match(result.evidence.Kubernetes, /Kubernetes migration/);
});

test("filters exclude unknown constrained facts and preserve source", () => {
  assert.equal(
    filterCandidates([candidate], ["React"], {
      minExperience: 3,
      location: "",
      maxNoticeDays: null,
      maxSalaryLpa: null,
      source: "all",
      skill: "",
    }).length,
    0,
  );
  assert.equal(
    filterCandidates([candidate], ["React"], {
      minExperience: 0,
      location: "Pune",
      maxNoticeDays: null,
      maxSalaryLpa: null,
      source: "all",
      skill: "",
    }).length,
    0,
  );
  assert.equal(
    filterCandidates([candidate], ["React"], {
      minExperience: 0,
      location: "",
      maxNoticeDays: null,
      maxSalaryLpa: null,
      source: "sample",
      skill: "",
    }).length,
    0,
  );
});

test("CSV escapes fields and neutralizes spreadsheet formulas", () => {
  const csv = candidatesToCsv(
    [{ ...candidate, name: '=HYPERLINK("bad")', location: "Pune, India" }],
    ["React"],
  );
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"Pune, India"/);
  assert.match(csv, /unknown/);
});

test("external links encode a user-edited role and skills", () => {
  const links = buildExternalSearch("QA Lead", "New Delhi", [
    "Playwright",
    "API testing",
  ]);
  assert.match(links.linkedin, /QA%20Lead/);
  assert.match(links.linkedin, /New%20Delhi/);
  assert.match(links.linkedin, /\/search\/results\/people\/\?/);
  assert.match(links.boolean, /Playwright/);
  assert.match(links.naukri, /naukri\.com/);
});

test("TXT resumes use actual contents, reject empty files, and fingerprint duplicates", async () => {
  const text = new File(["React and Node.js"], "person.txt", {
    type: "text/plain",
  });
  assert.equal((await readResume(text)).text, "React and Node.js");
  const bytes = new TextEncoder().encode("React and Node.js");
  assert.equal(await fingerprintBytes(bytes), await fingerprintBytes(bytes));
  await assert.rejects(
    () => readResume(new File(["  "], "empty.md")),
    /empty|readable/i,
  );
  await assert.rejects(
    () => readResume(new File(["hi"], "person.exe")),
    /TXT|MD|PDF|DOCX/i,
  );
});
