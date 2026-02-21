import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = decoded.userId;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Token is not valid' });
        }
    }
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }
};

export default authMiddleware;