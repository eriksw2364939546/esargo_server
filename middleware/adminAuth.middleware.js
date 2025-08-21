// ================ middleware/adminAuth.middleware.js (ИСПРАВЛЕННЫЙ) ================
import jwt from "jsonwebtoken";
import Meta from "../models/Meta.model.js";
import { AdminUser } from "../models/index.js";

const decodeToken = async (token) => {
    try {
        console.log('🔍 DECODING TOKEN...');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔍 DECODED TOKEN:', {
            user_id: decoded.user_id,
            role: decoded.role,
            admin_role: decoded.admin_role,
            email: decoded.email
        });

        const { user_id, _id, role, admin_role } = decoded;
        const adminId = user_id || _id;

        if (role !== "admin") {
            console.log('🚨 ROLE NOT ADMIN:', role);
            return { 
                message: "Access denied! Role invalid!", 
                result: false, 
                status: 403 
            };
        }

        console.log('🔍 SEARCHING FOR ADMIN:', adminId);

        // ✅ ИСПРАВЛЕНО: Ищем админа напрямую в AdminUser
        const admin = await AdminUser.findById(adminId);

        if (!admin) {
            console.log('🚨 ADMIN NOT FOUND');
            return { 
                message: "Access denied! Admin not found!", 
                result: false, 
                status: 404 
            };
        }

        console.log('✅ ADMIN FOUND:', {
            id: admin._id,
            email: admin.email,
            role: admin.role,
            is_active: admin.is_active
        });

        if (!admin.is_active) {
            console.log('🚨 ADMIN NOT ACTIVE');
            return {
                message: "Access denied! Admin account is inactive!",
                result: false,
                status: 403
            };
        }

        if (admin.isSuspended && admin.isSuspended()) {
            console.log('🚨 ADMIN SUSPENDED');
            return {
                message: "Access denied! Admin account is suspended!",
                result: false,
                status: 403
            };
        }

        console.log('✅ ADMIN ACCESS APPROVED');

        return { 
            message: "Access approved!", 
            result: true, 
            admin: admin,
            admin_role: admin_role || admin.role
        };

    } catch (err) {
        console.error('🚨 TOKEN DECODE ERROR:', err);
        
        if (err.name === 'TokenExpiredError') {
            return { message: "Access denied! Token expired!", result: false, status: 401 };
        } else if (err.name === 'JsonWebTokenError') {
            return { message: "Access denied! Token invalid!", result: false, status: 401 };
        } else {
            return { message: "Access denied! Token error!", result: false, status: 401 };
        }
    }
};

const checkAdminToken = async (req, res, next) => {
    try {
        console.log('🔍 CHECK ADMIN TOKEN - START');
        
        const authHeader = req.headers["authorization"];
        console.log('🔍 AUTH HEADER:', authHeader);
        
        const token = authHeader?.split(" ")[1];
        console.log('🔍 EXTRACTED TOKEN:', token ? 'Present' : 'Missing');

        if (!token) {
            console.log('🚨 NO TOKEN PROVIDED');
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await decodeToken(token);
        if (!data.result) {
            console.log('🚨 TOKEN DECODE FAILED:', data.message);
            return res.status(data.status).json({
                message: data.message,
                result: false
            });
        }

        console.log('✅ TOKEN VERIFIED, SETTING REQ DATA');
        req.admin = data.admin;
        req.admin_role = data.admin_role;

        next();

    } catch (error) {
        console.error('🚨 CHECK ADMIN TOKEN ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

const checkAccessByGroup = (adminRoles) => {
    return async (req, res, next) => {
        try {
            console.log('🔍 CHECK ACCESS BY GROUP:', adminRoles);
            
            const authHeader = req.headers["authorization"];
            const token = authHeader?.split(" ")[1];

            if (!token) {
                console.log('🚨 NO TOKEN IN ACCESS CHECK');
                return res.status(401).json({ 
                    message: "Access denied! Token required!", 
                    result: false 
                });
            }

            const data = await decodeToken(token);
            if (!data.result) {
                console.log('🚨 TOKEN FAILED IN ACCESS CHECK');
                return res.status(data.status).json({
                    message: data.message,
                    result: false
                });
            }

            console.log('🔍 CHECKING ROLE ACCESS:', {
                required_roles: adminRoles,
                user_role: data.admin_role,
                has_access: adminRoles.includes(data.admin_role)
            });

            if (!adminRoles.includes(data.admin_role)) {
                console.log('🚨 INSUFFICIENT ROLE PERMISSIONS');
                return res.status(403).json({ 
                    message: `Access denied! Required roles: ${adminRoles.join(', ')}. Your role: ${data.admin_role}`, 
                    result: false 
                });
            }

            console.log('✅ ACCESS GRANTED FOR ROLE:', data.admin_role);
            req.admin = data.admin;
            req.admin_role = data.admin_role;

            next();

        } catch (error) {
            console.error('🚨 ACCESS CHECK ERROR:', error);
            res.status(500).json({ 
                message: "Access denied! Server error!", 
                result: false, 
                error: error.message 
            });
        }
    };
};

export { checkAdminToken, checkAccessByGroup };