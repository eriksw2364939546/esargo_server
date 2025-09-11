// routes/index.js - ГЛАВНЫЙ РОУТЕР с исправленными импортами
import express from 'express';

// ✅ ИСПРАВЛЕНО: Импорт только существующих файлов
import customerRoutes from './Customer.route.js';
import partnerRoutes from './Partner.route.js';
import courierRoutes from './Courier.route.js';
import adminRoutes from './Admin.route.js';
import publicRoutes from './Public.route.js';
import cartRoutes from './Cart.route.js';
import orderRoutes from './Order.route.js';
import fileUploadRoutes from './FileUpload.route.js';

// Административные роуты (существующие)
import adminPartnerRoutes from './AdminPartner.route.js';
import adminCourierRoutes from './AdminCourier.route.js';

// Партнерские роуты (существующие)
import partnerMenuRoutes from './Partner.menu.routes.js';

const router = express.Router();

// ================ ПУБЛИЧНЫЕ РОУТЫ ================
router.use('/public', publicRoutes);

// ================ КЛИЕНТСКИЕ РОУТЫ ================
router.use('/customers', customerRoutes);

// ================ ПАРТНЕРСКИЕ РОУТЫ ================
router.use('/partners', partnerRoutes);
router.use('/partners/menu', partnerMenuRoutes);

// ================ СИСТЕМА ЗАКАЗОВ ================
router.use('/orders', orderRoutes);

// ================ КОРЗИНА ПОКУПОК ================
router.use('/cart', cartRoutes);

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
                
                // ✅ ИСПРАВЛЕНО: Корзина покупок с правильными параметрами
                cart_get: 'GET /api/cart',
                cart_add_item: 'POST /api/cart/items',
                cart_update_item: 'PUT /api/cart/items/:item_id',
                cart_remove_item: 'DELETE /api/cart/items/:item_id',
                cart_clear: 'DELETE /api/cart',
                cart_calculate_delivery: 'POST /api/cart/calculate-delivery',
                cart_check_delivery: 'POST /api/cart/check-delivery',
                
                // ✅ ДОБАВЛЕНО: Управление адресами
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
                },
                
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
                verify: 'GET /api/partners/verify',
                dashboard: 'GET /api/partners/dashboard',
                profile: 'GET /api/partners/profile/:id',
                update_profile: 'PUT /api/partners/profile/:id',
                legal_info: 'POST /api/partners/legal-info/:request_id',
                submit_for_review: 'POST /api/partners/submit-for-review/:profile_id',
                
                // ✅ ДОБАВЛЕНО: Управление меню
                menu: {
                    categories_get: 'GET /api/partners/menu/categories',
                    categories_add: 'POST /api/partners/menu/categories',
                    categories_update: 'PUT /api/partners/menu/categories/:category_id',
                    categories_delete: 'DELETE /api/partners/menu/categories/:category_id',
                    
                    products_get: 'GET /api/partners/menu/products',
                    products_add: 'POST /api/partners/menu/products',
                    products_update: 'PUT /api/partners/menu/products/:product_id',
                    products_delete: 'DELETE /api/partners/menu/products/:product_id',
                    
                    stats: 'GET /api/partners/menu/stats'
                },
                
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
                verify: 'GET /api/couriers/verify',
                profile: 'GET /api/couriers/profile',
                update_profile: 'PUT /api/couriers/profile/:id',
                delete_profile: 'DELETE /api/couriers/profile/:id',
                
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
                verify: 'GET /api/admin/verify',
                
                // Управление партнерами
                partners: {
                    requests: 'GET /api/admin/partners/requests',
                    request_details: 'GET /api/admin/partners/requests/:id',
                    approve_request: 'POST /api/admin/partners/requests/:id/approve',
                    reject_request: 'POST /api/admin/partners/requests/:id/reject',
                    profiles: 'GET /api/admin/partners/profiles',
                    profile_details: 'GET /api/admin/partners/profiles/:id',
                    publish: 'POST /api/admin/partners/profiles/:id/publish',
                    approve_legal: 'POST /api/admin/partners/legal/:id/approve',
                    reject_legal: 'POST /api/admin/partners/legal/:id/reject'
                },
                
                // Управление курьерами
                couriers: {
                    applications: 'GET /api/admin/couriers/applications',
                    application_details: 'GET /api/admin/couriers/applications/:id',
                    approve_application: 'POST /api/admin/couriers/applications/:id/approve',
                    reject_application: 'POST /api/admin/couriers/applications/:id/reject',
                    profiles: 'GET /api/admin/couriers/profiles',
                    block: 'POST /api/admin/couriers/profiles/:id/block',
                    unblock: 'POST /api/admin/couriers/profiles/:id/unblock',
                    statistics: 'GET /api/admin/couriers/statistics'
                },
                
                // Системная статистика
                stats: 'GET /api/admin/stats',
                system_health: 'GET /api/admin/system/health'
            },
            
            // ✅ ОБНОВЛЕНО: Файловая система (только изображения)
            file_uploads: {
                partners: {
                    cover_upload: 'POST /api/uploads/partners/cover/upload',
                    cover_update: 'PUT /api/uploads/partners/cover/update',
                    gallery_add: 'POST /api/uploads/partners/gallery/add',
                    menu_item_add: 'POST /api/uploads/partners/menu/add',
                    gallery_remove: 'DELETE /api/uploads/partners/gallery/:profile_id/:filename',
                    files_list: 'GET /api/uploads/partners/files/:profile_id'
                },
                couriers: {
                    avatar_upload: 'POST /api/uploads/couriers/avatar/upload',
                    avatar_update: 'PUT /api/uploads/couriers/avatar/update',
                    files_list: 'GET /api/uploads/couriers/files/:profile_id'
                },
                admins: {
                    avatar_upload: 'POST /api/uploads/admins/avatar/upload',
                    avatar_update: 'PUT /api/uploads/admins/avatar/update',
                    create_with_avatar: 'POST /api/uploads/admins/create-with-avatar'
                },
                system: {
                    health: 'GET /api/uploads/system/health',
                    stats: 'GET /api/uploads/system/stats',
                    cleanup: 'POST /api/uploads/system/cleanup',
                    supported_formats: 'GET /api/uploads/supported-formats'
                }
            }
        },
        
        // ✅ ДОБАВЛЕНО: Системные возможности
        system_features: {
            order_management: "Full UberEats-style order flow",
            delivery_system: "ESARGO zones (Marseille: 0-5km, 5-10km)",
            payment_processing: "Stub implementation ready for integration",
            file_handling: "Images only (PDF documents in registration)",
            auto_cleanup: "Expired data removal every 30 minutes",
            cart_persistence: "Server-side sessions with MongoDB",
            multi_role_auth: "Customer, Partner, Courier, Admin",
            real_time_tracking: "Order status updates",
            rating_system: "Customer reviews and ratings",
            address_management: "Saved delivery addresses"
        },
        
        // ✅ ДОБАВЛЕНО: Архитектурная информация
        architecture_info: {
            layers: [
                "Controllers (req/res handling)",
                "Services (business logic)",
                "Models (database schemas)",
                "Middleware (auth, validation, file processing)",
                "Utils (crypto, validation, tokens)"
            ],
            security: [
                "JWT tokens with role-based access",
                "PII data encryption (phone, email, addresses)",
                "Password hashing (bcrypt)",
                "Rate limiting",
                "CORS protection"
            ],
            database: "MongoDB with Mongoose ODM",
            file_storage: "Local filesystem with image optimization",
            session_management: "express-session + MongoStore"
        },
        
        timestamp: new Date().toISOString(),
        server_uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

export default router