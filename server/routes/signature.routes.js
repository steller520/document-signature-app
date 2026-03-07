import Document from "../models/Document.model.js";
import Signature from "../models/Signature.model.js";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import Audit from "../models/Audit.model.js";
import { auditLogger } from "../utils/auditLogger.js";
import sendEmail from "../utils/sendMail.js";

export function signatureRoutes(app, authMiddleware) {
  // Save signature position
  app.post("/api/signatures", authMiddleware, async (req, res, next) => {
    try {
      const { documentId, signature, signatureDetails, coordinates, page } = req.body;

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
        email: null,
        signature,
        signatureDetails,
        coordinates,
        page,
        status: "pending",
      });

      await newSignature.save();

      // Create an audit record
      auditLogger("create_signature", req.user, documentId, req);

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
      const { documentId, signature, signatureDetails } = req.body;

      const record = await Signature.findOne({
        document: documentId,
        signedBy: req.user,
      });
      if (!record) {
        return res.status(404).json({ message: "Signature record not found" });
      }

      record.signature = signature;
      record.signatureDetails = {
        ...(record.signatureDetails || {}),
        ...(signatureDetails || {}),
      };
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

        const normalizedPath = String(document.filePath || "").replace(/\\/g, "/");
        const docPathCandidates = path.isAbsolute(normalizedPath)
          ? [normalizedPath]
          : [
              path.resolve(process.cwd(), normalizedPath),
              path.resolve(process.cwd(), "server", normalizedPath),
            ];
        const sourcePath = docPathCandidates.find((candidate) => fs.existsSync(candidate));

        if (!sourcePath) {
          return res.status(404).json({ message: "Document file not found" });
        }

        const pdfBytes = fs.readFileSync(sourcePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        const pages = pdfDoc.getPages();

        for (const sig of signatures) {
          const page = pages[sig.page - 1];
          if (!page) continue; // Skip if page number is invalid

          const signedText = sig.signature || sig.signatureDetails?.signerName || "Signed";

          page.drawText(signedText, {
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
      const { documentId, email, coordinates, page, signatureDetails } = req.body;

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
        signatureDetails,
        status: "pending",
      });

      auditLogger("invite_signature", req.user, documentId, req);

      const signatureLink = `${process.env.FRONTEND_URL}/sign/${record._id}`;
      
      // Send invitation email
      try {
        await sendEmail(
          email,
          "Document Signature Request",
          `You have been invited to sign a document.\n\nDocument: ${document.title || 'Untitled Document'}\n\nPlease click the link below to review and sign:\n${signatureLink}\n\nThank you.`
        );
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Continue even if email fails
      }
      
      res.status(201).json({
        message: `Signature invitation sent to ${email}`,
        link: signatureLink,
        record,
      });
    } catch (error) {
      next(error);
    }
  });

  // Invite multiple signers at once
  app.post("/api/signatures/invite-batch", authMiddleware, async (req, res, next) => {
    try {
      const { documentId, invitees, coordinates, page } = req.body;

      const document = await Document.findById(documentId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.uploadedBy.toString() !== req.user.toString()) {
        return res.status(403).json({
          message: "Only the document owner can invite signers",
        });
      }

      if (!Array.isArray(invitees) || invitees.length === 0) {
        return res.status(400).json({ message: "At least one invitee is required" });
      }

      const created = [];
      const skipped = [];

      for (const invitee of invitees) {
        const email = String(invitee?.email || "").trim().toLowerCase();

        if (!email) {
          skipped.push({ email: "", reason: "Email is required" });
          continue;
        }

        const existingInvite = await Signature.findOne({
          document: documentId,
          email,
        });

        if (existingInvite) {
          skipped.push({ email, reason: "Already invited" });
          continue;
        }

        const record = await Signature.create({
          document: documentId,
          email,
          coordinates,
          page,
          signatureDetails: {
            signerName: invitee?.signerName,
            signerTitle: invitee?.signerTitle,
            reason: invitee?.reason,
          },
          status: "pending",
        });

        // Send invitation email
        try {
          const signatureLink = `${process.env.FRONTEND_URL}/sign/${record._id}`;
          await sendEmail(
            email,
            "Document Signature Request",
            `You have been invited to sign a document.\n\nDocument: ${document.title || 'Untitled Document'}\n\nPlease click the link below to review and sign:\n${signatureLink}\n\nThank you.`
          );
        } catch (emailError) {
          console.error(`Failed to send invitation email to ${email}:`, emailError);
          // Continue even if email fails
        }

        created.push(record);
      }

      auditLogger("invite_signature", req.user, documentId, req);

      return res.status(201).json({
        message: "Invitees processed",
        created,
        skipped,
      });
    } catch (error) {
      next(error);
    }
  });

//   public signing not authhenticated signing using the link sent to email
  app.post("/api/signatures/public-sign/:token", async (req, res) => {
    const { signature } = req.body;

    const record = await Signature.findOne({ publicSignerToken: req.params.token });

    if (!record) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (record.status === "signed") {
      return res.status(400).json({ message: "Already signed" });
    }

    record.signature = signature;
    record.status = "signed";

    await record.save();

    res.json({ message: "Document signed successfully" });
  });
}
