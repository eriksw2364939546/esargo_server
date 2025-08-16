// models/AdminUser.model.js (исправленный - ES6 modules)
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminUserSchema = new mongoose.Schema({
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
  
  full_name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  // Роль администратора
  role: {
    type: String,
    required: true,
    enum: ['admin', 'manager', 'owner', 'support', 'moderator'],
    default: 'admin',
    index: true
  },
  
  // Статус активности
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Детализированные разрешения
  permissions: {
    dashboard: { 
      read: { type: Boolean, default: false }, 
      write: { type: Boolean, default: false } 
    },
    users: { 
      read: { type: Boolean, default: false }, 
      write: { type: Boolean, default: false }, 
      delete: { type: Boolean, default: false } 
    },
    partners: { 
      read: { type: Boolean, default: false }, 
      write: { type: Boolean, default: false }, 
      approve: { type: Boolean, default: false } 
    },
    couriers: { 
      read: { type: Boolean, default: false }, 
      write: { type: Boolean, default: false }, 
      approve: { type: Boolean, default: false } 
    },
    orders: { 
      read: { type: Boolean, default: false }, 
      write: { type: Boolean, default: false }, 
      cancel: { type: Boolean, default: false } 
    },
    finance: { 
      read: { type: Boolean, default: false }, 
      write: { type: Boolean, default: false } 
    },
    analytics: { 
      read: { type: Boolean, default: false }, 
      write: { type: Boolean, default: false } 
    },
    system: { 
      read: { type: Boolean, default: false }, 
      write: { type: Boolean, default: false }, 
      maintain: { type: Boolean, default: false } 
    }
  },
  
  // Контактная информация
  contact_info: {
    department: {
      type: String,
      enum: ['moderation', 'support', 'operations', 'finance', 'technical', 'general'],
      default: 'general'
    },
    phone: String,
    position: String
  },
  
  // Информация о создателе
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  
  // Отслеживание входов
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
  },
  
  last_login_ip: {
    type: String
  },
  
  // Статистика активности
  activity_stats: {
    total_logins: {
      type: Number,
      default: 0
    },
    actions_count: {
      type: Number,
      default: 0
    },
    last_action_at: {
      type: Date
    }
  },
  
  // Временное отключение
  suspension: {
    is_suspended: {
      type: Boolean,
      default: false
    },
    suspended_until: {
      type: Date
    },
    suspension_reason: {
      type: String
    },
    suspended_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    }
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
adminUserSchema.index({ email: 1 });
adminUserSchema.index({ role: 1, is_active: 1 });
adminUserSchema.index({ last_login_at: -1 });
adminUserSchema.index({ 'contact_info.department': 1 });
adminUserSchema.index({ 'suspension.is_suspended': 1 });

// Хэширование пароля перед сохранением
adminUserSchema.pre('save', async function(next) {
  if (!this.isModified('password_hash')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// МЕТОДЫ ЭКЗЕМПЛЯРА

// Проверка пароля
adminUserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

// Проверка заблокирован ли аккаунт
adminUserSchema.methods.isAccountLocked = function() {
  return !!(this.login_attempts.blocked_until && this.login_attempts.blocked_until > Date.now());
};

// Проверка приостановлен ли аккаунт
adminUserSchema.methods.isSuspended = function() {
  return this.suspension.is_suspended && 
         (!this.suspension.suspended_until || this.suspension.suspended_until > new Date());
};

// Увеличение счетчика попыток входа
adminUserSchema.methods.incrementLoginAttempts = function() {
  if (!this.login_attempts.last_attempt || 
      Date.now() - this.login_attempts.last_attempt > 3600000) {
    this.login_attempts.count = 1;
  } else {
    this.login_attempts.count += 1;
  }
  
  this.login_attempts.last_attempt = new Date();
  
  // Блокируем после 3 неудачных попыток (более строго для админов)
  if (this.login_attempts.count >= 3) {
    this.login_attempts.blocked_until = new Date(Date.now() + 3600000); // 1 час
  }
  
  return this.save();
};

// Сброс попыток входа при успешном входе
adminUserSchema.methods.resetLoginAttempts = function(ipAddress) {
  this.login_attempts.count = 0;
  this.login_attempts.last_attempt = undefined;
  this.login_attempts.blocked_until = undefined;
  this.last_login_at = new Date();
  this.last_activity_at = new Date();
  this.last_login_ip = ipAddress;
  this.activity_stats.total_logins += 1;
  
  return this.save();
};

// Проверка разрешения
adminUserSchema.methods.hasPermission = function(section, action) {
  if (this.role === 'owner') {
    return true; // owner имеет все права
  }
  
  if (!this.is_active || this.isSuspended()) {
    return false;
  }
  
  return this.permissions[section] && this.permissions[section][action];
};

// Проверка является ли администратором
adminUserSchema.methods.isAdmin = function() {
  return ['admin', 'manager', 'owner', 'support', 'moderator'].includes(this.role);
};

// Обновление активности
adminUserSchema.methods.updateActivity = function() {
  this.last_activity_at = new Date();
  this.activity_stats.actions_count += 1;
  this.activity_stats.last_action_at = new Date();
  
  return this.save();
};

// Запись активности (для совместимости)
adminUserSchema.methods.recordActivity = function() {
  return this.updateActivity();
};

// Приостановка аккаунта
adminUserSchema.methods.suspend = function(reason, duration, suspendedBy) {
  this.suspension.is_suspended = true;
  this.suspension.suspension_reason = reason;
  this.suspension.suspended_by = suspendedBy;
  
  if (duration) {
    this.suspension.suspended_until = new Date(Date.now() + duration);
  }
  
  return this.save();
};

// Снятие приостановки
adminUserSchema.methods.unsuspend = function() {
  this.suspension.is_suspended = false;
  this.suspension.suspended_until = undefined;
  this.suspension.suspension_reason = undefined;
  this.suspension.suspended_by = undefined;
  
  return this.save();
};

// Обновление разрешений
adminUserSchema.methods.updatePermissions = function(newPermissions) {
  if (this.role === 'owner') {
    throw new Error('Нельзя изменить разрешения владельца');
  }
  
  // Merge новых разрешений с существующими
  Object.keys(newPermissions).forEach(section => {
    if (this.permissions[section]) {
      Object.assign(this.permissions[section], newPermissions[section]);
    }
  });
  
  this.markModified('permissions');
  return this.save();
};

// СТАТИЧЕСКИЕ МЕТОДЫ

// Поиск по email
adminUserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Поиск активных админов
adminUserSchema.statics.findActive = function() {
  return this.find({ 
    is_active: true,
    'suspension.is_suspended': false
  });
};

// Поиск по роли
adminUserSchema.statics.findByRole = function(role) {
  return this.find({ 
    role,
    is_active: true 
  });
};

// Поиск по отделу
adminUserSchema.statics.findByDepartment = function(department) {
  return this.find({ 
    'contact_info.department': department,
    is_active: true 
  });
};

// Создание первого владельца (при инициализации системы)
adminUserSchema.statics.createOwner = async function(email, password, fullName) {
  const existingOwner = await this.findOne({ role: 'owner' });
  if (existingOwner) {
    throw new Error('Владелец уже существует');
  }
  
  const owner = new this({
    email,
    password_hash: password, // будет захэширован в pre hook
    full_name: fullName,
    role: 'owner',
    is_active: true
  });
  
  // Owner получает все права автоматически
  Object.keys(owner.permissions).forEach(section => {
    Object.keys(owner.permissions[section]).forEach(action => {
      owner.permissions[section][action] = true;
    });
  });
  
  return owner.save();
};

// Получение статистики активности админов
adminUserSchema.statics.getActivityStats = function(period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  return this.aggregate([
    {
      $match: {
        last_activity_at: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$contact_info.department',
        active_admins: { $sum: 1 },
        total_actions: { $sum: '$activity_stats.actions_count' },
        avg_actions_per_admin: { $avg: '$activity_stats.actions_count' }
      }
    }
  ]);
};

// Очистка неактивных аккаунтов
adminUserSchema.statics.cleanInactiveAccounts = function(daysInactive = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
  
  return this.updateMany({
    last_activity_at: { $lt: cutoffDate },
    role: { $ne: 'owner' }, // не трогаем owner
    is_active: true
  }, {
    $set: { is_active: false }
  });
};

export default mongoose.model('AdminUser', adminUserSchema);