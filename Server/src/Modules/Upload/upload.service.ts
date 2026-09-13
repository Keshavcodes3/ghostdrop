import type { IncomingMessage, ServerResponse } from "node:http";

import { busBoyUploadMidlleware } from "../../Middleware/busBoy.upload.js";


export const uploadService=(req:IncomingMessage,res:ServerResponse)=>{
    busBoyUploadMidlleware(req)
}
