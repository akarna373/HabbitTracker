// Runs every tests/**/*.test.ts with Node's built-in test runner, no extra dependency.
// The TypeScript compiler already in the project turns each file into JavaScript as it
// is loaded, and extensionless relative imports ("./dates") are resolved to .ts files.
// The code under test is the app's pure logic (no React Native, no Expo modules), plus
// Node's built-in SQLite for the database layer.
//
//   npm test
//   TEST_TZ=America/Los_Angeles npm test   (run the same tests in another time zone;
//   setting the TZ environment variable from outside does not work on Windows)
"use strict";

// Must happen before any date is created.
if (process.env.TEST_TZ) process.env.TZ = process.env.TEST_TZ;

const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request.startsWith(".") && parent && parent.filename && /\.tsx?$/.test(parent.filename)) {
    const base = path.resolve(path.dirname(parent.filename), request);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return originalResolve.call(this, request, parent, ...rest);
};

function compile(module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  module._compile(output.outputText, filename);
}
require.extensions[".ts"] = compile;
require.extensions[".tsx"] = compile;

function findTests(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findTests(full));
    else if (entry.name.endsWith(".test.ts")) found.push(full);
  }
  return found;
}

const files = findTests(path.join(root, "tests")).sort();
if (files.length === 0) {
  console.error("No test files found in tests/");
  process.exit(1);
}
for (const file of files) require(file);
