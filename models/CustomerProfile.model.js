// models/CustomerProfile.model.js - УЛУЧШЕННАЯ модель с расширенными адресами для ESARGO
import mongoose from 'mongoose';

const customerProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  first_name: {
    type: String
  },
  
  last_name: {
    type: String
  },
  
  phone: {
    type: String
  },
  
  avatar_url: {
    type: String
  },
  
  // ✅ УЛУЧШЕННАЯ СТРУКТУРА: Сохраненные адреса доставки для ESARGO
  saved_addresses: [{
    // Основная информация об адресе
    address: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 200
    },
    
    // Координаты (обязательные для расчета доставки)
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    
    // Название адреса для удобства
    name: {
      type: String,
      required: true,
      trim: true,
      enum: ['Дом', 'Работа', 'Родители', 'Друзья', 'Другое'],
      default: 'Дом'
    },
    
    // Основной адрес по умолчанию
    is_default: {
      type: Boolean,
      default: false
    },
    
    // ✅ НОВЫЕ ПОЛЯ для детальной доставки
    details: {
      // Квартира/офис
      apartment: {
        type: String,
        trim: true,
        maxlength: 20
      },
      
      // Подъезд
      entrance: {
        type: String,
        trim: true,
        maxlength: 10
      },
      
      // Домофон
      intercom: {
        type: String,
        trim: true,
        maxlength: 20
      },
      
      // Этаж
      floor: {
        type: String,
        trim: true,
        maxlength: 10
      },
      
      // Заметки для курьера
      delivery_notes: {
        type: String,
        trim: true,
        maxlength: 200
      }
    },
    
    // ✅ НОВЫЕ ПОЛЯ для системы доставки
    delivery_info: {
      // Зона доставки (будет рассчитываться автоматически)
      zone: {
        type: Number,
        enum: [1, 2], // Зона 1: 0-5км, Зона 2: 5-10км
        index: true
      },
      
      // Примерное расстояние от центра (будет обновляться)
      estimated_distance_km: {
        type: Number,
        min: 0,
        max: 10
      },
      
      // Последний раз адрес использовался для заказа
      last_used_at: {
        type: Date
      },
      
      // Количество заказов на этот адрес
      order_count: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    
    // Метаданные
    created_at: {
      type: Date,
      default: Date.now
    },
    updated_at: {
      type: Date,
      default: Date.now
    },
    
    // Валидация адреса через Google Maps
    validation: {
      is_validated: {
        type: Boolean,
        default: false
      },
      validated_at: {
        type: Date
      },
      formatted_address: {
        type: String // Отформатированный адрес от Google
      },
      place_id: {
        type: String // Google Places ID для точности
      }
    }
  }],
  
  // Сохраняем старое поле для совместимости
  delivery_addresses: [{
    label: {
      type: String
    },
    address: {
      type: String
    },
    lat: {
      type: Number
    },
    lng: {
      type: Number
    },
    is_default: {
      type: Boolean,
      default: false
    }
  }],
  
  // Избранные партнеры
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartnerProfile'
  }],
  
  // ✅ РАСШИРЕННЫЕ НАСТРОЙКИ пользователя
  settings: {
    notifications_enabled: {
      type: Boolean,
      default: true
    },
    preferred_language: {
      type: String,
      default: 'fr',
      enum: ['fr', 'en', 'ru']
    },
    marketing_emails: {
      type: Boolean,
      default: false
    },
    
    // ✅ НОВЫЕ НАСТРОЙКИ для доставки
    delivery_preferences: {
      // Предпочитаемое время доставки
      preferred_time_slots: [{
        type: String,
        enum: ['morning', 'afternoon', 'evening'] // утро, день, вечер
      }],
      
      // Предупреждать о часах пик
      notify_peak_hours: {
        type: Boolean,
        default: true
      },
      
      // Автоматически выбирать ближайший адрес
      auto_select_nearest: {
        type: Boolean,
        default: false
      },
      
      // Сохранять новые адреса автоматически
      auto_save_addresses: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // ✅ РАСШИРЕННАЯ СТАТИСТИКА заказов
  order_stats: {
    total_orders: {
      type: Number,
      default: 0
    },
    total_spent: {
      type: Number,
      default: 0
    },
    avg_rating_given: {
      type: Number,
      default: 0
    },
    
    // ✅ НОВАЯ СТАТИСТИКА по зонам доставки
    delivery_stats: {
      zone_1_orders: {
        type: Number,
        default: 0
      },
      zone_2_orders: {
        type: Number,
        default: 0
      },
      total_delivery_fees_paid: {
        type: Number,
        default: 0
      },
      avg_delivery_distance: {
        type: Number,
        default: 0
      },
      favorite_address_id: {
        type: mongoose.Schema.Types.ObjectId
      }
    }
  },
  
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ ================
customerProfileSchema.index({ user_id: 1 }, { unique: true });
customerProfileSchema.index({ phone: 1 });
customerProfileSchema.index({ is_active: 1 });
customerProfileSchema.index({ 'saved_addresses.delivery_info.zone': 1 }); // ✅ НОВЫЙ ИНДЕКС
customerProfileSchema.index({ 'saved_addresses.is_default': 1 }); // ✅ НОВЫЙ ИНДЕКС

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * ✅ НОВЫЙ МЕТОД: Получение основного адреса
 */
customerProfileSchema.methods.getDefaultAddress = function() {
  return this.saved_addresses.find(address => address.is_default) || 
         this.saved_addresses[0] || 
         null;
};

/**
 * ✅ НОВЫЙ МЕТОД: Добавление нового адреса
 */
customerProfileSchema.methods.addAddress = function(addressData) {
  // Проверяем лимит адресов (максимум 5)
  if (this.saved_addresses.length >= 5) {
    throw new Error('Максимальное количество адресов: 5');
  }
  
  // Если это первый адрес или явно указан как основной
  const isFirstAddress = this.saved_addresses.length === 0;
  const isDefault = isFirstAddress || addressData.is_default;
  
  // Если новый адрес основной, снимаем флаг с остальных
  if (isDefault) {
    this.saved_addresses.forEach(addr => {
      addr.is_default = false;
    });
  }
  
  const newAddress = {
    address: addressData.address,
    lat: addressData.lat,
    lng: addressData.lng,
    name: addressData.name || 'Дом',
    is_default: isDefault,
    details: addressData.details || {},
    delivery_info: {
      zone: null, // Будет рассчитан позже
      estimated_distance_km: null,
      order_count: 0
    },
    validation: {
      is_validated: false
    }
  };
  
  this.saved_addresses.push(newAddress);
  return newAddress;
};

/**
 * ✅ НОВЫЙ МЕТОД: Обновление статистики адреса после заказа
 */
customerProfileSchema.methods.updateAddressStats = function(addressId, orderData) {
  const address = this.saved_addresses.id(addressId);
  if (!address) return false;
  
  address.delivery_info.last_used_at = new Date();
  address.delivery_info.order_count += 1;
  
  // Обновляем зону и расстояние если есть данные
  if (orderData.delivery_zone) {
    address.delivery_info.zone = orderData.delivery_zone;
  }
  if (orderData.delivery_distance_km) {
    address.delivery_info.estimated_distance_km = orderData.delivery_distance_km;
  }
  
  return true;
};

/**
 * ✅ НОВЫЙ МЕТОД: Получение адресов в определенной зоне
 */
customerProfileSchema.methods.getAddressesByZone = function(zone) {
  return this.saved_addresses.filter(address => 
    address.delivery_info.zone === zone
  );
};

/**
 * ✅ НОВЫЙ МЕТОД: Найти ближайший адрес (по количеству использований)
 */
customerProfileSchema.methods.getMostUsedAddress = function() {
  if (this.saved_addresses.length === 0) return null;
  
  return this.saved_addresses.reduce((mostUsed, current) => {
    const currentCount = current.delivery_info.order_count || 0;
    const mostUsedCount = mostUsed.delivery_info.order_count || 0;
    return currentCount > mostUsedCount ? current : mostUsed;
  });
};

/**
 * ✅ НОВЫЙ МЕТОД: Обновление общей статистики заказов
 */
customerProfileSchema.methods.updateOrderStats = function(orderData) {
  this.order_stats.total_orders += 1;
  this.order_stats.total_spent += orderData.total_price || 0;
  
  // Обновляем статистику по зонам
  if (orderData.delivery_zone === 1) {
    this.order_stats.delivery_stats.zone_1_orders += 1;
  } else if (orderData.delivery_zone === 2) {
    this.order_stats.delivery_stats.zone_2_orders += 1;
  }
  
  // Обновляем статистику доставки
  if (orderData.delivery_fee) {
    this.order_stats.delivery_stats.total_delivery_fees_paid += orderData.delivery_fee;
  }
  
  // Пересчитываем среднее расстояние доставки
  if (orderData.delivery_distance_km) {
    const totalOrders = this.order_stats.total_orders;
    const currentAvg = this.order_stats.delivery_stats.avg_delivery_distance || 0;
    this.order_stats.delivery_stats.avg_delivery_distance = 
      ((currentAvg * (totalOrders - 1)) + orderData.delivery_distance_km) / totalOrders;
  }
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

/**
 * ✅ НОВЫЙ МЕТОД: Поиск клиентов по зоне доставки
 */
customerProfileSchema.statics.findByDeliveryZone = function(zone) {
  return this.find({
    'saved_addresses.delivery_info.zone': zone,
    is_active: true
  });
};

/**
 * ✅ НОВЫЙ МЕТОД: Статистика использования зон доставки
 */
customerProfileSchema.statics.getZoneUsageStats = function() {
  return this.aggregate([
    { $match: { is_active: true } },
    { $unwind: '$saved_addresses' },
    {
      $group: {
        _id: '$saved_addresses.delivery_info.zone',
        total_addresses: { $sum: 1 },
        total_orders: { $sum: '$saved_addresses.delivery_info.order_count' },
        avg_distance: { $avg: '$saved_addresses.delivery_info.estimated_distance_km' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================

// Виртуальное поле для полного имени
customerProfileSchema.virtual('full_name').get(function() {
  if (this.first_name && this.last_name) {
    return `${this.first_name} ${this.last_name}`;
  }
  return this.first_name || this.last_name || '';
});

// ✅ НОВОЕ ВИРТУАЛЬНОЕ ПОЛЕ: Количество сохраненных адресов
customerProfileSchema.virtual('addresses_count').get(function() {
  return this.saved_addresses.length;
});

// ✅ НОВОЕ ВИРТУАЛЬНОЕ ПОЛЕ: Основная зона доставки клиента
customerProfileSchema.virtual('primary_delivery_zone').get(function() {
  const defaultAddress = this.getDefaultAddress();
  return defaultAddress ? defaultAddress.delivery_info.zone : null;
});

// ================ MIDDLEWARE ================

// Middleware для обновления updated_at при изменении адресов
customerProfileSchema.pre('save', function(next) {
  if (this.isModified('saved_addresses')) {
    this.saved_addresses.forEach(address => {
      if (address.isModified() && !address.isNew) {
        address.updated_at = new Date();
      }
    });
  }
  next();
});

// Включаем виртуальные поля в JSON
customerProfileSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Удаляем поле delivery_addresses из JSON (оставляем только saved_addresses)
    delete ret.delivery_addresses;
    return ret;
  }
});
customerProfileSchema.set('toObject', { virtuals: true });

export default mongoose.model('CustomerProfile', customerProfileSchema);