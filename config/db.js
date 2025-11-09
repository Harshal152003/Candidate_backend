// config/db.js
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "candidateDB";

export async function connectMongoose() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log("✅ Mongoose connected");
  } catch (err) {
    console.error("Mongoose connection error:", err);
    throw err;
  }
}

// We also export a MongoClient for GridFS operations (native driver)
export async function createMongoClient() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("✅ MongoClient connected for GridFS");
  return client;
}
