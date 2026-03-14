import Audit from "../models/Audit.model.js";

export async function auditLogger(action, user, documentId, req) {
    try {
        await Audit.create({
            action,
            user,
            document: documentId,
            ipAddress: req.headers["x-forwarded-for"] || req.ip,
        });
    } catch (error) {
        console.error("Audit logger failed:", error?.message || error);
    }
}