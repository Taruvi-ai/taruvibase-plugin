#!/usr/bin/env node
/**
 * export-backend.js — Export Taruvi app backend config to .taruvi-backend/
 *
 * Usage:
 *   node skills/taruvi-app-developer/scripts/export-backend.js <SITE_URL> <API_KEY> <APP_SLUG>
 *
 * Example:
 *   node skills/taruvi-app-developer/scripts/export-backend.js "https://mysite.taruvi.app" "my-api-key" "my-app"
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { execSync } = require("child_process");

const [, , SITE_URL, API_KEY, APP_SLUG] = process.argv;

if (!SITE_URL || !API_KEY || !APP_SLUG) {
  console.error("Error: Missing required arguments");
  console.error("Usage: node export-backend.js <SITE_URL> <API_KEY> <APP_SLUG>");
  process.exit(1);
}

const OUTPUT_DIR = ".taruvi-backend";
const TEMP_ZIP = "app-package.zip";

/**
 * Make an HTTP/HTTPS POST request and save response to file
 */
function downloadFile(url, headers, body, outputPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      method: "POST",
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = client.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorData = "";
        res.on("data", (chunk) => (errorData += chunk));
        res.on("end", () => {
          reject(new Error(`Export failed with status ${res.statusCode}: ${errorData}`));
        });
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });

      fileStream.on("error", (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Remove directory recursively
 */
function rmdir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Count files in directory recursively
 */
function countFiles(dir) {
  let count = 0;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      count += countFiles(path.join(dir, item.name));
    } else {
      count++;
    }
  }
  return count;
}

/**
 * Extract zip file using system unzip or PowerShell
 */
function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });

  const isWindows = process.platform === "win32";

  if (isWindows) {
    // Use PowerShell on Windows
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    // Use unzip on Unix
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "inherit" });
  }
}

async function main() {
  console.log(`Exporting app '${APP_SLUG}' from ${SITE_URL}...`);

  const exportBody = JSON.stringify({
    include_app_roles: true,
    include_datatables: true,
    include_functions: true,
    include_events: true,
    include_widgets: true,
    include_secrets: true,
    include_policies: true,
    include_analytics: true,
    include_storage: true,
  });

  // Download the export package
  await downloadFile(
    `${SITE_URL}/api/apps/${APP_SLUG}/packages/`,
    { Authorization: `Api-Key ${API_KEY}` },
    exportBody,
    TEMP_ZIP
  );

  // Prepare target directory
  rmdir(OUTPUT_DIR);

  // Extract
  extractZip(TEMP_ZIP, OUTPUT_DIR);

  // Clean up
  fs.unlinkSync(TEMP_ZIP);

  // Report
  const fileCount = countFiles(OUTPUT_DIR);
  console.log("");
  console.log(`Export complete! ${fileCount} files extracted to ${OUTPUT_DIR}/`);
  console.log("");
  console.log("Next steps:");
  console.log("  git add .taruvi-backend");
  console.log("  git commit -m 'chore: export backend config'");
  console.log("  git push");
}

main().catch((err) => {
  console.error("Export failed:", err.message);
  // Clean up temp file if it exists
  if (fs.existsSync(TEMP_ZIP)) {
    fs.unlinkSync(TEMP_ZIP);
  }
  process.exit(1);
});
