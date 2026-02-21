

function  protectedRouteHandler(req, res) {
    res.json({ message: 'This is a protected route', userId: req.user });
}

export function protectedRoutes(app, authMiddleware) {
    app.get('/api/protected', authMiddleware, protectedRouteHandler);
}