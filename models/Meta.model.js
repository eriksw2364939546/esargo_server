// models/Meta.model.js
const mongoose = require('mongoose');

const metaSchema = new mongoose.Schema({
  // Ссылки на пользователей в зависимости от роли
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  partner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    default: null
  },
  
  courier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser', // Ссылка на AdminUser модель
    default: null
  },
  
  // Роль пользователя
  role: {
    type: String,
    enum: ['customer', 'partner', 'courier', 'admin'],
    required: true
  },
  
  // Хешированный email для безопасного поиска
  em: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Дополнительные метаданные
  is_active: {
    type: Boolean,
    default: true
  },
  
  // Информация о безопасности
  security_info: {
    last_login_attempt: Date,
    failed_login_attempts: {
      type: Number,
      default: 0
    },
    account_locked_until: Date,
    password_changed_at: Date
  }
}, {
  timestamps: true
});

// Индексы для оптимизации поиска
metaSchema.index({ em: 1, role: 1 });
metaSchema.index({ customer: 1 });
metaSchema.index({ partner: 1 });
metaSchema.index({ courier: 1 });
metaSchema.index({ admin: 1 });
metaSchema.index({ is_active: 1 });

// Методы для работы с безопасностью
metaSchema.methods.incrementFailedAttempts = function() {
  this.security_info.failed_login_attempts += 1;
  this.security_info.last_login_attempt = new Date();
  
  // Блокируем аккаунт после 5 неудачных попыток на 15 минут
  if (this.security_info.failed_login_attempts >= 5) {
    this.security_info.account_locked_until = new Date(Date.now() + 15 * 60 * 1000);
  }
  
  return this.save();
};

metaSchema.methods.resetFailedAttempts = function() {
  this.security_info.failed_login_attempts = 0;
  this.security_info.account_locked_until = undefined;
  this.security_info.last_login_attempt = new Date();
  return this.save();
};

metaSchema.methods.isAccountLocked = function() {
  return this.security_info.account_locked_until && 
         this.security_info.account_locked_until > new Date();
};

module.exports = mongoose.model('Meta', metaSchema);