const mongoose = require('mongoose');

const initialPartnerRequestSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected', 'awaiting_legal_info'],
    default: 'pending',
    index: true
  },
  business_data: {
    business_name: { type: String, required: true, trim: true, maxlength: 100 },
    brand_name: { type: String, trim: true, maxlength: 100 },
    category: { type: String, required: true, enum: ['restaurant', 'store'] },
    address: { type: String, required: true, trim: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    owner_name: { type: String, required: true, trim: true },
    owner_surname: { type: String, required: true, trim: true },
    floor_unit: { type: String, trim: true, maxlength: 100 }
  },
  whatsapp_consent: { type: Boolean, default: false },
  submitted_at: { type: Date, required: true, default: Date.now, index: true },
  review_info: {
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
    reviewed_at: Date,
    rejection_reason: String,
    admin_notes: String
  },
  source: { type: String, enum: ['web', 'mobile', 'admin'], default: 'web' },
  ip_address: String,
  user_agent: String
}, {
  timestamps: true
});

initialPartnerRequestSchema.index({ user_id: 1, status: 1 });
initialPartnerRequestSchema.index({ 'business_data.category': 1 });
initialPartnerRequestSchema.index({ submitted_at: -1 });

initialPartnerRequestSchema.methods.approve = function(adminId, notes = '') {
  this.status = 'awaiting_legal_info';
  this.review_info.reviewed_by = adminId;
  this.review_info.reviewed_at = new Date();
  this.review_info.admin_notes = notes;
  return this.save();
};

initialPartnerRequestSchema.methods.reject = function(adminId, reason) {
  this.status = 'rejected';
  this.review_info.reviewed_by = adminId;
  this.review_info.reviewed_at = new Date();
  this.review_info.rejection_reason = reason;
  return this.save();
};

module.exports = mongoose.model('InitialPartnerRequest', initialPartnerRequestSchema);
