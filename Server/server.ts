import {WebSocketServer} from "ws"
import connect from "./src/connect.js"
import http from "node:http"

import { busBoyUploadMidlleware } from "./src/Middleware/busBoy.upload.js"
import { uploadRoutes } from "./src/Modules/Upload/upload.routes.js"
import { uploadService } from "./src/Modules/Upload/upload.service.js"
const PORT=4000

const server=http.createServer()

server.on("request",(req,res)=>{
    if(req.method=="GET" && req.url=="/")
    {
        res.end("hi this is ghost drop")
    }
    if(req.method=="POST" && req.url=="/upload"){
        uploadRoutes(req,res)
    }
})

const wss=new WebSocketServer({
    noServer:true,
})
server.on("upgrade",(req,socket,head)=>{
    wss.handleUpgrade(req,socket,head,(ws)=>{
        wss.emit("connection",ws,req)
        ws.send(JSON.stringify({
            type:"Welcome",
            message:"connected to GhostDrop signaling server",
        }))
    })
})


wss.on("connection",(socket)=>{
    connect.addClient(socket)
    socket.send(JSON.stringify({
        type:"Welcome",
        message:"connected to GhostDrop signaling server",
    }))

  socket.on("message", (data) => {
    console.log("Received:", data.toString());
    connect.broadCastMessages(socket,data.toString())
  });

  socket.on("close", () => {
    connect.removeClient(socket)
    console.log("Peer disconnected");
  });
})

server.listen(PORT,()=>{
    console.log(`GhostDrop signaling server running on ws://localhost:${PORT}`);
})


