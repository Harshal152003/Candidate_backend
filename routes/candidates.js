// routes/candidates.js
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

const MAX_RESUME_BYTES = (parseInt(process.env.MAX_RESUME_MB || "5", 10)) * 1024 * 1024;
const MAX_VIDEO_SECONDS = parseInt(process.env.MAX_VIDEO_SECONDS || "90", 10);

// multer memory storage: we want buffer to upload to GridFS without saving to disk
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024 // allow big enough video (we'll validate duration separately)
  }
});

// helper: write buffer to temp file for ffprobe
function writeTempFile(buffer, ext = "") {
  const tmpPath = path.join(os.tmpdir(), `tmp_${uuidv4()}${ext}`);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

// Get ffprobe duration in seconds
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

/**
 * POST /api/candidates/submit
 * fields: firstName, lastName, positionAppliedFor, currentPosition, experienceYears
 * files: resume (pdf), video (webm/mp4) - both required
 */
router.post("/submit", upload.fields([{ name: "resume", maxCount: 1 }, { name: "video", maxCount: 1 }]), async (req, res) => {
  let client;
  try {
    // Basic field validation
    const { firstName, lastName, positionAppliedFor, currentPosition, experienceYears } = req.body;
    if (!firstName || !lastName || !positionAppliedFor || !currentPosition || !experienceYears) {
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

    // Validate resume: pdf & <= MAX_RESUME_BYTES
    if (resumeFile.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Resume must be a PDF file." });
    }
    if (resumeFile.size > MAX_RESUME_BYTES) {
      return res.status(400).json({ message: `Resume must be ≤ ${process.env.MAX_RESUME_MB} MB.` });
    }

    // Validate video: server-side duration check using ffprobe
    // Write video buffer to temp file
    const tempVideoPath = writeTempFile(videoFile.buffer, path.extname(videoFile.originalname) || ".webm");
    let durationSec = 0;
    try {
      durationSec = await getVideoDurationSeconds(tempVideoPath);
    } catch (err) {
      // if ffprobe fails, clean up and return error indicating ffmpeg missing or invalid file
      fs.unlinkSync(tempVideoPath);
      return res.status(500).json({ message: "Video duration check failed. Make sure ffmpeg is installed on server." });
    }

    // Clean up temp file
    fs.unlinkSync(tempVideoPath);

    if (durationSec > MAX_VIDEO_SECONDS) {
      return res.status(400).json({ message: `Video duration exceeds ${MAX_VIDEO_SECONDS} seconds.` });
    }

    // All validations passed: connect to native MongoClient and upload files to GridFS
    client = await createMongoClient();

    // Upload resume to GridFS
    const resumeFileId = await uploadBufferToGridFS(client, resumeFile.buffer, `resume_${Date.now()}_${resumeFile.originalname}`, resumeFile.mimetype);

    // Upload video to GridFS
    const videoFileId = await uploadBufferToGridFS(client, videoFile.buffer, `video_${Date.now()}_${videoFile.originalname}`, videoFile.mimetype);

    // Save candidate metadata in MongoDB via Mongoose
    const candidate = new Candidate({
      firstName,
      lastName,
      positionAppliedFor,
      currentPosition,
      experienceYears: Number(experienceYears),
      resumeFileId: resumeFileId, // ObjectId
      resumeFilename: resumeFile.originalname,
      videoFileId: videoFileId,
      videoFilename: videoFile.originalname
    });

    await candidate.save();

    // close client
    await client.close();

    return res.status(201).json({
      message: "Candidate submitted successfully",
      candidateId: candidate._id,
      resumeFileId,
      videoFileId
    });
  } catch (err) {
    console.error("Submit error:", err);
    if (client) {
      try { await client.close(); } catch (e) {}
    }
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET candidate metadata by id
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });
    const candidate = await Candidate.findById(id).lean();
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    return res.json(candidate);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET resume stream by file id
 * /api/candidates/files/resume/:fileId
 */
router.get("/files/resume/:fileId", async (req, res) => {
  let client;
  try {
    const { fileId } = req.params;
    client = await createMongoClient();
    streamFileFromGridFS(client, fileId, res);
  } catch (err) {
    console.error(err);
    if (client) try { await client.close(); } catch (e) {}
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET video stream by file id
 * /api/candidates/files/video/:fileId
 */
router.get("/files/video/:fileId", async (req, res) => {
  let client;
  try {
    const { fileId } = req.params;
    client = await createMongoClient();
    streamFileFromGridFS(client, fileId, res);
  } catch (err) {
    console.error(err);
    if (client) try { await client.close(); } catch (e) {}
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
