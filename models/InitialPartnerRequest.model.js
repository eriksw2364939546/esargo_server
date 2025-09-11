// models/InitialPartnerRequest.model.js - ТОЧНО ПО СКРИНУ 1 🎯
import mongoose from 'mongoose';

const initialPartnerRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // 👤 ЛИЧНЫЕ ДАННЫЕ (точно как на скрине 1)
  personal_data: {
    first_name: {
      type: String, // 🔐 ЗАШИФРОВАНО - "Имя"
      required: true
    },
    last_name: {
      type: String, // 🔐 ЗАШИФРОВАНО - "Фамилия"  
      required: true
    },
    email: {
      type: String, // 🔐 ЗАШИФРОВАНО - "Электронная почта"
      required: true
    },
    phone: {
      type: String, // 🔐 ЗАШИФРОВАНО - "Номер мобильного телефона" с FR
      required: true
    }
  },
  
  // 🏪 БИЗНЕС ДАННЫЕ (точно как на скрине 1)
  business_data: {
    // Адрес и этаж
    address: {
      type: String, // 🔐 ЗАШИФРОВАНО - "Адрес магазина"
      required: true
    },
    floor_unit: {
      type: String, // 🔐 ЗАШИФРОВАНО - "Этаж/люкс (по желанию)"
      default: null
    },
    
    // Названия
    business_name: {
      type: String, // ✅ ОТКРЫТО - "Название магазина" ("Burger King")
      required: true,
      trim: true,
      maxlength: 100
    },
    brand_name: {
      type: String, // ✅ ОТКРЫТО - "Название бренда" ("Burger King")
      trim: true,
      maxlength: 100
    },
    
    // Тип бизнеса (dropdown на скрине)
    category: {
      type: String, // ✅ ОТКРЫТО - "Тип бизнеса" (рестораны/магазины)
      required: true,
      enum: ['restaurant', 'store'],
      index: true
    },
    
    // Геолокация
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    
    // Владелец (для внутреннего использования)
    owner_name: {
      type: String, // ✅ ОТКРЫТО
      required: true
    },
    owner_surname: {
      type: String, // ✅ ОТКРЫТО
      required: true
    }
  },
  
  // 📱 WHATSAPP СОГЛАСИЕ (точно как на скрине 1)
  marketing_consent: {
    whatsapp_consent: {
      type: Boolean, // "Я согласен на обмен сообщениями WhatsApp"
      default: false,
      required: true
    }
  },
  
  // 🎯 СТАТУС ЗАЯВКИ (workflow остается)
  status: {
    type: String,
    enum: [
      'pending',             // Ждет одобрения админом
      'approved',            // Одобрено, можно подавать юр.данные
      'rejected'             // Отклонено
    ],
    default: 'pending',
    index: true
  },
  
  // 🔄 WORKFLOW ЭТАПЫ
  workflow_stage: {
    type: Number,
    default: 1,
    min: 1,
    max: 7
  },
  
  // ℹ️ ИНФОРМАЦИЯ О РАССМОТРЕНИИ
  review_info: {
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    reviewed_at: Date,
    approved_at: Date,
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
  
  // 🛡️ БЕЗОПАСНОСТЬ
  security_info: {
    registration_ip: String,
    user_agent: String,
    country_code: {
      type: String,
      default: 'FR'
    },
    phone_country: {
      type: String,
      default: 'FR' // Соответствует выпадающему "FR" на скрине
    }
  },
  
  // 📅 ВРЕМЕННЫЕ МЕТКИ
  submitted_at: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  collection: 'initialpartnerrequests'
});

// ================ ИНДЕКСЫ ================
initialPartnerRequestSchema.index({
  status: 1,
  'business_data.category': 1,
  submitted_at: -1
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

/**
 * Обновление статуса с автоматическим workflow_stage
 */
initialPartnerRequestSchema.methods.updateStatus = function(newStatus, adminId = null, notes = '') {
  const statusToStage = {
    'pending': 1,
    'approved': 2,
    'rejected': 1
  };
  
  this.status = newStatus;
  this.workflow_stage = statusToStage[newStatus];
  this.updated_at = new Date();
  
  if (adminId) {
    this.review_info.reviewed_by = adminId;
    this.review_info.reviewed_at = new Date();
    
    if (newStatus === 'approved') {
      this.review_info.approved_at = new Date();
    }
  }
  
  if (notes) {
    this.review_info.admin_notes = notes;
  }
  
  return this.save();
};

/**
 * Валидация французского телефона
 */
initialPartnerRequestSchema.methods.validateFrenchPhone = function() {
  const phone = this.personal_data.phone;
  if (!phone) return false;
  
  const frenchPhoneRegex = /^(\+33|0)[1-9](\d{8})$/;
  const cleanPhone = phone.replace(/\s/g, '');
  return frenchPhoneRegex.test(cleanPhone);
};

// ================ НАСТРОЙКИ JSON ================
initialPartnerRequestSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Не возвращаем зашифрованные данные в JSON
    if (ret.personal_data) {
      delete ret.personal_data.first_name;
      delete ret.personal_data.last_name;
      delete ret.personal_data.email;
      delete ret.personal_data.phone;
    }
    if (ret.business_data) {
      delete ret.business_data.address;
      delete ret.business_data.floor_unit;
      delete ret.business_data.owner_name;      // ✅ ДОБАВИТЬ
      delete ret.business_data.owner_surname; 
    }
    return ret;
  }
});

export default mongoose.model('InitialPartnerRequest', initialPartnerRequestSchema);