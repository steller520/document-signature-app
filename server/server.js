import express from 'express';
import mongoose  from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { userRoutes } from './routes/user.routes.js';
import authMiddleware from './middleware/authMiddleware.js';
import { protectedRoutes } from './routes/protected.routes.js';
import { documentRoutes } from './routes/document.routes.js';
import multer from 'multer';
import { signatureRoutes } from './routes/signature.routes.js';
import { auditRoutes } from './routes/audit.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';


dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, 'uploads');

// Middleware
// CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve uploaded files; force inline PDF display in browser viewers.
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      if (path.extname(filePath).toLowerCase() === ".pdf") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
      }
    },
  }),
);



// Routes
userRoutes(app);
protectedRoutes(app, authMiddleware);
documentRoutes(app, authMiddleware);
signatureRoutes(app, authMiddleware);
auditRoutes(app, authMiddleware);

// Universal error handling middleware
app.use((err, req, res, next) => {

  // Catch Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File size exceeds the limit of 5MB",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        message: "Only one file is allowed per upload",
      });
    }
  }

  // Catch custom file type errors
  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({
      message: err.message,
    });
  }

  console.error(err);
  res.status(500).json({
    message: "Server error",
  });
});

// Test route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
