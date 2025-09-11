// routes/index.js - ИСПРАВЛЕННЫЕ ИМПОРТЫ
import express from 'express';
const router = express.Router();

// Import существующих роутов
import partnerRoutes from './Partner.route.js';
import partnerMenuRoutes from './Partner.menu.routes.js'; 
import customerRoutes from './Customer.route.js';
import courierRoutes from './Courier.route.js';
import adminRoutes from './Admin.route.js';
import adminPartnerRoutes from './AdminPartner.route.js';
import adminCourierRoutes from './AdminCourier.route.js';

// 🆕 ИСПРАВЛЕННЫЕ ИМПОРТЫ ДЛЯ СИСТЕМЫ ЗАКАЗОВ
import publicRoutes from './Public.route.js';      // ИСПРАВЛЕНО: убрали ../routes/Public/
import cartRoutes from './Cart.route.js';          // Корзина покупок
import orderRoutes from './Order.route.js';        // Заказы

import fileUploadRoutes from './FileUpload.route.js';

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'ESARGO API работает корректно - UberEats Style',
        service_layer: 'enabled',
        meta_model: 'enabled',
        partner_system: 'fully_implemented',
        menu_system: 'enabled',
        courier_system: 'enabled',
        
        // 🆕 НОВЫЕ СИСТЕМЫ
        public_catalog: 'enabled',       // Публичный просмотр ресторанов
        shopping_cart: 'enabled',        // Корзина покупок
        order_management: 'enabled',     // Управление заказами
        payment_system: 'stub_enabled',  // Заглушка платежей
        
        timestamp: new Date().toISOString()
    });
});

// ================ ПУБЛИЧНЫЕ РОУТЫ (без авторизации) ================
router.use('/public', publicRoutes);

// ================ ОСНОВНЫЕ ПОЛЬЗОВАТЕЛЬСКИЕ РОУТЫ ================
router.use('/customers', customerRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);

// ================ ПАРТНЕРСКИЕ РОУТЫ ================
router.use('/partners', partnerRoutes);
router.use('/partners/menu', partnerMenuRoutes);

// ================ КУРЬЕРСКИЕ РОУТЫ ================
router.use('/couriers', courierRoutes);

// ================ АДМИНИСТРАТИВНЫЕ РОУТЫ ================
router.use('/admin', adminRoutes);
router.use('/admin/partners', adminPartnerRoutes);
router.use('/admin/couriers', adminCourierRoutes);


//======================IMAGES================================

router.use('/uploads', fileUploadRoutes);

// ================ СИСТЕМНАЯ ИНФОРМАЦИЯ ================
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'ESARGO API Server - UberEats Style Food Delivery',
        version: '2.1.0',
        architecture: 'Service Layer + Meta Security Model + Full Order Management + Cart System',
        
        available_endpoints: {
            // ПУБЛИЧНЫЕ (без авторизации) - как UberEats
            public_catalog: {
                restaurants_list: 'GET /api/public/catalog',
                restaurant_details: 'GET /api/public/restaurants/:id',
                restaurant_menu: 'GET /api/public/restaurants/:id/menu',
                search_restaurants: 'GET /api/public/restaurants/search',
                popular_restaurants: 'GET /api/public/restaurants/popular',
                categories: 'GET /api/public/restaurants/categories'
            },
            
            // КЛИЕНТСКИЕ (требуют авторизации customer)
            customers: {
                register: 'POST /api/customers/register',
                login: 'POST /api/customers/login',
                verify: 'GET /api/customers/verify',
                profile: 'GET /api/customers/profile',
                update_profile: 'PUT /api/customers/profile/:id',
                delete_profile: 'DELETE /api/customers/profile/:id',
                
                // Корзина покупок
                cart_get: 'GET /api/cart',
                cart_add_item: 'POST /api/cart/items',
                cart_update_item: 'PUT /api/cart/items/:item_id',
                cart_remove_item: 'DELETE /api/cart/items/:item_id',
                cart_clear: 'DELETE /api/cart',
                cart_calculate_delivery: 'POST /api/cart/calculate-delivery',
                
                // Заказы
                orders_create: 'POST /api/orders',
                orders_my: 'GET /api/orders/my',
                orders_details: 'GET /api/orders/:id',
                orders_cancel: 'POST /api/orders/:id/cancel',
                orders_rate: 'POST /api/orders/:id/rate',
                orders_track: 'GET /api/orders/:id/track'
            },
            
            // ПАРТНЕРСКИЕ (требуют авторизации partner)
            partners: {
                register: 'POST /api/partners/register',
                login: 'POST /api/partners/login',
                profile: 'GET /api/partners/profile',
                menu_management: 'GET /api/partners/menu/*',
                
                // Заказы партнера
                orders_list: 'GET /api/orders/partner/list',
                orders_accept: 'POST /api/orders/:id/accept',
                orders_reject: 'POST /api/orders/:id/reject',
                orders_ready: 'POST /api/orders/:id/ready'
            },
            
            // КУРЬЕРСКИЕ (требуют авторизации courier)
            couriers: {
                register: 'POST /api/couriers/register',
                login: 'POST /api/couriers/login',
                profile: 'GET /api/couriers/profile',
                
                // Заказы курьера
                orders_available: 'GET /api/orders/courier/available',
                orders_my: 'GET /api/orders/courier/my',
                orders_take: 'POST /api/orders/:id/take',
                orders_pickup: 'POST /api/orders/:id/pickup',
                orders_deliver: 'POST /api/orders/:id/deliver'
            },
            
            // АДМИНИСТРАТИВНЫЕ (требуют авторизации admin)
            admin: {
                login: 'POST /api/admin/login',
                partners: 'GET /api/admin/partners/*',
                couriers: 'GET /api/admin/couriers/*'
            }
        },
        
        // 🆕 НОВЫЕ ВОЗМОЖНОСТИ
        features: {
            public_browsing: "Просмотр ресторанов без регистрации (как UberEats)",
            shopping_cart: "Корзина покупок с сессиями на сервере",
            multi_role_orders: "Заказы для клиентов, партнеров и курьеров",
            payment_integration: "Готовность к интеграции с реальными платежами",
            real_time_tracking: "Отслеживание заказов в реальном времени",
            delivery_calculation: "Расчет времени и стоимости доставки",
            rating_system: "Система оценок для партнеров и курьеров",
            order_management: "Полный жизненный цикл заказа",
            session_management: "Управление сессиями и корзинами"
        },
        
        // WORKFLOW ЗАКАЗА (как в UberEats)
        order_workflow: {
            step_1: "Клиент просматривает каталог ресторанов (GET /api/public/catalog)",
            step_2: "Клиент регистрируется/авторизуется (POST /api/customers/register|login)",
            step_3: "Клиент просматривает меню ресторана (GET /api/public/restaurants/:id/menu)",
            step_4: "Клиент добавляет товары в корзину (POST /api/cart/items)",
            step_5: "Клиент рассчитывает доставку (POST /api/cart/calculate-delivery)",
            step_6: "Клиент создает заказ (POST /api/orders)",
            step_7: "Ресторан принимает/отклоняет заказ (POST /api/orders/:id/accept|reject)",
            step_8: "Ресторан помечает заказ готовым (POST /api/orders/:id/ready)",
            step_9: "Курьер берет заказ (POST /api/orders/:id/take)",
            step_10: "Курьер забирает заказ (POST /api/orders/:id/pickup)",
            step_11: "Курьер доставляет заказ (POST /api/orders/:id/deliver)",
            step_12: "Клиент оценивает заказ (POST /api/orders/:id/rate)"
        },
        
        timestamp: new Date().toISOString()
    });
});

export default router;