// routes/Admin.route.js
import express from 'express';
import {
  login,
  createAdmin,
  verify,
  getProfile,
  updatePermissions,
  getAdminsList
} from '../controllers/AdminController.js';
import { 
  authenticateUser, 
  requireRole,
  requireAdminPermission
} from '../middleware/auth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// POST /api/admin/login - Авторизация администратора
router.post('/login', login);

// GET /api/admin/health - Проверка работы админских роутов
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Admin routes working with service layer",
    service_layer: "enabled",
    meta_model: "enabled",
    admin_permissions: "enabled",
    available_endpoints: {
      // Публичные
      login: "POST /api/admin/login",
      
      // Защищенные
      verify: "GET /api/admin/verify",
      profile: "GET /api/admin/profile",
      create_admin: "POST /api/admin/create",
      list_admins: "GET /api/admin/list",
      update_permissions: "PUT /api/admin/:admin_id/permissions"
    },
    roles: {
      owner: "Полные права",
      manager: "Управление партнерами, курьерами, заказами",
      support: "Поддержка пользователей, просмотр заказов",
      moderator: "Модерация контента, одобрение заявок"
    },
    timestamp: new Date().toISOString()
  });
});

// ================ ЗАЩИЩЕННЫЕ РОУТЫ ================

// GET /api/admin/verify - Верификация токена администратора
router.get('/verify', authenticateUser, requireRole('admin'), verify);

// GET /api/admin/profile - Получение профиля администратора
router.get('/profile', authenticateUser, requireRole('admin'), getProfile);

// POST /api/admin/create - Создание нового администратора (owner/manager)
router.post('/create', authenticateUser, requireRole('admin'), createAdmin);

// GET /api/admin/list - Получение списка администраторов (owner/manager)  
router.get('/list', authenticateUser, requireRole('admin'), getAdminsList);

// PUT /api/admin/:admin_id/permissions - Обновление разрешений администратора (owner/manager)
router.put('/:admin_id/permissions', authenticateUser, requireRole('admin'), updatePermissions);

export default router;