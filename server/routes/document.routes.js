import upload from "../middleware/upload.js";
import Document from "../models/Document.model.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRootDir = path.resolve(__dirname, "..");

export function documentRoutes(app, authMiddleware) {
  app.post(
    "/api/docs/upload",
    authMiddleware,
    upload.single("document"),
    async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

    
        const document = new Document({
          uploadedBy: req.user,
          title: req.file.originalname,
          filePath: path.posix.join("uploads", req.file.filename),
          status: "pending",
        });

        await document.save();
        
        res.status(201).json(document);
      } catch (error) {
        next(error);
      }
    },
  );
  //   List user PDFs
  app.get("/api/docs", authMiddleware, async (req, res, next) => {
    try {
      const documents = await Document.find({
        uploadedBy: req.user,
      }).sort({ createdAt: -1 });
      res.status(200).json(documents);
    } catch (error) {
      next(error);
    }
  });

  //   View specific PDF
  app.get("/api/docs/view/:token", authMiddleware, async (req, res, next) => {
    try {
      const document = await Document.findOne({
        publicToken: req.params.token,
        uploadedBy: req.user,
      });
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.status(200).json(document);
    } catch (error) {
      next(error);
    }
  });

  // Stream PDF bytes for in-app viewing.
  app.get("/api/docs/:token/file", authMiddleware, async (req, res, next) => {
    try {
      const document = await Document.findOne({
        publicToken: req.params.token,
        uploadedBy: req.user,
      });

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const normalizedPath = String(document.filePath || "").replace(/\\/g, "/");
      const candidatePaths = path.isAbsolute(normalizedPath)
        ? [normalizedPath]
        : [
            path.resolve(serverRootDir, normalizedPath),
            path.resolve(process.cwd(), normalizedPath),
          ];
      const absolutePath = candidatePaths.find((candidate) =>
        fs.existsSync(candidate),
      );

      if (!absolutePath) {
        return res.status(404).json({ message: "Document file not found" });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      return res.sendFile(absolutePath, (err) => {
        if (err) {
          next(err);
        }
      });
    } catch (error) {
      next(error);
    }
  });
}
