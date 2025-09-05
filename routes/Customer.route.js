// routes/Customer.route.js - Обновленные роуты с полным API управления адресами
import express from 'express';
import {
  register,
  login,
  verify,
  getProfile,
  edit,
  delClient
} from '../controllers/CustomerController.js';

// ✅ НОВЫЙ ИМПОРТ: Контроллер управления адресами
import {
  addAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  removeAddress,
  setDefaultAddress,
  getDeliveryZonesInfo,
  getMockAddresses,
  validateAddress
} from '../controllers/AddressController.js';

import { 
  authenticateCustomer, 
  requireRole,
  checkProfileOwnership,
  validateCustomerRegistration,
  validateCustomerUpdate
} from '../middleware/customerAuth.middleware.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ (без middleware) ================

/**
 * POST /api/customers/register - Регистрация клиента
 * Middleware: validateCustomerRegistration (валидация данных + подтверждение пароля)
 */
router.post('/register', 
  validateCustomerRegistration,
  register
);

/**
 * POST /api/customers/login - Авторизация пользователя
 * Middleware: нет (публичный endpoint)
 */
router.post('/login', login);

/**
 * GET /api/customers/health - Проверка работы роутов
 * Middleware: нет (служебный endpoint)
 */
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Customer routes working correctly",
    service_layer: "enabled",
    middleware: "enabled",
    address_api: "enabled", // ✅ НОВОЕ
    available_endpoints: {
      public: {
        register: "POST /api/customers/register",
        login: "POST /api/customers/login",
        health: "GET /api/customers/health"
      },
      protected: {
        verify: "GET /api/customers/verify",
        profile: "GET /api/customers/profile",
        update_profile: "PUT /api/customers/profile/:id",
        delete_profile: "DELETE /api/customers/profile/:id",
        // ✅ НОВЫЕ ЭНДПОИНТЫ АДРЕСОВ
        addresses: {
          get_all: "GET /api/customers/addresses",
          get_by_id: "GET /api/customers/addresses/:addressId",
          add: "POST /api/customers/addresses",
          update: "PUT /api/customers/addresses/:addressId",
          remove: "DELETE /api/customers/addresses/:addressId",
          set_default: "PATCH /api/customers/addresses/:addressId/default",
          validate: "POST /api/customers/addresses/validate",
          delivery_zones: "GET /api/customers/addresses/delivery-zones",
          mock_data: "GET /api/customers/addresses/mock-data"
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ================ ЗАЩИЩЕННЫЕ РОУТЫ (требуют аутентификации) ================

/**
 * GET /api/customers/verify - Верификация токена
 * Middleware: authenticateCustomer (проверка токена)
 */
router.get('/verify', 
  authenticateCustomer, 
  verify
);

/**
 * GET /api/customers/profile - Получение профиля пользователя
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/profile', 
  authenticateCustomer, 
  requireRole('customer'), 
  getProfile
);

/**
 * PUT /api/customers/profile/:id - Обновление профиля пользователя
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 * - checkProfileOwnership (проверка права редактировать профиль)
 * - validateCustomerUpdate (валидация данных + подтверждение пароля при смене)
 */
router.put('/profile/:id', 
  authenticateCustomer, 
  requireRole('customer'), 
  checkProfileOwnership,
  validateCustomerUpdate,
  edit
);

/**
 * DELETE /api/customers/profile/:id - Удаление пользователя
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 * - checkProfileOwnership (проверка права удалить профиль)
 */
router.delete('/profile/:id', 
  authenticateCustomer, 
  requireRole('customer'), 
  checkProfileOwnership,
  delClient
);

// ================ 📍 УПРАВЛЕНИЕ АДРЕСАМИ ДОСТАВКИ ================

// ✅ УТИЛИТАРНЫЕ РОУТЫ (должны быть ПЕРЕД параметризованными)

/**
 * GET /api/customers/addresses/delivery-zones - Информация о зонах доставки
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/addresses/delivery-zones',
  authenticateCustomer,
  requireRole('customer'),
  getDeliveryZonesInfo
);

/**
 * GET /api/customers/addresses/mock-data - Тестовые адреса (только для разработки)
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/addresses/mock-data',
  authenticateCustomer,
  requireRole('customer'),
  getMockAddresses
);

/**
 * POST /api/customers/addresses/validate - Валидация адреса без сохранения
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.post('/addresses/validate',
  authenticateCustomer,
  requireRole('customer'),
  validateAddress
);

// ✅ ОСНОВНЫЕ CRUD РОУТЫ

/**
 * GET /api/customers/addresses - Получение всех адресов пользователя
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/addresses', 
  authenticateCustomer, 
  requireRole('customer'), 
  getAddresses
);

/**
 * POST /api/customers/addresses - Добавление адреса доставки
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 * Body: {
 *   address: String (required),
 *   lat?: Number,
 *   lng?: Number,
 *   name?: 'Дом' | 'Работа' | 'Родители' | 'Друзья' | 'Другое',
 *   is_default?: Boolean,
 *   details?: {
 *     apartment?: String,
 *     entrance?: String,
 *     intercom?: String,
 *     floor?: String,
 *     delivery_notes?: String
 *   }
 * }
 */
router.post('/addresses', 
  authenticateCustomer, 
  requireRole('customer'), 
  addAddress
);

/**
 * GET /api/customers/addresses/:addressId - Получение конкретного адреса
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/addresses/:addressId',
  authenticateCustomer,
  requireRole('customer'),
  getAddressById
);

/**
 * PUT /api/customers/addresses/:addressId - Обновление адреса доставки
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 * Body: {
 *   address?: String,
 *   name?: 'Дом' | 'Работа' | 'Родители' | 'Друзья' | 'Другое',
 *   is_default?: Boolean,
 *   details?: {
 *     apartment?: String,
 *     entrance?: String,
 *     intercom?: String,
 *     floor?: String,
 *     delivery_notes?: String
 *   }
 * }
 */
router.put('/addresses/:addressId', 
  authenticateCustomer, 
  requireRole('customer'), 
  updateAddress
);

/**
 * DELETE /api/customers/addresses/:addressId - Удаление адреса доставки
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.delete('/addresses/:addressId', 
  authenticateCustomer, 
  requireRole('customer'), 
  removeAddress
);

/**
 * PATCH /api/customers/addresses/:addressId/default - Установка основного адреса
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.patch('/addresses/:addressId/default',
  authenticateCustomer,
  requireRole('customer'),
  setDefaultAddress
);

// ================ ДОПОЛНИТЕЛЬНЫЕ ЗАЩИЩЕННЫЕ РОУТЫ ================

/**
 * GET /api/customers/favorites - Получение избранных партнеров
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/favorites', 
  authenticateCustomer, 
  requireRole('customer'), 
  (req, res) => {
    // TODO: Реализовать контроллер для избранных
    res.json({
      result: true,
      message: "Функционал избранных партнеров в разработке",
      favorites: []
    });
  }
);

/**
 * POST /api/customers/favorites/:partnerId - Добавление в избранное
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.post('/favorites/:partnerId', 
  authenticateCustomer, 
  requireRole('customer'), 
  (req, res) => {
    // TODO: Реализовать контроллер для добавления в избранное
    res.json({
      result: true,
      message: "Функционал добавления в избранное в разработке"
    });
  }
);

/**
 * DELETE /api/customers/favorites/:partnerId - Удаление из избранного
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.delete('/favorites/:partnerId', 
  authenticateCustomer, 
  requireRole('customer'), 
  (req, res) => {
    // TODO: Реализовать контроллер для удаления из избранного
    res.json({
      result: true,
      message: "Функционал удаления из избранного в разработке"
    });
  }
);

/**
 * GET /api/customers/orders - Получение истории заказов
 * Middleware: 
 * - authenticateCustomer (проверка токена)
 * - requireRole('customer') (проверка роли)
 */
router.get('/orders', 
  authenticateCustomer, 
  requireRole('customer'), 
  (req, res) => {
    // TODO: Реализовать контроллер для истории заказов
    res.json({
      result: true,
      message: "История заказов в разработке",
      orders: []
    });
  }
);

export default router;