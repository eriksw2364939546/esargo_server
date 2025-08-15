// routes/index.js
const express = require('express');
const router = express.Router();

// Import route modules
const restaurantRoutes = require('./restaurants');
const menuRoutes = require('./menu');
const cartRoutes = require('./cart');
const orderRoutes = require('./orders');

// Health check endpoint
router.get('/health', (req, res) => {
	res.json({
		success: true,
		message: 'API работает корректно',
		timestamp: new Date().toISOString()
	});
});

// Restaurant routes
router.use('/restaurants', restaurantRoutes);

// Menu routes
router.use('/menu', menuRoutes);

// Cart routes
router.use('/cart', cartRoutes);

// Order routes
router.use('/orders', orderRoutes);

// Middleware для обработки несуществующих маршрутов
router.use('*', (req, res) => {
	res.status(404).json({
		success: false,
		message: 'Маршрут не найден',
		requested_url: req.originalUrl
	});
});

module.exports = router;