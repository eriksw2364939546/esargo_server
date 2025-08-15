// routes/index.js
const express = require('express');
const router = express.Router();

// Import только тот роут, который у вас есть
const partnerRoutes = require('./Partner.route');

// Health check endpoint
router.get('/health', (req, res) => {
	res.json({
		success: true,
		message: 'API работает корректно',
		timestamp: new Date().toISOString()
	});
});

// Partner routes (для создания ресторанов/магазинов)
router.use('/partners', partnerRoutes);

// Главная страница API
router.get('/', (req, res) => {
	res.json({
		success: true,
		message: 'ESARGO API Server',
		version: '1.0.0',
		available_endpoints: {
			partners: {
				create: 'POST /api/partners',
				list: 'GET /api/partners',
				details: 'GET /api/partners/:id',
				update_status: 'PUT /api/partners/:id/status',
				delete: 'DELETE /api/partners/:id'
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