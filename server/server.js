import express from 'express';
import mongoose  from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { userRoutes } from './routes/user.routes.js';
import authMiddleware from './middleware/authMiddleware.js';
import { protectedRoutes } from './routes/protected.routes.js';
import { documentRoutes } from './routes/document.routes.js';


dotenv.config();

const app = express();

// Middleware
// CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Universal error handling middleware
app.use((err, req, res, next) => {

  // Handle Multer file size limit error
  if(err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size exceeds the limit of 5MB' });
  }
  console.error(err.stack);
  res.status(500).send('Something broke!');
});


// Routes
userRoutes(app);
protectedRoutes(app, authMiddleware);
documentRoutes(app, authMiddleware);


// Test route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
