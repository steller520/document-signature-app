import bcrypt from 'bcryptjs';
import User from '../models/User.model.js';
import jwt from 'jsonwebtoken';

export function userRoutes(app) {

    // Register Route
    app.post('/api/auth/register', async (req, res, next) => {
        try {
            const { name, email, password } = req.body;

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'User already exists' });
            } else {
                const newUser = new User({ name, email });
                
                const passwordHash = await bcrypt.hash(password, 10);
                newUser.password = passwordHash;
                await newUser.save();
                res.status(201).json({ message: 'User registered successfully' });
            }   
        } catch (error) {
            next(error);
        }       
    });

    // Login Route
    app.post("/api/auth/login", async (req, res, next) => {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { userId: user._id }, 
                process.env.JWT_SECRET, 
                { expiresIn: '1h' }
            );

            res.json({ 
                message: 'Login successful',
                token 
            });

        } catch (error) {
            next(error);
        }
    });


}

