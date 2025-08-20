// routes/Admin.route.js - ИСПРАВЛЕННЫЕ АДМИНСКИЕ РОУТЫ 🎯
import express from 'express';
import {
  login,
  createAdmin,

  createFirstAdmin,

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

// 🆕 ИМПОРТИРУЕМ РОУТЫ УПРАВЛЕНИЯ ПАРТНЕРАМИ
import adminPartnerRoutes from './AdminPartner.route.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================

// POST /api/admin/login - Авторизация администратора
router.post('/login', login);

// GET /api/admin/health - Проверка работы админских роутов
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "🎯 Admin routes - ИСПРАВЛЕННЫЕ С УПРАВЛЕНИЕМ ПАРТНЕРАМИ",
    service_layer: "enabled",
    meta_model: "enabled",
    admin_permissions: "enabled",
    
    // 📋 СТРУКТУРА АДМИНСКИХ МОДУЛЕЙ
    available_modules: {
      // 👤 УПРАВЛЕНИЕ АДМИНИСТРАТОРАМИ
      admin_management: {
        base_path: "/api/admin/",
        description: "Управление админскими аккаунтами",
        endpoints: {
          login: "POST /login",
          verify: "GET /verify", 
          profile: "GET /profile",
          create_admin: "POST /create",
          list_admins: "GET /list",
          update_permissions: "PUT /:admin_id/permissions"
        }
      },
      
      // 🏪 УПРАВЛЕНИЕ ПАРТНЕРАМИ (НОВОЕ!)
      partner_management: {
        base_path: "/api/admin/partners/",
        description: "Полный цикл одобрения партнеров",
        workflow_steps: {
          "ЭТАП 1→2": "POST /requests/:id/approve - Одобрить первичную заявку",
          "ЭТАП 2": "Партнер подает юр.данные через свой кабинет",
          "ЭТАП 3→4": "POST /legal/:id/approve - Одобрить юр.данные → создать профиль",
          "ЭТАП 4": "Партнер наполняет контент через свой кабинет",
          "ЭТАП 5→6": "POST /profiles/:id/approve - Одобрить контент → опубликовать"
        },
        endpoints: {
          // Просмотр
          get_all_requests: "GET /requests",
          get_request_details: "GET /requests/:request_id",
          
          // Первичные заявки (ЭТАП 1)
          approve_initial_request: "POST /requests/:request_id/approve",
          reject_initial_request: "POST /requests/:request_id/reject",
          
          // Юридические данные (ЭТАП 3)
          approve_legal_info: "POST /legal/:legal_info_id/approve",
          reject_legal_info: "POST /legal/:legal_info_id/reject",
          
          // Контент и публикация (ЭТАП 5)
          approve_content: "POST /profiles/:profile_id/approve",
          reject_content: "POST /profiles/:profile_id/reject"
        }
      },
      
      // 🚚 ПЛАНИРУЕМЫЕ МОДУЛИ
      future_modules: {
        courier_management: "/api/admin/couriers/",
        order_management: "/api/admin/orders/",
        customer_support: "/api/admin/customers/",
        analytics: "/api/admin/analytics/",
        system_settings: "/api/admin/system/"
      }
    },
    
    // 🔑 РОЛИ И РАЗРЕШЕНИЯ
    roles: {
      owner: {
        description: "Полные права на все модули",
        can_do: ["Создавать администраторов", "Изменять настройки системы", "Всё"]
      },
      manager: {
        description: "Управление партнерами, курьерами, заказами",
        can_do: ["Одобрять партнеров", "Управлять заказами", "Создавать support/moderator"]
      },
      support: {
        description: "Поддержка пользователей, просмотр заказов",
        can_do: ["Просматривать заказы", "Помогать клиентам", "Просматривать заявки"]
      },
      moderator: {
        description: "Модерация контента, одобрение заявок",
        can_do: ["Модерировать контент", "Одобрять заявки", "Просматривать профили"]
      }
    },
    
    // 🔐 БЕЗОПАСНОСТЬ
    security_features: {
      role_based_access: "Контроль доступа на основе ролей",
      permission_system: "Гранулярные разрешения",
      admin_logging: "Логирование всех админских действий",
      session_management: "Управление сессиями",
      ip_restrictions: "Ограничения по IP (планируется)"
    },
    
    timestamp: new Date().toISOString()
  });
});

// ================ ЗАЩИЩЕННЫЕ РОУТЫ АДМИНОВ ================

// GET /api/admin/verify - Верификация токена администратора
router.get('/verify', authenticateUser, requireRole('admin'), verify);

// GET /api/admin/profile - Получение профиля администратора
router.get('/profile', authenticateUser, requireRole('admin'), getProfile);

// POST /api/admin/create - Создание нового администратора (owner/manager)
router.post('/create', authenticateUser, requireRole('admin'), createAdmin);

router.post('/create-first', createFirstAdmin);

// GET /api/admin/list - Получение списка администраторов (owner/manager)  
router.get('/list', authenticateUser, requireRole('admin'), getAdminsList);

// PUT /api/admin/:admin_id/permissions - Обновление разрешений администратора (owner/manager)
router.put('/:admin_id/permissions', authenticateUser, requireRole('admin'), updatePermissions);

// ================ 🆕 ПОДКЛЮЧЕНИЕ МОДУЛЯ ПАРТНЕРОВ ================

/**
 * 🏪 МОДУЛЬ УПРАВЛЕНИЯ ПАРТНЕРАМИ
 * /api/admin/partners/* - Все роуты для управления workflow партнеров
 * 
 * 🎯 ПРАВИЛЬНЫЙ WORKFLOW:
 * 1. Партнер регистрируется → InitialPartnerRequest (pending)
 * 2. Админ одобряет → status = approved
 * 3. Партнер подает юр.данные → PartnerLegalInfo, status = under_review  
 * 4. Админ одобряет документы → создается PartnerProfile, status = legal_approved
 * 5. Партнер наполняет контент → status = content_review
 * 6. Админ одобряет контент → is_public = true, status = completed
 */
router.use('/partners', adminPartnerRoutes);

// ================ 🔄 ПЛАНИРУЕМЫЕ МОДУЛИ ================

// 🚚 МОДУЛЬ КУРЬЕРОВ (планируется)
// router.use('/couriers', adminCourierRoutes);

// 🛒 МОДУЛЬ ЗАКАЗОВ (планируется)
// router.use('/orders', adminOrderRoutes);

// 👥 МОДУЛЬ КЛИЕНТОВ (планируется)
// router.use('/customers', adminCustomerRoutes);

// 📊 МОДУЛЬ АНАЛИТИКИ (планируется)
// router.use('/analytics', adminAnalyticsRoutes);

// ⚙️ МОДУЛЬ СИСТЕМНЫХ НАСТРОЕК (планируется)
// router.use('/system', adminSystemRoutes);

// 📋 МОДУЛЬ ЛОГОВ (планируется)
// router.use('/logs', adminLogsRoutes);

// ================ ДОПОЛНИТЕЛЬНЫЕ АДМИНСКИЕ ФУНКЦИИ ================

/**
 * 📊 ОБЩАЯ СТАТИСТИКА СИСТЕМЫ
 * GET /api/admin/dashboard
 */
router.get('/dashboard', 
  authenticateUser, 
  requireRole('admin'), 
  async (req, res) => {
    try {
      const { user } = req;
      
      // Базовая статистика для дашборда
      const dashboardData = {
        admin_info: {
          id: user._id,
          full_name: user.full_name,
          role: user.admin_role || user.role,
          department: user.department
        },
        
        quick_stats: {
          pending_partner_requests: "Загружается...",
          active_partners: "Загружается...",
          total_orders_today: "Загружается...",
          revenue_today: "Загружается..."
        },
        
        quick_actions: [
          {
            title: "Заявки партнеров",
            description: "Просмотр и одобрение заявок",
            link: "/api/admin/partners/requests"
          },
          {
            title: "Управление администраторами",
            description: "Создание и управление админами",
            link: "/api/admin/list"
          }
        ],
        
        notifications: [
          {
            type: "info",
            message: "Система ESARGO работает нормально",
            timestamp: new Date()
          }
        ]
      };

      res.status(200).json({
        result: true,
        message: "Дашборд администратора",
        dashboard: dashboardData
      });

    } catch (error) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({
        result: false,
        message: "Ошибка загрузки дашборда"
      });
    }
  }
);

/**
 * 🔍 БЫСТРЫЙ ПОИСК ПО СИСТЕМЕ
 * GET /api/admin/search?q=query
 */
router.get('/search',
  authenticateUser,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || q.length < 3) {
        return res.status(400).json({
          result: false,
          message: "Поисковый запрос должен содержать минимум 3 символа"
        });
      }

      // Базовый поиск (можно расширить)
      const searchResults = {
        partners: [],
        customers: [],
        orders: [],
        admins: []
      };

      res.status(200).json({
        result: true,
        message: `Результаты поиска для: "${q}"`,
        query: q,
        results: searchResults,
        total_found: 0
      });

    } catch (error) {
      console.error('Admin search error:', error);
      res.status(500).json({
        result: false,
        message: "Ошибка поиска"
      });
    }
  }
);

// ================ MIDDLEWARE ДЛЯ ОБРАБОТКИ ОШИБОК ================
router.use((error, req, res, next) => {
  console.error('Admin Route Error:', error);
  
  res.status(error.statusCode || 500).json({
    result: false,
    message: error.message || 'Ошибка в админских роутах',
    error_code: error.code || 'ADMIN_ROUTE_ERROR',
    timestamp: new Date().toISOString()
  });
});

// ================ ЗАМЕТКИ ДЛЯ РАЗРАБОТЧИКОВ ================
/*
🎯 СТРУКТУРА АДМИНСКИХ РОУТОВ:

BASE: /api/admin/
├── 👤 УПРАВЛЕНИЕ АДМИНАМИ
│   ├── POST /login - Авторизация
│   ├── GET /verify - Проверка токена
│   ├── GET /profile - Профиль админа
│   ├── POST /create - Создание админа
│   ├── GET /list - Список админов
│   └── PUT /:admin_id/permissions - Изменение прав
│
├── 🏪 УПРАВЛЕНИЕ ПАРТНЕРАМИ (/partners/*)
│   ├── GET /requests - Все заявки
│   ├── POST /requests/:id/approve - ЭТАП 1→2
│   ├── POST /legal/:id/approve - ЭТАП 3→4 (создает PartnerProfile!)
│   └── POST /profiles/:id/approve - ЭТАП 5→6 (публикует)
│
├── 📊 ДОПОЛНИТЕЛЬНО
│   ├── GET /dashboard - Дашборд админа
│   └── GET /search - Поиск по системе
│
└── 🔄 ПЛАНИРУЕМЫЕ МОДУЛИ
    ├── /couriers/* - Управление курьерами
    ├── /orders/* - Управление заказами
    ├── /customers/* - Поддержка клиентов
    └── /analytics/* - Аналитика

🔑 КЛЮЧЕВЫЕ ПРИНЦИПЫ:
- Все админские действия логируются
- Проверка ролей и разрешений
- PartnerProfile создается ТОЛЬКО через админа
- Полный контроль workflow партнеров
*/

export default router;