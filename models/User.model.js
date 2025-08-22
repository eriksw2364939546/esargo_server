// models/User.model.js (ФИНАЛЬНАЯ БЕЗОПАСНАЯ ВЕРСИЯ)
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // 🔐 EMAIL ЗАШИФРОВАН для безопасного хранения
  email: {
    type: String, // 🔐 ЗАШИФРОВАННЫЙ EMAIL
    required: true
    // 🔐 УБИРАЕМ ВСЕ ИНДЕКСЫ И ОГРАНИЧЕНИЯ - поиск только через Meta!
    // unique: true,
    // lowercase: true, 
    // trim: true,
    // index: true
  },
  
  password_hash: {
    type: String,
    required: true
  },
  
  // Роль пользователя
  role: {
    type: String,
    enum: ['customer', 'partner', 'courier', 'admin', 'manager', 'owner'],
    default: 'customer',
    index: true
  },
  
  // Статус аккаунта
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  is_email_verified: {
    type: Boolean,
    default: false
  },
  
  // GDPR согласие
  gdpr_consent: {
    data_processing: {
      type: Boolean,
      default: false
    },
    marketing: {
      type: Boolean,
      default: false
    },
    analytics: {
      type: Boolean,
      default: false
    },
    consent_date: {
      type: Date,
      default: Date.now
    }
  },
  
  // Информация о регистрации
  registration_source: {
    type: String,
    enum: ['web', 'mobile', 'admin'],
    default: 'web'
  },
  
  registration_ip: {
    type: String
  },
  
  user_agent: {
    type: String
  },
  
  // Система попыток входа
  login_attempts: {
    count: {
      type: Number,
      default: 0
    },
    last_attempt: {
      type: Date
    },
    blocked_until: {
      type: Date
    }
  },
  
  // Активность
  last_login_at: {
    type: Date
  },
  
  last_activity_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 🔐 ИНДЕКСЫ БЕЗ EMAIL - поиск только через Meta
userSchema.index({ role: 1, is_active: 1 });
userSchema.index({ last_activity_at: -1 });

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

// Метод сравнения паролей
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    const { comparePassword } = await import('../utils/hash.js');
    return await comparePassword(candidatePassword, this.password_hash);
  } catch (error) {
    console.error('Password comparison error in User model:', error);
    return false;
  }
};

// 🔐 МЕТОД ДЛЯ ПОЛУЧЕНИЯ РАСШИФРОВАННОГО EMAIL (для админов)
userSchema.methods.getDecryptedEmail = function() {
  try {
    const { decryptString } = require('../utils/crypto.js');
    return decryptString(this.email);
  } catch (error) {
    console.error('Email decryption error:', error);
    return '[EMAIL_DECRYPT_ERROR]';
  }
};

// Увеличение счетчика неудачных попыток
userSchema.methods.incrementLoginAttempts = function() {
  this.login_attempts.count += 1;
  this.login_attempts.last_attempt = new Date();
  
  if (this.login_attempts.count >= 5) {
    this.login_attempts.blocked_until = new Date(Date.now() + 15 * 60 * 1000);
  }
  
  return this.save();
};

// Сброс счетчика попыток
userSchema.methods.resetLoginAttempts = function() {
  this.login_attempts.count = 0;
  this.login_attempts.last_attempt = undefined;
  this.login_attempts.blocked_until = undefined;
  this.last_login_at = new Date();
  this.last_activity_at = new Date();
  
  return this.save();
};

// Проверка заблокирован ли аккаунт
userSchema.methods.isAccountLocked = function() {
  return this.login_attempts.blocked_until && 
         this.login_attempts.blocked_until > new Date();
};

// Проверка ролей
userSchema.methods.hasRole = function(role) {
  if (Array.isArray(role)) {
    return role.includes(this.role);
  }
  return this.role === role;
};

// Проверка админских ролей
userSchema.methods.isAdmin = function() {
  return this.hasRole(['admin', 'manager', 'owner']);
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

// 🔐 УБИРАЕМ ПОИСК ПО EMAIL - только через Meta!
// userSchema.statics.findByEmail = function(email) {
//   throw new Error('Email search not allowed. Use Meta.findByEmailAndRole() instead');
// };

// Поиск активных пользователей
userSchema.statics.findActive = function() {
  return this.find({ is_active: true });
};

// Поиск по роли
userSchema.statics.findByRole = function(role) {
  return this.find({ role, is_active: true });
};

// ================ ВИРТУАЛЬНЫЕ ПОЛЯ ================

userSchema.virtual('customerProfile', {
  ref: 'CustomerProfile',
  localField: '_id',
  foreignField: 'user_id',
  justOne: true
});

userSchema.virtual('partnerProfile', {
  ref: 'PartnerProfile',
  localField: '_id',
  foreignField: 'user_id',
  justOne: true
});

userSchema.virtual('courierProfile', {
  ref: 'CourierProfile',
  localField: '_id',
  foreignField: 'user_id',
  justOne: true
});

// ✅ НАСТРОЙКА БЕЗОПАСНОГО JSON ВЫВОДА
userSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // 🔐 ПОЛНОСТЬЮ СКРЫВАЕМ ЗАШИФРОВАННЫЕ ДАННЫЕ
    delete ret.password_hash;
    delete ret.email; // Зашифрованный email скрыт
    
    // Оставляем только безопасные поля
    return {
      id: ret._id,
      role: ret.role,
      is_active: ret.is_active,
      is_email_verified: ret.is_email_verified,
      created_at: ret.createdAt,
      updated_at: ret.updatedAt,
      last_login_at: ret.last_login_at,
      registration_source: ret.registration_source
    };
  }
});

userSchema.set('toObject', { virtuals: true });

export default mongoose.model('User', userSchema);