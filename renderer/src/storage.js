import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { config } from "./config.js";

/**
 * Publishes the finished MP4 and returns a downloadable HTTPS URL.
 *  - local: the file stays on this server's volume and is served by /files
 *           behind an unguessable signed token.
 *  - s3   : the file is uploaded to any S3-compatible bucket (R2, Spaces, …)
 *           with SigV4, then the public CDN URL is returned.
 */
export async function publish(renderId, filePath) {
  if (config.storageDriver === "s3") return publishToS3(renderId, filePath);
  return publishLocally(renderId, filePath);
}

async function publishLocally(renderId, filePath) {
  const token = crypto.randomBytes(16).toString("hex");
  const name = `${renderId}.${token}.mp4`;
  const target = path.join(config.outputDir, name);
  await fs.rename(filePath, target).catch(async () => {
    await fs.copyFile(filePath, target);
    await fs.rm(filePath, { force: true });
  });
  const base = config.publicBaseUrl || `http://localhost:${config.port}`;
  return `${base}/files/${name}`;
}

async function publishToS3(renderId, filePath) {
  const { endpoint, region, bucket, accessKeyId, secretAccessKey } = config.s3;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("STORAGE_DRIVER=s3 but S3_* variables are incomplete");
  }
  const body = await fs.readFile(filePath);
  const key = `renders/${renderId}.mp4`;
  const url = `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
  const headers = await signV4({
    url,
    method: "PUT",
    region,
    accessKeyId,
    secretAccessKey,
    body,
    contentType: "video/mp4",
  });

  const response = await fetch(url, { method: "PUT", headers, body });
  if (!response.ok) {
    throw new Error(`S3 upload failed (${response.status}): ${await response.text()}`);
  }
  await fs.rm(filePath, { force: true });
  const base = config.s3.publicBaseUrl || `${endpoint.replace(/\/+$/, "")}/${bucket}`;
  return `${base}/${key}`;
}

/** Minimal AWS SigV4 for a single PUT — avoids pulling in the AWS SDK. */
async function signV4({ url, method, region, accessKeyId, secretAccessKey, body, contentType }) {
  const parsed = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${parsed.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    parsed.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();
  let signingKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  for (const part of [region, "s3", "aws4_request"]) signingKey = hmac(signingKey, part);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
