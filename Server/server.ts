import { WebSocketServer } from "ws";
import connect from "./src/connect.js";
import http from "node:http";
import { uploadRoutes } from "./src/Modules/Upload/upload.routes.js";

const PORT = Number(process.env.PORT ?? 4000);

const server = http.createServer((req, res) => {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  if (req.method === "GET" && url.pathname === "/") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("hi this is ghost drop");
    return;
  }
  if (req.method === "POST" && url.pathname === "/upload") {
    uploadRoutes(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname.startsWith("/download/")) {
    uploadRoutes(req, res);
    return;
  }
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Route not found" }));
});

const wss = new WebSocketServer({
  noServer: true
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (socket) => {
  connect.addClient(socket);
  socket.send(JSON.stringify({
    type: "Welcome",
    message: "connected to GhostDrop signaling server"
  }));
  socket.on("message", (data) => {
    try {
      connect.handleMessage(socket, data.toString());
    } catch {
      try {
        socket.send(JSON.stringify({ type: "ERROR", code: "INTERNAL", message: "Failed to process message" }));
      } catch {
        void 0;
      }
    }
  });
  socket.on("close", () => {
    connect.removeClient(socket);
  });
  socket.on("error", () => {
    connect.removeClient(socket);
  });
});

server.listen(PORT, () => {
  console.log(`GhostDrop signaling server running on ws://localhost:${PORT}`);
});
