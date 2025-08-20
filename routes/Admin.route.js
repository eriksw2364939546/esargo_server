// routes/Admin.route.js - АДМИНСКИЕ РОУТЫ С НОВОЙ MIDDLEWARE СИСТЕМОЙ (ИСПРАВЛЕННЫЙ) 🎯
import express from 'express';
import {
  login,
  createAdmin,
  verify,
  getProfile,
  updatePermissions,
  getAdminsList
} from '../controllers/AdminController.js';

// 🆕 ИМПОРТ НОВОГО АДМИНСКОГО MIDDLEWARE
import { 
  checkAdminToken,
  checkAdminAccessByGroup,
  requireOwner,
  requireManagerOrOwner,
  requireAnyAdmin
} from '../middleware/adminAuth.middleware.js';

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
    message: "🎯 Admin routes - С НОВОЙ MIDDLEWARE СИСТЕМОЙ",
    service_layer: "enabled",
    meta_model: "enabled",
    admin_permissions: "role_based",
    
    // 📋 ДОСТУПНЫЕ АДМИНСКИЕ РОЛИ
    admin_roles: {
      owner: {
        description: "Владелец системы - все права",
        created: "Автоматически при запуске сервера",
        permissions: "Полный доступ ко всем функциям"
      },
      manager: {
        description: "Менеджер - управление партнерами и заказами",
        permissions: "Одобрение партнеров, управление контентом"
      },
      admin: {
        description: "Администратор - базовые права",
        permissions: "Просмотр данных, базовые операции"
      },
      support: {
        description: "Поддержка пользователей",
        permissions: "Работа с клиентами, просмотр заказов"
      },
      moderator: {
        description: "Модерация контента",
        permissions: "Модерация контента партнеров"
      }
    },
    
    // 📋 СТРУКТУРА MIDDLEWARE
    middleware_system: {
      base_auth: "checkAdminToken - базовая проверка токена админа",
      role_based: "checkAdminAccessByGroup(['role1', 'role2']) - проверка по ролям",
      shortcuts: {
        requireOwner: "Только для owner",
        requireManagerOrOwner: "Для owner и manager",
        requireAnyAdmin: "Для любого админа"
      }
    },
    
    // 📋 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
    usage_examples: {
      only_owner: "router.post('/critical', requireOwner, controller)",
      owner_and_manager: "router.post('/manage', requireManagerOrOwner, controller)",
      specific_roles: "router.get('/data', checkAdminAccessByGroup(['admin', 'support']), controller)",
      any_admin: "router.get('/dashboard', requireAnyAdmin, controller)"
    },
    
    // 🎯 ИНФОРМАЦИЯ ОБ OWNER АККАУНТЕ
    owner_account: {
      creation: "Автоматически при первом запуске сервера",
      email: "admin@admin.com",
      password: "admin (измените после первого входа!)",
      note: "Используйте POST /api/admin/login для входа"
    },
    
    // 📋 ДОСТУПНЫЕ ENDPOINTS
    available_endpoints: {
      auth: {
        login: "POST /api/admin/login",
        verify: "GET /api/admin/verify",
        profile: "GET /api/admin/profile"
      },
      management: {
        create_admin: "POST /api/admin/create",
        list_admins: "GET /api/admin/list",
        update_permissions: "PUT /api/admin/:admin_id/permissions"
      },
      partners: {
        requests: "GET /api/admin/partners/requests",
        approve_request: "POST /api/admin/partners/requests/:id/approve",
        approve_legal: "POST /api/admin/partners/legal/:id/approve",
        approve_content: "POST /api/admin/partners/profiles/:id/approve"
      },
      system: {
        dashboard: "GET /api/admin/dashboard",
        search: "GET /api/admin/search",
        system_info: "GET /api/admin/system"
      }
    },
    
    timestamp: new Date().toISOString()
  });
});

// ================ ЗАЩИЩЕННЫЕ РОУТЫ АДМИНОВ ================

// GET /api/admin/verify - Верификация токена администратора
router.get('/verify', checkAdminToken, verify);

// GET /api/admin/profile - Получение профиля администратора  
router.get('/profile', checkAdminToken, getProfile);

// POST /api/admin/create - Создание нового администратора (только owner или manager)
router.post('/create', requireManagerOrOwner, createAdmin);

// GET /api/admin/list - Получение списка администраторов (owner/manager)
router.get('/list', requireManagerOrOwner, getAdminsList);

// PUT /api/admin/:admin_id/permissions - Обновление разрешений (только owner)
router.put('/:admin_id/permissions', requireOwner, updatePermissions);

// ================ 🆕 ПОДКЛЮЧЕНИЕ МОДУЛЯ ПАРТНЕРОВ С НОВЫМИ MIDDLEWARE ================

/**
 * 🏪 МОДУЛЬ УПРАВЛЕНИЯ ПАРТНЕРАМИ
 * Используем role-based middleware для разных уровней доступа
 */
router.use('/partners', adminPartnerRoutes);

// ================ ДАШБОРД И АНАЛИТИКА ================

/**
 * 📊 ГЛАВНЫЙ ДАШБОРД АДМИНИСТРАТОРА
 * GET /api/admin/dashboard - Доступен любому админу
 */
router.get('/dashboard', requireAnyAdmin, async (req, res) => {
  try {
    // 🎯 БАЗОВАЯ ИНФОРМАЦИЯ ДАШБОРДА
    const dashboardData = {
      admin_info: {
        id: req.admin._id,
        full_name: req.admin.full_name,
        role: req.admin_role,
        department: req.admin.contact_info?.department,
        last_login: req.admin.last_login_at
      },
      
      server_status: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV,
        version: "2.0.0"
      },
      
      quick_stats: {
        pending_requests: "Загружается...",
        active_partners: "Загружается...",
        total_orders: "Загружается..."
      },
      
      // 🎯 ДЕЙСТВИЯ В ЗАВИСИМОСТИ ОТ РОЛИ
      available_actions: getActionsForRole(req.admin_role),
      
      notifications: [
        {
          type: "success",
          message: "Owner аккаунт создается автоматически при запуске",
          timestamp: new Date()
        },
        {
          type: "info", 
          message: `Добро пожаловать, ${req.admin.full_name}! Ваша роль: ${req.admin_role}`,
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
});

/**
 * 🔍 БЫСТРЫЙ ПОИСК ПО СИСТЕМЕ
 * GET /api/admin/search?q=query - Доступен любому админу
 */
router.get('/search', requireAnyAdmin, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 3) {
      return res.status(400).json({
        result: false,
        message: "Поисковый запрос должен содержать минимум 3 символа"
      });
    }

    // 🎯 ПОИСК В ЗАВИСИМОСТИ ОТ РОЛИ АДМИНА
    const searchResults = await performSearchByRole(q, req.admin_role);

    res.status(200).json({
      result: true,
      message: `Результаты поиска для: "${q}"`,
      query: q,
      admin_role: req.admin_role,
      results: searchResults,
      total_found: Object.values(searchResults).flat().length
    });

  } catch (error) {
    console.error('Admin search error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка поиска"
    });
  }
});

// ================ СИСТЕМНЫЕ РОУТЫ (ТОЛЬКО OWNER) ================

/**
 * 🔧 СИСТЕМНЫЕ НАСТРОЙКИ
 * GET /api/admin/system - Только для owner
 */
router.get('/system', requireOwner, async (req, res) => {
  try {
    const systemInfo = {
      database: {
        status: "connected",
        collections: "Загружается..."
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu_usage: "Недоступно"
      },
      security: {
        active_sessions: "Загружается...",
        failed_logins: "Загружается..."
      }
    };

    res.status(200).json({
      result: true,
      message: "Системная информация",
      system: systemInfo
    });

  } catch (error) {
    console.error('System info error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения системной информации"
    });
  }
});

// ================ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ================

/**
 * 🎯 ПОЛУЧЕНИЕ ДОСТУПНЫХ ДЕЙСТВИЙ В ЗАВИСИМОСТИ ОТ РОЛИ
 */
function getActionsForRole(adminRole) {
  const baseActions = [
    {
      title: "Просмотр дашборда",
      description: "Основная информация системы",
      link: "/api/admin/dashboard"
    }
  ];

  switch (adminRole) {
    case 'owner':
      return [
        ...baseActions,
        {
          title: "Управление администраторами",
          description: "Создание и управление админами",
          link: "/api/admin/list"
        },
        {
          title: "Системные настройки",
          description: "Настройка системы",
          link: "/api/admin/system"
        },
        {
          title: "Управление партнерами",
          description: "Полный контроль над партнерами",
          link: "/api/admin/partners/requests"
        }
      ];
      
    case 'manager':
      return [
        ...baseActions,
        {
          title: "Заявки партнеров",
          description: "Одобрение и управление партнерами",
          link: "/api/admin/partners/requests"
        },
        {
          title: "Создание админов",
          description: "Создание администраторов",
          link: "/api/admin/create"
        }
      ];
      
    case 'support':
      return [
        ...baseActions,
        {
          title: "Поддержка клиентов",
          description: "Работа с обращениями",
          link: "/api/admin/support"
        }
      ];
      
    default:
      return baseActions;
  }
}

/**
 * 🔍 ПОИСК В ЗАВИСИМОСТИ ОТ РОЛИ
 */
async function performSearchByRole(query, adminRole) {
  const results = {
    partners: [],
    customers: [],
    orders: [],
    admins: []
  };

  // Owner и Manager могут искать везде
  if (['owner', 'manager'].includes(adminRole)) {
    // Полный поиск (здесь будет реальная логика поиска)
    return results;
  }
  
  // Support может искать только клиентов и заказы
  if (adminRole === 'support') {
    return {
      customers: [],
      orders: []
    };
  }
  
  // Остальные роли - ограниченный поиск
  return {
    basic_info: []
  };
}

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
🎯 НОВАЯ СТРУКТУРА АДМИНСКИХ РОУТОВ С ROLE-BASED MIDDLEWARE:

BASE: /api/admin/
├── 👤 УПРАВЛЕНИЕ АДМИНИСТРАТОРАМИ
│   ├── POST /login - Авторизация (публичный)
│   ├── GET /verify - Проверка токена (checkAdminToken)
│   ├── GET /profile - Профиль админа (checkAdminToken)
│   ├── POST /create - Создание админа (requireManagerOrOwner)
│   ├── GET /list - Список админов (requireManagerOrOwner)
│   └── PUT /:admin_id/permissions - Изменение прав (requireOwner)
│
├── 🏪 УПРАВЛЕНИЕ ПАРТНЕРАМИ (/partners/*)
│   ├── Различные уровни доступа по ролям
│   ├── Owner: полный доступ
│   ├── Manager: одобрение и управление
│   └── Admin/Support: просмотр
│
├── 📊 ДАШБОРД И АНАЛИТИКА
│   ├── GET /dashboard - Главный дашборд (requireAnyAdmin)
│   ├── GET /search - Поиск по системе (requireAnyAdmin)
│   └── GET /system - Системная информация (requireOwner)
│
└── 🎯 РОЛИ И ПРАВА:
    ├── owner: Все права (создается автоматически)
    ├── manager: Управление партнерами + создание админов
    ├── admin: Базовые права
    ├── support: Поддержка клиентов
    └── moderator: Модерация контента

🆕 MIDDLEWARE СИСТЕМА:
- checkAdminToken: Базовая проверка админского токена
- checkAdminAccessByGroup(['role1', 'role2']): Проверка по ролям
- requireOwner: Только owner
- requireManagerOrOwner: Owner или manager
- requireAnyAdmin: Любой админ

🔑 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:
router.post('/critical', requireOwner, controller)
router.post('/manage', requireManagerOrOwner, controller)  
router.get('/data', checkAdminAccessByGroup(['admin', 'support']), controller)
router.get('/dashboard', requireAnyAdmin, controller)

📧 OWNER АККАУНТ:
Email: admin@admin.com
Password: admin
Создается автоматически при запуске сервера
*/

export default router;