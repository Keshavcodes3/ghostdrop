# 👻 GhostDrop

> *Peer-to-peer file sharing, without the middleman.*

**Private** · **Peer-to-Peer** · **Temporary**

`TypeScript` · `WebRTC` · `WebSocket` · `Next.js` · `Node.js`

[About](#-about) • [How It Works](#-how-it-works) • [Features](#-features) • [Architecture](#️-architecture) • [Getting Started](#-getting-started) • [Roadmap](#️-roadmap)

---

## 📖 About

**GhostDrop** is a *temporary*, *peer-to-peer* file transfer app that lets two browsers exchange files **directly** using `WebRTC`.

Instead of the traditional **upload → server → download** model, GhostDrop uses a *lightweight backend* only for **signaling** and **room coordination**.

Once the `WebRTC` connection is established, the file data moves between peers over an `RTCDataChannel` — **the server never touches the file**.

### Traditional file sharing

```text
┌──────────┐       Upload        ┌──────────┐
│  Sender  │ ──────────────────► │  Server  │
└──────────┘                     └────┬─────┘
                                      │
                                  Download
                                      │
                                      ▼
                                ┌──────────┐
                                │ Receiver │
                                └──────────┘
```

### GhostDrop

```text
┌──────────┐                       ┌──────────┐
│  Sender  │ ═════════════════════ │ Receiver │
└──────────┘       WebRTC          └──────────┘
                         │
                    Direct Data
```

> The server helps peers **find** and **negotiate** with each other. It does *not* act as the file-storage layer.

---

## 🎯 The Goal

GhostDrop is built around one simple idea:

> ***Move the file, not the file to a server.***

The project is also an *exploration* of how modern networking works inside the browser.

While building GhostDrop, the system explores:

`WebSockets` · `WebRTC` · `ICE` · `STUN / TURN` · `NAT traversal` · `DataChannels` · `Binary data` · `File chunking` · `Streaming` · `Backpressure` · `Connection state` · `Distributed state` · `Cryptography` · `Docker` · `Scaling signaling infrastructure`

---

## ⚡ Features

### Current MVP

- **Create** *temporary rooms*
- **Generate** *shareable room links*
- **Join** rooms
- **Two-peer** connections
- **WebSocket** signaling
- **WebRTC** peer connection
- **File** selection
- **File metadata** exchange
- **Chunked** file transfer
- **Transfer** *progress*, *speed*, and *cancellation*
- **Connection** status
- **Room** expiration
- **Basic** error handling
- **Automatic** cleanup

### Future

- *Application-level* **end-to-end encryption**
- **Pause / resume**
- **Resumable** transfers
- **Automatic** reconnection
- **Transfer** retry
- **QR-code** sharing
- **Multi-file** transfer improvements
- **Multi-peer** rooms
- **Rate limiting**
- **Redis-backed** signaling
- **Horizontal** scaling
- **Monitoring**
- **Production** deployment

---

## 🔥 How It Works

GhostDrop has **two completely different** communication paths.

```text
                 ┌──────────────────────┐
                 │   Signaling Server   │
                 │                      │
                 │   Room Management    │
                 │   WebRTC Signaling   │
                 └──────────┬───────────┘
                            │
                         WebSocket
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
        ┌──────────┐                 ┌──────────┐
        │ Browser A│                 │ Browser B│
        │  Sender  │                 │ Receiver │
        └────┬─────┘                 └────┬─────┘
             │                            │
             └════════════════════════════┘
                    WebRTC
                  DataChannel
                       │
                    File Data
```

### 1. Room creation

The **sender** creates a *temporary room*:

```http
POST /room
```

The server generates a unique room ID:

```text
7F4K9P
```

The sender receives:

```text
/room/7F4K9P
```

That link can be shared with the **receiver**.

### 2. Peer joins

The **receiver** opens the room URL.

Both clients open `WebSocket` connections to the signaling server.

The server keeps *temporary* room state:

```typescript
type Room = {
  id: string;
  peers: Peer[];
  createdAt: number;
  expiresAt: number;
};
```

> The **MVP** allows *exactly two peers* per room.

### 3. WebRTC signaling

`WebRTC` does *not magically* know how to find the other browser.

Peers first exchange connection info. The signaling server forwards messages such as:

`OFFER` · `ANSWER` · `ICE_CANDIDATE`

```text
  Peer A                  Server                  Peer B
    |                       |                       |
    |--- OFFER ------------>|                       |
    |                       |--- OFFER ------------>|
    |                       |                       |
    |                       |<----------- ANSWER ---|
    |<----------- ANSWER ---|                       |
    |                       |                       |
    |--- ICE -------------->|--- ICE -------------->|
    |                       |                       |
    |===============================================|
    |      WebRTC Connection established            |
    |                       |                       |
```

**1.** `Peer A` → `Server` → `Peer B` : ***OFFER***
**2.** `Peer B` → `Server` → `Peer A` : ***ANSWER***
**3.** Both sides exchange ***ICE candidates***
**4.** Peers establish a **direct** `WebRTC` connection

Once negotiation succeeds, the signaling server is **no longer** responsible for the file.

---

## 🌐 WebRTC DataChannel

GhostDrop uses:

- **`RTCPeerConnection`**
- **`RTCDataChannel`**

The `DataChannel` lets browsers exchange *arbitrary data*.

For file transfer:

```text
File
  │
  ▼
ArrayBuffer / Uint8Array
  │
  ▼
Chunks
  │
  ▼
RTCDataChannel
  │
  ▼
Receiver
```

> This is where the **actual file transfer** happens.

---

## 📦 File Transfer Protocol

GhostDrop separates *control messages* from **binary file data**.

A simplified transfer:

```text
FILE_OFFER
     │
     ▼
TRANSFER_ACCEPT
     │
     ▼
TRANSFER_START
     │
     ▼
FILE_CHUNK
     │
     ▼
FILE_CHUNK
     │
     ▼
FILE_CHUNK
     │
     ▼
     ...
     │
     ▼
TRANSFER_COMPLETE
```

If something goes wrong:

```text
TRANSFER_ERROR
```

If either peer cancels:

```text
TRANSFER_CANCEL
```

Every transfer gets a unique `transferId`:

```json
{
  "type": "FILE_OFFER",
  "transferId": "tr_8f31a",
  "fileName": "video.mp4",
  "fileSize": 524288000,
  "mimeType": "video/mp4"
}
```

> The file itself is *not* included in the metadata message.

---

## 🧩 Chunking

A large file cannot be treated as **one giant message**.

Instead:

```text
500 MB File

┌─────────────┐
│  Chunk 001  │
├─────────────┤
│  Chunk 002  │
├─────────────┤
│  Chunk 003  │
├─────────────┤
│  Chunk 004  │
├─────────────┤
│     ...     │
├─────────────┤
│  Chunk N    │
└─────────────┘
```

The **sender** reads the file *incrementally* and sends chunks through the `DataChannel`.

The **receiver** collects chunks and *reconstructs* the original file.

This introduces an important networking problem:

> ***Backpressure***

The sender cannot blindly push data as fast as possible.

```text
Sender
  │
  │  chunks sent fast
  ▼
DataChannel
  │
  │  Buffer filling...
  ▼
Receiver
```

GhostDrop will eventually use `DataChannel` buffering info to **control send speed**.

---

## 🔐 Security Model

GhostDrop is designed around *temporary peer-to-peer* transfers.

The initial **MVP** relies on `WebRTC`'s *encrypted transport*.

Later versions will explore **application-level encryption**:

```text
Original File
     │
     ▼
Encrypt
     │
     ▼
Encrypted Chunks
     │
     ▼
WebRTC
     │
     ▼
Encrypted Chunks
     │
     ▼
Decrypt
     │
     ▼
Original File
```

Potential technologies:

`Web Crypto API` · `AES-GCM` · *ephemeral keys* · *key exchange* · *authenticated encryption*

> The security model will be documented *separately* as the cryptographic layer is introduced.

---

## 🏗️ Architecture

### MVP architecture

```text
                         ┌───────────────────┐
                         │      Client       │
                         │     Next.js       │
                         └─────────┬─────────┘
                                   │
                           WebSocket / HTTP
                                   │
                                   ▼
                         ┌───────────────────┐
                         │ Signaling Server  │
                         │      Node.js      │
                         └─────────┬─────────┘
                                   │
                              Room State
                                   │
                     ┌─────────────┴─────────────┐
                     │                           │
                     ▼                           ▼
               ┌──────────┐               ┌──────────┐
               │ Browser A│               │ Browser B│
               │  Sender  │               │ Receiver │
               └────┬─────┘               └────┬─────┘
                    │                            │
                    └════════════════════════════┘
                              WebRTC
                            DataChannel
                                 │
                             File Data
```

### 🧱 Components

**Frontend**

Responsible for:

- *UI*
- **room** creation
- **room** joining
- `WebSocket` connection
- `WebRTC` negotiation
- **file** selection
- **transfer** state
- **progress** UI
- **download** handling

**Signaling server**

Responsible for:

- **room** creation
- **room** membership
- **peer** discovery
- **forwarding** `WebRTC` signaling messages
- **disconnect** detection
- **room** expiration
- **cleanup**

**WebRTC layer**

Responsible for:

- **peer** connection
- `ICE` negotiation
- `DataChannel`
- **binary** transfer
- **connection** state

**Transfer layer**

Responsible for:

- **file** metadata
- **chunking**
- **transfer** state
- **progress**
- *backpressure*
- **cancellation**
- **reconstruction**

---

## 📁 Project Structure

> *The structure will evolve as the system grows.*

```text
ghostdrop/
│
├── apps/
│   │
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   │       ├── websocket/
│   │       ├── webrtc/
│   │       └── transfer/
│   │
│   └── signaling/
│       └── src/
│           ├── rooms/
│           ├── websocket/
│           ├── signaling/
│           └── server/
│
├── packages/
│   └── shared/
│       └── protocol/
│
├── docker/
│
├── docker-compose.yml
├── package.json
├── README.md
└── LICENSE
```

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | `Next.js` |
| *UI* | `React` |
| **Language** | `TypeScript` |
| *Signaling* | `WebSocket` |
| **Peer connection** | `WebRTC` |
| *File transfer* | `RTCDataChannel` |
| **Runtime** | `Node.js` |
| *Styling* | `Tailwind CSS` |
| **Containerization** | `Docker` |
| *State* | *In-memory initially* |
| **Scaling** | *Redis — later* |
| *Deployment* | *Vercel + dedicated signaling server* |

---

## 🚀 Getting Started

> *Development setup will be documented as implementation progresses.*

**Prerequisites**

Make sure you have:

- **`Node.js`**
- **`npm` / `pnpm`**
- **`Git`**
- *A modern browser*

**Clone the repository:**

```bash
git clone https://github.com/<your-username>/ghostdrop.git
cd ghostdrop
```

**Install dependencies:**

```bash
npm install
```

**Create your environment file:**

```bash
cp .env.example .env
```

**Start the development server:**

```bash
npm run dev
```

> *Exact commands may change as the architecture is finalized.*

---

## 🔬 Development Phases

GhostDrop is intentionally developed **from the networking layer upward**.

### Phase 1 — WebSocket playground

```text
Browser
   │
   ▼
WebSocket
   │
   ▼
Node.js
```

Learn:

- *persistent connections*
- **events**
- **messages**
- **disconnects**
- **rooms**

### Phase 2 — Room system

Build:

- **room** creation
- **room** joining
- **peer** tracking
- **room** expiration
- **cleanup**

### Phase 3 — WebRTC

Build:

- `RTCPeerConnection`
- *SDP offer*
- *SDP answer*
- `ICE candidates`
- `STUN`
- `DataChannels`

### Phase 4 — File transfer

Build:

- **file** metadata
- **binary** chunks
- **chunk** reconstruction
- **progress**
- **transfer** speed
- **cancellation**
- **error** handling

### Phase 5 — Reliability

Explore:

- *backpressure*
- **retries**
- **reconnects**
- **timeouts**
- **transfer** recovery
- **resumable** transfers

### Phase 6 — Security

Explore:

- `Web Crypto API`
- `AES-GCM`
- *key exchange*
- *ephemeral keys*
- *threat modeling*

### Phase 7 — Infrastructure

Explore:

- `Docker`
- `Docker Compose`
- *reverse proxies*
- *HTTPS*
- `Redis`
- *rate limiting*
- *monitoring*

### Phase 8 — Scaling

Eventually:

```text
                         Load Balancer
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Signaling A     Signaling B     Signaling C
              │               │               │
              └───────────────┼───────────────┘
                              │
                            Redis
```

> This stage explores how *temporary room state* works across **multiple signaling servers**.

---

## 🎯 MVP Boundary

The **MVP** deliberately supports *two peers only*.

**Included**

- [x] *Temporary rooms*
- [x] *Shareable links*
- [x] **Two peers**
- [x] `WebSocket` signaling
- [x] `WebRTC` connection
- [x] **File** transfer
- [x] **Chunking**
- [x] **Progress**
- [x] **Cancellation**
- [x] **Error** handling
- [x] **Room** expiration

**Not included**

- [ ] *User accounts*
- [ ] *Cloud storage*
- [ ] *Permanent file history*
- [ ] `PostgreSQL`
- [ ] `Redis`
- [ ] *Multi-peer rooms*
- [ ] *Payments*
- [ ] *Social features*
- [ ] *Chat*
- [ ] *Pause / resume*
- [ ] *Resumable transfers*
- [ ] *Advanced analytics*

The objective of the **MVP** is to prove the complete pipeline:

```text
Create
  ↓
Join
  ↓
Signal
  ↓
Connect
  ↓
Transfer
  ↓
Receive
  ↓
Download
  ↓
Destroy
```

---

## 🧪 MVP Acceptance Criteria

GhostDrop's **MVP** is complete when:

**Basic transfer**

> *Two users on different networks can connect and transfer a file.*

**Multiple files**

> *Multiple selected files can be transferred successfully.*

**Large file**

> *A reasonably large file transfers without crashing the browser or server.*

**Cancellation**

> *Either peer can **cancel** an active transfer.*

**Disconnect**

> *If a peer disconnects, the other peer receives an appropriate **failure state**.*

**Room isolation**

> *Peers in different rooms **cannot** communicate with one another.*

**Expiration**

> *Inactive rooms are **automatically** removed.*

---

## 🧠 What This Project Teaches

GhostDrop is more than a file-sharing UI.

It is an exploration of:

```text
Browser APIs
      ↓
WebSockets
      ↓
WebRTC
      ↓
NAT Traversal
      ↓
Peer-to-Peer Networking
      ↓
Binary Data
      ↓
Streaming
      ↓
Backpressure
      ↓
Distributed State
      ↓
Security
      ↓
Infrastructure
      ↓
Scaling
```

> The end goal is to understand what *actually happens* when data moves between **two computers** across the internet.

---

## 🗺️ Roadmap

- [ ] *WebSocket playground*
- [ ] *Temporary room system*
- [ ] *Peer discovery*
- [ ] `WebRTC` *signaling*
- [ ] `STUN` *configuration*
- [ ] `DataChannel` *connection*
- [ ] **File metadata** protocol
- [ ] **Chunked** transfer
- [ ] **Progress** tracking
- [ ] **Cancellation**
- [ ] **Error** handling
- [ ] **Room** expiration

```text
──────────── MVP ────────────
```

- [ ] *Backpressure*
- [ ] *Reconnection*
- [ ] *Resumable transfers*
- [ ] **Application-level** encryption
- [ ] **QR** sharing
- [ ] **Better** large-file support
- [ ] **Rate** limiting

```text


## 📜 License

This project is licensed under the ***MIT License***.

---

> *👻 GhostDrop*
>
> ***Drop the file. Lose the middleman.***
>
> *Built with curiosity, `TypeScript`, and a questionable amount of networking.*
