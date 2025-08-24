// ================ middleware/adminAuth.middleware.js (ИСПРАВЛЕННЫЙ) ================
import jwt from "jsonwebtoken";
import { AdminUser } from "../models/index.js";

/**
 * ✅ ИСПРАВЛЕННАЯ функция декодирования токена
 */
const decodeToken = async (token) => {
    try {
        console.log('🔍 DECODING ADMIN TOKEN...');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { user_id, _id, role, admin_role } = decoded;
        const adminId = user_id || _id;

        console.log('🔍 DECODED TOKEN DATA:', { 
            adminId, 
            role, 
            admin_role,
            token_type: decoded.type 
        });

        // Быстрая проверка роли
        if (role !== "admin") {
            console.log('❌ INVALID ROLE:', role);
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
            console.log('❌ ADMIN NOT FOUND:', adminId);
            return { 
                message: "Access denied! Admin not found!", 
                result: false, 
                status: 404 
            };
        }

        console.log('🔍 ADMIN FOUND:', {
            admin_id: admin._id,
            email: admin.email,
            role: admin.role,
            is_active: admin.is_active,
            is_suspended: admin.suspension?.is_suspended
        });

        // ✅ ИСПРАВЛЕНО: Проверяем is_active вместо account_status
        if (!admin.is_active) {
            console.log('❌ ADMIN ACCOUNT INACTIVE');
            return {
                message: "Access denied! Admin account is inactive!",
                result: false,
                status: 403
            };
        }

        // ✅ ИСПРАВЛЕНО: Правильная проверка приостановки
        if (admin.suspension && admin.suspension.is_suspended) {
            const now = new Date();
            const suspendedUntil = admin.suspension.suspended_until;
            
            // Если есть дата окончания приостановки и она прошла
            if (suspendedUntil && now > suspendedUntil) {
                // Автоматически снимаем приостановку
                admin.suspension.is_suspended = false;
                admin.suspension.suspended_until = undefined;
                await admin.save();
                console.log('✅ AUTO-UNSUSPENDED ADMIN:', admin._id);
            } else {
                console.log('❌ ADMIN ACCOUNT SUSPENDED');
                return {
                    message: "Access denied! Admin account is suspended!",
                    result: false,
                    status: 403
                };
            }
        }

        // ✅ УПРОЩЕНА: Проверка времени сессии (опционально)
        const now = new Date();
        const lastActivity = admin.last_activity_at || admin.last_login_at;
        
        if (lastActivity) {
            const sessionTimeout = 8; // 8 часов по умолчанию
            const sessionExpiry = new Date(lastActivity.getTime() + (sessionTimeout * 60 * 60 * 1000));
            
            if (now > sessionExpiry) {
                console.log('⏰ SESSION EXPIRED for admin:', admin._id);
                return {
                    message: "Access denied! Session expired!",
                    result: false,
                    status: 401
                };
            }
        }

        // ✅ УПРОЩЕНО: Обновляем активность без блокирования
        try {
            admin.last_activity_at = now;
            await admin.save();
        } catch (updateError) {
            console.warn('⚠️ Could not update admin activity:', updateError.message);
            // Не блокируем запрос из-за ошибки обновления
        }

        console.log('✅ ADMIN ACCESS APPROVED:', {
            admin_id: admin._id,
            role: admin.role,
            is_active: admin.is_active
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
 * ✅ ИСПРАВЛЕННАЯ базовая проверка токена админа
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
 * ✅ ИСПРАВЛЕННАЯ проверка доступа по группам ролей
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

            // ✅ ПРОВЕРКА ролей
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
 * ✅ НОВЫЙ: Простая проверка для debugging
 */
const debugAdminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];
        
        console.log('🐛 DEBUG ADMIN AUTH:', {
            has_auth_header: !!authHeader,
            has_token: !!token,
            token_length: token ? token.length : 0,
            token_preview: token ? token.substring(0, 20) + '...' : 'none'
        });

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                console.log('🐛 DECODED TOKEN:', {
                    user_id: decoded.user_id || decoded._id,
                    role: decoded.role,
                    admin_role: decoded.admin_role,
                    exp: new Date(decoded.exp * 1000)
                });
                
                const admin = await AdminUser.findById(decoded.user_id || decoded._id);
                console.log('🐛 ADMIN FROM DB:', {
                    found: !!admin,
                    id: admin?._id,
                    email: admin?.email,
                    role: admin?.role,
                    is_active: admin?.is_active,
                    suspended: admin?.suspension?.is_suspended
                });
            } catch (debugError) {
                console.log('🐛 TOKEN DECODE ERROR:', debugError.message);
            }
        }

        next();
    } catch (error) {
        console.error('🐛 DEBUG ERROR:', error);
        next();
    }
};

export { 
    checkAdminToken, 
    checkAccessByGroup,
    debugAdminAuth // 🆕 Для debugging
};