// routes/index.js - ОБНОВЛЕННЫЙ с курьерскими роутами

import express from 'express';

// ================ ИМПОРТ ВСЕХ РОУТОВ ================

// Основные пользовательские роуты
import customerRoutes from './Customer.route.js';
import partnerRoutes from './Partner.route.js'; 
import courierRoutes from './Courier.route.js';  // НОВЫЕ РОУТЫ

// Административные роуты
import adminRoutes from './Admin.route.js';
import adminPartnerRoutes from './AdminPartner.route.js';
import adminCourierRoutes from './AdminCourier.route.js';  // НОВЫЕ АДМИН РОУТЫ

// Специализированные роуты
import partnerMenuRoutes from './Partner.menu.routes.js';
import orderRoutes from './Order.route.js';
import messageRoutes from './Message.route.js';
import reviewRoutes from './Review.route.js';
import categoryRoutes from './Category.route.js';

const router = express.Router();

// ================ ОСНОВНЫЕ API РОУТЫ ================

// Клиенты
router.use('/customers', customerRoutes);

// Партнеры
router.use('/partners', partnerRoutes);
router.use('/partners/menu', partnerMenuRoutes);

// Курьеры (НОВЫЕ РОУТЫ)
router.use('/couriers', courierRoutes);

// Заказы и сообщения
router.use('/orders', orderRoutes);
router.use('/messages', messageRoutes);
router.use('/reviews', reviewRoutes);

// Категории
router.use('/categories', categoryRoutes);

// ================ АДМИНИСТРАТИВНЫЕ РОУТЫ ================

// Основная админская панель
router.use('/admin', adminRoutes);

// Управление партнерами
router.use('/admin/partners', adminPartnerRoutes);

// Управление курьерами (НОВЫЕ АДМИН РОУТЫ)
router.use('/admin/couriers', adminCourierRoutes);

// ================ СИСТЕМНАЯ ИНФОРМАЦИЯ ================

// Статус API и системная информация
router.get('/status', (req, res) => {
  res.json({
    result: true,
    message: "ESARGO API работает",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    
    available_endpoints: {
      // Пользовательские API
      customers: {
        base_url: "/api/customers",
        description: "Регистрация и управление клиентами",
        main_endpoints: [
          "POST /register", "POST /login", "GET /profile", "PUT /profile"
        ]
      },
      
      partners: {
        base_url: "/api/partners", 
        description: "Регистрация и управление партнерами (рестораны/магазины)",
        main_endpoints: [
          "POST /register", "POST /login", "GET /profile", "POST /legal-info/:request_id"
        ]
      },
      
      // НОВАЯ ИНФОРМАЦИЯ О КУРЬЕРАХ
      couriers: {
        base_url: "/api/couriers",
        description: "Регистрация и управление курьерами",
        main_endpoints: [
          "POST /register", "POST /login", "GET /profile", 
          "PATCH /availability", "PATCH /location", "GET /earnings"
        ],
        workflow: "pending → approved → working"
      },
      
      orders: {
        base_url: "/api/orders",
        description: "Система заказов"
      },
      
      // Административные API  
      admin: {
        partners: {
          base_url: "/api/admin/partners",
          description: "Управление заявками и профилями партнеров"
        },
        
        // НОВАЯ СЕКЦИЯ АДМИНА ДЛЯ КУРЬЕРОВ
        couriers: {
          base_url: "/api/admin/couriers", 
          description: "Управление заявками и профилями курьеров",
          main_endpoints: [
            "GET /applications", "POST /applications/:id/approve",
            "POST /applications/:id/reject", "GET /profiles",
            "POST /profiles/:id/block", "GET /statistics"
          ]
        }
      }
    },
    
    // ОБНОВЛЕННАЯ СИСТЕМА РОЛЕЙ
    user_roles: {
      customer: "Клиенты (заказчики)",
      partner: "Партнеры (рестораны и магазины)", 
      courier: "Курьеры (доставка)",  // НОВАЯ РОЛЬ
      admin: "Администраторы системы"
    },
    
    // WORKFLOW ИНФОРМАЦИЯ
    registration_workflows: {
      partners: {
        steps: ["register", "admin_approval", "legal_documents", "profile_creation"],
        estimated_time: "2-3 дня"
      },
      
      // НОВЫЙ WORKFLOW ДЛЯ КУРЬЕРОВ  
      couriers: {
        steps: ["register_with_documents", "admin_approval", "profile_creation"],
        estimated_time: "24 часа",
        required_documents: ["id_card", "bank_rib", "driver_license*", "insurance*", "vehicle_registration*"],
        note: "* требуется для мотоцикла/авто"
      }
    }
  });
});

// Информация о здоровье системы
router.get('/health', (req, res) => {
  res.json({
    result: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      api: "online",
      database: "connected", 
      courier_system: "active",  // НОВЫЙ СЕРВИС
      partner_system: "active",
      customer_system: "active"
    }
  });
});

// Fallback для неизвестных роутов
router.use('*', (req, res) => {
  res.status(404).json({
    result: false,
    message: "API endpoint не найден",
    requested_path: req.originalUrl,
    method: req.method,
    suggestion: "Проверьте правильность URL и метод запроса",
    available_endpoints: "/api/status"
  });
});

export default router;