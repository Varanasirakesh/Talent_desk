export type Candidate = {
  id: string;
  name: string;
  source: "sample" | "upload";
  resumeText: string;
  fileName: string;
  yearsExperience: number | null;
  location: string | null;
  noticeDays: number | null;
  salaryLpa: number | null;
  originalFile?: File;
  fingerprint?: string;
  portalProfile?: {
    headline: string;
    designation: string;
    company: string;
    currentSalaryLpa: number | null;
    preferredLocations: string[];
    keySkills: string[];
    employment: { company: string; designation: string; period: string; summary: string }[];
    education: string;
    updatedAt: string;
  };
};

export type CandidateResult = {
  candidate: Candidate;
  coverage: number;
  matched: string[];
  missing: string[];
  evidence: Record<string, string>;
};

export type CandidateFilters = {
  skill: string;
  minExperience: number;
  location: string;
  maxNoticeDays: number | null;
  maxSalaryLpa: number | null;
  source: "all" | Candidate["source"];
};

const dictionary: Record<string, string[]> = {
  React: ["react", "react.js", "reactjs"],
  TypeScript: ["typescript"],
  JavaScript: ["javascript"],
  Python: ["python"],
  Spark: ["spark", "pyspark"],
  dbt: ["dbt"],
  Airflow: ["airflow"],
  Snowflake: ["snowflake"],
  "Data modelling": ["data modelling", "data modeling", "dimensional modelling", "dimensional modeling"],
  "Data analytics": ["data analytics", "analytics", "analytical"],
  Java: ["java"],
  "Node.js": ["node.js", "nodejs"],
  SQL: ["sql"],
  AWS: ["aws", "amazon web services"],
  Azure: ["azure"],
  Docker: ["docker"],
  Kubernetes: ["kubernetes", "k8s"],
  Playwright: ["playwright"],
  Selenium: ["selenium"],
  "API testing": ["api testing", "api tests", "rest api testing"],
  Figma: ["figma"],
  "User research": ["user research"],
  Excel: ["excel"],
  PowerBI: ["power bi", "powerbi"],
  Tableau: ["tableau"],
  "Project management": ["project management"],
  "Stakeholder management": ["stakeholder management"],
  "Financial analysis": ["financial analysis"],
  "Content strategy": ["content strategy"],
  SEO: ["seo", "search engine optimization"],
};

function evidenceLine(text: string, term: string): string | null {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const match = pattern.exec(line);
    if (!match) continue;
    if (line.length <= 220) return line;
    const start = Math.max(0, match.index - 80);
    const end = Math.min(line.length, match.index + match[0].length + 110);
    return `${start ? "…" : ""}${line.slice(start, end)}${end < line.length ? "…" : ""}`;
  }
  return null;
}

export function deriveSkills(jd: string): string[] {
  return Object.entries(dictionary)
    .filter(([, aliases]) => aliases.some((alias) => evidenceLine(jd, alias)))
    .map(([skill]) => skill);
}

export function evaluateCandidate(
  candidate: Candidate,
  requiredSkills: string[],
): CandidateResult {
  const matched: string[] = [];
  const missing: string[] = [];
  const evidence: Record<string, string> = {};
  for (const skill of requiredSkills) {
    const aliases = dictionary[skill] ?? [skill];
    const line = aliases
      .map((alias) => evidenceLine(candidate.resumeText, alias))
      .find(Boolean);
    if (line) {
      matched.push(skill);
      evidence[skill] = line;
    } else missing.push(skill);
  }
  return {
    candidate,
    coverage: requiredSkills.length
      ? Math.round((matched.length / requiredSkills.length) * 100)
      : 0,
    matched,
    missing,
    evidence,
  };
}

export function filterCandidates(
  candidates: Candidate[],
  skills: string[],
  filters: CandidateFilters,
): CandidateResult[] {
  return candidates
    .map((candidate) => evaluateCandidate(candidate, skills))
    .filter(({ candidate, matched }) => {
      if (filters.source !== "all" && candidate.source !== filters.source)
        return false;
      if (
        filters.skill &&
        !matched.some(
          (skill) => skill.toLowerCase() === filters.skill.toLowerCase(),
        )
      )
        return false;
      if (
        filters.minExperience > 0 &&
        (candidate.yearsExperience === null ||
          candidate.yearsExperience < filters.minExperience)
      )
        return false;
      if (
        filters.location &&
        !candidate.location
          ?.toLowerCase()
          .includes(filters.location.trim().toLowerCase())
      )
        return false;
      if (
        filters.maxNoticeDays !== null &&
        (candidate.noticeDays === null ||
          candidate.noticeDays > filters.maxNoticeDays)
      )
        return false;
      if (
        filters.maxSalaryLpa !== null &&
        (candidate.salaryLpa === null ||
          candidate.salaryLpa > filters.maxSalaryLpa)
      )
        return false;
      return true;
    });
}

function csvCell(value: unknown): string {
  let text =
    value === null || value === undefined || value === ""
      ? "unknown"
      : String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function candidatesToCsv(
  candidates: Candidate[],
  skills: string[],
  jobId = "",
): string {
  const headers = [
    "Job ID",
    "Candidate",
    "Source",
    "Required skill coverage",
    "Matched skills",
    "Missing skills",
    "Experience years",
    "Location",
    "Notice days",
    "Salary LPA",
    "Resume file",
  ];
  const rows = candidates.map((candidate) => {
    const result = evaluateCandidate(candidate, skills);
    return [
      jobId,
      candidate.name,
      candidate.source,
      `${result.coverage}%`,
      result.matched.join("; "),
      result.missing.join("; "),
      candidate.yearsExperience,
      candidate.location,
      candidate.noticeDays,
      candidate.salaryLpa,
      candidate.fileName,
    ];
  });
  return (
    [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}

export function buildExternalSearch(
  role: string,
  location: string,
  skills: string[],
) {
  const terms = [role.trim(), ...skills.filter(Boolean), location.trim()]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams();
  params.set("keywords", terms);
  const linkedin = `https://www.linkedin.com/search/results/people/?${params.toString().replace(/\+/g, "%20")}`;
  const boolean = [
    role.trim() && `"${role.trim().replace(/"/g, "")}"`,
    ...skills.filter(Boolean).map((skill) => `"${skill.replace(/"/g, "")}"`),
  ]
    .filter(Boolean)
    .join(" AND ");
  return { linkedin, naukri: "https://recruit.naukri.com/", boolean };
}

export function interviewQuestions(
  skills: string[],
  result: CandidateResult,
): string[] {
  const focus = [...result.matched.slice(0, 2), ...result.missing.slice(0, 2)];
  return focus.length
    ? focus.map((skill) =>
        result.matched.includes(skill)
          ? `Ask for a concrete example of ${skill} work, their contribution, and the outcome. Resume evidence: ${result.evidence[skill]}`
          : `Ask whether they have used ${skill}; request a specific example. No evidence found in the supplied resume.`,
      )
    : [
        "Ask about the role's core tasks and request a concrete work example. Add required skills to make these prompts specific.",
      ];
}
