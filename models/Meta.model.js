// models/Meta.model.js (упрощенный и исправленный)
import mongoose from 'mongoose';

const metaSchema = new mongoose.Schema({
  // ЕДИНАЯ ссылка на пользователя (вместо отдельных полей)
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Роль пользователя
  role: {
    type: String,
    enum: ['customer', 'partner', 'courier', 'admin', 'manager', 'owner'],
    required: true,
    index: true
  },
  
  // Хешированный email для безопасного поиска
  em: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Статус активности
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Информация о безопасности
  security_info: {
    last_login_attempt: {
      type: Date
    },
    failed_login_attempts: {
      type: Number,
      default: 0
    },
    account_locked_until: {
      type: Date
    },
    password_changed_at: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Составные индексы для оптимизации поиска
metaSchema.index({ em: 1, role: 1 });
metaSchema.index({ user_id: 1, role: 1 });
metaSchema.index({ role: 1, is_active: 1 });

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

// Статические методы

// Поиск по хешированному email и роли
metaSchema.statics.findByEmailAndRole = function(hashedEmail, role) {
  return this.findOne({ em: hashedEmail, role }).populate('user_id');
};

// Поиск всех Meta записей пользователя
metaSchema.statics.findByUserId = function(userId) {
  return this.find({ user_id: userId });
};

// Создание Meta записи
metaSchema.statics.createMeta = function(userId, role, hashedEmail) {
  return this.create({
    user_id: userId,
    role: role,
    em: hashedEmail,
    is_active: true
  });
};

export default mongoose.model('Meta', metaSchema);