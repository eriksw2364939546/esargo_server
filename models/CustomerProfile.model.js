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

// 🆕 ДОБАВЛЕНО: Метод для добавления адреса доставки
customerProfileSchema.methods.addDeliveryAddress = async function(addressData) {
  try {
    const { label, address, lat, lng, is_default } = addressData;
    
    // Если новый адрес должен быть основным, убираем флаг с других
    if (is_default) {
      this.delivery_addresses.forEach(addr => {
        addr.is_default = false;
      });
    }
    
    // Если это первый адрес, делаем его основным автоматически
    if (this.delivery_addresses.length === 0) {
      addressData.is_default = true;
    }
    
    // Добавляем новый адрес
    this.delivery_addresses.push({
      label,
      address,
      lat,
      lng,
      is_default: addressData.is_default || false
    });
    
    return await this.save();
  } catch (error) {
    console.error('Add delivery address method error:', error);
    throw error;
  }
};

// 🆕 ДОБАВЛЕНО: Метод для обновления адреса доставки
customerProfileSchema.methods.updateDeliveryAddress = async function(addressId, updateData) {
  try {
    const address = this.delivery_addresses.id(addressId);
    if (!address) {
      throw new Error('Адрес не найден');
    }
    
    // Обновляем поля
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        address[key] = updateData[key];
      }
    });
    
    // Если адрес стал основным, убираем флаг с других
    if (updateData.is_default) {
      this.delivery_addresses.forEach(addr => {
        if (!addr._id.equals(addressId)) {
          addr.is_default = false;
        }
      });
    }
    
    return await this.save();
  } catch (error) {
    console.error('Update delivery address method error:', error);
    throw error;
  }
};

// 🆕 ДОБАВЛЕНО: Метод для удаления адреса доставки
customerProfileSchema.methods.removeDeliveryAddress = async function(addressId) {
  try {
    const address = this.delivery_addresses.id(addressId);
    if (!address) {
      throw new Error('Адрес не найден');
    }
    
    const wasDefault = address.is_default;
    
    // Удаляем адрес
    this.delivery_addresses.pull(addressId);
    
    // Если удаленный адрес был основным и остались другие адреса
    if (wasDefault && this.delivery_addresses.length > 0) {
      this.delivery_addresses[0].is_default = true;
    }
    
    return await this.save();
  } catch (error) {
    console.error('Remove delivery address method error:', error);
    throw error;
  }
};

// 🆕 ДОБАВЛЕНО: Метод для добавления в избранное
customerProfileSchema.methods.addToFavorites = async function(partnerId) {
  try {
    if (!this.favorites.includes(partnerId)) {
      this.favorites.push(partnerId);
      await this.save();
    }
    return this;
  } catch (error) {
    console.error('Add to favorites error:', error);
    throw error;
  }
};

// 🆕 ДОБАВЛЕНО: Метод для удаления из избранного
customerProfileSchema.methods.removeFromFavorites = async function(partnerId) {
  try {
    this.favorites.pull(partnerId);
    await this.save();
    return this;
  } catch (error) {
    console.error('Remove from favorites error:', error);
    throw error;
  }
};

// 🆕 ДОБАВЛЕНО: Метод для обновления статистики заказов
customerProfileSchema.methods.updateOrderStats = async function(orderAmount, rating = null) {
  try {
    this.order_stats.total_orders += 1;
    this.order_stats.total_spent += orderAmount;
    
    // Обновляем средний рейтинг если предоставлен
    if (rating !== null) {
      const currentTotal = this.order_stats.avg_rating_given * (this.order_stats.total_orders - 1);
      this.order_stats.avg_rating_given = (currentTotal + rating) / this.order_stats.total_orders;
    }
    
    await this.save();
    return this;
  } catch (error) {
    console.error('Update order stats error:', error);
    throw error;
  }
};

// 🆕 ДОБАВЛЕНО: Статический метод для поиска по user_id
customerProfileSchema.statics.findByUserId = function(userId) {
  return this.findOne({ user_id: userId });
};

// 🆕 ДОБАВЛЕНО: Статический метод для поиска активных профилей
customerProfileSchema.statics.findActive = function() {
  return this.find({ is_active: true });
};

// 🆕 ДОБАВЛЕНО: Статический метод для поиска по имени
customerProfileSchema.statics.findByName = function(searchQuery) {
  const regex = new RegExp(searchQuery, 'i');
  return this.find({
    $or: [
      { first_name: regex },
      { last_name: regex }
    ],
    is_active: true
  });
};

// Настройка виртуальных полей в JSON
customerProfileSchema.set('toJSON', { virtuals: true });
customerProfileSchema.set('toObject', { virtuals: true });

export default mongoose.model('CustomerProfile', customerProfileSchema);