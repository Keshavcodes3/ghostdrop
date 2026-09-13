import type { IncomingMessage, ServerResponse } from "node:http";
import { handleUpload, handleDownload } from "./aupload.controller.js";

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

export const uploadRoutes = (req: IncomingMessage, res: ServerResponse) => {
  const rawUrl = req.url ?? "/";
  const host = req.headers.host ?? "localhost";
  const url = new URL(rawUrl, `http://${host}`);
  if (req.method === "POST" && url.pathname === "/upload") {
    return handleUpload(req, res);
  }
  if (req.method === "GET" && url.pathname.startsWith("/download/")) {
    const fileId = url.pathname.slice("/download/".length).split("/")[0] ?? "";
    if (!fileId) {
      sendJson(res, 400, { error: "Missing file id" });
      return;
    }
    return handleDownload(req, res, fileId);
  }
  sendJson(res, 404, { error: "Route not found" });
};
