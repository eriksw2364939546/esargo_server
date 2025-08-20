// routes/index.js - ИСПРАВЛЕННЫЙ БЕЗ КОНФЛИКТА 🎯
import express from 'express';
const router = express.Router();

// Import роутов
import partnerRoutes from './Partner.route.js';
import customerRoutes from './Customer.route.js';
import adminRoutes from './Admin.route.js';

// Health check endpoint
router.get('/health', (req, res) => {
	res.json({
		success: true,
		message: 'ESARGO API работает корректно',
		service_layer: 'enabled',
		meta_model: 'enabled',
		timestamp: new Date().toISOString()
	});
});

// Customer routes (регистрация и авторизация клиентов)
router.use('/customers', customerRoutes);

// Partner routes (для создания ресторанов/магазинов)
router.use('/partners', partnerRoutes);

// Admin routes (для администраторов)
router.use('/admin', adminRoutes);

// Главная страница API
router.get('/', (req, res) => {
	res.json({
		success: true,
		message: 'ESARGO API Server',
		version: '2.0.0',
		architecture: 'Service Layer + Meta Security Model',
		available_endpoints: {
			customers: {
				register: 'POST /api/customers/register',
				login: 'POST /api/customers/login',
				verify: 'GET /api/customers/verify',
				profile: 'GET /api/customers/profile',
				update_profile: 'PUT /api/customers/profile/:id',
				delete_profile: 'DELETE /api/customers/profile/:id',
				addresses: {
					add: 'POST /api/customers/addresses',
					update: 'PUT /api/customers/addresses/:addressId',
					remove: 'DELETE /api/customers/addresses/:addressId'
				}
			},
			// partners: {
			// 	register: 'POST /api/partners/register', // 🔥 РЕГИСТРАЦИЯ С ТОКЕНОМ!
			// 	login: 'POST /api/partners/login',
			// 	dashboard: 'GET /api/partners/dashboard',
			// 	legal_info: 'POST /api/partners/legal-info/:request_id',
			// 	profile: 'GET /api/partners/profile',
			// 	menu: {
			// 		categories: 'GET/POST/PUT/DELETE /api/partners/menu/categories',
			// 		products: 'GET/POST/PUT/DELETE /api/partners/menu/products',
			// 		stats: 'GET /api/partners/menu/stats'
			// 	}
			// },
			admin: {
				login: 'POST /api/admin/login',
				verify: 'GET /api/admin/verify',
				profile: 'GET /api/admin/profile',
				create_admin: 'POST /api/admin/create',
				list_admins: 'GET /api/admin/list',
				partners: {
					requests: 'GET /api/admin/partners/requests',
					approve_request: 'POST /api/admin/partners/requests/:id/approve',
					approve_legal: 'POST /api/admin/partners/legal/:id/approve',
					approve_content: 'POST /api/admin/partners/profiles/:id/approve'
				}
			}
		},
		security_features: {
			meta_model: 'Безопасный поиск по хешированному email',
			encryption: 'Шифрование чувствительных данных',
			role_based_access: 'Контроль доступа на основе ролей',
			admin_permissions: 'Гранулярные разрешения для администраторов',
			account_lockout: 'Блокировка после неудачных попыток входа'
		},
		timestamp: new Date().toISOString()
	});
});

// ❌ УДАЛЕНО: Конфликтующий обработчик 404
// router.use('*', (req, res) => { ... });

export default router;