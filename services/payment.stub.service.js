// services/payment.service.js - ОБНОВЛЕННАЯ система платежей (только онлайн)
import crypto from 'crypto';

/**
 * 💳 ПЛАТЕЖНАЯ СИСТЕМА - ТОЛЬКО ОНЛАЙН ОПЛАТА
 * Все заказы должны быть оплачены картой при создании
 */

/**
 * 🎯 Создание и обработка платежа при заказе
 */
export const processOrderPayment = async (orderData) => {
  const {
    amount, // в евро (например 24.48)
    currency = 'EUR',
    customer_id,
    order_id,
    card_info = {} // данные карты от клиента
  } = orderData;

  console.log('💳 PROCESS ORDER PAYMENT:', {
    amount,
    currency,
    customer_id,
    order_id: order_id || 'pending'
  });

  // Валидация суммы
  if (!amount || amount <= 0) {
    throw new Error('Некорректная сумма платежа');
  }

  // Имитируем задержку обработки платежа (200-800ms)
  await new Promise(resolve => setTimeout(resolve, Math.random() * 600 + 200));

  // Генерируем уникальные ID
  const payment_id = `pi_${crypto.randomBytes(12).toString('hex')}`;
  const transaction_id = `txn_${crypto.randomBytes(10).toString('hex')}`;
  
  // Имитируем различные результаты платежей
  const randomOutcome = Math.random();
  
  if (randomOutcome < 0.92) {
    // 92% успешных платежей
    return {
      success: true,
      payment_id,
      transaction_id,
      method: 'card',
      amount: amount,
      currency,
      status: 'completed',
      processed_at: new Date(),
      receipt_url: `https://payments.esargo.com/receipts/${payment_id}`,
      processing_fee: Math.round(amount * 0.029 * 100) / 100, // 2.9% комиссия
      card_last_digits: '****' + Math.floor(Math.random() * 9000 + 1000),
      details: 'Платеж успешно обработан'
    };
  } else if (randomOutcome < 0.95) {
    // 3% - недостаточно средств
    throw new Error('Недостаточно средств на карте. Попробуйте другую карту.');
  } else if (randomOutcome < 0.97) {
    // 2% - карта отклонена банком
    throw new Error('Банк отклонил операцию. Свяжитесь с банком или используйте другую карту.');
  } else if (randomOutcome < 0.99) {
    // 2% - истекший срок карты
    throw new Error('Срок действия карты истек. Используйте действующую карту.');
  } else {
    // 1% - технические проблемы
    throw new Error('Временные технические проблемы. Попробуйте через несколько минут.');
  }
};

/**
 * 💸 Возврат средств при отмене заказа
 */
export const processOrderRefund = async (orderData) => {
  const {
    original_payment_id,
    amount,
    order_id,
    reason = 'order_cancelled'
  } = orderData;

  console.log('💸 PROCESS ORDER REFUND:', {
    original_payment_id,
    amount,
    order_id,
    reason
  });

  // Имитируем задержку
  await new Promise(resolve => setTimeout(resolve, 300));

  const refund_id = `ref_${crypto.randomBytes(10).toString('hex')}`;

  // 95% успешных возвратов
  if (Math.random() < 0.95) {
    return {
      success: true,
      refund_id,
      original_payment_id,
      amount,
      currency: 'EUR',
      status: 'completed',
      reason,
      processed_at: new Date(),
      estimated_arrival: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 дня
      details: 'Возврат средств обработан. Деньги поступят на карту в течение 3-5 рабочих дней.'
    };
  } else {
    throw new Error('Не удалось обработать возврат средств. Обратитесь в службу поддержки.');
  }
};

/**
 * 🔍 Проверка статуса платежа
 */
export const getPaymentStatus = async (payment_id) => {
  console.log('🔍 GET PAYMENT STATUS:', { payment_id });

  await new Promise(resolve => setTimeout(resolve, 100));

  // Для демонстрации возвращаем успешный статус
  return {
    payment_id,
    status: 'completed',
    amount: null, // будет заполнено из базы данных
    processed_at: new Date(),
    is_refunded: false
  };
};

/**
 * 🎛️ НАСТРОЙКИ ПЛАТЕЖНОЙ СИСТЕМЫ
 */
export const paymentConfig = {
  // Поддерживаемые валюты
  supported_currencies: ['EUR'],
  
  // Минимальная сумма платежа
  min_payment_amount: 1.00,
  
  // Максимальная сумма платежа
  max_payment_amount: 999.99,
  
  // Комиссия системы
  processing_fee_rate: 0.029, // 2.9%
  
  // Время ожидания обработки платежа (мс)
  payment_timeout: 30000, // 30 секунд
  
  // Процент успешных платежей
  success_rate: 0.92
};

/**
 * 🧪 ТЕСТОВЫЕ ФУНКЦИИ (только для разработки)
 */

// Создать успешный тестовый платеж
export const createTestSuccessPayment = async (amount) => {
  return {
    success: true,
    payment_id: `pi_test_success_${crypto.randomBytes(6).toString('hex')}`,
    transaction_id: `txn_test_${crypto.randomBytes(6).toString('hex')}`,
    method: 'card',
    amount,
    currency: 'EUR',
    status: 'completed',
    processed_at: new Date(),
    card_last_digits: '****1234',
    details: 'Тестовый успешный платеж',
    test_mode: true
  };
};

// Создать неуспешный тестовый платеж
export const createTestFailedPayment = async (amount, error_type = 'card_declined') => {
  const error_messages = {
    'insufficient_funds': 'Тестовая ошибка: недостаточно средств на карте',
    'card_declined': 'Тестовая ошибка: банк отклонил операцию',
    'expired_card': 'Тестовая ошибка: срок действия карты истек'
  };
  
  throw new Error(error_messages[error_type] || 'Тестовая ошибка платежа');
};

export default {
  processOrderPayment,
  processOrderRefund,
  getPaymentStatus,
  createTestSuccessPayment,
  createTestFailedPayment,
  paymentConfig
};