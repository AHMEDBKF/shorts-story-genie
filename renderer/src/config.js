import path from "node:path";

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DATA_DIR = process.env.DATA_DIR || path.resolve("./data");

export const config = {
  apiKey: process.env.RENDERER_API_KEY || "",
  port: num(process.env.RENDERER_PORT, 8080),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, ""),

  dataDir: DATA_DIR,
  jobsDir: path.join(DATA_DIR, "jobs"),
  workDir: path.join(DATA_DIR, "work"),
  outputDir: path.join(DATA_DIR, "output"),

  storageDriver: (process.env.STORAGE_DRIVER || "local").toLowerCase(),
  s3: {
    endpoint: process.env.S3_ENDPOINT || "",
    region: process.env.S3_REGION || "auto",
    bucket: process.env.S3_BUCKET || "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    publicBaseUrl: (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, ""),
  },

  maxConcurrentRenders: num(process.env.MAX_CONCURRENT_RENDERS, 1),
  jobRetentionHours: num(process.env.JOB_RETENTION_HOURS, 48),
  fileRetentionHours: num(process.env.FILE_RETENTION_HOURS, 24),

  version: "1.0.0",
};
