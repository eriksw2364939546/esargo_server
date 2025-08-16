// routes/index.js
const express = require('express');
const router = express.Router();

// Import роутов
const partnerRoutes = require('./Partner.route');
const customerRoutes = require('./Customer.route'); // ✅ ВАШ ФАЙЛ

// Health check endpoint
router.get('/health', (req, res) => {
	res.json({
		success: true,
		message: 'API работает корректно',
		timestamp: new Date().toISOString()
	});
});

// Customer routes (регистрация и авторизация клиентов)
router.use('/customers', customerRoutes); // ✅ ПОДКЛЮЧЕНИЕ

// Partner routes (для создания ресторанов/магазинов)
router.use('/partners', partnerRoutes);

// Главная страница API
router.get('/', (req, res) => {
	res.json({
		success: true,
		message: 'ESARGO API Server',
		version: '1.0.0',
		available_endpoints: {
			customers: { // ✅ ОБНОВЛЕННЫЕ ENDPOINTS
				register: 'POST /api/customers/register',
				login: 'POST /api/customers/login',
				profile: 'GET /api/customers/profile',
				update_profile: 'PUT /api/customers/profile'
			},
			partners: {
				initial_request: 'POST /api/partners/initial-request',
				legal_info: 'POST /api/partners/:id/legal-info',
				list_requests: 'GET /api/partners/requests',
				update_status: 'PATCH /api/partners/:id/status'
			}
		},
		timestamp: new Date().toISOString()
	});
});

// Middleware для обработки несуществующих маршрутов
router.use('*', (req, res) => {
	res.status(404).json({
		success: false,
		message: 'Маршрут не найден',
		requested_url: req.originalUrl
	});
});

module.exports = router;