"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const strict_1 = __importDefault(require("node:assert/strict"));
const server_1 = require("react-dom/server");
const FormB_S121E_js_1 = __importDefault(require("./FormB_S121E.js"));
const FormC_Inspector_js_1 = __importDefault(require("./FormC_Inspector.js"));
const FormD_Superintendent_js_1 = __importDefault(require("./FormD_Superintendent.js"));
function runAssertion(name, assertion) {
    try {
        assertion();
    }
    catch (error) {
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
runAssertion("APS / Stenotypist template preserves bilingual headings without a countersigning section", () => {
    const markup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(FormB_S121E_js_1.default, {}));
    strict_1.default.ok(markup.includes("FOR ASSISTANT PRIVATE SECRETARY / STENOTYPISTS"));
    strict_1.default.ok(markup.includes("اسسٹنٹ پرائیویٹ سیکریٹری / اسٹینوٹائپسٹ"));
    strict_1.default.equal(markup.includes("REMARKS OF THE COUNTERSIGNING OFFICER"), false);
});
runAssertion("Superintendent template includes the countersigning officer section", () => {
    const markup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(FormD_Superintendent_js_1.default, {}));
    strict_1.default.ok(markup.includes("for Superintendent / Assistant Incharge"));
    strict_1.default.ok(markup.includes("REMARKS OF THE COUNTERSIGNING OFFICER"));
    strict_1.default.ok(markup.includes("کاؤنٹر سائننگ افسر کے ریمارکس"));
});
runAssertion("Inspector template uses the shared signature and stamp layout", () => {
    const markup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(FormC_Inspector_js_1.default, {}));
    strict_1.default.ok(markup.includes("Official Stamp"));
    strict_1.default.ok(markup.includes("Signature, Name &amp; Designation of Reporting Officer"));
    strict_1.default.equal(markup.includes("Click to Sign"), false);
});
console.log("Form template checks passed.");
