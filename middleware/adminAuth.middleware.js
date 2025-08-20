// middleware/adminAuth.middleware.js - АДМИНСКИЕ MIDDLEWARE НА ОСНОВЕ ВАШЕГО ПРИМЕРА 🎯
import jwt from "jsonwebtoken";
import Meta from "../models/Meta.model.js";
import { hashMeta } from "../utils/hash.js";

/**
 * 🔍 ДЕКОДИРОВАНИЕ И ПРОВЕРКА АДМИНСКОГО ТОКЕНА
 * Аналогично вашему decodeToken из примера
 */
const decodeAdminToken = async (token) => {
  try {
    // Декодируем токен (используем verify вместо decode для безопасности)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { user_id, _id, role, admin_role, is_admin } = decoded;

    // 🎯 ПРОВЕРКА: это должен быть админ
    if (role !== "admin" || !is_admin) {
      return { 
        message: "Access denied! Role invalid!", 
        result: false, 
        status: 403 
      };
    }

    // 🔍 ИЩЕМ АДМИНА В META ПО ID
    const adminId = user_id || _id;
    const metaInfo = await Meta.findOne({
      admin: adminId,
      role: "admin"
    }).populate("admin");

    if (!metaInfo || !metaInfo.admin) {
      return { 
        message: "Access denied! Admin is not defined!", 
        result: false, 
        status: 404 
      };
    }

    // ✅ ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ АДМИНА
    if (!metaInfo.admin.is_active) {
      return { 
        message: "Access denied! Admin account is inactive!", 
        result: false, 
        status: 403 
      };
    }

    if (metaInfo.admin.isSuspended && metaInfo.admin.isSuspended()) {
      return { 
        message: "Access denied! Admin account is suspended!", 
        result: false, 
        status: 403 
      };
    }

    return { 
      message: "Access approved!", 
      result: true, 
      admin: metaInfo.admin,
      admin_role: admin_role || metaInfo.admin.role
    };

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { 
        message: "Access denied! Token expired!", 
        result: false, 
        status: 403 
      };
    } else {
      return { 
        message: "Access denied! Token invalid!", 
        result: false, 
        status: 403 
      };
    }
  }
};

/**
 * 🔐 БАЗОВАЯ ПРОВЕРКА АДМИНСКОГО ТОКЕНА
 * Аналогично вашему checkModerToken
 */
export const checkAdminToken = async (req, res, next) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];

    if (!token) {
      return res.status(403).json({ 
        message: "Access denied! Token undefined!", 
        result: false 
      });
    }

    const data = await decodeAdminToken(token);
    if (!data.result) {
      return res.status(data.status).json(data);
    }

    // 🎯 ДОБАВЛЯЕМ АДМИНА В REQUEST
    req.admin = data.admin;
    req.admin_role = data.admin_role;
    req.user = data.admin; // Для совместимости с существующими контроллерами
    req.user.is_admin_user = true;
    req.user.admin_role = data.admin_role;

    next();

  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(500).json({ 
      message: "Access denied!", 
      result: false, 
      error: error.message 
    });
  }
};

/**
 * 🎯 ПРОВЕРКА ДОСТУПА ПО ГРУППАМ РОЛЕЙ
 * Аналогично вашему checkAccessByGroup
 */
export const checkAdminAccessByGroup = (adminRoles) => {
  return async (req, res, next) => {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];

      if (!token) {
        return res.status(403).json({ 
          message: "Access denied! Token undefined!", 
          result: false 
        });
      }

      const data = await decodeAdminToken(token);
      if (!data.result) {
        return res.status(data.status).json(data);
      }

      // 🎯 ПРОВЕРЯЕМ РОЛЬ АДМИНА
      const allowedRoles = Array.isArray(adminRoles) ? adminRoles : [adminRoles];
      
      if (!allowedRoles.includes(data.admin_role)) {
        return res.status(403).json({ 
          message: "Access denied! Admin role invalid!", 
          result: false,
          required_roles: allowedRoles,
          current_role: data.admin_role
        });
      }

      // 🎯 ДОБАВЛЯЕМ АДМИНА В REQUEST
      req.admin = data.admin;
      req.admin_role = data.admin_role;
      req.user = data.admin; // Для совместимости
      req.user.is_admin_user = true;
      req.user.admin_role = data.admin_role;

      next();

    } catch (error) {
      console.error("Admin group access error:", error);
      res.status(500).json({ 
        message: "Access denied!", 
        result: false, 
        error: error.message 
      });
    }
  };
};

/**
 * 🔍 УПРОЩЕННАЯ ПРОВЕРКА - ТОЛЬКО OWNER
 * Для критичных операций
 */
export const requireOwner = checkAdminAccessByGroup(['owner']);

/**
 * 🔍 ПРОВЕРКА - OWNER ИЛИ MANAGER
 * Для операций управления
 */
export const requireManagerOrOwner = checkAdminAccessByGroup(['owner', 'manager']);

/**
 * 🔍 ПРОВЕРКА - ЛЮБОЙ АДМИН
 * Для просмотра данных
 */
export const requireAnyAdmin = checkAdminAccessByGroup(['owner', 'manager', 'admin', 'support', 'moderator']);

export default {
  checkAdminToken,
  checkAdminAccessByGroup,
  requireOwner,
  requireManagerOrOwner,
  requireAnyAdmin
};