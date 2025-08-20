// // routes/Partner.route.js - РАСШИРЕННЫЕ РОУТЫ С УПРАВЛЕНИЕМ МЕНЮ 🍽️
// import express from 'express';
// import {
//   registerPartner,
//   loginPartnerUser,
//   getDashboardStatus,
//   getPartnerPersonalData,
//   checkFeatureAccess,
//   submitPartnerLegalInfo,
//   getPartnerProfileData,
//   // Legacy/deprecated
//   getRequestStatus,
//   createInitialPartnerRequest
// } from '../controllers/PartnerController.js';

// // 🆕 ИМПОРТ КОНТРОЛЛЕРА МЕНЮ
// import {
//   getMenuCategories,
//   addMenuCategory,
//   updateMenuCategory,
//   deleteMenuCategory,
//   getProducts,
//   addProduct,
//   updateProduct,
//   deleteProduct,
//   getMenuStats
// } from '../controllers/PartnerMenuController.js';

// import { 
//   authenticateUser, 
//   requireRole
// } from '../middleware/auth.middleware.js';

// const router = express.Router();

// // ================ ПУБЛИЧНЫЕ РОУТЫ ================

// /**
//  * 🎯 ОСНОВНОЙ РОУТ РЕГИСТРАЦИИ
//  * POST /api/partners/register
//  * Создает: User + Meta + InitialPartnerRequest (ЭТАП 1)
//  */
// router.post('/register', registerPartner);

// /**
//  * 🔑 АВТОРИЗАЦИЯ ПАРТНЕРА  
//  * POST /api/partners/login
//  */
// router.post('/login', loginPartnerUser);

// /**
//  * 🏥 HEALTH CHECK
//  * GET /api/partners/health
//  */
// router.get('/health', (req, res) => {
//   res.json({
//     result: true,
//     message: "🏪 Partner routes working",
//     service_layer: "enabled", 
//     meta_model: "enabled",
    
//     // 📋 WORKFLOW ПАРТНЕРОВ
//     partner_workflow: {
//       "ЭТАП 1": "POST /register → Создание User + InitialPartnerRequest",
//       "ЭТАП 2": "POST /legal-info/:request_id → Подача юр.данных", 
//       "ЭТАП 3": "Админ одобряет → Создается PartnerProfile",
//       "ЭТАП 4": "Партнер наполняет контент",
//       "ЭТАП 5": "Админ одобряет → Публикация"
//     },
    
//     // 🛠 ДОСТУПНЫЕ ENDPOINTS
//     available_endpoints: {
//       // Регистрация и авторизация
//       register: "POST /api/partners/register",
//       login: "POST /api/partners/login",
      
//       // Личный кабинет
//       dashboard: "GET /api/partners/dashboard", 
//       personal_data: "GET /api/partners/personal-data",
//       feature_access: "GET /api/partners/access/:feature",
      
//       // Юридические данные (ЭТАП 2)
//       submit_legal: "POST /api/partners/legal-info/:request_id",
      
//       // Профиль (доступен после ЭТАПА 3)
//       profile: "GET /api/partners/profile",
      
//       // 🆕 УПРАВЛЕНИЕ МЕНЮ (ЭТАП 4)
//       menu: {
//         categories: {
//           get_all: "GET /api/partners/menu/categories",
//           add: "POST /api/partners/menu/categories",
//           update: "PUT /api/partners/menu/categories/:category_id",
//           delete: "DELETE /api/partners/menu/categories/:category_id"
//         },
//         products: {
//           get_all: "GET /api/partners/menu/products",
//           add: "POST /api/partners/menu/products",
//           update: "PUT /api/partners/menu/products/:product_id",
//           delete: "DELETE /api/partners/menu/products/:product_id"
//         },
//         stats: "GET /api/partners/menu/stats"
//       },
      
//       // Legacy/deprecated
//       old_status: "GET /api/partners/status (deprecated)",
//       old_initial: "POST /api/partners/initial-request (deprecated)"
//     },
    
//     timestamp: new Date().toISOString()
//   });
// });

// // ================ ЗАЩИЩЕННЫЕ РОУТЫ ЛИЧНОГО КАБИНЕТА ================

// /**
//  * 📊 ЛИЧНЫЙ КАБИНЕТ - ДАШБОРД
//  * GET /api/partners/dashboard
//  * Показывает статус заявки и следующие шаги
//  */
// router.get('/dashboard', 
//   authenticateUser, 
//   requireRole('partner'), 
//   getDashboardStatus
// );

// /**
//  * 👤 ПЕРСОНАЛЬНЫЕ ДАННЫЕ (расшифрованные)
//  * GET /api/partners/personal-data
//  * Только для владельца аккаунта
//  */
// router.get('/personal-data', 
//   authenticateUser, 
//   requireRole('partner'), 
//   getPartnerPersonalData
// );

// /**
//  * 🔐 ПРОВЕРКА ДОСТУПА К ФУНКЦИЯМ
//  * GET /api/partners/access/:feature
//  */
// router.get('/access/:feature', 
//   authenticateUser, 
//   requireRole('partner'), 
//   checkFeatureAccess
// );

// // ================ ЭТАП 2: ЮРИДИЧЕСКИЕ ДАННЫЕ ================

// /**
//  * 📋 ПОДАЧА ЮРИДИЧЕСКИХ ДАННЫХ
//  * POST /api/partners/legal-info/:request_id
//  * Создает: PartnerLegalInfo + обновляет статус заявки
//  */
// router.post('/legal-info/:request_id', 
//   authenticateUser, 
//   requireRole('partner'), 
//   submitPartnerLegalInfo
// );

// // ================ ЭТАП 4+: ПРОФИЛЬ ================

// /**
//  * 🏪 ПРОФИЛЬ ПАРТНЕРА
//  * GET /api/partners/profile
//  * Доступен только после одобрения юр.данных (ЭТАП 3)
//  */
// router.get('/profile', 
//   authenticateUser, 
//   requireRole('partner'), 
//   getPartnerProfileData
// );

// // ================ 🆕 ЭТАП 4: УПРАВЛЕНИЕ МЕНЮ И ПРОДУКТАМИ ================

// // 📊 СТАТИСТИКА МЕНЮ
// router.get('/menu/stats', 
//   authenticateUser, 
//   requireRole('partner'), 
//   getMenuStats
// );

// // 📋 УПРАВЛЕНИЕ КАТЕГОРИЯМИ МЕНЮ
// router.get('/menu/categories', 
//   authenticateUser, 
//   requireRole('partner'), 
//   getMenuCategories
// );

// router.post('/menu/categories', 
//   authenticateUser, 
//   requireRole('partner'), 
//   addMenuCategory
// );

// router.put('/menu/categories/:category_id', 
//   authenticateUser, 
//   requireRole('partner'), 
//   updateMenuCategory
// );

// router.delete('/menu/categories/:category_id', 
//   authenticateUser, 
//   requireRole('partner'), 
//   deleteMenuCategory
// );

// // 🍽️ УПРАВЛЕНИЕ ПРОДУКТАМИ/БЛЮДАМИ
// router.get('/menu/products', 
//   authenticateUser, 
//   requireRole('partner'), 
//   getProducts
// );

// router.post('/menu/products', 
//   authenticateUser, 
//   requireRole('partner'), 
//   addProduct
// );

// router.put('/menu/products/:product_id', 
//   authenticateUser, 
//   requireRole('partner'), 
//   updateProduct
// );

// router.delete('/menu/products/:product_id', 
//   authenticateUser, 
//   requireRole('partner'), 
//   deleteProduct
// );

// // ================ LEGACY/DEPRECATED РОУТЫ ================

// /**
//  * ❌ УСТАРЕВШИЙ: Статус заявки
//  * GET /api/partners/status
//  * Используйте /dashboard вместо этого
//  */
// router.get('/status', 
//   authenticateUser, 
//   requireRole('partner'), 
//   getRequestStatus
// );

// /**
//  * ❌ УСТАРЕВШИЙ: Создание первичной заявки
//  * POST /api/partners/initial-request  
//  * Используйте /register вместо этого
//  */
// router.post('/initial-request', createInitialPartnerRequest);

// // ================ MIDDLEWARE ДЛЯ ОБРАБОТКИ ОШИБОК ================
// router.use((error, req, res, next) => {
//   console.error('Partner Route Error:', error);
  
//   res.status(error.statusCode || 500).json({
//     result: false,
//     message: error.message || 'Ошибка в партнерских роутах',
//     error_code: error.code || 'PARTNER_ROUTE_ERROR',
//     timestamp: new Date().toISOString()
//   });
// });

// // ================ ЭКСПОРТ ================
// export default router;