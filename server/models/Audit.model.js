import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'create_signature',
        'sign_document',
        'finalize_document',
        'invite_signature',
        'move_signature',
      ],
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

auditSchema.index({ document: 1, createdAt: -1 }); // For fast retrieval of recent actions on a document

const Audit = mongoose.model("Audit", auditSchema);

export default Audit;
