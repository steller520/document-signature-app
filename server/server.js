import express from 'express';
import mongoose  from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { userRoutes } from './routes/user.routes.js';
import authMiddleware from './middleware/authMiddleware.js';
import { protectedRoutes } from './routes/protected.routes.js';


dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

//Global Middleware for Routes

userRoutes(app);
protectedRoutes(app, authMiddleware);



app.get('/', (req, res) => {
  res.send('API is running...');
});

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
