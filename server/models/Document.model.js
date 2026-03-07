import mongoose from 'mongoose';
import crypto from 'crypto';

const DocumentSchema = new mongoose.Schema({
  title: {
    type: String, 
    required: true
  },
  publicDocToken: {
    type: String,
    unique: true,
    default: () => crypto.randomBytes(16).toString("hex"),
  },
  filePath: {
    type: String, 
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  status:{
    type: String,
    enum: ['pending', 'approved', 'rejected', 'signed'],
    default: 'pending'
  },
}, { timestamps: true });

const Document = mongoose.model('Document', DocumentSchema);

export default Document;