import path from "node:path";
import { nanoid } from "nanoid";

export const createFileId = () => {
  return nanoid(12);
};

export const sanitizeFilename = (filename: string) => {
  const base = path.basename(filename).trim();
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  return cleaned.length > 0 ? cleaned : "unnamed";
};

export const resolveUploadDir = () => {
  return path.join(process.cwd(), "src", "files");
};

export const buildDownloadPath = (fileId: string) => {
  return `/download/${fileId}`;
};
