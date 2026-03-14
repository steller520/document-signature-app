import Document from "../models/Document.model.js";
import Signature from "../models/Signature.model.js";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Audit from "../models/Audit.model.js";
import { auditLogger } from "../utils/auditLogger.js";
import sendEmail from "../utils/sendMail.js";

const DEFAULT_SIGNATURE_WIDTH = 0.2;
const DEFAULT_SIGNATURE_HEIGHT = 0.08;
const SIGNATURE_STACK_GAP = 0.015;

function buildPublicSignatureLink(token) {
  return `${process.env.FRONTEND_URL}/signatures/public-sign/${token}`;
}

function resolveStoredFilePath(filePath) {
  const normalizedPath = String(filePath || "").replace(/\\/g, "/");
  const candidatePaths = path.isAbsolute(normalizedPath)
    ? [normalizedPath]
    : [
        path.resolve(process.cwd(), normalizedPath),
        path.resolve(process.cwd(), "server", normalizedPath),
      ];

  return candidatePaths.find((candidate) => fs.existsSync(candidate));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSignatureClusterKey(signature) {
  return [
    signature.page,
    Number(signature.coordinates?.x || 0).toFixed(4),
    Number(signature.coordinates?.y || 0).toFixed(4),
  ].join(":");
}

function getSignaturePlacement(signature, stackIndex, page) {
  const widthNormalized = clamp(
    Number(signature.coordinates?.width || DEFAULT_SIGNATURE_WIDTH),
    0.08,
    0.6,
  );
  const heightNormalized = clamp(
    Number(signature.coordinates?.height || DEFAULT_SIGNATURE_HEIGHT),
    0.04,
    0.2,
  );
  const minCenterX = widthNormalized / 2;
  const maxCenterX = 1 - widthNormalized / 2;
  const minCenterY = heightNormalized / 2;
  const maxCenterY = 1 - heightNormalized / 2;
  const centerXNormalized = clamp(
    Number(signature.coordinates?.x || 0),
    minCenterX,
    maxCenterX,
  );
  const baseCenterYNormalized = clamp(
    Number(signature.coordinates?.y || 0),
    minCenterY,
    maxCenterY,
  );
  const stackStep = heightNormalized + SIGNATURE_STACK_GAP;
  const canStackDown =
    baseCenterYNormalized + stackIndex * stackStep <= maxCenterY;
  const canStackUp =
    baseCenterYNormalized - stackIndex * stackStep >= minCenterY;
  const stackDirection = canStackDown ? 1 : canStackUp ? -1 : baseCenterYNormalized > 0.5 ? -1 : 1;
  const centerYNormalized = clamp(
    baseCenterYNormalized + stackIndex * stackStep * stackDirection,
    minCenterY,
    maxCenterY,
  );
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const boxWidth = widthNormalized * pageWidth;
  const boxHeight = heightNormalized * pageHeight;
  const centerX = centerXNormalized * pageWidth;
  const boxBottom = pageHeight - centerYNormalized * pageHeight - boxHeight / 2;

  return {
    boxBottom,
    boxHeight,
    centerX,
  };
}

async function findSignatureInvite(identifier, populate) {
  let query = Signature.findOne({ publicSignerToken: identifier });

  if (populate) {
    query = query.populate(populate);
  }

  let record = await query;

  if (!record && mongoose.Types.ObjectId.isValid(identifier)) {
    query = Signature.findById(identifier);

    if (populate) {
      query = query.populate(populate);
    }

    record = await query;
  }

  return record;
}

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

        const signatures = await Signature.find({ document: documentId }).sort({
          page: 1,
          createdAt: 1,
          _id: 1,
        });

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
        const signatureFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const pages = pdfDoc.getPages();
        const signatureClusterCounts = new Map();

        for (const sig of signatures) {
          const page = pages[sig.page - 1];
          if (!page) continue; // Skip if page number is invalid

          const signedText = sig.signature || sig.signatureDetails?.signerName || "Signed";
          const clusterKey = getSignatureClusterKey(sig);
          const stackIndex = signatureClusterCounts.get(clusterKey) || 0;
          signatureClusterCounts.set(clusterKey, stackIndex + 1);
          const placement = getSignaturePlacement(sig, stackIndex, page);
          const fontSize = clamp(placement.boxHeight * 0.45, 12, 24);
          const textWidth = signatureFont.widthOfTextAtSize(signedText, fontSize);
          const textHeight = signatureFont.heightAtSize(fontSize);
          const textX = clamp(
            placement.centerX - textWidth / 2,
            0,
            page.getWidth() - textWidth,
          );
          const textY = clamp(
            placement.boxBottom + (placement.boxHeight - textHeight) / 2,
            0,
            page.getHeight() - textHeight,
          );

          page.drawText(signedText, {
            x: textX,
            y: textY,
            size: fontSize,
            font: signatureFont,
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

      const signatureLink = buildPublicSignatureLink(record.publicSignerToken);
      
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
          const signatureLink = buildPublicSignatureLink(record.publicSignerToken);
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
  app.get("/api/signatures/public-sign/:token", async (req, res, next) => {
    try {
      const record = await findSignatureInvite(
        req.params.token,
        "document title status",
      );

      if (!record) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (record.expiresAt && record.expiresAt < new Date()) {
        return res.status(410).json({ message: "Invitation has expired" });
      }

      return res.status(200).json({
        _id: record._id,
        email: record.email,
        status: record.status,
        page: record.page,
        coordinates: record.coordinates,
        signature: record.signature,
        signatureDetails: record.signatureDetails || {},
        expiresAt: record.expiresAt,
        document: record.document,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get(
    "/api/signatures/public-sign/:token/document",
    async (req, res, next) => {
      try {
        const record = await findSignatureInvite(
          req.params.token,
          "document title filePath status",
        );

        if (!record || !record.document) {
          return res.status(404).json({ message: "Invitation not found" });
        }

        if (record.expiresAt && record.expiresAt < new Date()) {
          return res.status(410).json({ message: "Invitation has expired" });
        }

        const sourcePath = resolveStoredFilePath(record.document.filePath);

        if (!sourcePath) {
          return res.status(404).json({ message: "Document file not found" });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");

        return res.sendFile(sourcePath, (err) => {
          if (err) {
            next(err);
          }
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post("/api/signatures/public-sign/:token", async (req, res, next) => {
    try {
      const trimmedSignature = String(req.body?.signature || "").trim();

      if (!trimmedSignature) {
        return res.status(400).json({ message: "Signature text is required" });
      }

      const record = await findSignatureInvite(req.params.token);

      if (!record) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (record.expiresAt && record.expiresAt < new Date()) {
        return res.status(410).json({ message: "Invitation has expired" });
      }

      if (record.status === "signed") {
        return res.status(400).json({ message: "Already signed" });
      }

      record.signature = trimmedSignature;
      record.status = "signed";

      await record.save();

      res.json({ message: "Document signed successfully" });
    } catch (error) {
      next(error);
    }
  });
}
