// models/CourierApplication.model.js - ПОЛНЫЙ ФАЙЛ с шифрованием как у партнеров
import mongoose from 'mongoose';

const courierApplicationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Временные метки заявки
  submitted_at: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // Статус заявки
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  
  // 🔐 ЛИЧНЫЕ ДАННЫЕ - ЗАШИФРОВАНЫ (как у партнеров)
  personal_data: {
    first_name: {
      type: String,
      required: true
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    },
    last_name: {
      type: String,
      required: true
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    },
    email: {
      type: String,
      required: true
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    },
    phone: {
      type: String,
      required: true
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    },
    date_of_birth: {
      type: Date,
      required: true
    },
    address: {
      street: {
        type: String,
        required: true
        // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
      },
      city: {
        type: String,
        required: true
        // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
      },
      postal_code: {
        type: String,
        required: true
        // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
      },
      country: {
        type: String,
        default: 'France'
      }
    }
  },

  // ✅ ПОИСКОВЫЕ ПОЛЯ - ОТКРЫТО (только для поиска админом)
  search_data: {
    first_name: {
      type: String,
      required: true,
      trim: true
      // ✅ ОТКРЫТО для поиска админом
    },
    last_name: {
      type: String,
      required: true,
      trim: true
      // ✅ ОТКРЫТО для поиска админом  
    },
    city: {
      type: String,
      required: true,
      trim: true
      // ✅ ОТКРЫТО для поиска админом
    }
  },
  
  // Информация о транспорте
  vehicle_info: {
    vehicle_type: {
      type: String,
      required: true,
      enum: ['bike', 'motorbike', 'car'],
      index: true
    },
    vehicle_brand: {
      type: String,
      trim: true
    },
    vehicle_model: {
      type: String,
      trim: true
    },
    license_plate: {
      type: String
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    },
    insurance_company: {
      type: String,
      trim: true
    },
    insurance_policy_number: {
      type: String
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    }
  },
  
  // 🔐 ДОКУМЕНТЫ - ЗАШИФРОВАНЫ (URLs могут содержать персональную информацию)
  documents: {
    id_card_url: {
      type: String,
      required: true
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    },
    driver_license_url: {
      type: String
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    },
    insurance_url: {
      type: String
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    },
    vehicle_registration_url: {
      type: String
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    },
    bank_rib_url: {
      type: String,
      required: true
      // 🔐 ЗАШИФРОВАНО в сервисе через cryptoString()
    }
  },
  
  // Верификация документов
  verification: {
    identity_verified: {
      type: Boolean,
      default: false
    },
    license_verified: {
      type: Boolean,
      default: false
    },
    insurance_verified: {
      type: Boolean,
      default: false
    },
    vehicle_verified: {
      type: Boolean,
      default: false
    },
    overall_verification_status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'failed'],
      default: 'not_started'
    },
    last_verification_update: {
      type: Date,
      default: Date.now
    }
  },
  
  // Согласия (могут быть открыты)
  consents: {
    terms_accepted: {
      type: Boolean,
      required: true,
      validate: {
        validator: function(v) {
          return v === true;
        },
        message: 'Необходимо принять условия использования'
      }
    },
    privacy_policy_accepted: {
      type: Boolean,
      required: true,
      validate: {
        validator: function(v) {
          return v === true;
        },
        message: 'Необходимо принять политику конфиденциальности'
      }
    },
    data_processing_accepted: {
      type: Boolean,
      required: true,
      validate: {
        validator: function(v) {
          return v === true;
        },
        message: 'Необходимо согласие на обработку данных'
      }
    },
    background_check_accepted: {
      type: Boolean,
      required: true,
      validate: {
        validator: function(v) {
          return v === true;
        },
        message: 'Необходимо согласие на проверку данных'
      }
    }
  },
  
  // Информация о рассмотрении заявки
  review_info: {
    review_stage: {
      type: String,
      enum: ['documents', 'verification', 'interview', 'final'],
      default: 'documents'
    },
    priority_level: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    reviewed_at: {
      type: Date
    },
    approved_at: {
      type: Date
    },
    rejection_reason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    admin_notes: {
      type: String,
      trim: true,
      maxlength: 1000
    }
  },
  
  // Дубликаты (для предотвращения повторных заявок)
  duplicate_check: {
    phone_exists: {
      type: Boolean,
      default: false
    },
    email_exists: {
      type: Boolean,
      default: false
    },
    license_exists: {
      type: Boolean,
      default: false
    }
  },
  
  // Тестирование (если требуется)
  test_results: {
    theory_test_passed: {
      type: Boolean,
      default: false
    },
    practical_test_passed: {
      type: Boolean,
      default: false
    }
  },
  
  // Метаданные
  source: {
    type: String,
    enum: ['web', 'mobile_app', 'referral'],
    default: 'web'
  },
  referral_code: {
    type: String,
    trim: true
  },
  ip_address: {
    type: String
  },
  user_agent: {
    type: String
  }
}, {
  timestamps: true
});

// ================ ИНДЕКСЫ ================
courierApplicationSchema.index({ user_id: 1 });
courierApplicationSchema.index({ status: 1, submitted_at: -1 });
courierApplicationSchema.index({ 'search_data.first_name': 1 }); // ✅ Индекс для поиска
courierApplicationSchema.index({ 'search_data.last_name': 1 });  // ✅ Индекс для поиска
courierApplicationSchema.index({ 'search_data.city': 1 });       // ✅ Индекс для поиска
courierApplicationSchema.index({ 'vehicle_info.vehicle_type': 1 });
courierApplicationSchema.index({ 'review_info.reviewed_by': 1 });

// Составной индекс для админской панели
courierApplicationSchema.index({ 
  status: 1, 
  'verification.overall_verification_status': 1,
  submitted_at: -1 
});

// ================ НАСТРОЙКИ JSON (как у партнеров) ================
courierApplicationSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // 🔐 НЕ ВОЗВРАЩАЕМ ЗАШИФРОВАННЫЕ ДАННЫЕ В JSON
    if (ret.personal_data) {
      delete ret.personal_data.first_name;    // 🔐 Скрываем
      delete ret.personal_data.last_name;     // 🔐 Скрываем
      delete ret.personal_data.email;         // 🔐 Скрываем
      delete ret.personal_data.phone;         // 🔐 Скрываем
      if (ret.personal_data.address) {
        delete ret.personal_data.address.street;      // 🔐 Скрываем
        delete ret.personal_data.address.city;        // 🔐 Скрываем
        delete ret.personal_data.address.postal_code; // 🔐 Скрываем
      }
    }
    
    if (ret.documents) {
      delete ret.documents.id_card_url;         // 🔐 Скрываем
      delete ret.documents.driver_license_url;  // 🔐 Скрываем
      delete ret.documents.insurance_url;       // 🔐 Скрываем
      delete ret.documents.vehicle_registration_url; // 🔐 Скрываем
      delete ret.documents.bank_rib_url;        // 🔐 Скрываем
    }
    
    if (ret.vehicle_info) {
      delete ret.vehicle_info.license_plate;          // 🔐 Скрываем
      delete ret.vehicle_info.insurance_policy_number; // 🔐 Скрываем
    }
    
    return ret;
  }
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================


// Одобрение заявки с правильной верификацией
courierApplicationSchema.methods.approve = function(adminId, adminNotes = '') {
  this.status = 'approved';
  this.review_info.reviewed_by = adminId;
  this.review_info.reviewed_at = new Date();
  this.review_info.approved_at = new Date();
  this.review_info.admin_notes = adminNotes;
  
  // Автоматически верифицируем документы при одобрении
  this.verification.identity_verified = true;
  this.verification.overall_verification_status = 'completed';
  this.verification.last_verification_update = new Date();
  
  // Верифицируем документы в зависимости от типа транспорта
  if (this.vehicle_info.vehicle_type === 'motorbike' || this.vehicle_info.vehicle_type === 'car') {
    this.verification.license_verified = true;
    this.verification.insurance_verified = true;
  }
  
  if (this.vehicle_info.vehicle_type === 'car') {
    this.verification.vehicle_verified = true;
  }
  
  // Для bike - права и страховка не требуются
  if (this.vehicle_info.vehicle_type === 'bike') {
    this.verification.license_verified = false;
    this.verification.insurance_verified = false;
    this.verification.vehicle_verified = false;
  }
  
  return this.save();
};

// Отклонение заявки
courierApplicationSchema.methods.reject = function(adminId, reason, adminNotes = '') {
  this.status = 'rejected';
  this.review_info.reviewed_by = adminId;
  this.review_info.reviewed_at = new Date();
  this.review_info.rejection_reason = reason;
  this.review_info.admin_notes = adminNotes;
  this.verification.overall_verification_status = 'failed';
  
  return this.save();
};

// Проверка на дубликаты (обновленная логика)
courierApplicationSchema.methods.checkForDuplicates = async function() {
  // Проверяем через search_data (открытые поля) вместо зашифрованных
  const existingApplications = await this.constructor.find({
    _id: { $ne: this._id },
    status: { $in: ['pending', 'approved'] },
    $or: [
      { 
        'search_data.first_name': this.search_data.first_name,
        'search_data.last_name': this.search_data.last_name,
        'search_data.city': this.search_data.city
      }
    ]
  });
  
  this.duplicate_check.email_exists = existingApplications.length > 0;
  
  return this.save();
};

// Расчет возраста
courierApplicationSchema.methods.getAge = function() {
  if (!this.personal_data.date_of_birth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.personal_data.date_of_birth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Создание CourierProfile после одобрения
courierApplicationSchema.methods.createCourierProfile = async function() {
  if (this.status !== 'approved') {
    throw new Error('Заявка должна быть одобрена');
  }
  
  const CourierProfile = mongoose.model('CourierProfile');
  
  const courierProfile = new CourierProfile({
    user_id: this.user_id,
    first_name: this.search_data.first_name,  // Используем открытые данные
    last_name: this.search_data.last_name,    // Используем открытые данные
    phone: this.personal_data.phone,          // Зашифрованный телефон
    vehicle_type: this.vehicle_info.vehicle_type,
    documents: this.documents,                // Зашифрованные документы
    is_approved: true,
    application_status: 'approved',
    approved_by: this.review_info.reviewed_by,
    approved_at: this.review_info.reviewed_at
  });
  
  return courierProfile.save();
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

// Поиск заявок по статусу
courierApplicationSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ submitted_at: -1 });
};

// Поиск заявок ожидающих рассмотрения
courierApplicationSchema.statics.findPending = function() {
  return this.find({ status: 'pending' }).sort({ submitted_at: 1 });
};

// Поиск заявок в процессе проверки
courierApplicationSchema.statics.findInProgress = function() {
  return this.find({ 
    status: 'pending',
    'verification.overall_verification_status': 'in_progress'
  }).sort({ submitted_at: 1 });
};

// Поиск заявок по типу транспорта
courierApplicationSchema.statics.findByVehicleType = function(vehicleType) {
  return this.find({ 
    'vehicle_info.vehicle_type': vehicleType 
  }).sort({ submitted_at: -1 });
};

// Поиск заявок админа
courierApplicationSchema.statics.findByAdmin = function(adminId) {
  return this.find({ 
    'review_info.reviewed_by': adminId 
  }).sort({ 'review_info.reviewed_at': -1 });
};

// Поиск заявок для админской панели (только открытые поля)
courierApplicationSchema.statics.findForAdmin = function(filters = {}) {
  return this.find(filters)
    .select('search_data vehicle_info.vehicle_type status submitted_at review_info verification user_id')
    .sort({ submitted_at: -1 });
};

// Поиск по открытым полям
courierApplicationSchema.statics.searchByName = function(firstName, lastName) {
  return this.find({
    'search_data.first_name': firstName,
    'search_data.last_name': lastName
  });
};

// Статистика заявок
courierApplicationSchema.statics.getStats = function(period = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  return this.aggregate([
    {
      $match: {
        submitted_at: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        by_vehicle_type: {
          $push: '$vehicle_info.vehicle_type'
        },
        avg_age: {
          $avg: {
            $divide: [
              { $subtract: [new Date(), '$personal_data.date_of_birth'] },
              365.25 * 24 * 60 * 60 * 1000
            ]
          }
        }
      }
    }
  ]);
};

// Поиск просроченных заявок (не рассмотренных более 2 дней)
courierApplicationSchema.statics.findOverdue = function(daysOld = 2) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.find({
    status: 'pending',
    submitted_at: { $lt: cutoffDate }
  }).sort({ submitted_at: 1 });
};

export default mongoose.model('CourierApplication', courierApplicationSchema);