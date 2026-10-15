"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { HrSettings } from "./settings";
import { defaultPreferences, type HrPreferences } from "./preferences";
import { readResume } from "./imports";
import { demoCandidateProvider } from "./portal";
import { dataEngineerJd, dataEngineerSkills } from "./portal-fixture";
import {
  buildExternalSearch,
  candidatesToCsv,
  deriveSkills,
  evaluateCandidate,
  filterCandidates,
  interviewQuestions,
  type Candidate,
  type CandidateFilters,
} from "./model";

const sampleCandidates: Candidate[] = [
  {
    id: "sample-1",
    name: "Aarav Mehta",
    source: "sample",
    fileName: "aarav-mehta-sample.txt",
    resumeText:
      "Fictional sample resume — Aarav Mehta\n5 years building React and TypeScript interfaces. Used Node.js and SQL in product teams.\nLocation: Bengaluru. Notice period: 30 days. Expected salary: ₹18 LPA.",
    yearsExperience: 5,
    location: "Bengaluru",
    noticeDays: 30,
    salaryLpa: 18,
  },
  {
    id: "sample-2",
    name: "Mira Sen",
    source: "sample",
    fileName: "mira-sen-sample.txt",
    resumeText:
      "Fictional sample resume — Mira Sen\n7 years in QA. Designed Playwright and API testing suites; led stakeholder reviews.\nLocation: Pune. Notice period: 45 days. Expected salary: ₹23 LPA.",
    yearsExperience: 7,
    location: "Pune",
    noticeDays: 45,
    salaryLpa: 23,
  },
  {
    id: "sample-3",
    name: "Nisha Rao",
    source: "sample",
    fileName: "nisha-rao-sample.txt",
    resumeText:
      "Fictional sample resume — Nisha Rao\n4 years in design. Figma prototypes, user research interviews and content strategy.\nLocation: Hyderabad. Notice period: 15 days. Expected salary: ₹16 LPA.",
    yearsExperience: 4,
    location: "Hyderabad",
    noticeDays: 15,
    salaryLpa: 16,
  },
  {
    id: "sample-4",
    name: "Dev Iyer",
    source: "sample",
    fileName: "dev-iyer-sample.txt",
    resumeText:
      "Fictional sample resume — Dev Iyer\n9 years in platform engineering. Python, AWS, Docker and Kubernetes delivery.\nLocation: Chennai. Notice period: 60 days. Expected salary: ₹32 LPA.",
    yearsExperience: 9,
    location: "Chennai",
    noticeDays: 60,
    salaryLpa: 32,
  },
];

type OnboardingTask = {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  candidateId: string;
  status: "todo" | "progress" | "done";
};

type HiringJob = {
  id: string;
  title: string;
  location: string;
  jd: string;
  skills: string[];
  analyzedJd: string | null;
  analysisStale: boolean;
  candidates: Candidate[];
  filters: CandidateFilters;
  sort: "coverage" | "name" | "experience";
  shortlist: string[];
  tasks: OnboardingTask[];
  requirements: {
    minExperience: number | null;
    maxExperience: number | null;
    salaryMinLpa: number | null;
    salaryMaxLpa: number | null;
    maxNoticeDays: number | null;
  };
};

const sampleJd =
  "Senior Frontend Engineer. Build React and TypeScript interfaces, collaborate on API testing, and improve accessibility. Experience with Node.js and SQL is useful.";

const emptyFilters: CandidateFilters = {
  skill: "",
  minExperience: 0,
  location: "",
  maxNoticeDays: null,
  maxSalaryLpa: null,
  source: "all",
};

function makeHiringJob(
  id: string,
  title: string,
  location: string,
  jd: string,
): HiringJob {
  return {
    id,
    title,
    location,
    jd,
    skills: deriveSkills(jd),
    analyzedJd: jd,
    analysisStale: false,
    candidates: [],
    filters: { ...emptyFilters },
    sort: "coverage",
    shortlist: [],
    tasks: [],
    requirements: {
      minExperience: null,
      maxExperience: null,
      salaryMinLpa: null,
      salaryMaxLpa: null,
      maxNoticeDays: null,
    },
  };
}

function dueFrom(joiningDate: string, offset: number) {
  const date = new Date(`${joiningDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function HrDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute("open", "");
    return () => {
      if (dialog?.open && dialog.close) dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="hr-modal hr-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function display(value: number | string | null, suffix = "") {
  return value === null || value === "" ? "Unknown" : `${value}${suffix}`;
}

export function HrWorkspace() {
  const [jobs, setJobs] = useState<HiringJob[]>(() => [
    {
      ...makeHiringJob(
        "HR-DEMO-001",
        "Data Engineer — Analytics Platform",
        "Hyderabad",
        dataEngineerJd,
      ),
      skills: [...dataEngineerSkills],
      requirements: {
        minExperience: 3,
        maxExperience: 5,
        salaryMinLpa: 12,
        salaryMaxLpa: 20,
        maxNoticeDays: 45,
      },
    },
  ]);
  const [activeJobId, setActiveJobId] = useState("HR-DEMO-001");
  const activeJobRef = useRef(activeJobId);
  activeJobRef.current = activeJobId;
  const [step, setStep] = useState(1);
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftJd, setDraftJd] = useState("");
  const [draftSkills, setDraftSkills] = useState<string[]>([]);
  const [draftSkill, setDraftSkill] = useState("");
  const [draftRequirements, setDraftRequirements] = useState<
    HiringJob["requirements"]
  >({
    minExperience: null,
    maxExperience: null,
    salaryMinLpa: null,
    salaryMaxLpa: null,
    maxNoticeDays: null,
  });
  const activeJob = jobs.find((job) => job.id === activeJobId);
  const [profilePreferences, setProfilePreferences] = useState<HrPreferences>({
    ...defaultPreferences,
  });
  const selectedJobPreferences = activeJob
    ? {
        ...profilePreferences,
        defaultRole: activeJob.title,
        defaultLocation: activeJob.location,
        defaultSkills: activeJob.skills,
        minExperience: activeJob.filters.minExperience,
        maxNoticeDays: activeJob.filters.maxNoticeDays,
        maxSalaryLpa: activeJob.filters.maxSalaryLpa,
      }
    : profilePreferences;
  const jd = activeJob?.jd ?? "";
  const role = activeJob?.title ?? "";
  const location = activeJob?.location ?? "";
  const skills = activeJob?.skills ?? [];
  const analyzedJd = activeJob?.analyzedJd ?? null;
  const analysisStale = activeJob?.analysisStale ?? false;
  const candidates = activeJob?.candidates ?? [];
  const filters = activeJob?.filters ?? emptyFilters;
  const sort = activeJob?.sort ?? "coverage";
  const shortlist = activeJob?.shortlist ?? [];
  const tasks = activeJob?.tasks ?? [];
  const [skillDraft, setSkillDraft] = useState("");
  const importBusy = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const portalBusy = useRef(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskOwner, setTaskOwner] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [taskCandidate, setTaskCandidate] = useState("");
  const [checklistCandidate, setChecklistCandidate] = useState("");
  const [checklistOwner, setChecklistOwner] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateActiveJob(
    patch: Partial<HiringJob> | ((job: HiringJob) => Partial<HiringJob>),
  ) {
    if (!activeJobId) return;
    setJobs((current) =>
      current.map((job) =>
        job.id === activeJobId
          ? { ...job, ...(typeof patch === "function" ? patch(job) : patch) }
          : job,
      ),
    );
  }
  const setJd = (jd: string) => updateActiveJob({ jd });
  const setRole = (title: string) => updateActiveJob({ title });
  const setLocation = (location: string) => updateActiveJob({ location });
  const setAnalyzedJd = (analyzedJd: string | null) =>
    updateActiveJob({ analyzedJd });
  const setAnalysisStale = (analysisStale: boolean) =>
    updateActiveJob({ analysisStale });
  const setSkills = (next: string[] | ((current: string[]) => string[])) =>
    updateActiveJob((job) => ({
      skills: typeof next === "function" ? next(job.skills) : next,
    }));
  const setCandidates = (
    next: Candidate[] | ((current: Candidate[]) => Candidate[]),
    jobId = activeJobId,
  ) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              candidates:
                typeof next === "function" ? next(job.candidates) : next,
            }
          : job,
      ),
    );
  };
  const setFilters = (
    next: CandidateFilters | ((current: CandidateFilters) => CandidateFilters),
  ) =>
    updateActiveJob((job) => ({
      filters: typeof next === "function" ? next(job.filters) : next,
    }));
  const setSort = (sort: HiringJob["sort"]) => updateActiveJob({ sort });
  const setShortlist = (next: string[] | ((current: string[]) => string[])) =>
    updateActiveJob((job) => ({
      shortlist: typeof next === "function" ? next(job.shortlist) : next,
    }));
  const setTasks = (
    next: OnboardingTask[] | ((current: OnboardingTask[]) => OnboardingTask[]),
  ) =>
    updateActiveJob((job) => ({
      tasks: typeof next === "function" ? next(job.tasks) : next,
    }));

  const results = useMemo(
    () =>
      filterCandidates(candidates, skills, filters).sort((a, b) => {
        if (sort === "name")
          return a.candidate.name.localeCompare(b.candidate.name);
        if (sort === "experience")
          return (
            (b.candidate.yearsExperience ?? -1) -
            (a.candidate.yearsExperience ?? -1)
          );
        return (
          b.coverage - a.coverage ||
          a.candidate.name.localeCompare(b.candidate.name)
        );
      }),
    [candidates, skills, filters, sort],
  );
  const shortlisted = shortlist
    .map((id) => candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Candidate => Boolean(candidate));
  const preview = candidates.find((candidate) => candidate.id === previewId);
  const questionCandidate = candidates.find(
    (candidate) => candidate.id === questionId,
  );
  const external = buildExternalSearch(role, location, skills);
  const completedTasks = tasks.filter((task) => task.status === "done").length;

  function updateFilter<K extends keyof CandidateFilters>(
    key: K,
    value: CandidateFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  function applyPreferences(preferences: HrPreferences) {
    setProfilePreferences((current) => ({
      ...current,
      recruiterName: preferences.recruiterName,
      company: preferences.company,
      linkedinProfileUrl: preferences.linkedinProfileUrl,
    }));
    if (!activeJob) {
      setDraftTitle(preferences.defaultRole);
      setDraftLocation(preferences.defaultLocation);
      setDraftSkills(preferences.defaultSkills);
    } else {
      setRole(preferences.defaultRole);
      setLocation(preferences.defaultLocation);
      setSkills(preferences.defaultSkills);
    }
    setFilters((current) => ({
      ...current,
      skill: preferences.defaultSkills.includes(current.skill)
        ? current.skill
        : "",
    }));
    setTaskOwner(preferences.recruiterName);
    setChecklistOwner(preferences.recruiterName);
    setFilters((current) => ({
      ...current,
      minExperience: preferences.minExperience,
      maxNoticeDays: preferences.maxNoticeDays,
      maxSalaryLpa: preferences.maxSalaryLpa,
      location: preferences.defaultLocation,
    }));
    setMessage(
      "Hiring settings applied to this session. Review the criteria against your job description.",
    );
  }
  function analyse() {
    if (!activeJob) {
      setError("Choose or create a job before reviewing its role details.");
      return;
    }
    if (!jd.trim()) {
      setError("Paste a job description before analysing it.");
      return;
    }
    const inferred = deriveSkills(jd);
    setSkills(inferred);
    setFilters((current) => ({
      ...current,
      skill: inferred.includes(current.skill) ? current.skill : "",
    }));
    setAnalyzedJd(jd);
    setAnalysisStale(false);
    setError("");
    setMessage(
      inferred.length
        ? `Found ${inferred.length} skill suggestion${inferred.length === 1 ? "" : "s"}. Edit the list before reviewing.`
        : "No dictionary skills found. Add the role's required skills manually.",
    );
  }
  function addSkill() {
    const value = skillDraft.trim();
    if (!value) return;
    if (!skills.some((skill) => skill.toLowerCase() === value.toLowerCase()))
      setSkills([...skills, value]);
    setSkillDraft("");
  }
  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const importJobId = activeJobId;
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (importBusy.current) {
      setError("Finish the current import before choosing more files.");
      return;
    }
    importBusy.current = true;
    setUploading(true);
    const existing = new Set(
      activeJob?.candidates
        .map((candidate) => candidate.fingerprint)
        .filter(Boolean),
    );
    const imported: Candidate[] = [];
    const problems: string[] = [];
    try {
      for (const file of files) {
        try {
          const parsed = await readResume(file);
          if (existing.has(parsed.fingerprint)) {
            problems.push(`${file.name}: duplicate resume skipped.`);
            continue;
          }
          existing.add(parsed.fingerprint);
          imported.push({
            id: crypto.randomUUID(),
            name: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
            source: "upload",
            resumeText: parsed.text,
            fileName: file.name,
            originalFile: file,
            fingerprint: parsed.fingerprint,
            yearsExperience: null,
            location: null,
            noticeDays: null,
            salaryLpa: null,
          });
        } catch (cause) {
          problems.push(
            `${file.name}: ${cause instanceof Error ? cause.message : "Could not read this file."}`,
          );
        }
      }
      if (imported.length)
        setCandidates((current) => [...current, ...imported], importJobId);
      setMessage(
        imported.length
          ? `${imported.length} resume${imported.length === 1 ? "" : "s"} imported into this browser session. Verify and edit unknown details.`
          : "",
      );
      setError(problems.join(" "));
    } finally {
      importBusy.current = false;
      setUploading(false);
    }
  }
  function patchCandidate(id: string, patch: Partial<Candidate>) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, ...patch } : candidate,
      ),
    );
  }
  async function loadPortalCandidates() {
    if (!activeJobId || portalBusy.current) return;
    const jobId = activeJobId;
    portalBusy.current = true;
    setPortalLoading(true);
    setError("");
    try {
      const profiles = await demoCandidateProvider.search();
      setCandidates(
        (current) => [
          ...current,
          ...profiles.filter((p) => !current.some((c) => c.id === p.id)),
        ],
        jobId,
      );
      if (activeJobRef.current === jobId) {
        setMessage(
          `${profiles.length} fictional portal profiles retrieved for ${jobId}. Repeated searches do not duplicate profiles.`,
        );
        setStep(3);
      }
    } catch (cause) {
      if (activeJobRef.current === jobId)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load demo profiles. Please retry.",
        );
    } finally {
      portalBusy.current = false;
      setPortalLoading(false);
    }
  }
  function downloadResume(candidate: Candidate) {
    download(
      candidate.originalFile ??
        new Blob([candidate.resumeText], { type: "text/plain;charset=utf-8" }),
      candidate.fileName,
    );
  }
  function exportShortlist() {
    if (!shortlisted.length) return;
    download(
      new Blob(["\uFEFF", candidatesToCsv(shortlisted, skills, activeJobId)], {
        type: "text/csv;charset=utf-8",
      }),
      `shortlist-${activeJobId.toLowerCase()}.csv`,
    );
  }
  async function copyBoolean() {
    try {
      await navigator.clipboard.writeText(external.boolean);
      setMessage(
        "Boolean query copied. Paste it into your recruiter search field.",
      );
    } catch {
      setError(
        "Clipboard access was unavailable. Select and copy the query below.",
      );
    }
  }
  function addTask() {
    if (!activeJob) return;
    if (!taskTitle.trim() || !taskOwner.trim() || !taskDate) {
      setError("Enter a task, owner and due date.");
      return;
    }
    setTasks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: taskTitle.trim(),
        owner: taskOwner.trim(),
        dueDate: taskDate,
        candidateId: taskCandidate,
        status: "todo",
      },
    ]);
    setTaskTitle("");
    setTaskOwner("");
    setTaskDate("");
    setError("");
  }
  function addChecklist() {
    if (!activeJob) return;
    const candidateId = checklistCandidate || shortlist[0];
    if (!candidateId || !checklistOwner.trim() || !joiningDate) {
      setError(
        "Choose a shortlisted candidate, checklist owner and joining date.",
      );
      return;
    }
    const items = [
      ["Verify documents", -7],
      ["Prepare equipment", -3],
      ["Arrange account access", -1],
      ["Schedule induction", 0],
    ] as const;
    setTasks((current) => [
      ...current,
      ...items.map(([title, offset]) => ({
        id: crypto.randomUUID(),
        title,
        owner: checklistOwner.trim(),
        dueDate: dueFrom(joiningDate, offset),
        candidateId,
        status: "todo" as const,
      })),
    ]);
    setError("");
    setMessage(
      "Four starter tasks added. Review each owner and date before sharing.",
    );
  }
  function exportTasks() {
    if (!activeJob || !tasks.length) return;
    const rows = tasks.map((task) => ({
      task: task.title,
      owner: task.owner,
      dueDate: task.dueDate,
      status: task.status,
      candidate:
        candidates.find((candidate) => candidate.id === task.candidateId)
          ?.name ?? null,
    }));
    download(
      new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              jobId: activeJob.id,
              jobTitle: activeJob.title,
              tasks: rows,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      `onboarding-tasks-${activeJob.id.toLowerCase()}.json`,
    );
  }

  function createJob() {
    const title = draftTitle.trim();
    const description = draftJd.trim();
    if (!title || !description) {
      setError("Add a role title and job description before creating the job.");
      return;
    }
    let sequence = jobs.length + 1;
    let id = "";
    do {
      id = `HR-${new Date().getFullYear()}-${String(sequence++).padStart(3, "0")}`;
    } while (jobs.some((job) => job.id === id));
    const job = makeHiringJob(id, title, draftLocation.trim(), description);
    if (draftSkills.length) job.skills = [...new Set(draftSkills)];
    job.requirements = { ...draftRequirements };
    setJobs((current) => [...current, job]);
    setActiveJobId(job.id);
    setStep(1);
    setCreateJobOpen(false);
    setDraftTitle("");
    setDraftLocation("");
    setDraftJd("");
    setDraftSkills([]);
    setDraftSkill("");
    setDraftRequirements({
      minExperience: null,
      maxExperience: null,
      salaryMinLpa: null,
      salaryMaxLpa: null,
      maxNoticeDays: null,
    });
    setError("");
    setMessage(
      `${job.id} created. Review the requisition, then continue to candidate sourcing when ready.`,
    );
  }

  function addDraftSkill() {
    const value = draftSkill.trim();
    if (!value) return;
    setDraftSkills((current) =>
      current.some((skill) => skill.toLowerCase() === value.toLowerCase())
        ? current
        : [...current, value],
    );
    setDraftSkill("");
  }

  function selectJob(id: string) {
    setActiveJobId(id);
    setStep(1);
    setCreateJobOpen(false);
    setSkillDraft("");
    setPreviewId(null);
    setQuestionId(null);
    setError("");
    setMessage("");
  }

  return (
    <div className="hr-workspace">
      <header className="hr-flow-heading">
        <div>
          <span className="hr-kicker">TALENT DESK / HIRING WORKSPACE</span>
          <h1>{step === 1 ? "Choose a job to get started." : role}</h1>
          <p>
            {step === 1
              ? "Keep each role, its candidates, and onboarding plan together."
              : "Work through the hiring steps for this requisition."}
          </p>
        </div>
        {activeJob && step > 1 && (
          <div className="hr-active-job-badge">
            <span>JOB ID</span>
            <strong>{activeJob.id}</strong>
            <button className="hr-inline-button" onClick={() => setStep(1)}>
              Change job
            </button>
          </div>
        )}
      </header>

      <ol className="hr-steps" aria-label="Hiring workflow">
        {[
          "Select a job",
          "Add candidates",
          "Review & shortlist",
          "Onboarding",
        ].map((label, index) => (
          <li
            key={label}
            className={
              step === index + 1
                ? "current"
                : step > index + 1
                  ? "complete"
                  : ""
            }
            aria-current={step === index + 1 ? "step" : undefined}
          >
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{label}</span>
          </li>
        ))}
      </ol>
      {activeJob && !createJobOpen && (
        <HrSettings
          key={activeJob.id}
          jobId={activeJob.id}
          jobTitle={activeJob.title}
          initialValue={selectedJobPreferences}
          onApply={applyPreferences}
        />
      )}
      {(message || error) && (
        <div className="hr-messages">
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
        </div>
      )}

      {step === 1 && (
        <section id="hr-role" className="hr-section">
          <div className="hr-section-heading">
            <div>
              <span className="hr-kicker">01 / SELECT A JOB ID</span>
              <h2>Which role are you hiring for?</h2>
              <p>
                Choose a requisition to continue. Every resume and next step
                will stay with that job.
              </p>
            </div>
            <span className="hr-counter">01</span>
          </div>

          <div className="hr-job-pick-layout">
            <div className="hr-surface hr-job-picker">
              <div className="hr-surface-head">
                <div>
                  <h3>Your open jobs</h3>
                  <small>Created in this browser session</small>
                </div>
                <button
                  className="btn secondary small"
                  onClick={() => {
                    setCreateJobOpen(true);
                    setDraftTitle("");
                    setDraftLocation("");
                    setDraftJd("");
                    setDraftSkills([]);
                    setDraftSkill("");
                    setDraftRequirements({
                      minExperience: null,
                      maxExperience: null,
                      salaryMinLpa: null,
                      salaryMaxLpa: null,
                      maxNoticeDays: null,
                    });
                  }}
                >
                  Add a job
                </button>
              </div>
              {jobs.length ? (
                <div className="hr-job-list" aria-label="Choose a job ID">
                  {jobs.map((job) => (
                    <button
                      className={`hr-job-option${activeJobId === job.id ? " selected" : ""}`}
                      key={job.id}
                      aria-pressed={activeJobId === job.id}
                      onClick={() => selectJob(job.id)}
                    >
                      <span>{job.id}</span>
                      <strong>{job.title}</strong>
                      <small>
                        {job.location || "Location not set"} ·{" "}
                        {job.candidates.length} candidates
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="hr-helper hr-no-jobs">
                  Your job list is empty. Add a role to receive its Job ID and
                  begin reviewing candidates.
                </p>
              )}
            </div>

            {createJobOpen && (
              <div className="hr-surface hr-new-job">
                <div className="hr-surface-head">
                  <div>
                    <h3>Create a requisition</h3>
                    <small>Talent Desk will assign the Job ID</small>
                  </div>
                </div>
                <div className="hr-field-grid">
                  <label>
                    Role title
                    <input
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      placeholder="e.g. Senior QA Engineer"
                    />
                  </label>
                  <label>
                    Location
                    <input
                      value={draftLocation}
                      onChange={(event) => setDraftLocation(event.target.value)}
                      placeholder="e.g. Bengaluru"
                    />
                  </label>
                </div>
                <div className="hr-field-grid hr-requirement-inputs">
                  {(
                    [
                      ["minExperience", "Required experience minimum · years"],
                      ["maxExperience", "Required experience maximum · years"],
                      ["salaryMinLpa", "Budget minimum · ₹ LPA"],
                      ["salaryMaxLpa", "Budget maximum · ₹ LPA"],
                      ["maxNoticeDays", "Target notice period · days"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        min="0"
                        step={key === "maxNoticeDays" ? "1" : "0.5"}
                        value={draftRequirements[key] ?? ""}
                        placeholder="Not specified"
                        onChange={(event) =>
                          setDraftRequirements((current) => ({
                            ...current,
                            [key]:
                              event.target.value === ""
                                ? null
                                : Math.max(0, Number(event.target.value)),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Job description
                  <textarea
                    aria-label="New job description"
                    value={draftJd}
                    onChange={(event) => setDraftJd(event.target.value)}
                    placeholder="Paste the responsibilities and requirements for this role…"
                    rows={6}
                  />
                </label>
                <div className="hr-draft-skills">
                  <label>
                    Required skills / search keywords
                    <input
                      aria-label="Add requisition skill"
                      value={draftSkill}
                      onChange={(event) => setDraftSkill(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addDraftSkill();
                        }
                      }}
                      placeholder="e.g. Python, React, SQL"
                    />
                  </label>
                  <button
                    className="btn secondary small"
                    type="button"
                    onClick={addDraftSkill}
                  >
                    Add skill
                  </button>
                  {draftSkills.length > 0 && (
                    <div
                      className="hr-skill-list"
                      aria-label="Requisition skills"
                    >
                      {draftSkills.map((skill) => (
                        <span className="hr-skill" key={skill}>
                          {skill}
                          <button
                            type="button"
                            aria-label={`Remove ${skill}`}
                            onClick={() =>
                              setDraftSkills((current) =>
                                current.filter((item) => item !== skill),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="hr-note">
                    Add the keywords HR wants to use now. AI suggestions will be
                    added to this same list later.
                  </p>
                </div>
                <div className="hr-jd-actions">
                  <button className="btn" onClick={createJob}>
                    Create job ID
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setDraftTitle("Senior Frontend Engineer");
                      setDraftLocation("Bengaluru");
                      setDraftJd(sampleJd);
                      setDraftSkills(deriveSkills(sampleJd));
                      setDraftSkill("");
                      setDraftRequirements({
                        minExperience: 4,
                        maxExperience: 7,
                        salaryMinLpa: 15,
                        salaryMaxLpa: 25,
                        maxNoticeDays: 45,
                      });
                      setError("");
                    }}
                  >
                    Use sample role
                  </button>
                  {activeJob && (
                    <button
                      className="hr-inline-button"
                      onClick={() => setCreateJobOpen(false)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <p className="hr-note">
                  Job details and candidate files stay in this browser session.
                </p>
              </div>
            )}
          </div>

          {activeJob && !createJobOpen && (
            <>
              <div className="hr-selected-job-line">
                <span>Selected requisition</span>
                <strong>{activeJob.id}</strong>
                <span>{activeJob.title}</span>
              </div>
              <div className="hr-role-grid">
                <div className="hr-surface hr-jd">
                  <div className="hr-surface-head">
                    <h3>Job brief</h3>
                    <small>For {activeJob.id}</small>
                  </div>
                  {activeJob.id === "HR-DEMO-001" && (
                    <div className="hr-portal-role">
                      <span className="hr-source-label">DEMO REQUISITION</span>
                      <div className="hr-portal-facts">
                        <span>
                          {display(activeJob.requirements.minExperience)}–
                          {display(activeJob.requirements.maxExperience)} years
                        </span>
                        <span>
                          ₹{display(activeJob.requirements.salaryMinLpa)}–
                          {display(activeJob.requirements.salaryMaxLpa)} LPA
                        </span>
                        <span>{activeJob.location} · Hybrid</span>
                        <span>Full-time</span>
                        <span>
                          Notice ≤
                          {display(activeJob.requirements.maxNoticeDays)} days
                        </span>
                      </div>
                      <p>
                        Build trusted data pipelines and turn business questions
                        into reliable analytical datasets.
                      </p>
                      <button
                        className="btn small"
                        disabled={portalLoading}
                        onClick={loadPortalCandidates}
                      >
                        {portalLoading
                          ? "Fetching profiles…"
                          : "Find demo candidates"}
                      </button>
                    </div>
                  )}
                  <div className="hr-field-grid">
                    <label>
                      Role title
                      <input
                        value={role}
                        onChange={(event) => setRole(event.target.value)}
                        placeholder="e.g. Senior QA Engineer"
                      />
                    </label>
                    <label>
                      Location for external search
                      <input
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="e.g. Bengaluru"
                      />
                    </label>
                  </div>
                  <div className="hr-field-grid hr-requirement-inputs">
                    {(
                      [
                        [
                          "minExperience",
                          "Required experience minimum · years",
                        ],
                        [
                          "maxExperience",
                          "Required experience maximum · years",
                        ],
                        ["salaryMinLpa", "Budget minimum · ₹ LPA"],
                        ["salaryMaxLpa", "Budget maximum · ₹ LPA"],
                        ["maxNoticeDays", "Target notice period · days"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          min="0"
                          step={key === "maxNoticeDays" ? "1" : "0.5"}
                          value={activeJob.requirements[key] ?? ""}
                          placeholder="Not specified"
                          onChange={(event) =>
                            updateActiveJob({
                              requirements: {
                                ...activeJob.requirements,
                                [key]:
                                  event.target.value === ""
                                    ? null
                                    : Math.max(0, Number(event.target.value)),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label>
                    Job description
                    <textarea
                      aria-label="Job description"
                      value={jd}
                      onChange={(event) => {
                        setJd(event.target.value);
                        if (
                          analyzedJd !== null &&
                          event.target.value !== analyzedJd
                        ) {
                          setAnalysisStale(true);
                          setAnalyzedJd(null);
                          setSkills([]);
                          setFilters((current) => ({ ...current, skill: "" }));
                        }
                      }}
                      placeholder="Paste responsibilities and requirements here…"
                      rows={7}
                    />
                  </label>
                  <div className="hr-jd-actions">
                    <button className="btn" onClick={analyse}>
                      Analyse job description
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setJd(sampleJd);
                        setRole("Senior Frontend Engineer");
                        setSkills(deriveSkills(sampleJd));
                        setFilters((current) => ({
                          ...current,
                          skill: deriveSkills(sampleJd).includes(current.skill)
                            ? current.skill
                            : "",
                        }));
                        setAnalyzedJd(sampleJd);
                        setAnalysisStale(false);
                        setError("");
                        setMessage(
                          "Sample job description loaded. Review its suggested skills.",
                        );
                      }}
                    >
                      Use sample job description
                    </button>
                  </div>
                  {analysisStale && (
                    <p className="hr-warning">
                      Job description changed. Run analysis again to refresh
                      skills and coverage.
                    </p>
                  )}
                </div>
                <div className="hr-surface hr-criteria">
                  <div className="hr-surface-head">
                    <h3>Required skills</h3>
                    <small>Human editable</small>
                  </div>
                  <p className="hr-helper">
                    {analyzedJd
                      ? `Required skills: ${skills.length ? skills.join(", ") : "none yet"}`
                      : "Analyse a job description, then review or add required skills."}
                  </p>
                  <div className="hr-skill-list">
                    {skills.map((skill) => (
                      <span className="hr-skill" key={skill}>
                        {skill}
                        <button
                          type="button"
                          aria-label={`Remove ${skill}`}
                          onClick={() => {
                            setSkills((current) =>
                              current.filter((item) => item !== skill),
                            );
                            setFilters((current) => ({
                              ...current,
                              skill:
                                current.skill === skill ? "" : current.skill,
                            }));
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="hr-add-skill">
                    <input
                      aria-label="Add required skill"
                      value={skillDraft}
                      onChange={(event) => setSkillDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="Add a skill or tool"
                    />
                    <button className="btn secondary small" onClick={addSkill}>
                      Add skill
                    </button>
                  </div>
                  <p className="hr-note">
                    Coverage counts explicit mentions only. A missing mention is
                    a review prompt, not proof of missing ability.
                  </p>
                </div>
              </div>
              <div className="hr-wizard-actions">
                <span>
                  Review the role and skills, then continue to candidate
                  sourcing.
                </span>
                <button
                  className="btn"
                  onClick={() => {
                    setStep(2);
                    setMessage("");
                  }}
                >
                  Continue to candidates <span aria-hidden>→</span>
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 2 && (
        <section id="hr-candidates" className="hr-section">
          <div className="hr-section-heading">
            <div>
              <span className="hr-kicker">02 / BUILD THE POOL</span>
              <h2>Bring candidates into view.</h2>
              <p>
                Use fictional examples or files you choose from your device.
                Nothing is fetched or saved remotely.
              </p>
            </div>
            <span className="hr-counter">02</span>
          </div>
          <div className="hr-source-grid">
            <button
              className="hr-source-card hr-portal-source"
              disabled={portalLoading}
              onClick={loadPortalCandidates}
            >
              <span>API</span>
              <strong>Recruiter portal demo</strong>
              <small>
                Six fictional profiles with role, experience, CTC, notice,
                skills and career history. Loaded through the mock API.
              </small>
              <b>
                {portalLoading ? "Fetching profiles…" : "Fetch demo profiles ↗"}
              </b>
            </button>
            <button
              className="hr-source-card"
              onClick={() => {
                setCandidates((current) => [
                  ...current,
                  ...sampleCandidates.filter(
                    (sample) =>
                      !current.some((candidate) => candidate.id === sample.id),
                  ),
                ]);
                setMessage(
                  "Fictional samples loaded. Their details are illustrative.",
                );
              }}
            >
              <span>01</span>
              <strong>Explore with samples</strong>
              <small>
                Four fictional profiles across engineering, QA and design.
              </small>
              <b>Load fictional samples ↗</b>
            </button>
            <label className="hr-source-card hr-upload">
              <span>↥</span>
              <strong>Upload resumes</strong>
              <small>
                TXT, MD, PDF or DOCX · up to 10 MB each · local browser memory.
              </small>
              <b>{uploading ? "Reading resumes…" : "Choose files ↗"}</b>
              <input
                disabled={uploading}
                type="file"
                accept=".txt,.md,.pdf,.docx"
                multiple
                aria-label="Upload resumes"
                onChange={importFiles}
              />
            </label>
            <div className="hr-source-card hr-external">
              <span>↗</span>
              <strong>Search outside the workspace</strong>
              <small>
                Opens independent search sites. No candidate data is imported
                from them.
              </small>
              <div className="hr-link-row">
                <a
                  href={external.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn people ↗
                </a>
                <a
                  href={external.naukri}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Naukri recruiter ↗
                </a>
              </div>
              <button className="hr-inline-button" onClick={copyBoolean}>
                Copy Boolean query
              </button>
              <code>
                {external.boolean || "Add a role or skills to build a query"}
              </code>
            </div>
          </div>
          <div className="hr-wizard-actions">
            <button className="btn secondary" onClick={() => setStep(1)}>
              Back to job
            </button>
            <button
              className="btn"
              onClick={() => {
                setStep(3);
                setMessage("");
              }}
            >
              Continue to review <span aria-hidden>→</span>
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section id="hr-review" className="hr-section">
          <div className="hr-section-heading">
            <div>
              <span className="hr-kicker">03 / REVIEW &amp; COMPARE</span>
              <h2>See the evidence.</h2>
              <p>
                Sort by required skill coverage, then inspect original text and
                verify every fact with the candidate.
              </p>
            </div>
            <span className="hr-counter">03</span>
          </div>
          <div className="hr-metrics">
            <div>
              <strong>{candidates.length}</strong>
              <span>in candidate pool</span>
            </div>
            <div>
              <strong>{results.length}</strong>
              <span>visible after filters</span>
            </div>
            <div>
              <strong>{shortlist.length}</strong>
              <span>saved for comparison</span>
            </div>
          </div>
          <div className="hr-review-layout">
            <aside className="hr-surface hr-filters">
              <div className="hr-surface-head">
                <h3>Filters</h3>
                <button
                  className="hr-inline-button"
                  onClick={() =>
                    setFilters({
                      skill: "",
                      minExperience: 0,
                      location: "",
                      maxNoticeDays: null,
                      maxSalaryLpa: null,
                      source: "all",
                    })
                  }
                >
                  Clear
                </button>
              </div>
              <label>
                Required skill
                <select
                  aria-label="Required skill"
                  value={filters.skill}
                  onChange={(event) =>
                    updateFilter("skill", event.target.value)
                  }
                >
                  <option value="">Any skill</option>
                  {skills.map((skill) => (
                    <option key={skill}>{skill}</option>
                  ))}
                </select>
              </label>
              <label>
                Minimum experience · years
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={filters.minExperience || ""}
                  onChange={(event) =>
                    updateFilter(
                      "minExperience",
                      Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                  placeholder="Any"
                />
              </label>
              <label>
                Location
                <input
                  value={filters.location}
                  onChange={(event) =>
                    updateFilter("location", event.target.value)
                  }
                  placeholder="Any location"
                />
              </label>
              <label>
                Maximum notice · days
                <input
                  type="number"
                  min="0"
                  value={filters.maxNoticeDays ?? ""}
                  onChange={(event) =>
                    updateFilter(
                      "maxNoticeDays",
                      event.target.value === ""
                        ? null
                        : Math.max(0, Number(event.target.value)),
                    )
                  }
                  placeholder="Any"
                />
              </label>
              <label>
                Maximum salary · ₹ LPA
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={filters.maxSalaryLpa ?? ""}
                  onChange={(event) =>
                    updateFilter(
                      "maxSalaryLpa",
                      event.target.value === ""
                        ? null
                        : Math.max(0, Number(event.target.value)),
                    )
                  }
                  placeholder="Any"
                />
              </label>
              <label>
                Source
                <select
                  aria-label="Source"
                  value={filters.source}
                  onChange={(event) =>
                    updateFilter(
                      "source",
                      event.target.value as CandidateFilters["source"],
                    )
                  }
                >
                  <option value="all">All sources</option>
                  <option value="sample">Fictional samples</option>
                  <option value="upload">My uploads</option>
                </select>
              </label>
              <p className="hr-note">
                When a filter requires an unknown fact, that candidate is hidden
                from these results. The shortlist remains available.
              </p>
            </aside>
            <div className="hr-results">
              <div className="hr-results-bar">
                <div>
                  <strong>Candidate results</strong>
                  <small>
                    {results.length} shown · source clearly labelled
                  </small>
                </div>
                <label>
                  Sort by{" "}
                  <select
                    aria-label="Sort candidates"
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as typeof sort)
                    }
                  >
                    <option value="coverage">Skill coverage</option>
                    <option value="experience">Experience</option>
                    <option value="name">Name</option>
                  </select>
                </label>
              </div>
              {results.length ? (
                results.map((result) => (
                  <article className="hr-candidate" key={result.candidate.id}>
                    <div className="hr-candidate-top">
                      <div className="hr-initial" aria-hidden="true">
                        {result.candidate.name.trim().charAt(0).toUpperCase() ||
                          "?"}
                      </div>
                      <div className="hr-candidate-name">
                        <span className="hr-source-label">
                          {result.candidate.source === "sample"
                            ? "FICTIONAL SAMPLE"
                            : "LOCAL UPLOAD"}
                        </span>
                        <h3>
                          <button
                            className="hr-profile-open"
                            onClick={() => setPreviewId(result.candidate.id)}
                          >
                            {result.candidate.name} <span aria-hidden>↗</span>
                          </button>
                        </h3>
                        {result.candidate.portalProfile && (
                          <p className="hr-portal-headline">
                            {result.candidate.portalProfile.designation} ·{" "}
                            {result.candidate.portalProfile.company}
                          </p>
                        )}
                        <p>
                          {display(result.candidate.location)} ·{" "}
                          {display(
                            result.candidate.yearsExperience,
                            " years experience",
                          )}{" "}
                          ·{" "}
                          {display(result.candidate.noticeDays, " day notice")}
                        </p>
                      </div>
                      <div className="hr-score">
                        <strong>
                          {skills.length ? `${result.coverage}%` : "—"}
                        </strong>
                        <small>skill coverage</small>
                      </div>
                    </div>
                    {result.candidate.portalProfile && (
                      <>
                        <div className="hr-portal-facts">
                          <span>
                            Current CTC{" "}
                            <b>
                              {display(
                                result.candidate.portalProfile.currentSalaryLpa,
                                " LPA",
                              )}
                            </b>
                          </span>
                          <span>
                            Expected{" "}
                            <b>{display(result.candidate.salaryLpa, " LPA")}</b>
                          </span>
                          <span>
                            Updated{" "}
                            <b>{result.candidate.portalProfile.updatedAt}</b>
                          </span>
                        </div>
                        <p className="hr-portal-summary">
                          {
                            result.candidate.portalProfile.employment[0]
                              ?.summary
                          }
                        </p>
                        {activeJob && (
                          <div className="hr-portal-checks">
                            <span>
                              Experience:{" "}
                              {activeJob.requirements.minExperience === null &&
                              activeJob.requirements.maxExperience === null
                                ? "No target"
                                : result.candidate.yearsExperience === null
                                  ? "Unknown"
                                  : (activeJob.requirements.minExperience ===
                                        null ||
                                        result.candidate.yearsExperience >=
                                          activeJob.requirements
                                            .minExperience) &&
                                      (activeJob.requirements.maxExperience ===
                                        null ||
                                        result.candidate.yearsExperience <=
                                          activeJob.requirements.maxExperience)
                                    ? "Within range"
                                    : "Review range"}
                            </span>
                            <span>
                              Budget:{" "}
                              {activeJob.requirements.salaryMaxLpa === null
                                ? "No target"
                                : result.candidate.salaryLpa === null
                                  ? "Unknown"
                                  : result.candidate.salaryLpa <=
                                      activeJob.requirements.salaryMaxLpa
                                    ? "Within budget"
                                    : "Above budget"}
                            </span>
                            <span>
                              Notice:{" "}
                              {activeJob.requirements.maxNoticeDays === null
                                ? "No target"
                                : result.candidate.noticeDays === null
                                  ? "Unknown"
                                  : result.candidate.noticeDays <=
                                      activeJob.requirements.maxNoticeDays
                                    ? "Within target"
                                    : "Above target"}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="hr-evidence">
                      <div>
                        <b>Evidence found</b>
                        <div className="hr-tags">
                          {result.matched.length ? (
                            result.matched.map((skill) => (
                              <span className="hr-tag positive" key={skill}>
                                {skill}
                              </span>
                            ))
                          ) : (
                            <em>None among required skills</em>
                          )}
                        </div>
                      </div>
                      <div>
                        <b>Needs review</b>
                        <div className="hr-tags">
                          {result.missing.length ? (
                            result.missing.map((skill) => (
                              <span className="hr-tag" key={skill}>
                                {skill}
                              </span>
                            ))
                          ) : (
                            <em>
                              {skills.length
                                ? "No missing mentions"
                                : "Add required skills"}
                            </em>
                          )}
                        </div>
                      </div>
                    </div>
                    {result.matched.length > 0 && (
                      <details className="hr-evidence-lines">
                        <summary>View resume evidence</summary>
                        {result.matched.map((skill) => (
                          <p key={skill}>
                            <b>{skill}</b>
                            <span>{result.evidence[skill]}</span>
                          </p>
                        ))}
                      </details>
                    )}
                    <div className="hr-card-actions">
                      <button
                        className="btn small"
                        onClick={() =>
                          setShortlist((current) =>
                            current.includes(result.candidate.id)
                              ? current.filter(
                                  (id) => id !== result.candidate.id,
                                )
                              : [...current, result.candidate.id],
                          )
                        }
                      >
                        {shortlist.includes(result.candidate.id)
                          ? "Remove from shortlist"
                          : "Add to shortlist"}
                      </button>
                      <button
                        className="btn secondary small"
                        onClick={() => setPreviewId(result.candidate.id)}
                      >
                        Review resume
                      </button>
                      <button
                        className="hr-inline-button"
                        onClick={() => setQuestionId(result.candidate.id)}
                      >
                        Interview prompts ↗
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="hr-empty">
                  <strong>
                    {candidates.length
                      ? "No candidates match the current filters."
                      : "Your candidate pool is empty."}
                  </strong>
                  <p>
                    {candidates.length
                      ? "Clear a filter or check unknown details in a resume."
                      : "Load fictional samples or upload local resumes to start reviewing."}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="hr-compare hr-surface">
            <div className="hr-surface-head">
              <div>
                <span className="hr-kicker">SHORTLIST / COMPARE</span>
                <h3>{shortlist.length} saved for comparison</h3>
              </div>
              <button
                className="btn secondary small"
                disabled={!shortlist.length}
                onClick={exportShortlist}
              >
                Export shortlist CSV
              </button>
            </div>
            {shortlisted.length ? (
              <div className="hr-compare-grid">
                {shortlisted.map((candidate) => {
                  const result = evaluateCandidate(candidate, skills);
                  return (
                    <div className="hr-compare-person" key={candidate.id}>
                      <span className="hr-source-label">
                        {candidate.source === "sample"
                          ? "FICTIONAL SAMPLE"
                          : "LOCAL UPLOAD"}
                      </span>
                      <h4>{candidate.name}</h4>
                      <strong>
                        {skills.length ? `${result.coverage}%` : "—"} coverage
                      </strong>
                      <p>
                        <b>Evidence:</b>{" "}
                        {result.matched.join(", ") || "None found"}
                      </p>
                      <p>
                        <b>Review:</b>{" "}
                        {result.missing.join(", ") || "No missing mentions"}
                      </p>
                      <p>
                        Experience{" "}
                        {display(candidate.yearsExperience, " years")} · Salary{" "}
                        {display(candidate.salaryLpa, " LPA")}
                      </p>
                      <button
                        className="hr-inline-button"
                        onClick={() => setQuestionId(candidate.id)}
                      >
                        Interview prompts ↗
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="hr-helper">
                Shortlisted profiles stay here even when filters hide them from
                the results.
              </p>
            )}
          </div>
          <div className="hr-wizard-actions">
            <button className="btn secondary" onClick={() => setStep(2)}>
              Back to candidates
            </button>
            <button
              className="btn"
              onClick={() => {
                setStep(4);
                setMessage("");
              }}
            >
              Continue to onboarding <span aria-hidden>→</span>
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section id="hr-onboarding" className="hr-section hr-onboarding">
          <div className="hr-section-heading">
            <div>
              <span className="hr-kicker">04 / PLAN THE HANDOFF</span>
              <h2>Make the next step clear.</h2>
              <p>
                Assign a task to an owner and due date. This is a planning list
                for the current session.
              </p>
            </div>
            <span className="hr-counter">04</span>
          </div>
          <div className="hr-surface">
            <div className="hr-checklist-form">
              <div>
                <strong>Starter onboarding checklist</strong>
                <small>Four editable tasks from the joining date.</small>
              </div>
              <label>
                Checklist candidate
                <select
                  value={checklistCandidate}
                  onChange={(event) =>
                    setChecklistCandidate(event.target.value)
                  }
                >
                  <option value="">First shortlisted candidate</option>
                  {shortlisted.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Checklist owner
                <input
                  value={checklistOwner}
                  onChange={(event) => setChecklistOwner(event.target.value)}
                  placeholder="e.g. HR operations"
                />
              </label>
              <label>
                Joining date
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(event) => setJoiningDate(event.target.value)}
                />
              </label>
              <button
                className="btn secondary small"
                onClick={addChecklist}
                disabled={!shortlisted.length}
              >
                Add onboarding checklist
              </button>
            </div>
            <div className="hr-onboard-top">
              <strong>
                {completedTasks} of {tasks.length} complete
              </strong>
              <button
                className="hr-inline-button"
                disabled={!tasks.length}
                onClick={exportTasks}
              >
                Export tasks JSON ↗
              </button>
            </div>
            <div className="hr-task-form">
              <label>
                Task
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="e.g. Prepare induction schedule"
                />
              </label>
              <label>
                Owner
                <input
                  value={taskOwner}
                  onChange={(event) => setTaskOwner(event.target.value)}
                  placeholder="e.g. HR operations"
                />
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={taskDate}
                  onChange={(event) => setTaskDate(event.target.value)}
                />
              </label>
              <label>
                Candidate
                <select
                  value={taskCandidate}
                  onChange={(event) => setTaskCandidate(event.target.value)}
                >
                  <option value="">General task</option>
                  {shortlisted.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn" onClick={addTask}>
                Add task
              </button>
            </div>
            {tasks.length ? (
              <div className="hr-task-list">
                {tasks.map((task) => (
                  <div className="hr-task" key={task.id}>
                    <span className="hr-task-marker">✓</span>
                    <div>
                      <strong>{task.title}</strong>
                      <small>
                        {task.owner} · {task.dueDate}
                        {task.candidateId
                          ? ` · ${candidates.find((candidate) => candidate.id === task.candidateId)?.name ?? "Candidate removed"}`
                          : ""}
                      </small>
                    </div>
                    <select
                      aria-label={`Status for ${task.title}`}
                      value={task.status}
                      onChange={(event) =>
                        setTasks((current) =>
                          current.map((item) =>
                            item.id === task.id
                              ? {
                                  ...item,
                                  status: event.target
                                    .value as OnboardingTask["status"],
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="todo">To do</option>
                      <option value="progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                    <button
                      className="hr-inline-button"
                      aria-label={`Remove ${task.title}`}
                      onClick={() =>
                        setTasks((current) =>
                          current.filter((item) => item.id !== task.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hr-helper hr-task-empty">
                No tasks yet. Add one when you are ready to plan the handoff.
              </p>
            )}
          </div>
          <div className="hr-wizard-actions">
            <button className="btn secondary" onClick={() => setStep(3)}>
              Back to review
            </button>
            <button
              className="btn"
              onClick={() => {
                setActiveJobId("");
                setStep(1);
                setMessage("");
              }}
            >
              Finish and choose a job <span aria-hidden>→</span>
            </button>
          </div>
        </section>
      )}

      {preview && (
        <HrDialog
          title={`Resume for ${preview.name}`}
          onClose={() => setPreviewId(null)}
        >
          <div className="hr-surface-head">
            <div>
              <span className="hr-source-label">
                {preview.source === "sample"
                  ? "FICTIONAL SAMPLE"
                  : "LOCAL UPLOAD"}
              </span>
              <h2>Resume review</h2>
            </div>
            <button
              className="hr-close"
              aria-label="Close resume"
              onClick={() => setPreviewId(null)}
            >
              ×
            </button>
          </div>
          {preview.portalProfile && (
            <div className="hr-portal-detail">
              <span className="hr-source-label">
                FICTIONAL PORTAL PROFILE · {preview.id}
              </span>
              <h3>{preview.name}</h3>
              <p>{preview.portalProfile.headline}</p>
              <div className="hr-portal-facts">
                <span>
                  Current CTC:{" "}
                  {display(preview.portalProfile.currentSalaryLpa, " LPA")}
                </span>
                <span>
                  Preferred:{" "}
                  {preview.portalProfile.preferredLocations.join(", ")}
                </span>
                <span>Updated: {preview.portalProfile.updatedAt}</span>
              </div>
              <h3>Key skills</h3>
              <div className="hr-tags">
                {preview.portalProfile.keySkills.map((skill) => (
                  <span className="hr-tag" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
              <h3>Career history</h3>
              {preview.portalProfile.employment.map((employment, index) => (
                <div className="hr-portal-employment" key={index}>
                  <strong>
                    {employment.designation} · {employment.company}
                  </strong>
                  <small>{employment.period}</small>
                  <p>{employment.summary}</p>
                </div>
              ))}
              <h3>Education</h3>
              <p>{preview.portalProfile.education}</p>
              <h3>Match evidence</h3>
              {skills.map((skill) => {
                const result = evaluateCandidate(preview, skills);
                return (
                  <p key={skill}>
                    <strong>{skill}: </strong>
                    {result.evidence[skill] ||
                      "No mention in the supplied resume; verify in discussion."}
                  </p>
                );
              })}
              <h3>Recruiter notes</h3>
              <p>
                These are illustrative profiles returned by a mock service.
                Skill coverage counts resume mentions; it is not an assessment
                of ability. Check salary, notice and experience separately.
              </p>
            </div>
          )}
          <div className="hr-modal-fields">
            <label>
              Display label
              <input
                value={preview.name}
                onChange={(event) =>
                  patchCandidate(preview.id, { name: event.target.value })
                }
              />
            </label>
            <label>
              Experience · years
              <input
                type="number"
                min="0"
                step="0.5"
                value={preview.yearsExperience ?? ""}
                onChange={(event) =>
                  patchCandidate(preview.id, {
                    yearsExperience:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
                placeholder="Unknown"
              />
            </label>
            <label>
              Location
              <input
                value={preview.location ?? ""}
                onChange={(event) =>
                  patchCandidate(preview.id, {
                    location: event.target.value || null,
                  })
                }
                placeholder="Unknown"
              />
            </label>
            <label>
              Notice · days
              <input
                type="number"
                min="0"
                value={preview.noticeDays ?? ""}
                onChange={(event) =>
                  patchCandidate(preview.id, {
                    noticeDays:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
                placeholder="Unknown"
              />
            </label>
            <label>
              Salary · ₹ LPA
              <input
                type="number"
                min="0"
                step="0.5"
                value={preview.salaryLpa ?? ""}
                onChange={(event) =>
                  patchCandidate(preview.id, {
                    salaryLpa:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
                placeholder="Unknown"
              />
            </label>
          </div>
          <p className="hr-note">
            Imported metadata starts unknown. Edit only after checking the
            resume or confirming with the candidate. The display label comes
            from the filename.
          </p>
          <div className="hr-resume-text">
            <pre>{preview.resumeText}</pre>
          </div>
          <button
            className="btn secondary small"
            onClick={() => downloadResume(preview)}
          >
            Download{" "}
            {preview.source === "upload" ? "original file" : "sample resume"}
          </button>
        </HrDialog>
      )}
      {questionCandidate && (
        <HrDialog
          title={`Interview prompts for ${questionCandidate.name}`}
          onClose={() => setQuestionId(null)}
        >
          <div className="hr-surface-head">
            <div>
              <span className="hr-kicker">DISCUSSION GUIDE</span>
              <h2>Interview prompts</h2>
              <p>{questionCandidate.name}</p>
            </div>
            <button
              className="hr-close"
              aria-label="Close interview prompts"
              onClick={() => setQuestionId(null)}
            >
              ×
            </button>
          </div>
          <ol>
            {interviewQuestions(
              skills,
              evaluateCandidate(questionCandidate, skills),
            ).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
          <p className="hr-note">
            Prompts are rule based and require human judgment. They do not
            decide who should be interviewed or hired.
          </p>
        </HrDialog>
      )}
    </div>
  );
}
