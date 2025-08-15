// routes/orders.js
const express = require('express');
const router = express.Router();
const {
	createOrder,
	getOrderById,
	trackOrdersByPhone,
	getRestaurantOrders,
	updateOrderStatus
} = require('../controllers/orderController');

// Validation middleware для ObjectId
const validateObjectId = (req, res, next) => {
	const { id, restaurantId } = req.params;
	const idToCheck = id || restaurantId;

	if (idToCheck && !idToCheck.match(/^[0-9a-fA-F]{24}$/)) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный ID'
		});
	}

	next();
};

// Validation middleware для создания заказа
const validateOrderCreation = (req, res, next) => {
	const { customer_info, delivery_address, payment_method } = req.body;

	if (!customer_info || !delivery_address || !payment_method) {
		return res.status(400).json({
			success: false,
			message: 'customer_info, delivery_address и payment_method обязательны'
		});
	}

	if (!customer_info.name || !customer_info.phone) {
		return res.status(400).json({
			success: false,
			message: 'Имя и телефон клиента обязательны'
		});
	}

	if (!delivery_address.street || !delivery_address.city || !delivery_address.postal_code) {
		return res.status(400).json({
			success: false,
			message: 'Улица, город и почтовый индекс обязательны'
		});
	}

	const validPaymentMethods = ['наличные', 'карта', 'онлайн'];
	if (!validPaymentMethods.includes(payment_method)) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный способ оплаты'
		});
	}

	next();
};

// Validation middleware для телефона
const validatePhone = (req, res, next) => {
	const { phone } = req.params;

	if (!phone || phone.length < 10) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный номер телефона'
		});
	}

	next();
};

// POST /api/orders - создать заказ из корзины
// Body: { session_id, customer_info, delivery_address, payment_method, delivery_time_preference, notes }
router.post('/', validateOrderCreation, createOrder);

// GET /api/orders/:id - получить детали заказа
// Возвращает полную информацию о заказе с ресторанами и товарами
router.get('/:id', validateObjectId, getOrderById);

// GET /api/orders/track/:phone - отслеживание заказов по телефону (для гостей)
// Query params: limit, page
router.get('/track/:phone', validatePhone, trackOrdersByPhone);

// GET /api/orders/restaurant/:restaurantId - получить заказы ресторана
// Query params: status, date_from, date_to, limit, page
router.get('/restaurant/:restaurantId', validateObjectId, getRestaurantOrders);

// PUT /api/orders/:id/status - обновить статус заказа ресторана
// Body: { restaurant_id, status, notes, estimated_prep_time }
router.put('/:id/status', validateObjectId, updateOrderStatus);

module.exports = router;