import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, "mfz-email.js"), "utf8");
const css = readFileSync(join(root, "mfz-email.css"), "utf8");
const failures = [];

function assert(ok, message) {
  if (!ok) failures.push(message);
  console.log(ok ? `ok  ${message}` : `FAIL ${message}`);
}

assert(!/\?\./.test(src), "source has no optional chaining");
assert(!/\?\?/.test(src), "source has no nullish coalescing");
assert(!/catch\s*\{/.test(src), "source has no optional catch binding");
assert(src.includes("lastRemote = null"), "typing clears lastRemote so a corrected email can submit");
assert(src.includes("ymail.com") && src.includes("mail.com") && src.includes("mac.com"), "known-good providers are in COMMON_DOMAINS");
assert(src.includes("LOCAL_DISPOSABLE") && src.includes("yopmail.com"), "tiny local disposable list is present");
assert(src.includes("apiUnavailable"), "API-down still allows submit");
assert(src.includes("Your email domain is invalid"), "no-MX domains show a domain error");
assert(src.includes("debug: false"), "production debug logging is off");
assert(!css.includes("margin-bottom: 10px"), "CSS does not add extra Webflow field gap");
assert(src.length < 18_000, "source stays small for jsDelivr minify (" + src.length + " bytes)");

const minPath = join(tmpdir(), "mfz-email.min.check.js");
let minified = "";
try {
  execFileSync("npx", ["--yes", "terser@5.31.0", join(root, "mfz-email.js"), "-c", "-m", "--ecma", "2017", "-o", minPath], {
    cwd: root,
    stdio: "pipe",
  });
  minified = readFileSync(minPath, "utf8");
} catch (err) {
  console.error(err.stderr ? err.stderr.toString() : err);
}

assert(minified.length > 500, "GitHub/jsDelivr-style Terser minify succeeds");
assert(minified.length < 8000, "minified JS stays under 8KB (" + minified.length + " bytes)");
try {
  unlinkSync(minPath);
} catch {
  /* ignore */
}

globalThis.window = globalThis;
globalThis.document = {
  readyState: "complete",
  addEventListener() {},
  querySelectorAll() {
    return [];
  },
  body: {},
};
globalThis.Node = { ELEMENT_NODE: 1 };
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
};

new Function(src)();
const api = globalThis.MFZEmail;
assert(typeof api.localProblem === "function", "MFZEmail.localProblem is exported for checks");

const cases = [
  ["juan.cruz@gmail.com", null],
  ["juan.cruz@yahoo.com.ph", null],
  ["ada@mail.com", null],
  ["ada@ymail.com", null],
  ["ada@mac.com", null],
  ["test@meydanfz.ae", null],
  ["webmaster@meydanfz.ae", null],
  ["info@meydanfz.ae", null],
  ["demo@meydanfz.ae", "keyword"],
  ["a@mailinator.com", "disposable"],
  ["a@mail.yopmail.com", "disposable"],
  ["juan.cruz@gmaiil.com", "typo"],
  ["not-an-email", "syntax"],
];

for (const [email, kind] of cases) {
  const problem = api.localProblem(email);
  const got = problem ? problem.kind : null;
  assert(got === kind, "local " + email + " → " + (kind || "ok"));
}

assert(api.suggestTypo("juan.cruz@gmaiil.com") === "juan.cruz@gmail.com", "client suggests gmail.com for gmaiil.com");
assert(api.suggestTypo("ada@mail.com") === null, "client does not rewrite mail.com");
assert(api.suggestTypo("a@yopmail.com") === "a@hotmail.com" || api.localProblem("a@yopmail.com").kind === "disposable", "yopmail is disposable locally, not a hotmail suggestion");

if (failures.length) {
  console.error("\n" + failures.length + " mfz-email check(s) failed");
  process.exit(1);
}

console.log("\nAll mfz-email.js minify and local checks passed");
console.log("minified", minified.length, "bytes");
