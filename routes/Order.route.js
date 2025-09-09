// routes/Order.route.js - Система заказов
import express from 'express';
import {
  // Клиентские контроллеры
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  rateOrder,
  
  // Партнерские контроллеры  
  getPartnerOrders,
  acceptOrder,
  rejectOrder,
  markOrderReady,
  
  // Курьерские контроллеры
  getAvailableOrders,
  acceptDelivery,
  markOrderPickedUp,
  markOrderDelivered,
  getCourierOrders,
  
  // Общие контроллеры
  trackOrder,
  getOrderStatus
} from '../controllers/OrderController.js';

import { authenticateCustomer, requireRole as requireCustomerRole } from '../middleware/customerAuth.middleware.js';
import { checkPartnerToken, requirePartnerProfile } from '../middleware/partnerAuth.middleware.js';
import { checkCourierToken, requireApprovedCourier } from '../middleware/courierAuth.middleware.js';

const router = express.Router();

// ================ КЛИЕНТСКИЕ РОУТЫ ================

/**
 * POST /api/orders - Создать заказ из корзины
 * Body: {
 *   delivery_address: { address, lat, lng, apartment, entrance, intercom, delivery_notes },
 *   customer_contact: { name, phone, email },
 *   payment_method: 'card' | 'cash',
 *   special_requests: String
 * }
 */
router.post('/', 
  authenticateCustomer, 
  requireCustomerRole('customer'),
  createOrder
);

router.post('/create', 
  authenticateCustomer, 
  requireCustomerRole('customer'),
  createOrder
);

/**
 * GET /api/orders/my - Получить мои заказы
 * Query: status, limit, offset
 */
router.get('/my', 
  authenticateCustomer, 
  requireCustomerRole('customer'),
  getMyOrders
);

/**
 * GET /api/orders/:id - Получить детали заказа
 */
router.get('/:id', 
  authenticateCustomer, 
  requireCustomerRole('customer'),
  getOrderById
);

/**
 * POST /api/orders/:id/cancel - Отменить заказ
 * Body: { reason: String }
 */
router.post('/:id/cancel', 
  authenticateCustomer, 
  requireCustomerRole('customer'),
  cancelOrder
);

/**
 * POST /api/orders/:id/rate - Оценить заказ
 * Body: {
 *   partner_rating: Number (1-5),
 *   courier_rating: Number (1-5),
 *   comment: String
 * }
 */
router.post('/:id/rate', 
  authenticateCustomer, 
  requireCustomerRole('customer'),
  rateOrder
);

// ================ ПАРТНЕРСКИЕ РОУТЫ ================

/**
 * GET /api/orders/partner/list - Получить заказы партнера
 * Query: status, limit, offset
 */
router.get('/partner/list', 
  checkPartnerToken,
  requirePartnerProfile,
  getPartnerOrders
);

/**
 * POST /api/orders/:id/accept - Принять заказ
 * Body: { estimated_preparation_time: Number (в минутах) }
 */
router.post('/:id/accept', 
  checkPartnerToken,
  requirePartnerProfile,
  acceptOrder
);

/**
 * POST /api/orders/:id/reject - Отклонить заказ
 * Body: { reason: String }
 */
router.post('/:id/reject', 
  checkPartnerToken,
  requirePartnerProfile,
  rejectOrder
);

/**
 * POST /api/orders/:id/ready - Заказ готов к выдаче
 */
router.post('/:id/ready', 
  checkPartnerToken,
  requirePartnerProfile,
  markOrderReady
);

// ================ КУРЬЕРСКИЕ РОУТЫ ================

/**
 * GET /api/orders/courier/available - Доступные заказы для курьера
 * Query: lat, lng, radius (в км)
 */
router.get('/courier/available', 
  checkCourierToken,
  requireApprovedCourier,
  getAvailableOrders
);

/**
 * GET /api/orders/courier/my - Мои взятые заказы
 * Query: status, limit, offset
 */
router.get('/courier/my', 
  checkCourierToken,
  requireApprovedCourier,
  getCourierOrders
);

/**
 * POST /api/orders/:id/take - Взять заказ на доставку
 */
router.post('/:id/take', 
  checkCourierToken,      // ✅ Добавляем проверку токена
  requireApprovedCourier, // ✅ Затем проверяем статус
  acceptDelivery
);

/**
 * POST /api/orders/:id/pickup - Забрал заказ у партнера
 */
router.post('/:id/pickup', 
  checkCourierToken,
  requireApprovedCourier,
  markOrderPickedUp
);

/**
 * POST /api/orders/:id/deliver - Доставил заказ клиенту
 * Body: { delivery_notes: String }
 */
router.post('/:id/deliver', 
  checkCourierToken,
  requireApprovedCourier,
  markOrderDelivered
);

// ================ ОБЩИЕ РОУТЫ (доступны всем участникам) ================

/**
 * GET /api/orders/:id/track - Отслеживание заказа
 * Доступен клиенту, партнеру и курьеру связанным с заказом
 */
router.get('/:id/track', trackOrder);

/**
 * GET /api/orders/:id/status - Краткий статус заказа
 * Публичный эндпоинт для быстрой проверки статуса
 */
router.get('/:id/status', getOrderStatus);

// ================ СЛУЖЕБНЫЕ ЭНДПОИНТЫ ================

/**
 * GET /api/orders/health - Проверка работоспособности
 */
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "Orders API working",
    order_statuses: [
      'pending',      // Ожидает подтверждения партнера
      'accepted',     // Партнер принял заказ
      'preparing',    // Партнер готовит заказ
      'ready',        // Заказ готов, ищем курьера
      'picked_up',    // Курьер забрал заказ
      'on_the_way',   // Курьер в пути к клиенту
      'delivered',    // Заказ доставлен
      'cancelled'     // Заказ отменен
    ],
    available_endpoints: {
      customer: {
        create: "POST /api/orders",
        my_orders: "GET /api/orders/my",
        order_details: "GET /api/orders/:id",
        cancel: "POST /api/orders/:id/cancel",
        rate: "POST /api/orders/:id/rate"
      },
      partner: {
        list: "GET /api/orders/partner/list",
        accept: "POST /api/orders/:id/accept",
        reject: "POST /api/orders/:id/reject", 
        ready: "POST /api/orders/:id/ready"
      },
      courier: {
        available: "GET /api/orders/courier/available",
        my_orders: "GET /api/orders/courier/my",
        take: "POST /api/orders/:id/take",
        pickup: "POST /api/orders/:id/pickup",
        deliver: "POST /api/orders/:id/deliver"
      },
      tracking: {
        track: "GET /api/orders/:id/track",
        status: "GET /api/orders/:id/status"
      }
    },
    features: [
      "Multi-role order management",
      "Real-time status updates", 
      "Payment integration ready",
      "Delivery tracking",
      "Rating system"
    ],
    timestamp: new Date().toISOString()
  });
});

export default router;