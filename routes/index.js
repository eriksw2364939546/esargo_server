// routes/index.js (ОБНОВЛЕННЫЙ с системой заказов как UberEats)
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

// 🆕 НОВЫЕ РОУТЫ ДЛЯ СИСТЕМЫ ЗАКАЗОВ
import publicRoutes from '../routes/Public/Public.route.js';        // Публичный каталог
import cartRoutes from './Cart.route.js';            // Корзина покупок
import orderRoutes from './Order.route.js';          // Заказы

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
// 🆕 Публичный каталог ресторанов - как UberEats главная страница
router.use('/public', publicRoutes);

// ================ ОСНОВНЫЕ ПОЛЬЗОВАТЕЛЬСКИЕ РОУТЫ ================

// Customer routes (регистрация, авторизация, профиль)
router.use('/customers', customerRoutes);

// 🆕 Cart routes (корзина покупок) - требует авторизации клиента
router.use('/cart', cartRoutes);

// 🆕 Order routes (создание и управление заказами) - мульти-роль
router.use('/orders', orderRoutes);

// Partner routes (управление рестораном)
router.use('/partners', partnerRoutes);

// Partner menu routes (управление меню)
router.use('/partners/menu', partnerMenuRoutes);

// Courier routes (система курьеров)
router.use('/couriers', courierRoutes);

// ================ АДМИНИСТРАТИВНЫЕ РОУТЫ ================

// Admin routes (основная админка)
router.use('/admin', adminRoutes);

// Admin partner management routes (управление партнерами)
router.use('/admin/partners', adminPartnerRoutes);

// Admin courier management routes (управление курьерами) 
router.use('/admin/couriers', adminCourierRoutes);

// ================ СИСТЕМНАЯ ИНФОРМАЦИЯ ================

// Главная страница API
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'ESARGO API Server - UberEats Style Food Delivery',
        version: '2.1.0',
        architecture: 'Service Layer + Meta Security Model + Full Order Management + Cart System',
        
        // 🆕 ОБНОВЛЕННЫЕ ЭНДПОИНТЫ
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
                
                // Заказы клиента
                create_order: 'POST /api/orders',
                my_orders: 'GET /api/orders/my',
                order_details: 'GET /api/orders/:id',
                cancel_order: 'POST /api/orders/:id/cancel',
                rate_order: 'POST /api/orders/:id/rate'
            },
            
            // ПАРТНЕРСКИЕ (рестораны)
            partners: {
                register: 'POST /api/partners/register',
                login: 'POST /api/partners/login',
                verify: 'GET /api/partners/verify',
                dashboard: 'GET /api/partners/dashboard',
                legal_info: 'POST /api/partners/legal-info/:request_id',
                profile: 'GET /api/partners/profile',
                update_profile: 'PUT /api/partners/profile/:id',
                
                // Управление меню
                menu_categories: {
                    list: 'GET /api/partners/menu/categories',
                    create: 'POST /api/partners/menu/categories',
                    update: 'PUT /api/partners/menu/categories/:category_id',
                    delete: 'DELETE /api/partners/menu/categories/:category_id'
                },
                menu_products: {
                    list: 'GET /api/partners/menu/products',
                    create: 'POST /api/partners/menu/products',
                    update: 'PUT /api/partners/menu/products/:product_id',
                    delete: 'DELETE /api/partners/menu/products/:product_id'
                },
                menu_stats: 'GET /api/partners/menu/stats',
                
                // Управление заказами ресторана
                orders_list: 'GET /api/orders/partner/list',
                accept_order: 'POST /api/orders/:id/accept',
                reject_order: 'POST /api/orders/:id/reject',
                mark_ready: 'POST /api/orders/:id/ready'
            },
            
            // КУРЬЕРСКИЕ (доставка)
            couriers: {
                register: 'POST /api/couriers/register',
                login: 'POST /api/couriers/login',
                verify: 'GET /api/couriers/verify',
                profile: 'GET /api/couriers/profile',
                toggle_availability: 'PATCH /api/couriers/availability',
                update_location: 'PATCH /api/couriers/location',
                
                // Управление заказами курьера
                available_orders: 'GET /api/orders/courier/available',
                my_orders: 'GET /api/orders/courier/my',
                take_order: 'POST /api/orders/:id/take',
                pickup_order: 'POST /api/orders/:id/pickup',
                deliver_order: 'POST /api/orders/:id/deliver'
            },
            
            // ОБЩИЕ (отслеживание заказов)
            tracking: {
                track_order: 'GET /api/orders/:id/track',
                order_status: 'GET /api/orders/:id/status'
            },
            
            // АДМИНИСТРАТИВНЫЕ
            admin: {
                login: 'POST /api/admin/login',
                verify: 'GET /api/admin/verify',
                profile: 'GET /api/admin/profile',
                create_admin: 'POST /api/admin/create',
                list_admins: 'GET /api/admin/list',
                edit_admin: 'PUT /api/admin/edit/:id',
                delete_admin: 'DELETE /api/admin/delete/:id'
            },
            admin_partners: {
                view_requests: 'GET /api/admin/partners/requests',
                view_request: 'GET /api/admin/partners/requests/:id',
                approve_request: 'POST /api/admin/partners/requests/:id/approve',
                reject_request: 'POST /api/admin/partners/requests/:id/reject',
                approve_legal: 'POST /api/admin/partners/legal/:id/approve',
                reject_legal: 'POST /api/admin/partners/legal/:id/reject',
                publish_partner: 'POST /api/admin/partners/profiles/:id/publish'
            },
            admin_couriers: {
                view_applications: 'GET /api/admin/couriers/applications',
                view_application: 'GET /api/admin/couriers/applications/:id',
                approve_application: 'POST /api/admin/couriers/applications/:id/approve',
                reject_application: 'POST /api/admin/couriers/applications/:id/reject',
                view_profiles: 'GET /api/admin/couriers/profiles',
                block_courier: 'POST /api/admin/couriers/profiles/:id/block',
                unblock_courier: 'POST /api/admin/couriers/profiles/:id/unblock'
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
            step_8: "Ресторан готовит заказ и помечает готовым (POST /api/orders/:id/ready)",
            step_9: "Курьер берет заказ (POST /api/orders/:id/take)",
            step_10: "Курьер забирает у ресторана (POST /api/orders/:id/pickup)",
            step_11: "Курьер доставляет клиенту (POST /api/orders/:id/deliver)",
            step_12: "Клиент оценивает заказ (POST /api/orders/:id/rate)"
        },
        
        security_features: {
            meta_mode: "Шифрование и хэширование чувствительных данных",
            jwt_authentication: "JWT токены для всех ролей",
            role_based_access: "Разграничение прав по ролям",
            session_security: "Защищенные серверные сессии для корзин",
            input_validation: "Валидация входящих данных",
            rate_limiting: "Ограничение частоты запросов"
        },
        
        payment_system: {
            status: "stub_implementation",
            description: "Заглушка платежной системы для тестирования",
            supported_methods: ["card", "cash"],
            currencies: ["EUR", "USD", "RUB"],
            ready_for_integration: ["Stripe", "PayPal", "Square"],
            test_endpoints: {
                success_payment: "Используйте test_mode: true в запросе",
                failed_payment: "Используйте test_error: 'card_declined' в запросе"
            }
        },
        
        database_collections: {
            users: "Базовые пользователи (клиенты, партнеры, курьеры)",
            customer_profiles: "Профили клиентов",
            partner_profiles: "Профили ресторанов",
            courier_profiles: "Профили курьеров", 
            products: "Товары и блюда",
            carts: "Корзины покупок (серверная сторона)",
            orders: "Заказы с полным жизненным циклом",
            messages: "Системные уведомления",
            admin_logs: "Логи административных действий"
        },
        
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

export default router;