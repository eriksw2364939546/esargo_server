// ================ middleware/adminAuth.middleware.js (ИСПРАВЛЕННЫЙ ПО ПАТТЕРНУ) ================
import jwt from "jsonwebtoken";
import Meta from "../models/Meta.model.js";

/**
 * ✅ ИСПРАВЛЕННАЯ функция декодирования токена по паттерну moderator
 */
const decodeToken = async (token) => {
    try {
        console.log('🔍 DECODING ADMIN TOKEN...');
        
        // ✅ Используем jwt.verify вместо jwt.decode
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { user_id, _id, role, admin_role } = decoded;
        const adminId = user_id || _id;

        console.log('🔍 DECODED TOKEN DATA:', { 
            adminId, 
            role, 
            admin_role
        });

        // ✅ Проверяем основную роль как в moderator примере
        if (role !== "admin") {
            console.log('❌ INVALID ROLE:', role);
            return { 
                message: "Access denied! Role invalid!", 
                result: false, 
                status: 403 
            };
        }

        console.log('🔍 SEARCHING FOR ADMIN IN META:', { adminId });

        // ✅ ГЛАВНОЕ ИСПРАВЛЕНИЕ: Ищем через Meta с populate как в примере
        const metaInfo = await Meta.findOne({
            admin: adminId,     // ← ищем админа в Meta
            role: "admin"       // ← роль должна быть admin
        }).populate("admin");   // ← получаем полный AdminUser объект

        console.log('🔍 META INFO RESULT:', {
            metaInfo_found: !!metaInfo,
            has_admin: !!metaInfo?.admin,
            admin_id: metaInfo?.admin?._id,
            admin_email: metaInfo?.admin?.email,
            admin_role: metaInfo?.admin?.role
        });

        // ✅ Проверяем результат как в moderator примере
        if (!metaInfo || !metaInfo.admin) {
            console.log('❌ ADMIN NOT FOUND IN META');
            return { 
                message: "Access denied! Admin is not defined!", 
                result: false, 
                status: 404 
            };
        }

        const admin = metaInfo.admin;

        console.log('🔍 ADMIN VALIDATION:', {
            admin_id: admin._id,
            email: admin.email,
            role: admin.role,
            is_active: admin.is_active,
            meta_is_active: metaInfo.is_active
        });

        // ✅ Проверяем активность админа
        if (!admin.is_active) {
            console.log('❌ ADMIN ACCOUNT INACTIVE');
            return {
                message: "Access denied! Admin account is inactive!",
                result: false,
                status: 403
            };
        }

        // ✅ Проверяем активность Meta записи
        if (!metaInfo.is_active) {
            console.log('❌ META RECORD INACTIVE');
            return {
                message: "Access denied! Admin meta record is inactive!",
                result: false,
                status: 403
            };
        }

        // ✅ Проверяем приостановку аккаунта
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

        // ✅ Проверяем блокировку аккаунта
        if (metaInfo.isAccountLocked && metaInfo.isAccountLocked()) {
            console.log('❌ ADMIN ACCOUNT LOCKED');
            return {
                message: "Access denied! Admin account is locked!",
                result: false,
                status: 423
            };
        }

        // ✅ Обновляем активность без блокирования
        try {
            admin.last_activity_at = new Date();
            await admin.save();
        } catch (updateError) {
            console.warn('⚠️ Could not update admin activity:', updateError.message);
            // Не блокируем запрос из-за ошибки обновления
        }

        console.log('✅ ADMIN ACCESS APPROVED:', {
            admin_id: admin._id,
            admin_role: admin.role,
            is_active: admin.is_active
        });

        // ✅ Возвращаем как в moderator примере
        return { 
            message: "Access approved!", 
            result: true, 
            admin: admin,                    // ← полный AdminUser объект
            admin_role: admin.role           // ← конкретная роль (owner/manager)
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
 * ✅ ИСПРАВЛЕННАЯ базовая проверка токена админа по паттерну moderator
 */
const checkAdminToken = async (req, res, next) => {
    try {
        console.log('🔍 CHECK ADMIN TOKEN - START');
        
        // ✅ Извлекаем токен как в moderator примере
        const token = req.headers["authorization"]?.split(" ")[1];

        if (!token) {
            console.log('🚨 NO TOKEN PROVIDED');
            return res.status(403).json({ 
                message: "Access denied! Token undefined!", 
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
        
        // ✅ Сохраняем данные админа как в moderator примере
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
 * ✅ ИСПРАВЛЕННАЯ проверка доступа по группам ролей по паттерну moderator
 */
const checkAccessByGroup = (requiredRoles) => {
    return async (req, res, next) => {
        try {
            console.log('🔍 CHECK ACCESS BY GROUP:', { 
                required: requiredRoles,
                endpoint: req.path,
                method: req.method
            });
            
            // ✅ Извлекаем токен как в moderator примере
            const token = req.headers["authorization"]?.split(" ")[1];

            if (!token) {
                return res.status(403).json({ 
                    message: "Access denied! Token undefined!", 
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

            // ✅ Проверяем роль как в moderator примере
            const userRole = data.admin_role;

            console.log('🔍 ROLE ACCESS CHECK:', {
                required_roles: requiredRoles,
                user_role: userRole,
                has_access: requiredRoles.includes(userRole)
            });

            // ✅ ПРОВЕРКА ролей как в moderator примере
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
                    message: "Access denied! Role invalid!", 
                    result: false
                });
            }

            console.log('✅ ACCESS GRANTED:', {
                admin_role: userRole,
                endpoint: req.path
            });

            // ✅ Сохраняем данные админа как в moderator примере
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

export { 
    checkAdminToken, 
    checkAccessByGroup
};