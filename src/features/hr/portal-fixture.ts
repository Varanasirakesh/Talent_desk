// Fictional recruiter-style schema for the demo. This is not Naukri's API contract.
export type PortalProfile = {
  candidateId: string;
  name: string;
  headline: string;
  currentEmployment: { designation: string; company: string };
  experienceYears: number;
  currentLocation: string;
  preferredLocations: string[];
  compensation: { currency: "INR"; unit: "LPA"; current: number | null; expected: number | null };
  noticePeriodDays: number | null;
  keySkills: string[];
  employment: { company: string; designation: string; period: string; summary: string }[];
  education: string;
  updatedAt: string;
  resume: { fileName: string; text: string };
};

export type PortalResponse = {
  schemaVersion: "1.0";
  provider: "recruiter-demo";
  isMock: true;
  requestId: string;
  total: number;
  profiles: PortalProfile[];
};

function profile(id: string, name: string, title: string, company: string, years: number,
  location: string, current: number | null, expected: number | null, notice: number | null,
  skills: string[], summary: string, previous: string): PortalProfile {
  return {
    candidateId: `DEMO-${id}`, name, headline: `${title} · ${skills.slice(0, 3).join(" / ")}`,
    currentEmployment: { designation: title, company }, experienceYears: years,
    currentLocation: location, preferredLocations: [location, "Remote"],
    compensation: { currency: "INR", unit: "LPA", current, expected }, noticePeriodDays: notice,
    keySkills: skills,
    employment: [
      { company, designation: title, period: "2023 – Present", summary },
      { company: "Demo Meridian Systems", designation: "Data Associate", period: "Previous role", summary: previous },
    ],
    education: "B.Tech, Computer Science · Fictional demonstration record",
    updatedAt: "2026-10-07",
    resume: { fileName: `${id}-demo-resume.txt`, text: `FICTIONAL DEMO PROFILE — ${name}\n${title} at ${company}. ${years} years of experience.\n${summary}\n${previous}\nLocation: ${location}.\nSalary and notice details are illustrative.` },
  };
}

const profiles = [
  profile("101", "Ananya Rao", "Data Engineer", "Demo Northstar Analytics", 4.5, "Hyderabad", 14, 18, 30,
    ["SQL", "Python", "dbt", "Airflow", "Snowflake", "Data modelling", "Data analytics", "AWS"],
    "Built SQL and Python ELT pipelines; used dbt and Airflow to deliver tested Snowflake datasets. Owned dimensional data modelling and worked with analysts on data analytics, KPI definitions, freshness checks and dashboards.",
    "Maintained AWS ingestion jobs and introduced automated data-quality checks."),
  profile("102", "Rohan Desai", "Analytics Engineer", "Demo MetricWorks", 3.5, "Bengaluru", 12, 16, 15,
    ["SQL", "Python", "dbt", "Snowflake", "Data modelling", "Data analytics", "Power BI"],
    "Developed SQL and dbt marts on Snowflake, dimensional data modelling and Python validation scripts. Supported data analytics and Power BI reporting with governed metrics.",
    "Translated finance reporting requirements into reusable datasets and documented business rules."),
  profile("103", "Kavya Menon", "Senior Data Engineer", "Demo Lakehouse Labs", 6, "Pune", 21, 26, 60,
    ["SQL", "Python", "Spark", "Airflow", "AWS", "Data modelling", "Data analytics"],
    "Operated Python, SQL and Spark pipelines on AWS with Airflow orchestration. Designed data modelling standards for data analytics; implemented alerts and incremental ingestion.",
    "Reduced nightly batch failures through automated validation and recovery playbooks."),
  profile("104", "Arjun Shah", "Data Analyst", "Demo InsightBridge", 2, "Hyderabad", 7, 10, 0,
    ["SQL", "Python", "Data analytics", "Power BI", "Excel"],
    "Used SQL and Python for data analytics and business reporting. Built Power BI dashboards, reconciled source reports and investigated inconsistent KPI definitions.",
    "Partnered with operations teams to document dashboard requirements; limited production pipeline ownership."),
  profile("105", "Meera Nair", "Data Engineer", "Demo CloudFoundry Data", 5, "Chennai", 16, null, null,
    ["SQL", "Python", "Spark", "Azure", "Airflow", "Data modelling"],
    "Built SQL, Python and Spark transformations on Azure. Used Airflow for scheduled workflows, data modelling and quality validation.",
    "Supported warehouse migrations and documented operational runbooks. Salary expectation and notice period not provided."),
  profile("106", "Dev Patel", "Data Platform Engineer", "Demo FlowGrid", 4, "Hyderabad", 15, 20, 45,
    ["SQL", "Python", "Spark", "Airflow", "Snowflake", "Data modelling", "Data analytics", "AWS"],
    "Built Python and SQL ingestion with Spark and Airflow, loading Snowflake data products. Used data modelling and data analytics requirements to define trusted marts on AWS.",
    "Introduced pipeline tests, lineage documentation and cost monitoring with analytics stakeholders."),
];

export const demoPortalResponse: PortalResponse = {
  schemaVersion: "1.0", provider: "recruiter-demo", isMock: true,
  requestId: "demo-data-engineer-v1", total: profiles.length, profiles,
};

export const dataEngineerJd = `Data Engineer — Analytics Platform
Experience: 3–5 years. Salary: ₹12–20 LPA. Location: Hyderabad / hybrid. Full-time.
Build reliable SQL and Python ingestion and transformation pipelines. Use dbt and Airflow to deliver tested Snowflake datasets. Own data modelling, quality checks, freshness monitoring and documentation.
Understand data analytics: translate business questions into reusable metrics and curated datasets; work with analysts on KPI definitions and reporting accuracy.
Required: SQL, Python, dbt, Airflow, Snowflake, data modelling and data analytics.
Preferred: Spark and AWS experience.
Success: a production pipeline with agreed freshness and quality checks, documented analytical models, and fewer manual reporting steps.
Target notice period: up to 45 days. Equivalent practical experience is welcome.`;

export const dataEngineerSkills = ["SQL", "Python", "dbt", "Airflow", "Snowflake", "Data modelling", "Data analytics"];
