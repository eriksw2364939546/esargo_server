// ================ routes/index.js (ОБНОВЛЕННЫЙ С МЕНЮ МАРШРУТАМИ) ================
import express from 'express';
const router = express.Router();

// Import роутов
import partnerRoutes from './Partner.route.js';
import partnerMenuRoutes from './Partner.menu.routes.js'; // 🆕 НОВЫЕ МАРШРУТЫ МЕНЮ
import customerRoutes from './Customer.route.js';
import adminRoutes from './Admin.route.js';
import adminPartnerRoutes from './AdminPartner.route.js';

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'ESARGO API работает корректно',
        service_layer: 'enabled',
        meta_model: 'enabled',
        partner_system: 'fully_implemented', // 🆕 ОБНОВЛЕНО
        menu_system: 'enabled', // 🆕 НОВОЕ
        timestamp: new Date().toISOString()
    });
});

// Customer routes
router.use('/customers', customerRoutes);

// Partner routes  
router.use('/partners', partnerRoutes);

// 🆕 НОВОЕ: Partner menu routes
router.use('/partners/menu', partnerMenuRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Admin partner management routes
router.use('/admin/partners', adminPartnerRoutes);

// Главная страница API
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'ESARGO API Server',
        version: '2.1.0', // 🆕 ОБНОВЛЕНА ВЕРСИЯ
        architecture: 'Service Layer + Meta Security Model + Menu Management',
        available_endpoints: {
            customers: {
                register: 'POST /api/customers/register',
                login: 'POST /api/customers/login',
                verify: 'GET /api/customers/verify',
                profile: 'GET /api/customers/profile',
                update_profile: 'PUT /api/customers/profile/:id',
                delete_profile: 'DELETE /api/customers/profile/:id'
            },
            partners: {
                // Основные функции
                register: 'POST /api/partners/register',
                login: 'POST /api/partners/login',
                verify: 'GET /api/partners/verify',
                dashboard: 'GET /api/partners/dashboard',
                legal_info: 'POST /api/partners/legal-info/:request_id',
                profile: 'GET /api/partners/profile',
                update_profile: 'PUT /api/partners/profile/:id',
                delete_partner: 'DELETE /api/partners/profile/:id',
                
                // 🆕 НОВОЕ: Управление меню
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
                menu_stats: 'GET /api/partners/menu/stats'
            },
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
            }
        },
        security_features: {
            meta_model: 'Безопасный поиск по хешированному email',
            encryption: 'Шифрование чувствительных данных',
            role_based_access: 'Контроль доступа на основе ролей',
            admin_permissions: 'Гранулярные разрешения для администраторов',
            partner_workflow: 'Многоэтапная система одобрения партнеров',
            french_validation: 'Валидация французских данных (SIRET, IBAN, TVA)', // 🆕 НОВОЕ
            menu_permissions: 'Права доступа к управлению меню' // 🆕 НОВОЕ
        },
        workflow_stages: {
            stage_1: 'Регистрация и подача заявки (с новыми полями)',
            stage_2: 'Одобрение заявки админом',
            stage_3: 'Подача юридических документов (полная реализация)',
            stage_4: 'Создание профиля после одобрения документов',
            stage_5: 'Заполнение контента партнером (через сервисы)',
            stage_6: 'Финальная публикация админом'
        },
        business_rules: {
            restaurants: {
                supports_options: true,
                supports_preparation_time: true,
                default_preparation_time: '15 minutes'
            },
            stores: {
                supports_options: false,
                supports_preparation_time: false,
                preparation_time: '0 minutes (ready)'
            }
        },
        data_compatibility: {
            old_new_models: 'Поддержка совместимости старых и новых данных',
            normalization: 'Автоматическая нормализация полей',
            fallback_values: 'Безопасные fallback значения'
        },
        timestamp: new Date().toISOString()
    });
});

export default router;