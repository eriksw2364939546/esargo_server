// routes/Cart.route.js - Система корзины покупок
import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  calculateDelivery
} from '../controllers/CartController.js';
import { authenticateCustomer, requireRole } from '../middleware/customerAuth.middleware.js';

const router = express.Router();

// ================ УПРАВЛЕНИЕ КОРЗИНОЙ (требует авторизации клиента) ================

/**
 * GET /api/cart - Получить содержимое корзины
 * Middleware: authenticateCustomer, requireRole('customer')
 */
router.get('/', 
  authenticateCustomer, 
  requireRole('customer'),
  getCart
);

/**
 * POST /api/cart/items - Добавить товар в корзину
 * Body: {
 *   product_id: ObjectId,
 *   quantity: Number,
 *   selected_options: [{group_name, option_name, option_price}], // для ресторанов
 *   special_requests: String // опционально
 * }
 */
router.post('/items', 
  authenticateCustomer, 
  requireRole('customer'),
  addToCart
);

/**
 * PUT /api/cart/items/:item_id - Обновить товар в корзине
 * Body: {
 *   quantity: Number,
 *   selected_options: [{group_name, option_name, option_price}],
 *   special_requests: String
 * }
 */
router.put('/items/:item_id', 
  authenticateCustomer, 
  requireRole('customer'),
  updateCartItem
);

/**
 * DELETE /api/cart/items/:item_id - Удалить товар из корзины
 */
router.delete('/items/:item_id', 
  authenticateCustomer, 
  requireRole('customer'),
  removeFromCart
);

/**
 * DELETE /api/cart - Очистить корзину
 */
router.delete('/', 
  authenticateCustomer, 
  requireRole('customer'),
  clearCart
);

/**
 * POST /api/cart/calculate-delivery - Рассчитать доставку
 * Body: {
 *   delivery_address: {
 *     lat: Number,
 *     lng: Number,
 *     address: String
 *   }
 * }
 */
router.post('/calculate-delivery', 
  authenticateCustomer, 
  requireRole('customer'),
  calculateDelivery
);

// ================ СЛУЖЕБНЫЕ ЭНДПОИНТЫ ================

/**
 * GET /api/cart/health - Проверка работоспособности корзины
 */
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Cart API working",
    available_endpoints: {
      get_cart: "GET /api/cart",
      add_item: "POST /api/cart/items",
      update_item: "PUT /api/cart/items/:item_id", 
      remove_item: "DELETE /api/cart/items/:item_id",
      clear_cart: "DELETE /api/cart",
      calculate_delivery: "POST /api/cart/calculate-delivery"
    },
    cart_features: [
      "Server-side storage (MongoStore)",
      "Multi-restaurant prevention",
      "Options and special requests",
      "Delivery calculation",
      "Real-time pricing"
    ],
    session_info: {
      storage: "express-session + MongoStore",
      expires: "24 hours of inactivity"
    },
    timestamp: new Date().toISOString()
  });
});

export default router;