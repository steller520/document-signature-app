import Audit from "../models/Audit.model.js";

import User from "../models/User.model.js";

export function auditRoutes(app, authMiddleware ) {
    // Get audit logs for a document
    app.get("/api/audit/:documentId", authMiddleware, async (req, res, next) => {
        try {
            const audits = await Audit.find({ document: req.params.documentId })
                .populate("user", "name email")
                .sort({ createdAt: -1 });
            res.status(200).json(audits);
        } catch (error) {
            next(error);
        }
    });
}