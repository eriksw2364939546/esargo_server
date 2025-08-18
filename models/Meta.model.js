// models/Meta.model.js (ИСПРАВЛЕННЫЙ - включаем password_hash)
import mongoose from 'mongoose';

const metaSchema = new mongoose.Schema({
  // Роль пользователя
  role: {
    type: String,
    enum: ['customer', 'partner', 'courier', 'admin'],
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
  
  // 🆕 ИСПРАВЛЕНО: Отдельные ссылки для каждого типа пользователя
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  partner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  courier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // 🆕 ДОБАВЛЕНО: Ссылка на AdminUser
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
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
metaSchema.index({ role: 1, is_active: 1 });

// 🆕 ИСПРАВЛЕНО: Индексы для каждого типа пользователя
metaSchema.index({ customer: 1, role: 1 });
metaSchema.index({ partner: 1, role: 1 });
metaSchema.index({ courier: 1, role: 1 });
metaSchema.index({ admin: 1, role: 1 });

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

// Проверка заблокирован ли аккаунт
metaSchema.methods.isAccountLocked = function() {
  return this.security_info.account_locked_until && 
         this.security_info.account_locked_until > new Date();
};

// Увеличение счетчика неудачных попыток
metaSchema.methods.incrementFailedAttempts = function() {
  this.security_info.failed_login_attempts += 1;
  this.security_info.last_login_attempt = new Date();
  
  // Блокируем аккаунт после 5 неудачных попыток на 15 минут
  if (this.security_info.failed_login_attempts >= 5) {
    this.security_info.account_locked_until = new Date(Date.now() + 15 * 60 * 1000);
  }
  
  return this.save();
};

// Сброс счетчика неудачных попыток
metaSchema.methods.resetFailedAttempts = function() {
  this.security_info.failed_login_attempts = 0;
  this.security_info.last_login_attempt = new Date();
  this.security_info.account_locked_until = undefined;
  
  return this.save();
};

// Получение пользователя в зависимости от роли
metaSchema.methods.getUser = function() {
  switch (this.role) {
    case 'customer':
      return this.customer;
    case 'partner':
      return this.partner;
    case 'courier':
      return this.courier;
    case 'admin':
      return this.admin;
    default:
      return null;
  }
};

metaSchema.methods.getUserId = function() {
  switch (this.role) {
    case 'customer':
      return this.customer;
    case 'partner':
      return this.partner;
    case 'courier':
      return this.courier;
    case 'admin':
      return this.admin;
    default:
      return null;
  }
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

// 🔧 ИСПРАВЛЕНИЕ: Добавляем недостающий метод findByEmailHash
metaSchema.statics.findByEmailHash = function(hashedEmail) {
  return this.findOne({ em: hashedEmail });
};

// Поиск по хешированному email и роли
metaSchema.statics.findByEmailAndRole = function(hashedEmail, role) {
  return this.findOne({ em: hashedEmail, role });
};

// 🆕 ИСПРАВЛЕНО: Поиск с populate в зависимости от роли
metaSchema.statics.findByEmailAndRoleWithUser = function(hashedEmail, role) {
  let populateField;
  let refModel;
  
  switch (role) {
    case 'customer':
      populateField = 'customer';
      refModel = 'User';
      break;
    case 'partner':
      populateField = 'partner';
      refModel = 'User';
      break;
    case 'courier':
      populateField = 'courier';
      refModel = 'User';
      break;
    case 'admin':
      populateField = 'admin';
      refModel = 'AdminUser';
      break;
    default:
      return this.findOne({ em: hashedEmail, role });
  }
  
  // ✅ ИСПРАВЛЕНО: Убираем select: '-password_hash' чтобы включить пароль!
  return this.findOne({ em: hashedEmail, role }).populate({
    path: populateField,
    model: refModel
    // БЕЗ select - включаем ВСЕ поля включая password_hash
  });
};

// Обновление информации о пароле
metaSchema.statics.updatePasswordInfo = function(hashedEmail, role) {
  return this.findOneAndUpdate(
    { em: hashedEmail, role },
    { 
      'security_info.password_changed_at': new Date() 
    },
    { new: true }
  );
};

// 🆕 ИСПРАВЛЕНО: Создание Meta записи для разных типов пользователей
metaSchema.statics.createForCustomer = function(userId, hashedEmail) {
  return this.create({
    customer: userId,
    role: 'customer',
    em: hashedEmail,
    is_active: true
  });
};

metaSchema.statics.createForPartner = function(userId, hashedEmail) {
  return this.create({
    partner: userId,
    role: 'partner',
    em: hashedEmail,
    is_active: true
  });
};

metaSchema.statics.createForCourier = function(userId, hashedEmail) {
  return this.create({
    courier: userId,
    role: 'courier',
    em: hashedEmail,
    is_active: true
  });
};

metaSchema.statics.createForAdmin = function(adminId, hashedEmail) {
  return this.create({
    admin: adminId,
    role: 'admin',
    em: hashedEmail,
    is_active: true
  });
};

// 🆕 ДОБАВЛЕНО: Поиск всех Meta записей пользователя (по ID)
metaSchema.statics.findByUserId = function(userId, role) {
  const query = { is_active: true };
  
  switch (role) {
    case 'customer':
      query.customer = userId;
      break;
    case 'partner':
      query.partner = userId;
      break;
    case 'courier':
      query.courier = userId;
      break;
    case 'admin':
      query.admin = userId;
      break;
    default:
      return this.find({ 
        $or: [
          { customer: userId },
          { partner: userId },
          { courier: userId },
          { admin: userId }
        ]
      });
  }
  
  return this.find(query);
};

export default mongoose.model('Meta', metaSchema);