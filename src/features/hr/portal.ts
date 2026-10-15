import type { Candidate } from "./model";
import type { PortalProfile, PortalResponse } from "./portal-fixture";

export interface CandidateProvider {
  search(): Promise<Candidate[]>;
}

export function adaptPortalResponse(value: unknown): Candidate[] {
  const response = value as PortalResponse;
  if (!response || response.schemaVersion !== "1.0" || response.provider !== "recruiter-demo" || response.isMock !== true || !Array.isArray(response.profiles)) {
    throw new Error("Unsupported candidate response. Expected recruiter demo schema 1.0.");
  }
  const ids = new Set<string>();
  return response.profiles.map((profile: PortalProfile) => {
    const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
    const optionalNumber = (n: unknown) => n === null || finite(n);
    const text = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
    const strings = (s: unknown): s is string[] => Array.isArray(s) && s.every(text);
    if (!profile || !text(profile.candidateId) || ids.has(profile.candidateId) || !text(profile.name) || !text(profile.headline) ||
      !text(profile.currentEmployment?.designation) || !text(profile.currentEmployment?.company) || !finite(profile.experienceYears) ||
      !text(profile.currentLocation) || !strings(profile.preferredLocations) || !strings(profile.keySkills) ||
      profile.compensation?.currency !== "INR" || profile.compensation?.unit !== "LPA" ||
      !optionalNumber(profile.compensation.current) || !optionalNumber(profile.compensation.expected) || !optionalNumber(profile.noticePeriodDays) ||
      !text(profile.resume?.text) || !text(profile.resume?.fileName) || !text(profile.education) || !text(profile.updatedAt) ||
      !Array.isArray(profile.employment) || !profile.employment.every(e => text(e.company) && text(e.designation) && text(e.period) && text(e.summary))) {
      throw new Error("Candidate response contains incomplete or duplicate profiles.");
    }
    ids.add(profile.candidateId);
    return {
      id: profile.candidateId, name: profile.name, source: "sample", fileName: profile.resume.fileName,
      resumeText: profile.resume.text, yearsExperience: profile.experienceYears,
      location: profile.currentLocation, noticeDays: profile.noticePeriodDays, salaryLpa: profile.compensation.expected,
      portalProfile: { headline: profile.headline, designation: profile.currentEmployment.designation,
        company: profile.currentEmployment.company, currentSalaryLpa: profile.compensation.current,
        preferredLocations: profile.preferredLocations, keySkills: profile.keySkills,
        employment: profile.employment, education: profile.education, updatedAt: profile.updatedAt },
    };
  });
}

export const demoCandidateProvider: CandidateProvider = {
  async search() {
    const base = process.env.NEXT_PUBLIC_HR_BASE_PATH || "";
    const response = await fetch(`${base}/api/demo-candidates.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Candidate service unavailable (${response.status}). Please retry.`);
    return adaptPortalResponse(await response.json());
  },
};
