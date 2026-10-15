import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  navigator: dom.window.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
});
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
const { render, fireEvent, cleanup, waitFor } =
  require("@testing-library/react") as typeof import("@testing-library/react");
const { HrWorkspace } =
  require("../src/features/hr/workspace") as typeof import("../src/features/hr/workspace");

afterEach(cleanup);

test("mock API profiles load into cards, open details and do not duplicate on retry", async () => {
  const original = globalThis.fetch;
  const { demoPortalResponse } =
    await import("../src/features/hr/portal-fixture");
  globalThis.fetch = async () => Response.json(demoPortalResponse);
  try {
    const ui = render(<HrWorkspace />);
    fireEvent.click(ui.getByRole("button", { name: "Find demo candidates" }));
    await waitFor(() =>
      assert.equal(
        ui.getAllByRole("button", { name: "Add to shortlist" }).length,
        6,
      ),
    );
    fireEvent.click(ui.getByRole("button", { name: /Ananya Rao/ }));
    assert.ok(ui.getByRole("dialog", { name: "Resume for Ananya Rao" }));
    assert.ok(ui.getByRole("heading", { name: "Career history" }));
    fireEvent.click(ui.getByRole("button", { name: "Close resume" }));
    returnToJob(ui);
    fireEvent.click(ui.getByRole("button", { name: "Find demo candidates" }));
    await waitFor(() =>
      assert.equal(
        ui.getAllByRole("button", { name: "Add to shortlist" }).length,
        6,
      ),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("API failure shows an error and keeps the candidate pool empty", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  try {
    const ui = render(<HrWorkspace />);
    fireEvent.click(ui.getByRole("button", { name: "Find demo candidates" }));
    await waitFor(() =>
      assert.match(ui.getByRole("alert").textContent || "", /503/),
    );
    openCandidates(ui);
    openReview(ui);
    assert.ok(ui.getByText("Your candidate pool is empty."));
  } finally {
    globalThis.fetch = original;
  }
});

type WorkspaceUi = ReturnType<typeof render>;

test("editable job budget drives checks and default preferences keep Hyderabad profiles visible", async () => {
  const original = globalThis.fetch;
  const { demoPortalResponse } =
    await import("../src/features/hr/portal-fixture");
  globalThis.fetch = async () => Response.json(demoPortalResponse);
  try {
    const ui = render(<HrWorkspace />);
    fireEvent.change(ui.getByLabelText("Budget maximum · ₹ LPA"), {
      target: { value: "15" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Apply preferences" }));
    fireEvent.click(ui.getByRole("button", { name: "Find demo candidates" }));
    await waitFor(() =>
      assert.equal(
        ui.getAllByRole("button", { name: "Add to shortlist" }).length,
        3,
      ),
    );
    assert.equal(ui.getAllByText("Budget: Above budget").length, 2);
    assert.equal(ui.getAllByText("Budget: Within budget").length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("pending API response stays with its initiating job after switching requisitions", async () => {
  const original = globalThis.fetch;
  const { demoPortalResponse } =
    await import("../src/features/hr/portal-fixture");
  let complete: ((value: Response) => void) | undefined;
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      complete = resolve;
    });
  try {
    const ui = render(<HrWorkspace />);
    fireEvent.click(ui.getByRole("button", { name: "Find demo candidates" }));
    fireEvent.click(ui.getByRole("button", { name: "Add a job" }));
    fireEvent.change(ui.getByLabelText("Role title"), {
      target: { value: "SQL Engineer" },
    });
    fireEvent.change(ui.getByLabelText("New job description"), {
      target: { value: "SQL delivery" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Create job ID" }));
    complete?.(Response.json(demoPortalResponse));
    await waitFor(() =>
      assert.match(
        ui.getByRole("button", { name: /HR-DEMO-001/ }).textContent || "",
        /6 candidates/,
      ),
    );
    assert.ok(ui.getByRole("button", { name: /Continue to candidates/ }));
    openCandidates(ui);
    openReview(ui);
    assert.ok(ui.getByText("Your candidate pool is empty."));
  } finally {
    globalThis.fetch = original;
  }
});

test("new requisition saves its criteria and approved keywords before candidate sourcing", () => {
  const ui = render(<HrWorkspace />);
  fireEvent.click(ui.getByRole("button", { name: "Add a job" }));
  fireEvent.change(ui.getByLabelText("Role title"), {
    target: { value: "Platform Engineer" },
  });
  fireEvent.change(ui.getByLabelText("Location"), {
    target: { value: "Hyderabad" },
  });
  fireEvent.change(ui.getByLabelText("Required experience minimum · years"), {
    target: { value: "4" },
  });
  fireEvent.change(ui.getByLabelText("Budget maximum · ₹ LPA"), {
    target: { value: "30" },
  });
  fireEvent.change(ui.getByLabelText("New job description"), {
    target: { value: "Build reliable Kubernetes platforms." },
  });
  fireEvent.change(ui.getByLabelText("Add requisition skill"), {
    target: { value: "Kubernetes" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Add skill" }));
  fireEvent.click(ui.getByRole("button", { name: "Create job ID" }));

  assert.equal(
    (
      ui.getByLabelText(
        "Required experience minimum · years",
      ) as HTMLInputElement
    ).value,
    "4",
  );
  assert.equal(
    (ui.getByLabelText("Budget maximum · ₹ LPA") as HTMLInputElement).value,
    "30",
  );
  assert.ok(ui.getByText("Kubernetes"));
  assert.ok(ui.getByRole("button", { name: /Continue to candidates/ }));
});

function openCandidates(ui: WorkspaceUi) {
  fireEvent.click(ui.getByRole("button", { name: /Continue to candidates/ }));
}

function openReview(ui: WorkspaceUi) {
  fireEvent.click(ui.getByRole("button", { name: /Continue to review/ }));
}

function loadSamplesForReview(ui: WorkspaceUi) {
  openCandidates(ui);
  fireEvent.click(ui.getByRole("button", { name: /Explore with samples/ }));
  openReview(ui);
}

function returnToJob(ui: WorkspaceUi) {
  fireEvent.click(ui.getByRole("button", { name: "Back to candidates" }));
  fireEvent.click(ui.getByRole("button", { name: "Back to job" }));
}

test("JD edits invalidate the active analysis until rerun", () => {
  const ui = render(<HrWorkspace />);
  fireEvent.change(ui.getByLabelText("Job description"), {
    target: { value: "Need React and TypeScript" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Analyse job description" }));
  assert.match(
    ui.getByText(/Required skills: React, TypeScript/).textContent ?? "",
    /React, TypeScript/,
  );
  fireEvent.change(ui.getByLabelText("Job description"), {
    target: { value: "Need Python" },
  });
  assert.ok(ui.getByText(/Job description changed/));
  assert.equal(ui.queryByText(/Required skills: React, TypeScript/), null);
});

test("shortlist remains visible when filters hide a candidate", () => {
  const ui = render(<HrWorkspace />);
  loadSamplesForReview(ui);
  fireEvent.click(ui.getAllByRole("button", { name: "Add to shortlist" })[0]);
  fireEvent.change(ui.getByLabelText("Source"), {
    target: { value: "upload" },
  });
  assert.ok(ui.getByText(/No candidates match the current filters/));
  assert.ok(ui.getByText(/1 saved for comparison/));
});

test("onboarding task records editable owner, due date and status", () => {
  const ui = render(<HrWorkspace />);
  openCandidates(ui);
  openReview(ui);
  fireEvent.click(ui.getByRole("button", { name: /Continue to onboarding/ }));
  fireEvent.change(ui.getByLabelText("Task"), {
    target: { value: "Prepare access" },
  });
  fireEvent.change(ui.getByLabelText("Owner"), { target: { value: "HR ops" } });
  fireEvent.change(ui.getByLabelText("Due date"), {
    target: { value: "2026-10-02" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Add task" }));
  assert.ok(ui.getByText("Prepare access"));
  assert.ok(ui.getByText(/HR ops/));
  fireEvent.change(ui.getByLabelText("Status for Prepare access"), {
    target: { value: "done" },
  });
  assert.equal(
    (ui.getByLabelText("Status for Prepare access") as HTMLSelectElement).value,
    "done",
  );
});

test("sample JD and onboarding checklist prepare a useful session", () => {
  const ui = render(<HrWorkspace />);
  fireEvent.click(
    ui.getByRole("button", { name: "Use sample job description" }),
  );
  assert.match(
    (ui.getByLabelText("Job description") as HTMLTextAreaElement).value,
    /React/,
  );
  loadSamplesForReview(ui);
  fireEvent.click(ui.getAllByRole("button", { name: "Add to shortlist" })[0]);
  fireEvent.click(ui.getByRole("button", { name: /Continue to onboarding/ }));
  fireEvent.change(ui.getByLabelText("Checklist owner"), {
    target: { value: "HR ops" },
  });
  fireEvent.change(ui.getByLabelText("Joining date"), {
    target: { value: "2026-10-20" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Add onboarding checklist" }));
  assert.ok(ui.getByText("Verify documents"));
  assert.ok(ui.getByText(/0 of 4 complete/));
  assert.equal(ui.getAllByRole("combobox", { name: /Status for/ }).length, 4);
});

test("candidate card exposes the supplied text behind skill coverage", () => {
  const ui = render(<HrWorkspace />);
  fireEvent.click(
    ui.getByRole("button", { name: "Use sample job description" }),
  );
  loadSamplesForReview(ui);
  assert.ok(
    ui.getAllByText(/5 years building React and TypeScript interfaces/).length >
      0,
  );
});

test("removing or replacing a required skill clears its active filter", () => {
  const ui = render(<HrWorkspace />);
  fireEvent.click(
    ui.getByRole("button", { name: "Use sample job description" }),
  );
  loadSamplesForReview(ui);
  fireEvent.change(ui.getByLabelText("Required skill"), {
    target: { value: "React" },
  });
  returnToJob(ui);
  fireEvent.click(ui.getByRole("button", { name: "Remove React" }));
  openCandidates(ui);
  openReview(ui);
  assert.equal(
    (ui.getByLabelText("Required skill") as HTMLSelectElement).value,
    "",
  );
  assert.ok(ui.getAllByRole("button", { name: "Add to shortlist" }).length > 0);
  fireEvent.change(ui.getByLabelText("Required skill"), {
    target: { value: "TypeScript" },
  });
  returnToJob(ui);
  fireEvent.change(ui.getByLabelText("Job description"), {
    target: { value: "Need Python" },
  });
  fireEvent.click(ui.getByRole("button", { name: "Analyse job description" }));
  openCandidates(ui);
  openReview(ui);
  assert.equal(
    (ui.getByLabelText("Required skill") as HTMLSelectElement).value,
    "",
  );
  assert.ok(ui.getAllByRole("button", { name: "Add to shortlist" }).length > 0);
});

test("duplicate local resumes are imported once", async () => {
  const ui = render(<HrWorkspace />);
  openCandidates(ui);
  const first = new File(["React portfolio"], "first.txt", {
    type: "text/plain",
  });
  const same = new File(["React portfolio"], "second.txt", {
    type: "text/plain",
  });
  fireEvent.change(ui.getByLabelText("Upload resumes"), {
    target: { files: [first, same] },
  });
  await waitFor(() => assert.ok(ui.getByText(/duplicate resume skipped/)));
  assert.ok(ui.getByText(/1 resume imported/));
  openReview(ui);
  assert.equal(
    ui.getAllByRole("button", { name: "Add to shortlist" }).length,
    1,
  );
});

test("the upload control stays busy while a resume is being read", async () => {
  const ui = render(<HrWorkspace />);
  openCandidates(ui);
  const file = new File(["React"], "slow.txt", { type: "text/plain" });
  const original = file.arrayBuffer.bind(file);
  let release: (() => void) | undefined;
  Object.defineProperty(file, "arrayBuffer", {
    value: () =>
      new Promise<ArrayBuffer>((resolve) => {
        release = () => original().then(resolve);
      }),
  });
  fireEvent.change(ui.getByLabelText("Upload resumes"), {
    target: { files: [file] },
  });
  assert.equal(
    (ui.getByLabelText("Upload resumes") as HTMLInputElement).disabled,
    true,
  );
  release?.();
  await waitFor(() =>
    assert.equal(
      (ui.getByLabelText("Upload resumes") as HTMLInputElement).disabled,
      false,
    ),
  );
});
