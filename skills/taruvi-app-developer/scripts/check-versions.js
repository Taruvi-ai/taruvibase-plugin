#!/usr/bin/env node
/**
 * check-versions.js — warn when SDK/provider versions drift from what this skill was authored against.
 *
 * Usage:
 *   node skills/taruvi-app-developer/scripts/check-versions.js
 *
 * Exit code: 0 if all pinned, 1 if any drift detected.
 */

const https = require("https");
const { execSync } = require("child_process");

const PINNED_PYTHON_SDK = "0.1.9";
const PINNED_JS_SDK = "1.4.7";
const PINNED_REFINE_PROVIDERS = "1.3.0";

let drift = false;

/**
 * Fetch JSON from URL
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Invalid JSON"));
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Check npm package version
 */
async function checkNpm(pkg, pinned) {
  try {
    const output = execSync(`npm view ${pkg} version`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (output !== pinned) {
      console.log(`  [drift] ${pkg}: pinned=${pinned}, latest=${output}`);
      drift = true;
    } else {
      console.log(`  [ok]    ${pkg}: ${pinned}`);
    }
  } catch {
    console.log(`  [skip] could not fetch ${pkg} version`);
  }
}

/**
 * Check PyPI package version
 */
async function checkPypi(pkg, pinned) {
  try {
    const data = await fetchJson(`https://pypi.org/pypi/${pkg}/json`);
    const latest = data.info?.version;

    if (!latest) {
      console.log(`  [skip] could not fetch ${pkg} version`);
      return;
    }

    if (latest !== pinned) {
      console.log(`  [drift] ${pkg}: pinned=${pinned}, latest=${latest}`);
      drift = true;
    } else {
      console.log(`  [ok]    ${pkg}: ${pinned}`);
    }
  } catch {
    console.log(`  [skip] could not fetch ${pkg} version`);
  }
}

async function main() {
  console.log("Taruvi skill version check — taruvi-app-developer");
  console.log("---------------------------------------------------");

  await checkPypi("taruvi", PINNED_PYTHON_SDK);
  await checkNpm("@taruvi/sdk", PINNED_JS_SDK);
  await checkNpm("@taruvi/refine-providers", PINNED_REFINE_PROVIDERS);

  console.log("");

  if (drift) {
    console.log("Drift detected. Skill content may reference older API shapes.");
    console.log("Verify against package source before trusting skill specifics.");
    process.exit(1);
  }

  console.log("All pinned versions match latest. Skill content is current.");
  process.exit(0);
}

main();
