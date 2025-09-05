// models/CustomerProfile.model.js - ОЧИЩЕННАЯ модель только с новой системой адресов ESARGO
import mongoose from 'mongoose';

const customerProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    unique: true
  },
  
  first_name: {
    type: String,
    trim: true,
    maxlength: 50
  },
  
  last_name: {
    type: String,
    trim: true,
    maxlength: 50
  },
  
  phone: {
    type: String,
    trim: true
  },
  
  avatar_url: {
    type: String,
    trim: true
  },
  
  // ✅ ЕДИНСТВЕННАЯ СИСТЕМА АДРЕСОВ: saved_addresses
  saved_addresses: [{
    // Основная информация об адресе
    address: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 300
    },
    
    // Координаты (обязательные для расчета доставки ESARGO)
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
    
    // Детальная информация для доставки
    details: {
      // Квартира/офис
      apartment: {
        type: String,
        trim: true,
        maxlength: 20,
        default: ''
      },
      
      // Подъезд
      entrance: {
        type: String,
        trim: true,
        maxlength: 10,
        default: ''
      },
      
      // Домофон
      intercom: {
        type: String,
        trim: true,
        maxlength: 20,
        default: ''
      },
      
      // Этаж
      floor: {
        type: String,
        trim: true,
        maxlength: 10,
        default: ''
      },
      
      // Заметки для курьера
      delivery_notes: {
        type: String,
        trim: true,
        maxlength: 200,
        default: ''
      }
    },
    
    // Информация о доставке ESARGO
    delivery_info: {
      // Зона доставки (1: 0-5км, 2: 5-10км)
      zone: {
        type: Number,
        enum: [1, 2],
        default: null
      },
      
      // Расстояние от центра Марселя
      estimated_distance_km: {
        type: Number,
        min: 0,
        max: 15,
        default: null
      },
      
      // Количество заказов с этого адреса
      order_count: {
        type: Number,
        default: 0,
        min: 0
      },
      
      // Последнее использование
      last_used_at: {
        type: Date,
        default: null
      }
    },
    
    // Валидация адреса
    validation: {
      // Проверен ли адрес
      is_validated: {
        type: Boolean,
        default: false
      },
      
      // Когда был проверен
      validated_at: {
        type: Date,
        default: null
      },
      
      // Метод проверки (mock_geocoding, google_maps, manual)
      validation_method: {
        type: String,
        enum: ['mock_geocoding', 'google_maps', 'manual'],
        default: 'mock_geocoding'
      }
    },
    
    // Временные метки
    created_at: {
      type: Date,
      default: Date.now
    },
    
    updated_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Настройки пользователя
  preferences: {
    // Язык интерфейса
    language: {
      type: String,
      enum: ['ru', 'fr', 'en'],
      default: 'fr'
    },
    
    // Уведомления
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    
    // Настройки адресов
    address_settings: {
      // Показывать подсказки адресов
      show_suggestions: {
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
  
  // Статистика заказов ESARGO
  order_stats: {
    total_orders: {
      type: Number,
      default: 0,
      min: 0
    },
    
    total_spent: {
      type: Number,
      default: 0,
      min: 0
    },
    
    avg_rating_given: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    
    // Статистика по зонам доставки ESARGO
    delivery_stats: {
      zone_1_orders: {
        type: Number,
        default: 0,
        min: 0
      },
      
      zone_2_orders: {
        type: Number,
        default: 0,
        min: 0
      },
      
      total_delivery_fees_paid: {
        type: Number,
        default: 0,
        min: 0
      },
      
      avg_delivery_distance: {
        type: Number,
        default: 0,
        min: 0
      },
      
      // ID любимого адреса (наиболее используемого)
      favorite_address_id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
      }
    }
  },
  
  // Активность профиля
  is_active: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'customer_profiles'
});

// ================ ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ ================

customerProfileSchema.index({ user_id: 1 }, { unique: true });
customerProfileSchema.index({ phone: 1 });
customerProfileSchema.index({ is_active: 1 });

// ✅ ИНДЕКСЫ ДЛЯ НОВОЙ СИСТЕМЫ АДРЕСОВ
customerProfileSchema.index({ 'saved_addresses.delivery_info.zone': 1 });
customerProfileSchema.index({ 'saved_addresses.is_default': 1 });
customerProfileSchema.index({ 'saved_addresses.validation.is_validated': 1 });

// Составной индекс для быстрого поиска активных профилей с адресами
customerProfileSchema.index({ 
  is_active: 1, 
  'saved_addresses.delivery_info.zone': 1 
});

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================

// Полное имя
customerProfileSchema.virtual('full_name').get(function() {
  if (this.first_name && this.last_name) {
    return `${this.first_name} ${this.last_name}`;
  }
  return this.first_name || this.last_name || '';
});

// Количество сохраненных адресов
customerProfileSchema.virtual('addresses_count').get(function() {
  return this.saved_addresses?.length || 0;
});

// Основная зона доставки клиента
customerProfileSchema.virtual('primary_delivery_zone').get(function() {
  const defaultAddress = this.getDefaultAddress();
  return defaultAddress?.delivery_info?.zone || null;
});

// Статус верификации адресов
customerProfileSchema.virtual('addresses_verified').get(function() {
  if (!this.saved_addresses?.length) return false;
  return this.saved_addresses.every(addr => addr.validation?.is_validated);
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * Получение основного адреса
 */
customerProfileSchema.methods.getDefaultAddress = function() {
  if (!this.saved_addresses?.length) return null;
  
  return this.saved_addresses.find(address => address.is_default) || 
         this.saved_addresses[0] || 
         null;
};

/**
 * Добавление нового адреса (используется в Address Service)
 */
customerProfileSchema.methods.addAddress = function(addressData) {
  // Проверяем лимит адресов (максимум 5)
  if (this.saved_addresses.length >= 5) {
    throw new Error('Максимальное количество адресов: 5');
  }
  
  // Определяем, будет ли адрес основным
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
      zone: addressData.zone || null,
      estimated_distance_km: addressData.estimated_distance_km || null,
      order_count: 0
    },
    validation: {
      is_validated: addressData.is_validated || false,
      validated_at: addressData.is_validated ? new Date() : null,
      validation_method: addressData.validation_method || 'mock_geocoding'
    }
  };
  
  this.saved_addresses.push(newAddress);
  return newAddress;
};

/**
 * Обновление статистики адреса после заказа
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
  
  // Помечаем как валидированный при первом заказе
  if (!address.validation.is_validated) {
    address.validation.is_validated = true;
    address.validation.validated_at = new Date();
    address.validation.validation_method = 'order_validated';
  }
  
  return true;
};

/**
 * Получение адресов в определенной зоне
 */
customerProfileSchema.methods.getAddressesByZone = function(zone) {
  return this.saved_addresses.filter(address => 
    address.delivery_info.zone === zone
  );
};

/**
 * Найти наиболее используемый адрес
 */
customerProfileSchema.methods.getMostUsedAddress = function() {
  if (!this.saved_addresses?.length) return null;
  
  return this.saved_addresses.reduce((mostUsed, current) => {
    const currentCount = current.delivery_info.order_count || 0;
    const mostUsedCount = mostUsed.delivery_info.order_count || 0;
    return currentCount > mostUsedCount ? current : mostUsed;
  });
};

/**
 * Обновление общей статистики заказов
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
  
  // Обновляем любимый адрес
  const mostUsedAddress = this.getMostUsedAddress();
  if (mostUsedAddress) {
    this.order_stats.delivery_stats.favorite_address_id = mostUsedAddress._id;
  }
};

/**
 * Установка основного адреса
 */
customerProfileSchema.methods.setDefaultAddress = function(addressId) {
  // Снимаем флаг со всех адресов
  this.saved_addresses.forEach(addr => {
    addr.is_default = false;
  });
  
  // Устанавливаем новый основной адрес
  const targetAddress = this.saved_addresses.id(addressId);
  if (targetAddress) {
    targetAddress.is_default = true;
    return true;
  }
  
  return false;
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

/**
 * Поиск клиентов по зоне доставки
 */
customerProfileSchema.statics.findByDeliveryZone = function(zone) {
  return this.find({
    'saved_addresses.delivery_info.zone': zone,
    is_active: true
  });
};

/**
 * Статистика использования зон доставки
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

/**
 * Получение невалидированных адресов
 */
customerProfileSchema.statics.findUnvalidatedAddresses = function() {
  return this.find({
    'saved_addresses.validation.is_validated': false,
    is_active: true
  });
};

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

// Валидация: только один основной адрес
customerProfileSchema.pre('save', function(next) {
  const defaultAddresses = this.saved_addresses.filter(addr => addr.is_default);
  
  if (defaultAddresses.length > 1) {
    // Оставляем только первый как основной
    this.saved_addresses.forEach((addr, index) => {
      addr.is_default = (index === 0);
    });
  }
  
  next();
});

// ================ НАСТРОЙКИ JSON ================

customerProfileSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // ✅ УБИРАЕМ СТАРЫЕ ПОЛЯ ИЗ JSON ПОЛНОСТЬЮ
    delete ret.delivery_addresses; // Старое поле (если есть)
    delete ret.__v;
    
    // Добавляем полезную информацию
    ret.addresses_summary = {
      total_count: ret.saved_addresses?.length || 0,
      validated_count: ret.saved_addresses?.filter(a => a.validation?.is_validated).length || 0,
      default_address_id: ret.saved_addresses?.find(a => a.is_default)?._id || null,
      zones_used: [...new Set(ret.saved_addresses?.map(a => a.delivery_info?.zone).filter(Boolean))] || []
    };
    
    return ret;
  }
});

customerProfileSchema.set('toObject', { virtuals: true });

export default mongoose.model('CustomerProfile', customerProfileSchema);