// app.js (ПОЛНЫЙ с поддержкой сессий и всеми изменениями)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

// 🆕 Импорты для сессий
import session from 'express-session';
import MongoStore from 'connect-mongo';

import config from './config/app.js';
import connectDB from './config/database.js';
import { requestLogger, startupLogger } from './middleware/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import initOwnerAccount from './services/initOwner.service.js';

const app = express();

// Подключение к базе данных и инициализация системы
connectDB().then(() => {
  initOwnerAccount(); 
});

// 🆕 НАСТРОЙКА СЕССИЙ ДЛЯ КОРЗИНЫ
app.use(session({
  secret: process.env.SESSION_SECRET || 'esargo-session-secret-key-2024',
  name: 'esargo.session', // Имя cookie
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: config.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 24 часа в секундах
    touchAfter: 24 * 3600, // Обновлять сессию раз в 24 часа если не изменялась
  }),
  cookie: {
    secure: config.isProduction(), // HTTPS только в продакшене
    httpOnly: true, // Защита от XSS
    maxAge: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
    sameSite: 'lax' // CSRF защита
  },
  rolling: true // Обновлять время жизни при каждом запросе
}));

startupLogger('✅ Express sessions configured with MongoStore for shopping cart');

// Trust proxy для работы за load balancer
app.set('trust proxy', 1);

// Безопасность - Helmet
if (config.HELMET_ENABLED) {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Слишком много запросов с этого IP, попробуйте позже',
    retry_after: Math.ceil(config.RATE_LIMIT_WINDOW / 1000 / 60) + ' минут',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// CORS настройки
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (config.CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(
          new Error(`CORS policy: Origin ${origin} not allowed`)
        );
      }
    },
    credentials: true, // 🆕 ВАЖНО: разрешаем cookies для сессий
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Сжатие ответов
app.use(compression());

// Парсинг JSON и URL-encoded данных
app.use(
  express.json({
    limit: config.REQUEST_LIMIT,
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: config.REQUEST_LIMIT,
  })
);

// Защита от NoSQL инъекций
app.use(mongoSanitize());

// Логирование запросов
app.use(requestLogger);

// Health check для мониторинга
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ESARGO API Server работает корректно',
    version: '2.1.0',
    environment: config.NODE_ENV,
    features: {
      // 🆕 НОВЫЕ ВОЗМОЖНОСТИ
      order_system: 'enabled',
      shopping_cart: 'enabled', 
      public_catalog: 'enabled',
      payment_stub: 'enabled',
      sessions: 'enabled'
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// 🆕 MIDDLEWARE для добавления session ID в логи
app.use((req, res, next) => {
  if (req.sessionID) {
    req.sessionID = req.sessionID;
  }
  next();
});

// Основные API роуты
app.use(config.API_PREFIX, routes);

// Главная страница с информацией о системе заказов
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ESARGO API Server - UberEats Style Food Delivery Platform',
    version: '2.1.0',
    environment: config.NODE_ENV,
    architecture: 'Service Layer + Meta Security Model + Full Order Management System',
    
    // 🆕 ПОЛНАЯ ИНФОРМАЦИЯ О СИСТЕМЕ ЗАКАЗОВ
    order_system: {
      status: 'fully_operational',
      features: [
        'Public restaurant catalog browsing',
        'Shopping cart with server-side sessions',
        'Multi-role order management',
        'Real-time order tracking',
        'Payment processing (stub)',
        'Rating and review system',
        'Delivery tracking'
      ]
    },
    
    endpoints: {
      health: '/health',
      api_base: config.API_PREFIX,
      
      // Публичные эндпоинты (без авторизации)
      public_catalog: config.API_PREFIX + '/public/catalog',
      restaurant_menu: config.API_PREFIX + '/public/restaurants/:id/menu',
      
      // Клиентские эндпоинты
      customers: config.API_PREFIX + '/customers',
      shopping_cart: config.API_PREFIX + '/cart',
      orders: config.API_PREFIX + '/orders',
      
      // Партнерские эндпоинты
      partners: config.API_PREFIX + '/partners',
      partner_orders: config.API_PREFIX + '/orders/partner',
      
      // Курьерские эндпоинты  
      couriers: config.API_PREFIX + '/couriers',
      courier_orders: config.API_PREFIX + '/orders/courier',
      
      // Административные эндпоинты
      admin: config.API_PREFIX + '/admin'
    },
    
    // 🆕 WORKFLOW ЗАКАЗА
    order_workflow: {
      step_1: 'Browse restaurants (/public/catalog)',
      step_2: 'Register/login (/customers/register)',
      step_3: 'Add items to cart (/cart/items)',
      step_4: 'Calculate delivery (/cart/calculate-delivery)',
      step_5: 'Create order (/orders)',
      step_6: 'Restaurant accepts (/orders/:id/accept)',
      step_7: 'Restaurant marks ready (/orders/:id/ready)',
      step_8: 'Courier takes order (/orders/:id/take)',
      step_9: 'Courier picks up (/orders/:id/pickup)',
      step_10: 'Courier delivers (/orders/:id/deliver)',
      step_11: 'Customer rates (/orders/:id/rate)'
    },
    
    session_info: {
      store: 'MongoStore',
      ttl: '24 hours',
      secure: config.isProduction(),
      purpose: 'Shopping cart persistence'
    },
    
    timestamp: new Date().toISOString()
  });
});

// Обработчики ошибок
app.use(notFound);
app.use(errorHandler);

// Запуск сервера
const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  startupLogger(`🚀 ESARGO API Server running on port ${PORT}`);
  startupLogger(`📱 Environment: ${config.NODE_ENV}`);
  startupLogger(`🔗 API Base: ${config.API_PREFIX}`);
  startupLogger(`🛒 Shopping cart sessions: enabled`);
  startupLogger(`📦 Order management system: fully operational`);
  
  if (config.NODE_ENV === 'development') {
    startupLogger(`📖 API Documentation: http://localhost:${PORT}`);
    startupLogger(`🏪 Public catalog: http://localhost:${PORT}${config.API_PREFIX}/public/catalog`);
    startupLogger(`🛒 Cart API: http://localhost:${PORT}${config.API_PREFIX}/cart`);
    startupLogger(`📦 Orders API: http://localhost:${PORT}${config.API_PREFIX}/orders`);
  }
});

export default app;