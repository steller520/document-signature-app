import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  title: {
    type: String, 
    required: true
  },
  filepath: {
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
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
}, { timestamps: true });

const Document = mongoose.model('Document', DocumentSchema);

export default Document;