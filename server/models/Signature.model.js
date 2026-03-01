import mongoose from "mongoose";

const signatureSchema = new mongoose.Schema(
  {
    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    signature: {
      type: String,
      required: true,
    },
    coordinates: {
        x: {
            type: Number,
            required: true,
        },
        y: {
            type: Number,
            required: true,
        },
        width: {
            type: Number,
            required: true,
        },
        height: {
            type: Number,
            required: true,
        },
    },
    page: {
        type: Number,
        required: true,
        default: 1,
    },
    status: {
        type: String,
        enum: ['pending', 'signed', 'rejected'],
        default: 'pending',
    },
  },
  { timestamps: true }
);

// Ensure a user can only sign a document once and for fast lookups
signatureSchema.index({ document: 1, signedBy: 1 }, { unique: true });

const Signature = mongoose.model("Signature", signatureSchema);

export default Signature;
