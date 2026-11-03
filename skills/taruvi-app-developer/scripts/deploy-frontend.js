#!/usr/bin/env node
/**
 * deploy-frontend.js — Deploy frontend build to Taruvi Frontend Workers
 *
 * Usage:
 *   node skills/taruvi-app-developer/scripts/deploy-frontend.js <SITE_URL> <API_KEY> <APP_SLUG>
 *
 * Example:
 *   node skills/taruvi-app-developer/scripts/deploy-frontend.js "https://mysite.taruvi.app" "my-api-key" "my-app"
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const [, , SITE_URL, API_KEY, APP_SLUG] = process.argv;

if (!SITE_URL || !API_KEY || !APP_SLUG) {
  console.error("Error: Missing required arguments");
  console.error("Usage: node deploy-frontend.js <SITE_URL> <API_KEY> <APP_SLUG>");
  process.exit(1);
}

const DIST_ZIP = "dist.zip";

if (!fs.existsSync(DIST_ZIP)) {
  console.error(`Error: ${DIST_ZIP} not found. Build and zip the app first:`);
  console.error("  npm run build");
  console.error("  zip -r dist.zip dist/   (or use a zip tool on Windows)");
  process.exit(1);
}

/**
 * Make an HTTP/HTTPS request
 */
function request(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers,
    };

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Upload file using multipart/form-data
 */
function uploadFile(method, url, headers, fields, filePath, fileFieldName) {
  return new Promise((resolve, reject) => {
    const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    let body = "";
    for (const [key, value] of Object.entries(fields)) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }

    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const preFile = `--${boundary}\r\nContent-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"\r\nContent-Type: application/zip\r\n\r\n`;
    const postFile = `\r\n--${boundary}--\r\n`;

    const preBuffer = Buffer.from(body + preFile, "utf-8");
    const postBuffer = Buffer.from(postFile, "utf-8");
    const fullBody = Buffer.concat([preBuffer, fileContent, postBuffer]);

    const options = {
      method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        ...headers,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": fullBody.length,
      },
    };

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", reject);
    req.write(fullBody);
    req.end();
  });
}

async function main() {
  console.log(`Deploying '${APP_SLUG}' to ${SITE_URL}...`);

  // Get default worker slug from app settings
  const settingsRes = await request(
    "GET",
    `${SITE_URL}/api/apps/${APP_SLUG}/settings/`,
    { Authorization: `Api-Key ${API_KEY}` }
  );

  const workerSlug = settingsRes.data?.data?.default_frontend_worker_slug;

  if (workerSlug) {
    console.log(`Updating existing worker: ${workerSlug}`);

    // Update existing worker
    const updateRes = await uploadFile(
      "PATCH",
      `${SITE_URL}/api/cloud/frontend_workers/${workerSlug}/`,
      { Authorization: `Api-Key ${API_KEY}` },
      {},
      DIST_ZIP,
      "file"
    );

    const buildUuid = updateRes.data?.data?.latest_build?.uuid;
    if (buildUuid) {
      console.log(`Activating build: ${buildUuid}`);

      await request(
        "PATCH",
        `${SITE_URL}/api/cloud/frontend_workers/${workerSlug}/set-active-build/`,
        {
          Authorization: `Api-Key ${API_KEY}`,
          "Content-Type": "application/json",
        },
        JSON.stringify({ build_uuid: buildUuid })
      );

      console.log(`Deploy complete! Build ${buildUuid} is now active.`);
    } else {
      console.warn("Warning: Could not extract build UUID from response");
      console.log(JSON.stringify(updateRes.data, null, 2));
    }
  } else {
    console.log(`Creating new worker: ${APP_SLUG}`);

    // Create new worker (first build auto-activates)
    const createRes = await uploadFile(
      "POST",
      `${SITE_URL}/api/cloud/frontend_workers/`,
      { Authorization: `Api-Key ${API_KEY}` },
      {
        name: APP_SLUG,
        subdomain_input: APP_SLUG,
        is_internal: "true",
      },
      DIST_ZIP,
      "file"
    );

    const newWorkerSlug = createRes.data?.data?.slug || createRes.data?.slug;
    if (newWorkerSlug) {
      console.log(`Deploy complete! New worker created: ${newWorkerSlug}`);
    } else {
      console.error("Error: Failed to create worker");
      console.log(JSON.stringify(createRes.data, null, 2));
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Deploy failed:", err.message);
  process.exit(1);
});
