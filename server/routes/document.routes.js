import upload from "../middleware/upload.js";
import Document from "../models/Document.model.js";
import path from "path";

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
          filePath: req.file.path ,
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
  app.get("/api/docs/:id", authMiddleware, async (req, res, next) => {
    try {
      const document = await Document.findOne({
        _id: req.params.id,
        uploadedBy: req.user,
      });
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // ". can be risky path.resolve will resolve the path and prevent directory traversal attacks"
      res.sendFile(path.resolve(document.filepath));
    } catch (error) {
      next(error);
    }
  });
}
