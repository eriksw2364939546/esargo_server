// ================ 1. middleware/adminAuth.middleware.js ================
import jwt from "jsonwebtoken";
import Meta from "../models/Meta.model.js";

const decodeToken = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { _id, role, admin_role } = decoded;

        if (role !== "admin") return { 
            message: "Access denied! Role invalid!", 
            result: false, 
            status: 403 
        };

        const metaInfo = await Meta.findOne({
            admin: _id,
            role: "admin"
        }).populate("admin");

        if (!metaInfo || !metaInfo.admin) return { 
            message: "Access denied! Admin is not defined!", 
            result: false, 
            status: 404 
        };

        if (!metaInfo.admin.is_active) return {
            message: "Access denied! Admin account is inactive!",
            result: false,
            status: 403
        };

        if (metaInfo.admin.isSuspended && metaInfo.admin.isSuspended()) return {
            message: "Access denied! Admin account is suspended!",
            result: false,
            status: 403
        };

        return { 
            message: "Access approved!", 
            result: true, 
            admin: metaInfo.admin,
            admin_role: admin_role || metaInfo.admin.role
        };

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { message: "Access denied! Token expired!", result: false, status: 403 };
        } else {
            return { message: "Access denied! Token invalid!", result: false, status: 403 };
        }
    }
};

const checkAdminToken = async (req, res, next) => {
    try {
        const token = req.headers["authorization"]?.split(" ")[1];

        if (!token) return res.status(403).json({ 
            message: "Access denied! Token undefined!", 
            result: false 
        });

        const data = await decodeToken(token);
        if (!data.result) return res.status(data.status).json(data);

        req.admin = data.admin;
        req.admin_role = data.admin_role;

        next();

    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            message: "Access denied!", 
            result: false, 
            error: error.message 
        });
    }
};

const checkAccessByGroup = (adminRoles) => {
    return async (req, res, next) => {
        try {
            const token = req.headers["authorization"]?.split(" ")[1];

            if (!token) return res.status(403).json({ 
                message: "Access denied! Token undefined!", 
                result: false 
            });

            const data = await decodeToken(token);
            if (!data.result) return res.status(data.status).json(data);

            if (!adminRoles.includes(data.admin_role)) return res.status(403).json({ 
                message: "Access denied! Role invalid!", 
                result: false 
            });

            req.admin = data.admin;
            req.admin_role = data.admin_role;

            next();

        } catch (error) {
            console.error(error);
            res.status(500).json({ 
                message: "Access denied!", 
                result: false, 
                error: error.message 
            });
        }
    };
};

export { checkAdminToken, checkAccessByGroup };