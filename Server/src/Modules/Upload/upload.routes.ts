import type { IncomingMessage, ServerResponse } from "node:http";

import { busBoyUploadMidlleware } from "../../Middleware/busBoy.upload.js";
import { uploadService } from "./upload.service.js";


export const uploadRoutes=(req:IncomingMessage,res:ServerResponse)=>{
    if(req.method=="POST" && req.url=="/upload"){
        return uploadService(req,res)
    }
    res.statusCode=404
    res.end("Route not found")
}
