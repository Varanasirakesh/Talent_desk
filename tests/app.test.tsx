import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
require.extensions[".css"] = () => {};
const { default: RootLayout } =
  require("../src/app/layout") as typeof import("../src/app/layout");
const { default: Home } =
  require("../src/app/page") as typeof import("../src/app/page");

test("Talent Desk opens the HR workspace with its own navigation", () => {
  const html = renderToStaticMarkup(
    <RootLayout>
      <Home />
    </RootLayout>,
  );
  assert.match(html, /Talent Desk/);
  assert.match(html, /Hiring workflow/);
  assert.match(html, /Choose a job to get started/);
  assert.match(html, /HR-DEMO-001/);
  assert.match(html, /Data Engineer/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Find demo candidates/);
  assert.match(html, /Hiring settings/);
  assert.doesNotMatch(html, /Kit Lab|All kits|Choose a workspace to test/);
  assert.equal((html.match(/<main/g) ?? []).length, 1);
});

