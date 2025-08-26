// models/CustomerProfile.model.js (убрана валидация)
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
  
  // Сохраненные адреса доставки
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
  
  // Настройки пользователя
  settings: {
    notifications_enabled: {
      type: Boolean,
      default: true
    },
    preferred_language: {
      type: String,
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

// Индексы для оптимизации
customerProfileSchema.index({ user_id: 1 }, { unique: true });
customerProfileSchema.index({ phone: 1 });
customerProfileSchema.index({ is_active: 1 });

// Виртуальное поле для полного имени
customerProfileSchema.virtual('full_name').get(function() {
  if (this.first_name && this.last_name) {
    return `${this.first_name} ${this.last_name}`;
  }
  return this.first_name || this.last_name || '';
});

// Включаем виртуальные поля в JSON
customerProfileSchema.set('toJSON', { virtuals: true });
customerProfileSchema.set('toObject', { virtuals: true });

export default mongoose.model('CustomerProfile', customerProfileSchema);