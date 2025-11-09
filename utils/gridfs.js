import mongodb from "mongodb";

export async function uploadBufferToGridFS(client, buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    try {
      const db = client.db(process.env.DB_NAME);
      const bucket = new mongodb.GridFSBucket(db);

      const uploadStream = bucket.openUploadStream(filename, {
        contentType,
      });

      const fileId = uploadStream.id; // ✅ Capture ID here

      uploadStream.on("error", (err) => reject(err));

      uploadStream.on("finish", () => {
        console.log("✅ File uploaded to GridFS:", fileId.toString());
        resolve(fileId);
      });

      uploadStream.write(buffer);
      uploadStream.end();
    } catch (err) {
      reject(err);
    }
  });
}

export function streamFileFromGridFS(client, fileId, res) {
  try {
    const db = client.db(process.env.DB_NAME);
    const bucket = new mongodb.GridFSBucket(db);

    // ✅ Ensure the ID is clean and valid
    const cleanId = fileId.trim();
    const objectId = new mongodb.ObjectId(cleanId);

    const downloadStream = bucket.openDownloadStream(objectId);

    downloadStream.on("error", (err) => {
      console.error("GridFS download error:", err);
      res.status(404).json({ message: "File not found" });
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error("streamFileFromGridFS error:", err);
    res.status(400).json({ message: "Invalid file ID" });
  }
}
