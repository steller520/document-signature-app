import mongoose from "mongoose";
import crypto from "crypto";


const signatureSchema = new mongoose.Schema(
  {
    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    publicSignerToken: {
      type: String,
      unique: true,
      index: true,
      default: () =>  crypto.randomBytes(24).toString("hex"),
    },
    email: {
      type: String,
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    signatureImage: {
      type: String, // Base64 Image
    },
    signature: {
      type: String,
      trim: true,
      default: "",
    },
    signatureDetails: {
      signerName: {
        type: String,
        trim: true,
      },
      signerTitle: {
        type: String,
        trim: true,
      },
      reason: {
        type: String,
        trim: true,
      },
      signedAt: {
        type: Date,
      },
    },
    coordinates: {
      x: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
      y: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
      width: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
      height: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
    },
    page: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ["pending", "signed", "rejected"],
      default: "pending",
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from creation
    },
  },
  { timestamps: true },
);

// Ensure a user can only sign a document once (for authenticated signers).
signatureSchema.index(
  { document: 1, signedBy: 1 },
  {
    unique: true,
    partialFilterExpression: {
      signedBy: { $exists: true, $ne: null },
    },
  },
);

// Ensure the same invitee email cannot be invited multiple times per document.
signatureSchema.index(
  { document: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $exists: true, $ne: null },
    },
  },
);

// Automatically set signedAt when status changes to "signed"
signatureSchema.pre("save", function (next) {
  if (this.status === "signed" && !this.signatureDetails?.signedAt) {
    this.signatureDetails = {
      ...(this.signatureDetails || {}),
      signedAt: new Date(),
    };
  }
  next();
});

const Signature = mongoose.model("Signature", signatureSchema);

export default Signature;
