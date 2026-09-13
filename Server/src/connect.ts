import { WebSocket } from "ws";
import type { SignalMessage, ServerMessage } from "./Data/socketMessages.js";

type Room = {
  peers: Map<string, WebSocket>;
  createdAt: number;
  expiresAt: number;
  timer: NodeJS.Timeout;
};

type SocketMeta = {
  roomId: string;
  peerId: string;
};

const MAX_PEERS = 2;
const ROOM_TTL_MS = 30 * 60 * 1000;

class RoomManager {
  private rooms = new Map<string, Room>();
  private socketMeta = new Map<WebSocket, SocketMeta>();

  addClient = (_socket: WebSocket) => {
    void _socket;
  };

  removeClient = (socket: WebSocket) => {
    const meta = this.socketMeta.get(socket);
    if (!meta) {
      return;
    }
    this.leaveRoom(socket, meta.roomId, meta.peerId, "disconnect");
  };

  handleMessage = (socket: WebSocket, raw: unknown) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      this.sendError(socket, "INVALID_JSON", "Message must be JSON");
      return;
    }
    const msg = parsed as Partial<SignalMessage>;
    if (!msg || typeof msg.type !== "string") {
      this.sendError(socket, "INVALID_MESSAGE", "Missing message type");
      return;
    }
    switch (msg.type) {
      case "JOIN_ROOM":
        if (typeof msg.roomId !== "string" || typeof (msg as { peerId?: unknown }).peerId !== "string") {
          this.sendError(socket, "INVALID_JOIN", "roomId and peerId are required");
          return;
        }
        this.joinRoom(socket, msg.roomId, (msg as { peerId: string }).peerId);
        return;
      case "LEAVE_ROOM":
        if (typeof msg.roomId !== "string" || typeof (msg as { peerId?: unknown }).peerId !== "string") {
          this.sendError(socket, "INVALID_LEAVE", "roomId and peerId are required");
          return;
        }
        this.leaveRoom(socket, msg.roomId, (msg as { peerId: string }).peerId, "left");
        return;
      case "OFFER":
      case "ANSWER":
      case "ICE_CANDIDATE":
        this.forward(socket, msg as SignalMessage);
        return;
      default:
        this.sendError(socket, "UNKNOWN_TYPE", `Unsupported type ${(msg as { type: string }).type}`);
        return;
    }
  };

  broadCastMessages = (sender: WebSocket, payload: string) => {
    this.handleMessage(sender, payload);
  };

  private joinRoom = (socket: WebSocket, roomId: string, peerId: string) => {
    if (!roomId.trim() || !peerId.trim()) {
      this.sendError(socket, "INVALID_ID", "roomId and peerId must be non-empty");
      return;
    }
    const existing = this.socketMeta.get(socket);
    if (existing && existing.roomId !== roomId) {
      this.leaveRoom(socket, existing.roomId, existing.peerId, "left");
    }
    let room = this.rooms.get(roomId);
    if (!room) {
      const now = Date.now();
      const created: Room = {
        peers: new Map(),
        createdAt: now,
        expiresAt: now + ROOM_TTL_MS,
        timer: setTimeout(() => this.expireRoom(roomId), ROOM_TTL_MS)
      };
      created.timer.unref?.();
      this.rooms.set(roomId, created);
      room = created;
    }
    if (Date.now() > room.expiresAt) {
      this.expireRoom(roomId);
      this.send(socket, { type: "ROOM_EXPIRED", roomId } satisfies ServerMessage);
      return;
    }
    const occupant = room.peers.get(peerId);
    if (occupant && occupant !== socket) {
      this.sendError(socket, "PEER_ID_TAKEN", "peerId already in use in this room");
      return;
    }
    if (!room.peers.has(peerId) && room.peers.size >= MAX_PEERS) {
      this.send(socket, { type: "ROOM_FULL", roomId } satisfies ServerMessage);
      return;
    }
    room.peers.set(peerId, socket);
    this.socketMeta.set(socket, { roomId, peerId });
    const peers = [...room.peers.keys()];
    this.send(socket, { type: "ROOM_JOINED", roomId, peerId, peers } satisfies ServerMessage);
    for (const [otherId, otherSocket] of room.peers) {
      if (otherId !== peerId && otherSocket.readyState === WebSocket.OPEN) {
        this.send(otherSocket, { type: "PEER_JOINED", roomId, peerId } satisfies ServerMessage);
      }
    }
  };

  private leaveRoom = (socket: WebSocket, roomId: string, peerId: string, reason: "left" | "disconnect") => {
    const room = this.rooms.get(roomId);
    const meta = this.socketMeta.get(socket);
    if (!room) {
      return;
    }
    if (!meta || meta.roomId !== roomId || meta.peerId !== peerId) {
      return;
    }
    room.peers.delete(peerId);
    this.socketMeta.delete(socket);
    for (const otherSocket of room.peers.values()) {
      if (otherSocket.readyState === WebSocket.OPEN) {
        this.send(otherSocket, { type: "PEER_LEFT", roomId, peerId, reason } satisfies ServerMessage);
      }
    }
    if (room.peers.size === 0) {
      clearTimeout(room.timer);
      this.rooms.delete(roomId);
    }
  };

  private forward = (socket: WebSocket, msg: SignalMessage) => {
    if (msg.type !== "OFFER" && msg.type !== "ANSWER" && msg.type !== "ICE_CANDIDATE") {
      return;
    }
    const { roomId, from, to } = msg;
    if (!roomId || !from || !to) {
      this.sendError(socket, "INVALID_SIGNAL", "roomId, from and to are required");
      return;
    }
    const meta = this.socketMeta.get(socket);
    if (!meta || meta.roomId !== roomId || meta.peerId !== from) {
      this.sendError(socket, "NOT_IN_ROOM", "Join the room before signaling");
      return;
    }
    const room = this.rooms.get(roomId);
    if (!room) {
      this.send(socket, { type: "ROOM_EXPIRED", roomId } satisfies ServerMessage);
      return;
    }
    const target = room.peers.get(to);
    if (!target || target.readyState !== WebSocket.OPEN) {
      this.sendError(socket, "PEER_NOT_FOUND", "Target peer is not connected");
      return;
    }
    target.send(JSON.stringify(msg));
  };

  private expireRoom = (roomId: string) => {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    clearTimeout(room.timer);
    for (const [peerId, peerSocket] of room.peers) {
      void peerId;
      this.socketMeta.delete(peerSocket);
      if (peerSocket.readyState === WebSocket.OPEN) {
        this.send(peerSocket, { type: "ROOM_EXPIRED", roomId } satisfies ServerMessage);
      }
    }
    this.rooms.delete(roomId);
  };

  private send = (socket: WebSocket, msg: ServerMessage | { type: string; message: string }) => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(msg));
  };

  private sendError = (socket: WebSocket, code: string, message: string) => {
    this.send(socket, { type: "ERROR", code, message } satisfies ServerMessage);
  };
}

export default new RoomManager();
