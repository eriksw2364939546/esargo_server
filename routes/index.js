// routes/index.js (обновленный)
import express from 'express';
const router = express.Router();

// Import роутов
import partnerRoutes from './Partner.route.js';
import customerRoutes from './Customer.route.js';
import adminRoutes from './Admin.route.js'; // 🆕 НОВЫЙ

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

// 🆕 Admin routes (для администраторов)
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
			partners: {
				login: 'POST /api/partners/login',
				initial_request: 'POST /api/partners/initial-request',
				legal_info: 'POST /api/partners/:id/legal-info',
				profile: 'GET /api/partners/profile',
				status: 'GET /api/partners/status',
				admin: {
					list_requests: 'GET /api/partners/requests',
					request_details: 'GET /api/partners/requests/:request_id',
					update_status: 'PATCH /api/partners/:id/status',
					approve_legal: 'POST /api/partners/legal-info/:legal_info_id/approve',
					reject_legal: 'POST /api/partners/legal-info/:legal_info_id/reject'
				}
			},
			admin: { // 🆕 НОВЫЙ РАЗДЕЛ
				login: 'POST /api/admin/login',
				verify: 'GET /api/admin/verify',
				profile: 'GET /api/admin/profile',
				create_admin: 'POST /api/admin/create',
				list_admins: 'GET /api/admin/list',
				update_permissions: 'PUT /api/admin/:admin_id/permissions'
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

// Middleware для обработки несуществующих маршрутов
router.use('*', (req, res) => {
	res.status(404).json({
		success: false,
		message: 'Маршрут не найден',
		requested_url: req.originalUrl,
		available_routes: ['/api/customers', '/api/partners', '/api/admin']
	});
});

export default router;