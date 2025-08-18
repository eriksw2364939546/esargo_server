// services/partner.register.service.js - БЕЗОПАСНЫЙ С ШИФРОВАНИЕМ 🔐
import { User, InitialPartnerRequest } from '../models/index.js';
import Meta from '../models/Meta.model.js';
import { hashString, hashMeta } from '../utils/hash.js';
import { cryptoString, decryptString } from '../utils/crypto.js'; // 🔐 ДОБАВИЛИ ШИФРОВАНИЕ
import { generateCustomerToken } from './token.service.js';
import mongoose from 'mongoose';

/**
 * ✅ БЕЗОПАСНАЯ РЕГИСТРАЦИЯ: Создание User + InitialPartnerRequest
 * 🔐 С правильным шифрованием персон// models/PartnerProfile.model.js (ПОЛНЫЙ ИСПРАВЛЕННЫЙ)
import mongoose from 'mongoose';

const partnerProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  business_name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  brand_name: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  category: {
    type: String,
    required: true,
    enum: ['restaurant', 'store'],
    index: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // 🔐 ЗАШИФРОВАННЫЕ ДАННЫЕ
  address: {
    type: String, // Зашифрованный адрес
    required: true
  },
  
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 &&
                 coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Координаты должны быть в формате [longitude, latitude]'
      }
    }
  },
  
  phone: {
    type: String, // Зашифрованный телефон
    required: true
  },
  
  email: {
    type: String, // Зашифрованный email
    required: true
  },
  
  owner_name: {
    type: String,
    required: true,
    trim: true
  },
  
  owner_surname: {
    type: String,
    required: true,
    trim: true
  },
  
  floor_unit: {
    type: String, // Зашифрованный этаж/люкс
    trim: true
  },
  
  cover_image_url: {
    type: String,
    validate: {
      validator: function(url) {
        if (!url) return true;
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url);
      },
      message: 'Неверный формат URL изображения'
    }
  },
  
  // График работы
  working_hours: {
    monday: {
      is_open: { type: Boolean, default: true },
      open_time: { 
        type: String, 
        default: '09:00',
        validate: {
          validator: function(time) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
          },
          message: 'Время должно быть в формате HH:MM'
        }
      },
      close_time: { 
        type: String, 
        default: '21:00',
        validate: {
          validator: function(time) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
          },
          message: 'Время должно быть в формате HH:MM'
        }
      }
    },
    tuesday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    wednesday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    thursday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    friday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '09:00' },
      close_time: { type: String, default: '21:00' }
    },
    saturday: {
      is_open: { type: Boolean, default: true },
      open_time: { type: String, default: '10:00' },
      close_time: { type: String, default: '22:00' }
    },
    sunday: {
      is_open: { type: Boolean, default: false },
      open_time: { type: String, default: null },
      close_time: { type: String, default: null }
    }
  },
  
  // Рейтинги и отзывы
  ratings: {
    avg_rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    total_ratings: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Статус партнера
  is_approved: {
    type: Boolean,
    default: false,
    index: true
  },
  
  is_active: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // 🆕 ДОБАВЛЕНО: Статус одобрения (для отслеживания этапов)
  approval_status: {
    type: String,
    enum: [
      'awaiting_legal_info',    // Ждет юридических данных
      'under_review',           // Юридические данные на проверке  
      'approved',               // Полностью одобрен
      'rejected',               // Отклонен
      'suspended'               // Приостановлен
    ],
    default: 'awaiting_legal_info',
    index: true
  },
  
  // Информация об одобрении
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  
  approved_at: {
    type: Date
  },
  
  rejection_reason: {
    type: String,
    trim: true
  },
  
  // Юридическая информация (ссылка)
  legal_info: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerLegalInfo'
  },
  
  // Настройки уведомлений
  notification_settings: {
    new_order: { type: Boolean, default: true },
    order_cancelled: { type: Boolean, default: true },
    low_rating: { type: Boolean, default: true },
    weekly_report: { type: Boolean, default: true }
  },
  
  // Статистика партнера
  stats: {
    total_orders: { type: Number, default: 0 },
    completed_orders: { type: Number, default: 0 },
    cancelled_orders: { type: Number, default: 0 },
    total_revenue: { type: Number, default: 0 },
    avg_order_value: { type: Number, default: 0 },
    preparation_time_avg: { type: Number, default: 30 } // в минутах
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ================

// Геопространственный индекс для поиска по местоположению
partnerProfileSchema.index({ location: '2dsphere' });

// Составные индексы
partnerProfileSchema.index({ category: 1, is_approved: 1, is_active: 1 });
partnerProfileSchema.index({ 'ratings.avg_rating': -1, is_approved: 1, is_active: 1 });
partnerProfileSchema.index({ approval_status: 1, createdAt: -1 });

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================

// Полное имя владельца
partnerProfileSchema.virtual('owner_full_name').get(function() {
  return `${this.owner_name} ${this.owner_surname}`;
});

// Статус работы (открыт/закрыт)
partnerProfileSchema.virtual('is_currently_open').get(function() {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  
  const todaySchedule = this.working_hours[currentDay];
  
  if (!todaySchedule.is_open) {
    return false;
  }
  
  return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
});

// Средний рейтинг (округленный)
partnerProfileSchema.virtual('rating_rounded').get(function() {
  return Math.round(this.ratings.avg_rating * 10) / 10;
});

// Процент успешных заказов
partnerProfileSchema.virtual('success_rate').get(function() {
  if (this.stats.total_orders === 0) return 0;
  return Math.round((this.stats.completed_orders / this.stats.total_orders) * 100);
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

// Проверка открыт ли партнер сейчас
partnerProfileSchema.methods.isCurrentlyOpen = function() {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  
  const todaySchedule = this.working_hours[currentDay];
  
  if (!todaySchedule.is_open) {
    return false;
  }
  
  return currentTime >= todaySchedule.open_time && currentTime <= todaySchedule.close_time;
};

// Обновление рейтинга
partnerProfileSchema.methods.updateRating = function(newRating) {
  const totalRatings = this.ratings.total_ratings;
  const currentAvg = this.ratings.avg_rating;
  
  this.ratings.total_ratings = totalRatings + 1;
  this.ratings.avg_rating = ((currentAvg * totalRatings) + newRating) / this.ratings.total_ratings;
  
  return this.save();
};

// Одобрение партнера
partnerProfileSchema.methods.approve = function(adminId) {
  this.is_approved = true;
  this.is_active = true;
  this.approval_status = 'approved';
  this.approved_by = adminId;
  this.approved_at = new Date();
  this.rejection_reason = undefined;
  
  return this.save();
};

// Отклонение партнера
partnerProfileSchema.methods.reject = function(reason) {
  this.is_approved = false;
  this.is_active = false;
  this.approval_status = 'rejected';
  this.rejection_reason = reason;
  this.approved_by = undefined;
  this.approved_at = undefined;
  
  return this.save();
};

// Приостановка партнера
partnerProfileSchema.methods.suspend = function(reason) {
  this.is_active = false;
  this.approval_status = 'suspended';
  this.rejection_reason = reason;
  
  return this.save();
};

// Обновление статистики заказов
partnerProfileSchema.methods.updateOrderStats = function(orderData) {
  this.stats.total_orders += 1;
  
  if (orderData.status === 'completed') {
    this.stats.completed_orders += 1;
    this.stats.total_revenue += orderData.total_price || 0;
    this.stats.avg_order_value = this.stats.total_revenue / this.stats.completed_orders;
  } else if (orderData.status === 'cancelled') {
    this.stats.cancelled_orders += 1;
  }
  
  if (orderData.preparation_time) {
    // Обновляем среднее время приготовления
    const totalTime = this.stats.preparation_time_avg * (this.stats.completed_orders - 1);
    this.stats.preparation_time_avg = (totalTime + orderData.preparation_time) / this.stats.completed_orders;
  }
  
  return this.save();
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

// Поиск партнеров поблизости
partnerProfileSchema.statics.findNearby = function(lat, lng, radiusKm = 5, category = null) {
  const query = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: radiusKm * 1000 // конвертируем км в метры
      }
    },
    is_approved: true,
    is_active: true
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query).sort({ 'ratings.avg_rating': -1 });
};

// Поиск одобренных партнеров
partnerProfileSchema.statics.findApproved = function() {
  return this.find({ 
    is_approved: true, 
    is_active: true 
  }).sort({ 'ratings.avg_rating': -1 });
};

// Поиск партнеров ожидающих одобрения
partnerProfileSchema.statics.findPendingApproval = function() {
  return this.find({ 
    $or: [
      { approval_status: 'awaiting_legal_info' },
      { approval_status: 'under_review' }
    ]
  }).sort({ createdAt: 1 });
};

// Получение топ партнеров по рейтингу
partnerProfileSchema.statics.getTopRated = function(limit = 10) {
  return this.find({ 
    is_approved: true, 
    is_active: true,
    'ratings.total_ratings': { $gte: 5 } // минимум 5 отзывов
  })
  .sort({ 'ratings.avg_rating': -1 })
  .limit(limit);
};

// ================ MIDDLEWARE ================

// Pre-save middleware
partnerProfileSchema.pre('save', function(next) {
  // Автоматически активируем партнера при одобрении
  if (this.isModified('is_approved') && this.is_approved && !this.is_active) {
    this.is_active = true;
  }
  
  // Обновляем approval_status при изменении is_approved
  if (this.isModified('is_approved')) {
    if (this.is_approved) {
      this.approval_status = 'approved';
    } else if (this.rejection_reason) {
      this.approval_status = 'rejected';
    }
  }
  
  next();
});

// Post-save middleware для логирования
partnerProfileSchema.post('save', function(doc) {
  console.log(`📋 Partner profile ${doc._id} updated: ${doc.business_name}, status: ${doc.approval_status}`);
});

// ================ НАСТРОЙКИ JSON ================

// Настройка виртуальных полей в JSON
partnerProfileSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Удаляем служебные поля из JSON ответа
    delete ret.__v;
    return ret;
  }
});

partnerProfileSchema.set('toObject', { virtuals: true });

// ================ ЭКСПОРТ ================

export default mongoose.model('PartnerProfile', partnerProfileSchema);альных данных
 */
export const registerPartnerWithInitialRequest = async (registrationData) => {
  const session = await mongoose.startSession();
  
  try {
    return await session.withTransaction(async () => {
      const {
        // Данные пользователя
        first_name,
        last_name, 
        email,
        password,
        phone,
        
        // Данные бизнеса (изображение 1)
        business_name,
        brand_name,
        category, // restaurant/store
        address,
        location,
        floor_unit,
        whatsapp_consent = false,
        
        // Метаданные
        registration_ip,
        user_agent
      } = registrationData;

      // Проверка существования
      const normalizedEmail = email.toLowerCase().trim();
      const hashedEmail = hashMeta(normalizedEmail);
      
      const existingMeta = await Meta.findByEmailHash(hashedEmail);
      if (existingMeta) {
        const error = new Error('Пользователь с таким email уже существует');
        error.statusCode = 400;
        throw error;
      }

      // 1️⃣ Создаем User с ролью 'partner'
      const newUser = new User({
        email: normalizedEmail, // ✅ ОТКРЫТО (нужно для авторизации)
        password_hash: await hashString(password),
        role: 'partner', // 🎯 СРАЗУ ПАРТНЕР (может войти в кабинет)
        is_active: true,
        is_email_verified: false,
        gdpr_consent: {
          data_processing: true,
          marketing: whatsapp_consent,
          analytics: true,
          consent_date: new Date()
        },
        registration_source: 'web',
        registration_ip,
        user_agent
      });

      await newUser.save({ session });

      // 2️⃣ Создаем Meta запись через правильный метод
      const newMetaInfo = await Meta.createForPartner(newUser._id, hashedEmail);

      // 🆕 3️⃣ Создаем базовый PartnerProfile (пустой, будет заполнен после одобрения)
      const { PartnerProfile } = await import('../models/index.js');
      const newPartnerProfile = new PartnerProfile({
        user_id: newUser._id,
        business_name,
        brand_name: brand_name || business_name,
        category,
        description: `${category === 'restaurant' ? 'Ресторан' : 'Магазин'} ${business_name}`,
        
        // 🔐 ЗАШИФРОВЫВАЕМ основные данные
        address: cryptoString(address),
        location, // Координаты открыто (для карт)
        phone: cryptoString(phone),
        email: cryptoString(normalizedEmail),
        
        // Основная информация
        owner_name: first_name,
        owner_surname: last_name,
        floor_unit: floor_unit ? cryptoString(floor_unit) : null,
        
        // 🚧 СТАТУС: В процессе регистрации
        is_approved: false,
        is_active: false,
        approval_status: 'awaiting_legal_info', // pending → awaiting_legal_info → under_review → approved
        
        // Рабочие часы по умолчанию (можно изменить позже)
        working_hours: {
          monday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          tuesday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          wednesday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          thursday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          friday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          saturday: { is_open: true, open_time: '10:00', close_time: '22:00' },
          sunday: { is_open: false, open_time: null, close_time: null }
        }
      });

      // 4️⃣ Создаем InitialPartnerRequest (заявка партнера) 🔐 С ШИФРОВАНИЕМ
      const newPartnerRequest = new InitialPartnerRequest({
        user_id: newUser._id,
        
        // 🔐 ПЕРСОНАЛЬНЫЕ ДАННЫЕ - шифруем чувствительное
        personal_data: {
          first_name, // ✅ Имена можно открыто
          last_name,  // ✅ Имена можно открыто
          phone: cryptoString(phone), // 🔐 ШИФРУЕМ ТЕЛЕФОН
          email: normalizedEmail // ✅ Копия из User (открыто)
        },
        
        // 🔐 БИЗНЕС ДАННЫЕ - микс открытого и зашифрованного
        business_data: {
          business_name, // ✅ ОТКРЫТО (нужно для каталога)
          brand_name: brand_name || business_name, // ✅ ОТКРЫТО
          category, // ✅ ОТКРЫТО (нужно для фильтров)
          description: `${category === 'restaurant' ? 'Ресторан' : 'Магазин'} ${business_name}`, // ✅ ОТКРЫТО
          
          // 🔐 ШИФРУЕМ АДРЕСА И КОНТАКТЫ
          address: cryptoString(address), // 🔐 АДРЕС ЗАШИФРОВАН
          location, // ✅ Координаты можно открыто (неточные)
          floor_unit: floor_unit ? cryptoString(floor_unit) : null, // 🔐 ЭТАЖ ЗАШИФРОВАН
          
          // 🔐 КОНТАКТНЫЕ ДАННЫЕ ЗАШИФРОВАНЫ
          phone: cryptoString(phone), // 🔐 ТЕЛЕФОН ЗАШИФРОВАН
          email: cryptoString(normalizedEmail), // 🔐 EMAIL ЗАШИФРОВАН (копия для безопасности)
          
          // Владелец (для админов)
          owner_name: first_name, // ✅ ОТКРЫТО (имена не критичны)
          owner_surname: last_name // ✅ ОТКРЫТО
        },
        
        // Метаданные регистрации
        registration_info: {
          registration_ip,
          user_agent,
          whatsapp_consent,
          consent_date: new Date()
        },
        
        status: 'pending', // Ждет одобрения админом
        submitted_at: new Date()
      });

      await newPartnerRequest.save({ session });

      // 5️⃣ Генерируем JWT токен 
      const token = generateCustomerToken({
        user_id: newUser._id,
        email: newUser.email,
        role: newUser.role
      });

      // 🔐 ВАЖНО: В ответе возвращаем ТОЛЬКО безопасные данные
      return {
        success: true,
        user: {
          id: newUser._id,
          email: newUser.email, // ✅ Email открыт (нужен для интерфейса)
          role: newUser.role,
          is_active: newUser.is_active,
          is_email_verified: newUser.is_email_verified
        },
        request: {
          id: newPartnerRequest._id,
          business_name: newPartnerRequest.business_data.business_name, // ✅ Открыто
          category: newPartnerRequest.business_data.category, // ✅ Открыто
          status: newPartnerRequest.status,
          submitted_at: newPartnerRequest.submitted_at
          // 🚫 НЕ ВОЗВРАЩАЕМ зашифрованные данные в ответе
        },
        profile: {
          id: newPartnerProfile._id,
          business_name: newPartnerProfile.business_name,
          category: newPartnerProfile.category,
          approval_status: newPartnerProfile.approval_status,
          is_approved: newPartnerProfile.is_approved,
          is_active: newPartnerProfile.is_active
        },
        token
      };
    });

  } catch (error) {
    console.error('Register partner with initial request error:', error);
    throw error;
  }
};

/**
 * ✅ ОБНОВЛЕННОЕ получение статуса личного кабинета партнера
 * 🔓 Теперь учитывает PartnerProfile и показывает полную картину
 */
export const getPartnerDashboardStatus = async (userId) => {
  try {
    // Получаем первичную заявку партнера
    const request = await InitialPartnerRequest.findOne({ user_id: userId });
    
    if (!request) {
      return {
        hasRequest: false,
        dashboard_state: 'no_request',
        message: 'Заявка на партнерство не найдена',
        can_access_features: false,
        show_legal_form: false,
        admin_action_needed: false
      };
    }

    // 🆕 ПРОВЕРЯЕМ ТАКЖЕ PARTNERPROFILE
    const { PartnerProfile } = await import('../models/index.js');
    const profile = await PartnerProfile.findOne({ user_id: userId });

    // Конфигурация статусов для личного кабинета
    const statusConfig = {
      'pending': {
        dashboard_state: 'awaiting_approval',
        message: 'Ваша заявка на рассмотрении у администратора',
        can_access_features: false,
        show_legal_form: false,
        admin_action_needed: true,
        profile_exists: !!profile,
        profile_status: profile?.approval_status || 'not_created'
      },
      'approved': {
        dashboard_state: 'need_legal_info',
        message: 'Заявка одобрена! Заполните юридические данные',
        can_access_features: false,
        show_legal_form: true, // 🎯 ПОКАЗАТЬ ФОРМУ ИЗОБРАЖЕНИЯ 2
        admin_action_needed: false,
        profile_exists: !!profile,
        profile_status: profile?.approval_status || 'awaiting_legal_info'
      },
      'awaiting_legal_info': {
        dashboard_state: 'need_legal_info',
        message: 'Необходимо заполнить юридические данные',
        can_access_features: false,
        show_legal_form: true,
        admin_action_needed: false,
        profile_exists: !!profile,
        profile_status: profile?.approval_status || 'awaiting_legal_info'
      },
      'under_review': {
        dashboard_state: 'legal_review',
        message: 'Юридические данные на проверке',
        can_access_features: false,
        show_legal_form: false,
        admin_action_needed: true,
        profile_exists: !!profile,
        profile_status: profile?.approval_status || 'under_review'
      },
      'completed': {
        dashboard_state: 'active_partner',
        message: 'Добро пожаловать! Все функции доступны',
        can_access_features: true, // 🎉 ВСЁ ДОСТУПНО
        show_legal_form: false,
        admin_action_needed: false,
        profile_exists: !!profile,
        profile_status: profile?.approval_status || 'approved'
      },
      'rejected': {
        dashboard_state: 'rejected',
        message: 'Заявка отклонена',
        can_access_features: false,
        show_legal_form: false,
        admin_action_needed: false,
        rejection_reason: request.review_info?.rejection_reason,
        profile_exists: !!profile,
        profile_status: profile?.approval_status || 'rejected'
      }
    };

    const config = statusConfig[request.status] || statusConfig['pending'];

    return {
      hasRequest: true,
      request_id: request._id,
      status: request.status,
      
      // ✅ БЕЗОПАСНО: показываем только открытые данные
      business_name: request.business_data.business_name,
      category: request.business_data.category,
      submitted_at: request.submitted_at,
      
      // 🆕 ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ПРОФИЛЕ
      profile_id: profile?._id,
      has_profile: !!profile,
      
      // 🔓 РАСШИФРОВЫВАЕМ только для владельца (в контроллере проверяем права)
      // phone будет расшифрован отдельной функцией при необходимости
      
      ...config
    };

  } catch (error) {
    console.error('Get partner dashboard status error:', error);
    throw error;
  }
};

/**
 * 🔓 БЕЗОПАСНАЯ расшифровка данных партнера (только для владельца/админа)
 * @param {string} userId - ID пользователя  
 * @param {string} requesterId - ID того, кто запрашивает данные
 * @param {string} requesterRole - Роль запрашивающего
 * @returns {object} - Расшифрованные данные или ошибка доступа
 */
export const getDecryptedPartnerData = async (userId, requesterId, requesterRole) => {
  try {
    // Проверяем права доступа
    const hasAccess = (
      requesterRole === 'admin' || // Админ может все
      userId === requesterId // Владелец может свои данные
    );

    if (!hasAccess) {
      throw new Error('Нет прав для просмотра персональных данных');
    }

    const request = await InitialPartnerRequest.findOne({ user_id: userId });
    if (!request) {
      throw new Error('Заявка не найдена');
    }

    // 🔓 РАСШИФРОВЫВАЕМ чувствительные данные
    const decryptedData = {
      personal_data: {
        first_name: request.personal_data.first_name,
        last_name: request.personal_data.last_name,
        phone: decryptString(request.personal_data.phone), // 🔓 РАСШИФРОВАЛИ
        email: request.personal_data.email
      },
      business_data: {
        ...request.business_data.toObject(),
        address: decryptString(request.business_data.address), // 🔓 РАСШИФРОВАЛИ
        phone: decryptString(request.business_data.phone), // 🔓 РАСШИФРОВАЛИ
        email: decryptString(request.business_data.email), // 🔓 РАСШИФРОВАЛИ
        floor_unit: request.business_data.floor_unit ? 
          decryptString(request.business_data.floor_unit) : null // 🔓 РАСШИФРОВАЛИ
      }
    };

    return decryptedData;

  } catch (error) {
    console.error('Get decrypted partner data error:', error);
    throw error;
  }
};

/**
 * ✅ Проверка может ли партнер получить доступ к функциям
 */
export const checkPartnerAccess = async (userId, feature) => {
  try {
    const status = await getPartnerDashboardStatus(userId);
    
    // Список функций которые доступны только после полного одобрения
    const restrictedFeatures = [
      'menu_management',
      'order_management', 
      'analytics',
      'profile_editing',
      'financial_reports',
      'profile_viewing' // 🆕 ДОБАВИЛИ
    ];

    if (restrictedFeatures.includes(feature)) {
      return {
        has_access: status.can_access_features || false,
        reason: status.can_access_features 
          ? null 
          : 'Функция будет доступна после одобрения документов'
      };
    }

    // Базовые функции доступны всегда
    return {
      has_access: true,
      reason: null
    };

  } catch (error) {
    console.error('Check partner access error:', error);
    return {
      has_access: false,
      reason: 'Ошибка проверки доступа'
    };
  }
};

/**
 * 🔐 БЕЗОПАСНАЯ ФУНКЦИЯ: Шифрование юридических данных
 * Используется при подаче документов (этап 2)
 */
export const encryptLegalData = (legalData) => {
  return {
    // 🔐 ВСЕ ЮРИДИЧЕСКИЕ ДАННЫЕ ШИФРУЕМ
    legal_name: cryptoString(legalData.legal_name),
    siret_number: cryptoString(legalData.siret_number),
    legal_form: legalData.legal_form, // ✅ Форма собственности не критична
    business_address: cryptoString(legalData.business_address),
    contact_person: legalData.contact_person, // ✅ Имя не критично
    contact_phone: cryptoString(legalData.contact_phone),
    bank_details: legalData.bank_details ? cryptoString(legalData.bank_details) : null,
    tax_number: legalData.tax_number ? cryptoString(legalData.tax_number) : null,
    additional_info: legalData.additional_info || null
  };
};