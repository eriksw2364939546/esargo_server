// services/payment.stub.service.js - Заглушка для платежей
import crypto from 'crypto';

/**
 * 💳 ЗАГЛУШКА ПЛАТЕЖНОЙ СИСТЕМЫ
 * Имитирует работу реальной платежной системы (Stripe, PayPal и т.д.)
 * 
 * Возможные результаты:
 * - success (85% случаев)
 * - failed_insufficient_funds (5% случаев) 
 * - failed_card_declined (5% случаев)
 * - failed_network_error (3% случаев)
 * - failed_expired_card (2% случаев)
 */

/**
 * 🎯 Создание платежного намерения
 */
export const createPaymentIntent = async (paymentData) => {
  const {
    amount, // в копейках (например 1250 = 12.50 EUR)
    currency = 'EUR',
    customer_id,
    order_id,
    payment_method = 'card',
    card_info = null
  } = paymentData;

  console.log('💳 CREATE PAYMENT INTENT:', {
    amount,
    currency,
    customer_id,
    order_id,
    payment_method
  });

  // Имитируем задержку сети (100-500ms)
  await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));

  // Генерируем уникальный ID платежа
  const payment_id = `pi_${crypto.randomBytes(12).toString('hex')}`;
  
  // Имитируем различные результаты
  const randomOutcome = Math.random();
  let status, client_secret, error_code, error_message;

  if (randomOutcome < 0.85) {
    // 85% успешных платежей
    status = 'requires_confirmation';
    client_secret = `${payment_id}_secret_${crypto.randomBytes(8).toString('hex')}`;
  } else if (randomOutcome < 0.90) {
    // 5% - недостаточно средств
    status = 'failed';
    error_code = 'insufficient_funds';
    error_message = 'Недостаточно средств на карте';
  } else if (randomOutcome < 0.95) {
    // 5% - карта отклонена
    status = 'failed';
    error_code = 'card_declined';
    error_message = 'Банк отклонил операцию';
  } else if (randomOutcome < 0.98) {
    // 3% - сетевая ошибка
    status = 'failed';
    error_code = 'network_error';
    error_message = 'Ошибка соединения с банком';
  } else {
    // 2% - истекшая карта
    status = 'failed';
    error_code = 'expired_card';
    error_message = 'Срок действия карты истек';
  }

  const result = {
    payment_id,
    status,
    amount,
    currency,
    created_at: new Date().toISOString(),
    metadata: {
      order_id,
      customer_id
    }
  };

  if (status === 'requires_confirmation') {
    result.client_secret = client_secret;
  } else {
    result.error = {
      code: error_code,
      message: error_message
    };
  }

  console.log('✅ PAYMENT INTENT CREATED:', {
    payment_id,
    status,
    has_error: !!result.error
  });

  return result;
};

/**
 * ✅ Подтверждение платежа
 */
export const confirmPayment = async (payment_id, client_secret) => {
  console.log('🔄 CONFIRM PAYMENT:', { payment_id, client_secret });

  // Имитируем задержку обработки (200-1000ms)
  await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 200));

  // Проверяем валидность client_secret (упрощенно)
  if (!client_secret || !client_secret.includes(payment_id)) {
    return {
      payment_id,
      status: 'failed',
      error: {
        code: 'invalid_client_secret',
        message: 'Недействительный секретный ключ платежа'
      },
      confirmed_at: new Date().toISOString()
    };
  }

  // 95% успешных подтверждений, 5% неудачных
  const success = Math.random() < 0.95;

  if (success) {
    return {
      payment_id,
      status: 'succeeded',
      confirmed_at: new Date().toISOString(),
      transaction_id: `txn_${crypto.randomBytes(8).toString('hex')}`,
      receipt_url: `https://payments.esargo.com/receipts/${payment_id}`,
      processing_fee: Math.round(0.029 * 100) / 100 // 2.9% комиссия
    };
  } else {
    const errorMessages = [
      'Операция отменена банком',
      'Превышен лимит операций по карте',
      'Технические работы в банке'
    ];

    return {
      payment_id,
      status: 'failed',
      error: {
        code: 'processing_failed',
        message: errorMessages[Math.floor(Math.random() * errorMessages.length)]
      },
      confirmed_at: new Date().toISOString()
    };
  }
};

/**
 * 🔍 Получение статуса платежа
 */
export const getPaymentStatus = async (payment_id) => {
  console.log('🔍 GET PAYMENT STATUS:', { payment_id });

  // Имитируем задержку
  await new Promise(resolve => setTimeout(resolve, 100));

  // Для демонстрации возвращаем случайный статус
  const statuses = [
    { status: 'succeeded', probability: 0.7 },
    { status: 'processing', probability: 0.15 },
    { status: 'requires_confirmation', probability: 0.1 },
    { status: 'failed', probability: 0.05 }
  ];

  const random = Math.random();
  let cumulative = 0;
  
  for (const { status, probability } of statuses) {
    cumulative += probability;
    if (random <= cumulative) {
      return {
        payment_id,
        status,
        checked_at: new Date().toISOString()
      };
    }
  }

  // Fallback
  return {
    payment_id,
    status: 'succeeded',
    checked_at: new Date().toISOString()
  };
};

/**
 * 💸 Возврат платежа
 */
export const refundPayment = async (payment_id, refund_amount = null, reason = 'requested_by_customer') => {
  console.log('💸 REFUND PAYMENT:', { payment_id, refund_amount, reason });

  // Имитируем задержку
  await new Promise(resolve => setTimeout(resolve, 300));

  const refund_id = `re_${crypto.randomBytes(10).toString('hex')}`;

  // 90% успешных возвратов
  const success = Math.random() < 0.90;

  if (success) {
    return {
      refund_id,
      payment_id,
      status: 'succeeded',
      amount: refund_amount,
      reason,
      created_at: new Date().toISOString(),
      estimated_arrival: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 дней
    };
  } else {
    return {
      refund_id,
      payment_id,
      status: 'failed',
      error: {
        code: 'refund_failed',
        message: 'Не удалось обработать возврат. Обратитесь в службу поддержки.'
      },
      created_at: new Date().toISOString()
    };
  }
};

/**
 * 📊 Получение баланса (для демонстрации)
 */
export const getAccountBalance = async (account_id) => {
  console.log('📊 GET ACCOUNT BALANCE:', { account_id });

  await new Promise(resolve => setTimeout(resolve, 50));

  // Возвращаем случайный баланс для демонстрации
  return {
    account_id,
    available_balance: {
      amount: Math.floor(Math.random() * 10000000), // случайная сумма в копейках
      currency: 'EUR'
    },
    pending_balance: {
      amount: Math.floor(Math.random() * 100000),
      currency: 'EUR'
    },
    last_updated: new Date().toISOString()
  };
};

/**
 * 🧪 ТЕСТОВЫЕ МЕТОДЫ (только для разработки)
 */

/**
 * Создать тестовый платеж, который всегда успешен
 */
export const createTestSuccessPayment = async (paymentData) => {
  const payment_id = `pi_test_success_${crypto.randomBytes(6).toString('hex')}`;
  
  return {
    payment_id,
    status: 'requires_confirmation',
    amount: paymentData.amount,
    currency: paymentData.currency || 'EUR',
    client_secret: `${payment_id}_secret_test`,
    created_at: new Date().toISOString(),
    metadata: paymentData.metadata || {},
    test_mode: true
  };
};

/**
 * Создать тестовый платеж, который всегда неудачен
 */
export const createTestFailedPayment = async (paymentData, error_type = 'card_declined') => {
  const payment_id = `pi_test_failed_${crypto.randomBytes(6).toString('hex')}`;
  
  const error_messages = {
    'card_declined': 'Тестовая карта отклонена',
    'insufficient_funds': 'Тестовая карта: недостаточно средств',
    'expired_card': 'Тестовая карта: истек срок действия'
  };
  
  return {
    payment_id,
    status: 'failed',
    amount: paymentData.amount,
    currency: paymentData.currency || 'EUR',
    created_at: new Date().toISOString(),
    error: {
      code: error_type,
      message: error_messages[error_type] || 'Тестовая ошибка платежа'
    },
    metadata: paymentData.metadata || {},
    test_mode: true
  };
};

/**
 * 🎛️ НАСТРОЙКИ ЗАГЛУШКИ
 */
export const stubConfig = {
  // Процент успешных платежей (по умолчанию 85%)
  success_rate: 0.85,
  
  // Имитировать задержки сети
  simulate_network_delays: true,
  
  // Минимальная задержка (мс)
  min_delay: 100,
  
  // Максимальная задержка (мс)
  max_delay: 1000,
  
  // Поддерживаемые валюты
  supported_currencies: ['EUR', 'USD', 'RUB'],
  
  // Комиссия платежной системы (в процентах)
  processing_fee_rate: 0.029 // 2.9%
};

export default {
  createPaymentIntent,
  confirmPayment,
  getPaymentStatus,
  refundPayment,
  getAccountBalance,
  createTestSuccessPayment,
  createTestFailedPayment,
  stubConfig
};