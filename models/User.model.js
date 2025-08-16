// models/User.model.js (упрощенный и исправленный)
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Основная информация
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  
  password_hash: {
    type: String,
    required: true
  },
  
  // Роль пользователя (включая админов)
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
  
  // Упрощенная система попыток входа
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

// Индексы
userSchema.index({ email: 1, role: 1 });
userSchema.index({ is_active: 1, role: 1 });
userSchema.index({ last_activity_at: -1 });

// Хэширование пароля перед сохранением
userSchema.pre('save', async function(next) {
  if (!this.isModified('password_hash')) {
    return next();
  }
  
  try {
    // Добавляем соль из переменной окружения
    const saltedPassword = this.password_hash + (process.env.HASH_KEY || 'default-salt');
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(saltedPassword, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Методы экземпляра

// Проверка пароля
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    const saltedPassword = candidatePassword + (process.env.HASH_KEY || 'default-salt');
    return await bcrypt.compare(saltedPassword, this.password_hash);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

// Увеличение счетчика неудачных попыток
userSchema.methods.incrementLoginAttempts = function() {
  this.login_attempts.count += 1;
  this.login_attempts.last_attempt = new Date();
  
  // Блокируем после 5 неудачных попыток на 15 минут
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

// Статические методы

// Поиск по email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Поиск активных пользователей
userSchema.statics.findActive = function() {
  return this.find({ is_active: true });
};

// Поиск по роли
userSchema.statics.findByRole = function(role) {
  return this.find({ role, is_active: true });
};

// Виртуальные поля для связей с профилями
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

// Настройка виртуальных полей в JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

export default mongoose.model('User', userSchema);