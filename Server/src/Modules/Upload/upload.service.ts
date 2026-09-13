import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { busBoyUploadMiddleware } from "../../Middleware/busBoy.upload.js";
import { setFile, getFile } from "../../Data/fileMap.js";
import { buildDownloadPath } from "./upload.utils.js";

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

export const uploadService = async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const result = await busBoyUploadMiddleware(req);
    setFile(result.fileId, {
      filePath: result.filePath,
      fileName: result.fileName,
      mimeType: result.mimeType,
      size: result.size
    });
    sendJson(res, 201, {
      fileId: result.fileId,
      fileName: result.fileName,
      fileSize: result.size,
      mimeType: result.mimeType,
      downloadUrl: buildDownloadPath(result.fileId)
    });
  } catch (err: unknown) {
    const status = typeof err === "object" && err !== null && "statusCode" in err
      ? Number((err as { statusCode: unknown }).statusCode) || 500
      : 500;
    const message = err instanceof Error ? err.message : "Upload failed";
    if (!res.writableEnded) {
      sendJson(res, status, { error: message });
    }
  }
};

export const downloadService = (req: IncomingMessage, res: ServerResponse, fileId: string) => {
  void req;
  const record = getFile(fileId);
  if (!record) {
    sendJson(res, 404, { error: "File not found" });
    return;
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(record.filePath);
  } catch {
    sendJson(res, 410, { error: "File no longer available" });
    return;
  }
  const safeBase = path.basename(record.fileName).replace(/"/g, "");
  res.statusCode = 200;
  res.setHeader("Content-Type", record.mimeType);
  res.setHeader("Content-Length", String(stat.size));
  res.setHeader("Content-Disposition", `attachment; filename="${safeBase}"`);
  const stream = fs.createReadStream(record.filePath);
  stream.on("error", () => {
    if (!res.writableEnded) {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Failed to read file" });
      } else {
        res.destroy();
      }
    }
  });
  stream.pipe(res);
};

export const getsharableLink = (fileId: string) => {
  return buildDownloadPath(fileId);
};
