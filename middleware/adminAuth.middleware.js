// ================ middleware/adminAuth.middleware.js (ОПТИМИЗИРОВАННЫЙ) ================
import jwt from "jsonwebtoken";
import { AdminUser } from "../models/index.js";

/**
 * ✅ ОПТИМИЗИРОВАННАЯ функция декодирования токена
 */
const decodeToken = async (token) => {
    try {
        console.log('🔍 DECODING ADMIN TOKEN...');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { user_id, _id, role, admin_role } = decoded;
        const adminId = user_id || _id;

        // Быстрая проверка роли
        if (role !== "admin") {
            return { 
                message: "Access denied! Invalid role!", 
                result: false, 
                status: 403 
            };
        }

        console.log('🔍 SEARCHING FOR ADMIN:', { adminId, expected_role: admin_role });

        // ✅ ОПТИМИЗАЦИЯ: Прямой поиск в AdminUser без лишних запросов
        const admin = await AdminUser.findById(adminId).select('-password_hash');

        if (!admin) {
            return { 
                message: "Access denied! Admin not found!", 
                result: false, 
                status: 404 
            };
        }

        // ✅ РАСШИРЕННЫЕ ПРОВЕРКИ БЕЗОПАСНОСТИ
        if (!admin.is_active) {
            return {
                message: "Access denied! Admin account is inactive!",
                result: false,
                status: 403
            };
        }

        if (admin.account_status !== 'active') {
            return {
                message: `Access denied! Account status: ${admin.account_status}`,
                result: false,
                status: 403
            };
        }

        // Проверяем блокировку аккаунта
        if (admin.isSuspended && admin.isSuspended()) {
            return {
                message: "Access denied! Admin account is suspended!",
                result: false,
                status: 403
            };
        }

        // ✅ НОВОЕ: Проверка времени сессии
        const now = new Date();
        const sessionTimeout = admin.security_settings?.session_timeout || 8; // часы
        const lastActivity = admin.last_activity_at || admin.last_login_at;
        
        if (lastActivity) {
            const sessionExpiry = new Date(lastActivity.getTime() + (sessionTimeout * 60 * 60 * 1000));
            if (now > sessionExpiry) {
                return {
                    message: "Access denied! Session expired!",
                    result: false,
                    status: 401
                };
            }
        }

        // Обновляем активность
        admin.last_activity_at = now;
        await admin.save();

        console.log('✅ ADMIN ACCESS APPROVED:', {
            admin_id: admin._id,
            role: admin.role,
            session_valid: true
        });

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

/**
 * ✅ ОПТИМИЗИРОВАННАЯ базовая проверка токена админа
 */
const checkAdminToken = async (req, res, next) => {
    try {
        console.log('🔍 CHECK ADMIN TOKEN - START');
        
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            console.log('🚨 NO TOKEN PROVIDED');
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await decodeToken(token);
        if (!data.result) {
            console.log('🚨 TOKEN VALIDATION FAILED:', data.message);
            return res.status(data.status).json({
                message: data.message,
                result: false
            });
        }

        console.log('✅ ADMIN TOKEN VERIFIED');
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

/**
 * ✅ ОПТИМИЗИРОВАННАЯ проверка доступа по группам ролей
 */
const checkAccessByGroup = (requiredRoles) => {
    return async (req, res, next) => {
        try {
            console.log('🔍 CHECK ACCESS BY GROUP:', { 
                required: requiredRoles,
                endpoint: req.path,
                method: req.method
            });
            
            const authHeader = req.headers["authorization"];
            const token = authHeader?.split(" ")[1];

            if (!token) {
                return res.status(401).json({ 
                    message: "Access denied! Token required!", 
                    result: false 
                });
            }

            const data = await decodeToken(token);
            if (!data.result) {
                return res.status(data.status).json({
                    message: data.message,
                    result: false
                });
            }

            const userRole = data.admin_role;

            console.log('🔍 ROLE ACCESS CHECK:', {
                required_roles: requiredRoles,
                user_role: userRole,
                has_access: requiredRoles.includes(userRole)
            });

            // ✅ РАСШИРЕННАЯ проверка ролей
            if (!requiredRoles.includes(userRole)) {
                // Логируем попытку несанкционированного доступа
                console.warn(`🚨 UNAUTHORIZED ACCESS ATTEMPT:`, {
                    admin_id: data.admin._id,
                    admin_email: data.admin.email,
                    required_roles: requiredRoles,
                    actual_role: userRole,
                    endpoint: req.path,
                    method: req.method,
                    ip: req.ip,
                    timestamp: new Date()
                });

                return res.status(403).json({ 
                    message: `Access denied! Required roles: ${requiredRoles.join(', ')}. Your role: ${userRole}`, 
                    result: false,
                    security_info: {
                        required_permissions: requiredRoles,
                        current_role: userRole,
                        upgrade_needed: true
                    }
                });
            }

            console.log('✅ ACCESS GRANTED:', {
                admin_role: userRole,
                endpoint: req.path
            });

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

/**
 * ✅ НОВЫЙ MIDDLEWARE: Логирование действий админа
 */
const logAdminAction = (action_type) => {
    return (req, res, next) => {
        // Логируем действие админа
        const logData = {
            admin_id: req.admin?._id,
            admin_role: req.admin_role,
            action_type: action_type,
            endpoint: req.path,
            method: req.method,
            ip: req.ip,
            user_agent: req.get('User-Agent'),
            timestamp: new Date(),
            request_data: req.method === 'GET' ? req.query : req.body
        };

        console.log('📝 ADMIN ACTION LOG:', logData);

        // В будущем можно сохранять в AdminLog модель
        // await AdminLog.create(logData);

        next();
    };
};

export { 
    checkAdminToken, 
    checkAccessByGroup,
    logAdminAction // 🆕 НОВЫЙ ЭКСПОРТ
};