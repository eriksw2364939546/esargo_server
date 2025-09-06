// models/CustomerProfile.model.js - ИСПРАВЛЕННАЯ модель без дублирования
import mongoose from 'mongoose';

// Удаляем модель если она уже существует (предотвращение дублирования)
if (mongoose.models.CustomerProfile) {
  delete mongoose.models.CustomerProfile;
}

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
  
  // Система сохраненных адресов ESARGO
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
      apartment: {
        type: String,
        trim: true,
        maxlength: 20,
        default: ''
      },
      entrance: {
        type: String,
        trim: true,
        maxlength: 10,
        default: ''
      },
      intercom: {
        type: String,
        trim: true,
        maxlength: 20,
        default: ''
      },
      floor: {
        type: String,
        trim: true,
        maxlength: 10,
        default: ''
      },
      delivery_notes: {
        type: String,
        trim: true,
        maxlength: 200,
        default: ''
      }
    },
    
    // Информация о доставке ESARGO
    delivery_info: {
      zone: {
        type: Number,
        enum: [1, 2], // Зона 1: 0-5км, Зона 2: 5-10км
        index: true
      },
      estimated_distance_km: {
        type: Number,
        min: 0,
        max: 15
      },
      order_count: {
        type: Number,
        default: 0,
        min: 0
      },
      last_used_at: {
        type: Date
      }
    },
    
    // Валидация адреса
    validation: {
      is_validated: {
        type: Boolean,
        default: false
      },
      validated_at: {
        type: Date
      },
      validation_method: {
        type: String,
        enum: ['mock', 'google_maps', 'manual'],
        default: 'mock'
      }
    },
    
    // Метки времени
    created_at: {
      type: Date,
      default: Date.now
    },
    updated_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Предпочтения клиента
  preferences: {
    language: {
      type: String,
      enum: ['ru', 'fr', 'en'],
      default: 'fr'
    },
    marketing_consent: {
      type: Boolean,
      default: false
    },
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
    delivery_preferences: {
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
  timestamps: true
  // НЕ указываем collection - позволяем Mongoose генерировать автоматически
});

// ИНДЕКСЫ
customerProfileSchema.index({ user_id: 1 }, { unique: true });
customerProfileSchema.index({ phone: 1 });
customerProfileSchema.index({ is_active: 1 });
customerProfileSchema.index({ 'saved_addresses.delivery_info.zone': 1 });
customerProfileSchema.index({ 'saved_addresses.is_default': 1 });

// ВИРТУАЛЬНЫЕ ПОЛЯ
customerProfileSchema.virtual('full_name').get(function() {
  if (this.first_name && this.last_name) {
    return `${this.first_name} ${this.last_name}`;
  }
  return this.first_name || this.last_name || '';
});

customerProfileSchema.virtual('default_address').get(function() {
  return this.saved_addresses?.find(addr => addr.is_default) || null;
});

customerProfileSchema.virtual('addresses_count').get(function() {
  return this.saved_addresses?.length || 0;
});

// МЕТОДЫ ЭКЗЕМПЛЯРА
customerProfileSchema.methods.addAddress = function(addressData) {
  // Если это первый адрес, делаем его основным
  if (this.saved_addresses.length === 0) {
    addressData.is_default = true;
  }
  
  this.saved_addresses.push(addressData);
  return this.save();
};

customerProfileSchema.methods.updateOrderStats = function(orderData) {
  this.order_stats.total_orders += 1;
  this.order_stats.total_spent += orderData.total_price || 0;
  
  if (orderData.delivery_zone === 1) {
    this.order_stats.delivery_stats.zone_1_orders += 1;
  } else if (orderData.delivery_zone === 2) {
    this.order_stats.delivery_stats.zone_2_orders += 1;
  }
  
  if (orderData.delivery_fee) {
    this.order_stats.delivery_stats.total_delivery_fees_paid += orderData.delivery_fee;
  }
  
  if (orderData.delivery_distance_km) {
    const totalOrders = this.order_stats.total_orders;
    const currentAvg = this.order_stats.delivery_stats.avg_delivery_distance || 0;
    this.order_stats.delivery_stats.avg_delivery_distance = 
      ((currentAvg * (totalOrders - 1)) + orderData.delivery_distance_km) / totalOrders;
  }
};

customerProfileSchema.methods.setDefaultAddress = function(addressId) {
  this.saved_addresses.forEach(addr => {
    addr.is_default = false;
  });
  
  const targetAddress = this.saved_addresses.id(addressId);
  if (targetAddress) {
    targetAddress.is_default = true;
    return true;
  }
  
  return false;
};

// MIDDLEWARE
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

customerProfileSchema.pre('save', function(next) {
  const defaultAddresses = this.saved_addresses.filter(addr => addr.is_default);
  
  if (defaultAddresses.length > 1) {
    this.saved_addresses.forEach((addr, index) => {
      addr.is_default = (index === 0);
    });
  }
  
  next();
});

// НАСТРОЙКИ JSON
customerProfileSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    
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

// БЕЗОПАСНАЯ РЕГИСТРАЦИЯ МОДЕЛИ
const CustomerProfile = mongoose.models.CustomerProfile || mongoose.model('CustomerProfile', customerProfileSchema);
export default CustomerProfile;