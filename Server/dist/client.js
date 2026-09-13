import WebSocket from "ws";
const socket = new WebSocket("ws://localhost:4000");
socket.on("open", () => {
    console.log("Connected to server");
    socket.send("hello ghostdrop");
});
socket.on("message", (message) => {
    console.log("Server:", message.toString());
});
socket.on("close", () => {
    console.log("Disconnected");
});
//# sourceMappingURL=client.js.map