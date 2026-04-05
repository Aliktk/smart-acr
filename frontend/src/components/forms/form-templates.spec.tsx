import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import FormB_S121E from "./FormB_S121E";
import FormC_Inspector from "./FormC_Inspector";
import FormD_Superintendent from "./FormD_Superintendent";

test("APS / Stenotypist template preserves bilingual headings without a countersigning section", () => {
  const markup = renderToStaticMarkup(<FormB_S121E />);

  assert.ok(markup.includes("FOR ASSISTANT PRIVATE SECRETARY / STENOTYPISTS"));
  assert.ok(markup.includes("اسسٹنٹ پرائیویٹ سیکریٹری / اسٹینوٹائپسٹ"));
  assert.equal(markup.includes("REMARKS OF THE COUNTERSIGNING OFFICER"), false);
});

test("Superintendent template includes the countersigning officer section", () => {
  const markup = renderToStaticMarkup(<FormD_Superintendent />);

  assert.ok(markup.includes("for Superintendent / Assistant Incharge"));
  assert.ok(markup.includes("REMARKS OF THE COUNTERSIGNING OFFICER"));
  assert.ok(markup.includes("کاؤنٹر سائننگ افسر کے ریمارکس"));
});

test("Inspector template uses the shared signature and stamp layout", () => {
  const markup = renderToStaticMarkup(<FormC_Inspector />);

  assert.ok(markup.includes("Official Stamp"));
  assert.ok(markup.includes("Signature, Name &amp; Designation of Reporting Officer"));
  assert.equal(markup.includes("Click to Sign"), false);
});
