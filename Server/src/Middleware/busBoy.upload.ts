import http from "node:http";
import Busboy from "busboy";
import fs from "node:fs";
export const busBoyUploadMidlleware = (req: http.IncomingMessage) => {
  const headers = req.headers;
  const busboy = Busboy({ headers });
  let file: any;
  let info: any;
  busboy.on("file", (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    file = file;
    info = info;
    console.log(
      `File [${name}]: filename: %j, encoding: %j, mimeType: %j`,
      filename,
      encoding,
      mimeType
    );
    const writeStream =fs.createWriteStream(`./src/files/${filename}`)
    file.pipe(writeStream)
    file.on("data",(chunk)=>{
        console.log("chunk",chunk);
    })
    file.on("end", () => { console.log("File stream ended"); });
});
    busboy.on("close", () => { console.log("Upload parsing finished");});
    req.pipe(busboy);
    return{ file, info };
};
