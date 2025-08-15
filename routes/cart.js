// routes/cart.js
const express = require('express');
const router = express.Router();
const {
	addToCart,
	getCart,
	updateCartItem,
	removeCartItem,
	clearCart,
	calculateDelivery,
	validateCart
} = require('../controllers/cartController');

// Validation middleware для session_id
const validateSessionId = (req, res, next) => {
	const sessionId = req.body.session_id || req.params.sessionId;

	if (!sessionId) {
		return res.status(400).json({
			success: false,
			message: 'session_id обязателен'
		});
	}

	// Проверяем формат UUID (опционально)
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(sessionId)) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный формат session_id'
		});
	}

	next();
};

// Validation middleware для ObjectId
const validateObjectId = (req, res, next) => {
	const { itemId } = req.params;

	if (itemId && !itemId.match(/^[0-9a-fA-F]{24}$/)) {
		return res.status(400).json({
			success: false,
			message: 'Некорректный ID товара'
		});
	}

	next();
};

// POST /api/cart/add - добавить товар в корзину
// Body: { session_id, menu_item_id, quantity, notes }
router.post('/add', validateSessionId, addToCart);

// GET /api/cart/:sessionId - получить корзину
// Возвращает корзину со всеми ресторанами и товарами
router.get('/:sessionId', validateSessionId, getCart);

// DELETE /api/cart/items/:itemId - удалить товар из корзины
// Body: { session_id }
router.delete('/items/:itemId', validateObjectId, validateSessionId, removeCartItem);

// DELETE /api/cart/:sessionId - очистить всю корзину
router.delete('/:sessionId', validateSessionId, clearCart);

// POST /api/cart/calculate-delivery - рассчитать стоимость доставки
// Body: { session_id, postal_code }
router.post('/calculate-delivery', validateSessionId, calculateDelivery);

// POST /api/cart/validate - валидация корзины перед заказом
// Body: { session_id }
router.post('/validate', validateSessionId, validateCart);

module.exports = router;