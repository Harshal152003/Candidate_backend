import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import Candidate from "../models/candidates.js";
import { createMongoClient } from "../config/db.js";
import { uploadBufferToGridFS, streamFileFromGridFS } from "../utils/gridfs.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const MAX_RESUME_BYTES =
  parseInt(process.env.MAX_RESUME_MB || "5", 10) * 1024 * 1024;
const MAX_VIDEO_SECONDS = parseInt(process.env.MAX_VIDEO_SECONDS || "90", 10);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

function writeTempFile(buffer, ext = "") {
  const tmpPath = path.join(os.tmpdir(), `tmp_${uuidv4()}${ext}`);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

function getVideoDurationSeconds(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const format = metadata.format;
      const duration = format && format.duration ? format.duration : 0;
      resolve(duration);
    });
  });
}

router.post(
  "/submit",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    let client;
    try {
      const {
        firstName,
        lastName,
        positionAppliedFor,
        currentPosition,
        experienceYears,
      } = req.body;
      if (
        !firstName ||
        !lastName ||
        !positionAppliedFor ||
        !currentPosition ||
        !experienceYears
      ) {
        return res.status(400).json({ message: "All fields are required." });
      }

      if (!req.files || !req.files.resume || !req.files.resume[0]) {
        return res.status(400).json({ message: "Resume is required." });
      }
      if (!req.files || !req.files.video || !req.files.video[0]) {
        return res.status(400).json({ message: "Video is required." });
      }

      const resumeFile = req.files.resume[0];
      const videoFile = req.files.video[0];

      if (resumeFile.mimetype !== "application/pdf") {
        return res.status(400).json({ message: "Resume must be a PDF file." });
      }
      if (resumeFile.size > MAX_RESUME_BYTES) {
        return res
          .status(400)
          .json({
            message: `Resume must be ≤ ${process.env.MAX_RESUME_MB} MB.`,
          });
      }

      const tempVideoPath = writeTempFile(
        videoFile.buffer,
        path.extname(videoFile.originalname) || ".webm"
      );
      let durationSec = 0;
      try {
        durationSec = await getVideoDurationSeconds(tempVideoPath);
      } catch (err) {
        fs.unlinkSync(tempVideoPath);
        return res
          .status(500)
          .json({
            message:
              "Video duration check failed. Make sure ffmpeg is installed on server.",
          });
      }

      fs.unlinkSync(tempVideoPath);

      if (durationSec > MAX_VIDEO_SECONDS) {
        return res
          .status(400)
          .json({
            message: `Video duration exceeds ${MAX_VIDEO_SECONDS} seconds.`,
          });
      }

      client = await createMongoClient();

      const resumeFileId = await uploadBufferToGridFS(
        client,
        resumeFile.buffer,
        `resume_${Date.now()}_${resumeFile.originalname}`,
        resumeFile.mimetype
      );

      const videoFileId = await uploadBufferToGridFS(
        client,
        videoFile.buffer,
        `video_${Date.now()}_${videoFile.originalname}`,
        videoFile.mimetype
      );

      const candidate = new Candidate({
        firstName,
        lastName,
        positionAppliedFor,
        currentPosition,
        experienceYears: Number(experienceYears),
        resumeFileId: resumeFileId,
        resumeFilename: resumeFile.originalname,
        videoFileId: videoFileId,
        videoFilename: videoFile.originalname,
      });

      await candidate.save();

      await client.close();

      return res.status(201).json({
        message: "Candidate submitted successfully",
        candidateId: candidate._id,
        resumeFileId,
        videoFileId,
      });
    } catch (err) {
      console.error("Submit error:", err);
      if (client) {
        try {
          await client.close();
        } catch (e) {}
      }
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  }
);

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid id" });
    const candidate = await Candidate.findById(id).lean();
    if (!candidate)
      return res.status(404).json({ message: "Candidate not found" });
    return res.json(candidate);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/files/resume/:fileId", async (req, res) => {
  let client;
  try {
    const { fileId } = req.params;
    client = await createMongoClient();
    streamFileFromGridFS(client, fileId, res);
  } catch (err) {
    console.error(err);
    if (client)
      try {
        await client.close();
      } catch (e) {}
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/files/video/:fileId", async (req, res) => {
  let client;
  try {
    const { fileId } = req.params;
    client = await createMongoClient();
    streamFileFromGridFS(client, fileId, res);
  } catch (err) {
    console.error(err);
    if (client)
      try {
        await client.close();
      } catch (e) {}
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
