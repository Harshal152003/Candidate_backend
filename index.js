// index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectMongoose } from "./config/db.js";
import candidateRoutes from "./routes/candidates.js";

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/candidates", candidateRoutes);

// health
app.get("/", (req, res) => res.send("Candidate Portal Backend running"));

// start
const PORT = process.env.PORT || 5000;
(async () => {
  await connectMongoose();
  app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
})();
