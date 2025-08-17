// models/CourierApplication.model.js (исправленный - ES6 modules)
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
  
  // Информация о рассмотрении заявки
  review_info: {
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    reviewed_at: {
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
      maxlength: 1000 // Внутренние заметки для админов
    }
  },
  
  // Личные данные курьера
  personal_data: {
    first_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^(\+33|0)[1-9](\d{8})$/.test(v.replace(/\s/g, '')); // Французский номер
        },
        message: 'Некорректный формат французского номера телефона'
      }
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Некорректный формат email'
      }
    },
    date_of_birth: {
      type: Date,
      required: true,
      validate: {
        validator: function(date) {
          const age = (Date.now() - date) / (1000 * 60 * 60 * 24 * 365);
          return age >= 18 && age <= 70; // Возраст от 18 до 70 лет
        },
        message: 'Возраст должен быть от 18 до 70 лет'
      }
    },
    address: {
      street: {
        type: String,
        required: true,
        trim: true
      },
      city: {
        type: String,
        required: true,
        trim: true
      },
      postal_code: {
        type: String,
        required: true,
        trim: true,
        validate: {
          validator: function(v) {
            return /^\d{5}$/.test(v); // Французский почтовый индекс
          },
          message: 'Почтовый индекс должен содержать 5 цифр'
        }
      },
      country: {
        type: String,
        default: 'France'
      }
    },
    avatar_url: {
      type: String
    }
  },
  
  // Информация о транспорте (из макета регистрации)
  vehicle_info: {
    vehicle_type: {
      type: String,
      required: true,
      enum: ['bike', 'motorbike', 'car'] // Как в макете
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
      type: String,
      trim: true,
      uppercase: true
    },
    insurance_company: {
      type: String,
      trim: true
    },
    insurance_policy_number: {
      type: String,
      trim: true
    }
  },
  
  // Документы для верификации (как в макете)
  documents: {
    id_card_url: {
      type: String,
      required: true // Паспорт обязателен
    },
    driver_license_url: {
      type: String,
      required: function() {
        return this.vehicle_info.vehicle_type === 'motorbike' || 
               this.vehicle_info.vehicle_type === 'car';
      }
    },
    insurance_url: {
      type: String,
      required: function() {
        return this.vehicle_info.vehicle_type === 'motorbike' || 
               this.vehicle_info.vehicle_type === 'car';
      }
    },
    vehicle_registration_url: {
      type: String,
      required: function() {
        return this.vehicle_info.vehicle_type === 'motorbike' || 
               this.vehicle_info.vehicle_type === 'car';
      }
    },
    bank_rib_url: {
      type: String,
      required: true // RIB обязателен для выплат
    }
  },
  
  // Проверка документов
  verification: {
    identity_verified: {
      type: Boolean,
      default: false
    },
    identity_verification_notes: {
      type: String,
      trim: true
    },
    license_verified: {
      type: Boolean,
      default: false
    },
    license_verification_notes: {
      type: String,
      trim: true
    },
    insurance_verified: {
      type: Boolean,
      default: false
    },
    insurance_verification_notes: {
      type: String,
      trim: true
    },
    vehicle_verified: {
      type: Boolean,
      default: false
    },
    vehicle_verification_notes: {
      type: String,
      trim: true
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
  
  // Согласия (как в макете)
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
  
  // Тестирование (если требуется)
  test_results: {
    theory_test_passed: {
      type: Boolean,
      default: false
    },
    theory_test_score: {
      type: Number,
      min: 0,
      max: 100
    },
    practical_test_passed: {
      type: Boolean,
      default: false
    },
    test_taken_at: {
      type: Date
    }
  },
  
  // Дублирование данных (предотвращение повторных заявок)
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

// Индексы для оптимизации
courierApplicationSchema.index({ user_id: 1 });
courierApplicationSchema.index({ status: 1, submitted_at: -1 });
courierApplicationSchema.index({ 'personal_data.phone': 1 });
courierApplicationSchema.index({ 'personal_data.email': 1 });
courierApplicationSchema.index({ 'vehicle_info.vehicle_type': 1 });
courierApplicationSchema.index({ 'review_info.reviewed_by': 1 });
courierApplicationSchema.index({ submitted_at: -1 });

// Составной индекс для админской панели
courierApplicationSchema.index({ 
  status: 1, 
  'verification.overall_verification_status': 1,
  submitted_at: -1 
});

// Методы экземпляра

// Одобрение заявки
courierApplicationSchema.methods.approve = function(adminId, adminNotes = '') {
  this.status = 'approved';
  this.review_info.reviewed_by = adminId;
  this.review_info.reviewed_at = new Date();
  this.review_info.admin_notes = adminNotes;
  this.verification.overall_verification_status = 'completed';
  
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

// Обновление статуса проверки
courierApplicationSchema.methods.updateVerificationStatus = function(section, verified, notes = '') {
  switch(section) {
    case 'identity':
      this.verification.identity_verified = verified;
      this.verification.identity_verification_notes = notes;
      break;
    case 'license':
      this.verification.license_verified = verified;
      this.verification.license_verification_notes = notes;
      break;
    case 'insurance':
      this.verification.insurance_verified = verified;
      this.verification.insurance_verification_notes = notes;
      break;
    case 'vehicle':
      this.verification.vehicle_verified = verified;
      this.verification.vehicle_verification_notes = notes;
      break;
  }
  
  // Проверяем общий статус
  const requiredChecks = ['identity'];
  if (this.vehicle_info.vehicle_type !== 'bike') {
    requiredChecks.push('license', 'insurance', 'vehicle');
  }
  
  const allVerified = requiredChecks.every(check => {
    switch(check) {
      case 'identity': return this.verification.identity_verified;
      case 'license': return this.verification.license_verified;
      case 'insurance': return this.verification.insurance_verified;
      case 'vehicle': return this.verification.vehicle_verified;
      default: return false;
    }
  });
  
  if (allVerified) {
    this.verification.overall_verification_status = 'completed';
  } else {
    this.verification.overall_verification_status = 'in_progress';
  }
  
  return this.save();
};

// Проверка на дублирование
courierApplicationSchema.methods.checkForDuplicates = async function() {
  const existingApplications = await this.constructor.find({
    _id: { $ne: this._id },
    status: { $in: ['pending', 'approved'] },
    $or: [
      { 'personal_data.phone': this.personal_data.phone },
      { 'personal_data.email': this.personal_data.email }
    ]
  });
  
  this.duplicate_check.phone_exists = existingApplications.some(app => 
    app.personal_data.phone === this.personal_data.phone
  );
  this.duplicate_check.email_exists = existingApplications.some(app => 
    app.personal_data.email === this.personal_data.email
  );
  
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
    first_name: this.personal_data.first_name,
    last_name: this.personal_data.last_name,
    phone: this.personal_data.phone,
    avatar_url: this.personal_data.avatar_url,
    vehicle_type: this.vehicle_info.vehicle_type,
    documents: this.documents,
    is_approved: true,
    application_status: 'approved',
    approved_by: this.review_info.reviewed_by,
    approved_at: this.review_info.reviewed_at
  });
  
  return courierProfile.save();
};

// Статические методы

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

// 🆕 ИСПРАВЛЕНО: ES6 export
const CourierApplication = mongoose.model('CourierApplication', courierApplicationSchema);
export default CourierApplication;