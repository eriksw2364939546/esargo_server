// routes/Cart.route.js - ОБНОВЛЕННЫЕ роуты корзины с поддержкой ESARGO
import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  calculateDelivery,
  checkDeliveryAvailability // ✅ НОВЫЙ ИМПОРТ
} from '../controllers/CartController.js';
import { authenticateCustomer, requireRole } from '../middleware/customerAuth.middleware.js';

const router = express.Router();

// ================ УПРАВЛЕНИЕ КОРЗИНОЙ (требует авторизации клиента) ================

/**
 * GET /api/cart - Получить содержимое корзины
 * Query Parameters:
 * - include_delivery_zones: Boolean - включить информацию о зонах доставки
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

// ================ СИСТЕМА ДОСТАВКИ ESARGO ================

/**
 * POST /api/cart/calculate-delivery - Рассчитать доставку (ОБНОВЛЕНО)
 * Body: {
 *   // ВАРИАНТ 1: Новый адрес
 *   delivery_address: {
 *     lat: Number,
 *     lng: Number,
 *     address: String,
 *     apartment?: String,
 *     entrance?: String,
 *     delivery_notes?: String
 *   }
 *   // ИЛИ ВАРИАНТ 2: Сохраненный адрес
 *   saved_address_id: ObjectId
 * }
 */
router.post('/calculate-delivery', 
  authenticateCustomer, 
  requireRole('customer'),
  calculateDelivery
);

/**
 * ✅ НОВЫЙ ЭНДПОИНТ: POST /api/cart/check-delivery - Быстрая проверка доставки
 * Body: {
 *   lat: Number,
 *   lng: Number,
 *   address?: String
 * }
 * Возвращает: информацию о возможности доставки, зоне и времени
 */
router.post('/check-delivery', 
  authenticateCustomer, 
  requireRole('customer'),
  checkDeliveryAvailability
);

// ================ СЛУЖЕБНЫЕ ЭНДПОИНТЫ ================

/**
 * GET /api/cart/health - Проверка работоспособности корзины
 */
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Cart API working (ESARGO System)",
    service_version: "2.0.0",
    available_endpoints: {
      // Основные операции
      get_cart: "GET /api/cart",
      add_item: "POST /api/cart/items",
      update_item: "PUT /api/cart/items/:item_id", 
      remove_item: "DELETE /api/cart/items/:item_id",
      clear_cart: "DELETE /api/cart",
      
      // ✅ СИСТЕМА ДОСТАВКИ ESARGO
      calculate_delivery: "POST /api/cart/calculate-delivery",
      check_delivery: "POST /api/cart/check-delivery"
    },
    cart_features: [
      "Server-side storage (MongoStore)",
      "Multi-restaurant prevention",
      "Options and special requests",
      "ESARGO delivery calculation with zones", // ✅ ОБНОВЛЕНО
      "Real-time pricing",
      "Saved addresses integration", // ✅ НОВОЕ
      "Marseille delivery zones (1: 0-5km, 2: 5-10km)" // ✅ НОВОЕ
    ],
    esargo_delivery_system: {
      delivery_zones: {
        zone_1: {
          range: "0-5 km from Marseille center",
          rates: {
            large_order: "6€ (order ≥30€)",
            small_order: "9€ (order <30€)"
          }
        },
        zone_2: {
          range: "5-10 km from Marseille center", 
          rates: {
            large_order: "10€ (order ≥30€)",
            small_order: "13€ (order <30€)"
          }
        }
      },
      peak_hours: [
        "11:30-14:00 (+1.50€)",
        "18:00-21:00 (+2.00€)"
      ],
      city_bounds: {
        marseille: {
          lat_range: "43.200 - 43.350",
          lng_range: "5.200 - 5.600"
        }
      },
      features: [
        "Mock geocoding for testing",
        "Distance calculation (Haversine)",
        "Peak hour surcharges",
        "Zone-based pricing",
        "Integration with saved addresses"
      ]
    },
    session_info: {
      storage: "express-session + MongoStore",
      expires: "24 hours of inactivity"
    },
    timestamp: new Date().toISOString()
  });
});

export default router;