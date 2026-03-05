import Document from "../models/Document.model.js";
import Signature from "../models/Signature.model.js";
import fs from "fs";
import { PDFDocument, rgb } from "pdf-lib";
import Audit from "../models/Audit.model.js";
import { auditLogger } from "../utils/auditLogger.js";

export function signatureRoutes(app, authMiddleware) {
  // Save signature position
  app.post("/api/signatures", authMiddleware, async (req, res, next) => {
    try {
      const { documentId, signature, coordinates, page } = req.body;

      const document = await Document.findById(documentId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const existingSignature = await Signature.findOne({
        document: documentId,
        signedBy: req.user,
      });

      if (existingSignature) {
        return res
          .status(400)
          .json({ message: "You have already signed this document" });
      }

      const newSignature = new Signature({
        signedBy: req.user,
        document: documentId,
        signature,
        coordinates,
        page,
        status: "pending",
      });

      await newSignature.save();

      // Create an audit record
      auditLogger("add_signature", req.user, documentId, req);

      res.status(201).json(newSignature);
    } catch (error) {
      next(error);
    }
  });

  //   used by front end to show who still needs to sign the document and who has already signed
  app.get(
    "/api/signatures/:documentId",
    authMiddleware,
    async (req, res, next) => {
      try {
        const signatures = await Signature.find({
          document: req.params.documentId,
        }).populate("signedBy", "name email");

        res.status(200).json(signatures);
      } catch (error) {
        next(error);
      }
    },
  );

  //   upload the signature and status of the signature (signed, pending, rejected) to the document and update the document status if all signatures are signed
  app.post("/api/signatures/sign", authMiddleware, async (req, res, next) => {
    try {
      const { documentId, signature } = req.body;

      const record = await Signature.findOne({
        document: documentId,
        signedBy: req.user,
      });
      if (!record) {
        return res.status(404).json({ message: "Signature record not found" });
      }

      record.signature = signature;
      record.status = "signed";
      await record.save();

      // Create an audit record
      auditLogger("sign_document", req.user, documentId, req);

      res.status(200).json(record);
    } catch (error) {
      next(error);
    }
  });

  //   finalize the signature by updating the document with the signature and coordinates and page number and status of the signature (signed, pending, rejected) to the document and update the document status if all signatures are signed
  app.post(
    "/api/signatures/finalize",
    authMiddleware,
    async (req, res, next) => {
      try {
        const { documentId } = req.body;

        const document = await Document.findById(documentId);

        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }

        if (document.status === "signed") {
          return res.status(400).json({
            message: "Document is already finalized",
          });
        }

        if (document.uploadedBy.toString() !== req.user.toString()) {
          return res.status(403).json({
            message: "Only the document owner can finalize the document",
          });
        }

        const remaining = await Signature.countDocuments({
          document: documentId,
          status: { $ne: "signed" },
        });

        if (remaining > 0) {
          return res.status(400).json({
            message: "All signatures must be completed first",
          });
        }

        const signatures = await Signature.find({ document: documentId });

        const pdfBytes = fs.readFileSync(document.filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        const pages = pdfDoc.getPages();

        for (const sig of signatures) {
          const page = pages[sig.page - 1];
          if (!page) continue; // Skip if page number is invalid

          page.drawText(sig.signature, {
            x: sig.coordinates.x,
            y: sig.coordinates.y,
            size: 24,
            color: rgb(0, 0, 0),
          });
        }

        const finalPdf = await pdfDoc.save();

        const outputPath = `uploads/signed-${Date.now()}.pdf`;

        fs.writeFileSync(outputPath, finalPdf);

        document.status = "signed";
        document.filePath = outputPath;

        await document.save();

        auditLogger("finalize_document", req.user, documentId, req);

        res.status(200).json({
          message: "Document finalized and signed PDF generated",
          file: outputPath,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post("/api/signatures/invite", authMiddleware, async (req, res, next) => {
    try {
      const { documentId, email, coordinates, page } = req.body;

      const document = await Document.findById(documentId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.uploadedBy.toString() !== req.user.toString()) {
        return res.status(403).json({
          message: "Only the document owner can invite signers",
        });
      }

      const existingInvite = await Signature.findOne({
        document: documentId,
        email,
      });


      if (existingInvite) {
        return res
          .status(400)
          .json({ message: "This email is already invited to sign" });
      }

      const record = await Signature.create({
        document: documentId,
        email,
        coordinates,
        page,
        status: "pending",
      });

      auditLogger("invite_signature", req.user, documentId, req);

      const signatureLink = `${process.env.FRONTEND_URL}/sign/${record._id}`;
      res.status(201).json({
        message: `Signature invitation sent to ${email}`,
        link: signatureLink,
        record,
      });


    } catch (error) {
      next(error);
    }
  });
}
