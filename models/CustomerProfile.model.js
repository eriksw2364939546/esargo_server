// models/CustomerProfile.model.js (исправленный - ES6 modules)
import mongoose from 'mongoose';

const customerProfileSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  first_name: {
    type: String,
    required: true,
    trim: true
  },
  
  last_name: {
    type: String,
    required: true,
    trim: true
  },
  
  phone: {
    type: String,
    trim: true
  },
  
  avatar_url: {
    type: String
  },
  
  // Сохраненные адреса доставки
  delivery_addresses: [{
    label: {
      type: String,
      required: true,
      trim: true,
      enum: ['Дом', 'Работа', 'Другое']
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
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
  
  // Настройки пользователя
  settings: {
    notifications_enabled: {
      type: Boolean,
      default: true
    },
    preferred_language: {
      type: String,
      enum: ['ru', 'fr', 'en'],
      default: 'fr'
    },
    marketing_emails: {
      type: Boolean,
      default: false
    }
  },
  
  // Статистика заказов
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
    }
  },
  
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Индексы
customerProfileSchema.index({ user_id: 1 });
customerProfileSchema.index({ first_name: 1, last_name: 1 });
customerProfileSchema.index({ is_active: 1 });
customerProfileSchema.index({ 'order_stats.total_orders': -1 });

// Виртуальное поле для полного имени
customerProfileSchema.virtual('full_name').get(function() {
  return `${this.first_name} ${this.last_name}`;
});

// Метод для добавления адреса
customerProfileSchema.methods.addDeliveryAddress = function(addressData) {
  // Если это первый адрес или помечен как основной
  if (this.delivery_addresses.length === 0 || addressData.is_default) {
    // Убираем флаг default с других адресов
    this.delivery_addresses.forEach(addr => {
      addr.is_default = false;
    });
    addressData.is_default = true;
  }
  
  this.delivery_addresses.push(addressData);
  return this.save();
};

// Метод для добавления в избранное
customerProfileSchema.methods.addToFavorites = function(partnerId) {
  if (!this.favorites.includes(partnerId)) {
    this.favorites.push(partnerId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Метод для удаления из избранного
customerProfileSchema.methods.removeFromFavorites = function(partnerId) {
  this.favorites = this.favorites.filter(id => !id.equals(partnerId));
  return this.save();
};

// Настройка виртуальных полей в JSON
customerProfileSchema.set('toJSON', { virtuals: true });
customerProfileSchema.set('toObject', { virtuals: true });

export default mongoose.model('CustomerProfile', customerProfileSchema);