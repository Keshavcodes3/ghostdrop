import http from "node:http";
import Busboy from "busboy";
import fs from "node:fs";
import path from "node:path";
import { createFileId, sanitizeFilename, resolveUploadDir } from "../Modules/Upload/upload.utils.js";

export type UploadResult = {
  fileId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
};

export const busBoyUploadMiddleware = (req: http.IncomingMessage): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) {
      req.resume();
      reject(Object.assign(new Error("Expected multipart/form-data"), { statusCode: 400 }));
      return;
    }
    let settled = false;
    const fail = (err: unknown) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    const succeed = (value: UploadResult) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    let busboy: ReturnType<typeof Busboy>;
    try {
      busboy = Busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: 500 * 1024 * 1024, fields: 10 }
      });
    } catch (err) {
      req.resume();
      fail(err);
      return;
    }
    const uploadDir = resolveUploadDir();
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
      fail(err);
      return;
    }
    let fileCount = 0;
    let pending: UploadResult | null = null;
    let writeError: unknown = null;
    busboy.on("file", (fieldname, fileStream, fileInfo) => {
      fileCount += 1;
      if (fileCount > 1) {
        fileStream.resume();
        fail(Object.assign(new Error("Only one file allowed per request"), { statusCode: 400 }));
        return;
      }
      const originalName = fileInfo.filename || "unnamed";
      const safeName = sanitizeFilename(originalName);
      const fileId = createFileId();
      const storedName = `${fileId}-${safeName}`;
      const filePath = path.join(uploadDir, storedName);
      const out = fs.createWriteStream(filePath);
      let size = 0;
      const mimeType = fileInfo.mimeType || "application/octet-stream";
      fileStream.on("data", (chunk: Buffer) => {
        size += chunk.length;
      });
      fileStream.on("limit", () => {
        out.destroy();
        fs.rm(filePath, { force: true }, () => undefined);
        fail(Object.assign(new Error("File too large"), { statusCode: 413 }));
      });
      out.on("error", (err) => {
        writeError = err;
        fileStream.resume();
      });
      fileStream.pipe(out);
      fileStream.on("end", () => {
        pending = { fileId, fileName: originalName, filePath, mimeType, size };
      });
    });
    busboy.on("field", (name, _val) => {
      void name;
      void _val;
    });
    busboy.on("error", (err) => {
      fail(err);
    });
    busboy.on("close", () => {
      if (writeError) {
        fail(writeError);
        return;
      }
      if (!pending) {
        fail(Object.assign(new Error("No file provided"), { statusCode: 400 }));
        return;
      }
      succeed(pending);
    });
    req.on("aborted", () => {
      fail(Object.assign(new Error("Request aborted"), { statusCode: 499 }));
    });
    req.pipe(busboy);
  });
};

export const busBoyUploadMidlleware = busBoyUploadMiddleware;
