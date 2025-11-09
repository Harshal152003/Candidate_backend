// models/Candidate.js
import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  positionAppliedFor: { type: String, required: true },
  currentPosition: { type: String, required: true },
  experienceYears: { type: Number, required: true },
  resumeFileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // GridFS id
  resumeFilename: { type: String, required: true },
  videoFileId: { type: mongoose.Schema.Types.ObjectId }, // GridFS id
  videoFilename: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Candidate", candidateSchema);
