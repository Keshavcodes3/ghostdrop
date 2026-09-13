import type { IncomingMessage, ServerResponse } from "node:http";
import { uploadService, downloadService } from "./upload.service.js";

export const handleUpload = (req: IncomingMessage, res: ServerResponse) => {
  return uploadService(req, res);
};

export const handleDownload = (req: IncomingMessage, res: ServerResponse, fileId: string) => {
  return downloadService(req, res, fileId);
};
