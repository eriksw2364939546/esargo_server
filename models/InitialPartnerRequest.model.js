// models/InitialPartnerRequest.model.js (ДОБАВЛЕНИЕ НОВОГО СТАТУСА)
import mongoose from 'mongoose';

const initialPartnerRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // ... все существующие поля остаются ...
  
  status: {
    type: String,
    enum: [
      'pending',           // Ждет одобрения админом (ЭТАП 1)
      'approved',          // Одобрено, можно подавать юр.данные (ЭТАП 2) 
      'under_review',      // Юр.данные на проверке (ЭТАП 3)
      'legal_approved',    // 🆕 НОВЫЙ! Юр.данные одобрены, PartnerProfile создан (ЭТАП 4)
      'content_review',    // Контент на модерации (ЭТАП 5)
      'completed',         // ВСЁ ГОТОВО! Публичный доступ (ЭТАП 6)
      'rejected'           // Отклонено на любом этапе
    ],
    default: 'pending',
    index: true
  },
  
  // ... все остальные поля остаются без изменений ...
  
}, {
  timestamps: true
});

// ================ МЕТОДЫ ЭКЗЕМПЛЯРА ================

// Одобрение первичной заявки (переход к юр.данным)
initialPartnerRequestSchema.methods.approve = function(adminId, notes = '') {
  this.status = 'approved';
  this.review_info = {
    reviewed_by: adminId,
    reviewed_at: new Date(),
    decision: 'approved',
    admin_notes: notes
  };
  
  return this.save();
};

// Отклонение заявки
initialPartnerRequestSchema.methods.reject = function(adminId, reason) {
  this.status = 'rejected';
  this.review_info = {
    reviewed_by: adminId,
    reviewed_at: new Date(),
    decision: 'rejected',
    rejection_reason: reason
  };
  
  return this.save();
};

// 🆕 НОВОЕ: Перевод в статус "юр.данные одобрены"
initialPartnerRequestSchema.methods.approveLegal = function(adminId, notes = '') {
  this.status = 'legal_approved';
  if (!this.review_info) {
    this.review_info = {};
  }
  this.review_info.legal_approved_by = adminId;
  this.review_info.legal_approved_at = new Date();
  this.review_info.legal_notes = notes;
  
  return this.save();
};

// 🆕 НОВОЕ: Перевод в статус "контент на модерации"
initialPartnerRequestSchema.methods.submitForContentReview = function() {
  this.status = 'content_review';
  return this.save();
};

// 🆕 НОВОЕ: Финальное завершение (публичный доступ)
initialPartnerRequestSchema.methods.complete = function(adminId, notes = '') {
  this.status = 'completed';
  if (!this.review_info) {
    this.review_info = {};
  }
  this.review_info.completed_by = adminId;
  this.review_info.completed_at = new Date();
  this.review_info.completion_notes = notes;
  
  return this.save();
};

// ================ СТАТИЧЕСКИЕ МЕТОДЫ ================

// Поиск заявок по статусу
initialPartnerRequestSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ submitted_at: 1 });
};

// Поиск заявок ожидающих одобрения
initialPartnerRequestSchema.statics.findPendingApproval = function() {
  return this.find({ 
    status: { $in: ['pending', 'under_review', 'content_review'] }
  }).sort({ submitted_at: 1 });
};

// 🆕 НОВОЕ: Поиск заявок готовых для создания профиля
initialPartnerRequestSchema.statics.findReadyForProfile = function() {
  return this.find({ 
    status: 'approved' // Одобрены, но еще нет юр.данных
  }).sort({ submitted_at: 1 });
};

// 🆕 НОВОЕ: Поиск заявок с одобренными юр.данными
initialPartnerRequestSchema.statics.findWithApprovedLegal = function() {
  return this.find({ 
    status: 'legal_approved' // Юр.данные одобрены, можно наполнять контент
  }).sort({ submitted_at: 1 });
};

export default mongoose.model('InitialPartnerRequest', initialPartnerRequestSchema);