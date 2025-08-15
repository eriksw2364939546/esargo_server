// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Некорректный формат email'
    }
  },
  password_hash: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    required: true,
    enum: ['customer', 'partner', 'courier', 'admin', 'owner'],
    default: 'customer'
  },
  
  // Статус активности аккаунта
  is_active: {
    type: Boolean,
    default: true
  },
  
  // Подтверждение email
  is_email_verified: {
    type: Boolean,
    default: false
  },
  email_verification_token: {
    type: String
  },
  email_verification_expires: {
    type: Date
  },
  
  // Восстановление пароля
  password_reset_token: {
    type: String
  },
  password_reset_expires: {
    type: Date
  },
  
  // Временные токены для различных операций
  temp_tokens: [{
    token: {
      type: String,
      required: true
    },
    purpose: {
      type: String,
      required: true,
      enum: ['email_verification', 'password_reset', 'login_2fa', 'account_deletion']
    },
    expires_at: {
      type: Date,
      required: true
    },
    used: {
      type: Boolean,
      default: false
    }
  }],
  
  // Информация о последней активности
  last_login_at: {
    type: Date
  },
  last_login_ip: {
    type: String
  },
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
  
  // Настройки безопасности
  security_settings: {
    two_factor_enabled: {
      type: Boolean,
      default: false
    },
    login_notifications: {
      type: Boolean,
      default: true
    },
    suspicious_activity_alerts: {
      type: Boolean,
      default: true
    }
  },
  
  // Согласие на обработку данных (GDPR)
  gdpr_consent: {
    marketing: {
      type: Boolean,
      default: false
    },
    analytics: {
      type: Boolean,
      default: false
    },
    data_processing: {
      type: Boolean,
      default: true,
      required: true
    },
    consent_date: {
      type: Date,
      default: Date.now
    }
  },
  
  // Информация об удалении аккаунта
  deletion_requested_at: {
    type: Date
  },
  deletion_scheduled_for: {
    type: Date
  },
  deletion_reason: {
    type: String
  },
  
  // Метаданные
  registration_source: {
    type: String,
    enum: ['web', 'mobile_app', 'admin_created'],
    default: 'web'
  },
  registration_ip: {
    type: String
  },
  user_agent: {
    type: String
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ is_active: 1 });
userSchema.index({ email_verification_token: 1 });
userSchema.index({ password_reset_token: 1 });
userSchema.index({ 'temp_tokens.token': 1 });
userSchema.index({ last_login_at: -1 });
userSchema.index({ createdAt: -1 });

// Составной индекс для блокировки по попыткам входа
userSchema.index({ 
  'login_attempts.blocked_until': 1,
  'login_attempts.count': 1 
});

// Хэширование пароля перед сохранением
userSchema.pre('save', async function(next) {
  // Если пароль не изменился, пропускаем хэширование
  if (!this.isModified('password_hash')) {
    return next();
  }
  
  try {
    // Хэшируем пароль с солью
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Автоматическая очистка истекших временных токенов
userSchema.pre('save', function(next) {
  if (this.isModified('temp_tokens')) {
    this.temp_tokens = this.temp_tokens.filter(token => 
      token.expires_at > new Date() && !token.used
    );
  }
  next();
});

// Методы экземпляра

// Проверка пароля
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

// Проверка заблокирован ли аккаунт
userSchema.methods.isAccountLocked = function() {
  return !!(this.login_attempts.blocked_until && this.login_attempts.blocked_until > Date.now());
};

// Увеличение счетчика неудачных попыток входа
userSchema.methods.incrementLoginAttempts = function() {
  // Если это первая попытка или прошло более часа
  if (!this.login_attempts.last_attempt || 
      Date.now() - this.login_attempts.last_attempt > 3600000) {
    this.login_attempts.count = 1;
  } else {
    this.login_attempts.count += 1;
  }
  
  this.login_attempts.last_attempt = new Date();
  
  // Блокируем аккаунт после 5 неудачных попыток
  if (this.login_attempts.count >= 5) {
    this.login_attempts.blocked_until = new Date(Date.now() + 1800000); // 30 минут
  }
  
  return this.save();
};

// Сброс счетчика попыток входа при успешном входе
userSchema.methods.resetLoginAttempts = function() {
  this.login_attempts.count = 0;
  this.login_attempts.last_attempt = undefined;
  this.login_attempts.blocked_until = undefined;
  this.last_login_at = new Date();
  
  return this.save();
};

// Создание временного токена
userSchema.methods.createTempToken = function(purpose, expiresInMinutes = 60) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  const tempToken = {
    token,
    purpose,
    expires_at: new Date(Date.now() + expiresInMinutes * 60000),
    used: false
  };
  
  this.temp_tokens.push(tempToken);
  
  return token;
};

// Проверка и использование временного токена
userSchema.methods.useTempToken = function(token, purpose) {
  const tokenDoc = this.temp_tokens.find(t => 
    t.token === token && 
    t.purpose === purpose && 
    t.expires_at > new Date() && 
    !t.used
  );
  
  if (tokenDoc) {
    tokenDoc.used = true;
    return true;
  }
  
  return false;
};

// Создание токена для восстановления пароля
userSchema.methods.createPasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.password_reset_token = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.password_reset_expires = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
  
  return resetToken;
};

// Создание токена для подтверждения email
userSchema.methods.createEmailVerificationToken = function() {
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.email_verification_token = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
  
  return verificationToken;
};

// Подтверждение email
userSchema.methods.verifyEmail = function() {
  this.is_email_verified = true;
  this.email_verification_token = undefined;
  this.email_verification_expires = undefined;
  
  return this.save();
};

// Запрос на удаление аккаунта
userSchema.methods.requestAccountDeletion = function(reason) {
  this.deletion_requested_at = new Date();
  this.deletion_scheduled_for = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней
  this.deletion_reason = reason;
  
  return this.save();
};

// Отмена удаления аккаунта
userSchema.methods.cancelAccountDeletion = function() {
  this.deletion_requested_at = undefined;
  this.deletion_scheduled_for = undefined;
  this.deletion_reason = undefined;
  
  return this.save();
};

// Проверка прав доступа
userSchema.methods.hasRole = function(role) {
  if (Array.isArray(role)) {
    return role.includes(this.role);
  }
  return this.role === role;
};

// Проверка является ли админом
userSchema.methods.isAdmin = function() {
  return this.hasRole(['admin', 'owner']);
};

// Статические методы

// Поиск пользователя по email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Поиск активных пользователей
userSchema.statics.findActive = function() {
  return this.find({ is_active: true });
};

// Поиск пользователей по роли
userSchema.statics.findByRole = function(role) {
  return this.find({ role, is_active: true });
};

// Очистка истекших токенов (для cron задач)
userSchema.statics.cleanExpiredTokens = function() {
  return this.updateMany(
    {},
    {
      $pull: {
        temp_tokens: {
          $or: [
            { expires_at: { $lte: new Date() } },
            { used: true }
          ]
        }
      }
    }
  );
};

// Виртуальные поля
userSchema.virtual('profile', {
  ref: function() {
    switch(this.role) {
      case 'customer': return 'CustomerProfile';
      case 'partner': return 'PartnerProfile';
      case 'courier': return 'CourierProfile';
      default: return null;
    }
  },
  localField: '_id',
  foreignField: 'user_id',
  justOne: true
});

// Настройка виртуальных полей в JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);