import WebSocket from "ws";

const roomId = process.argv[2] ?? "test-room";
const peerId = process.argv[3] ?? `peer-${Math.random().toString(36).slice(2, 8)}`;
const socket = new WebSocket("ws://localhost:4000");

socket.on("open", () => {
  console.log(`Connected as ${peerId} in ${roomId}`);
  socket.send(JSON.stringify({ type: "JOIN_ROOM", roomId, peerId }));
});

socket.on("message", (message) => {
  const text = message.toString();
  try {
    console.log("Server:", JSON.parse(text));
  } catch {
    console.log("Server:", text);
  }
});

socket.on("close", () => {
  console.log("Disconnected");
});

socket.on("error", (err) => {
  console.log(`Socket error: ${err.message}`);
});
