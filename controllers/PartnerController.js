const mongoose = require('mongoose');
const { InitialPartnerRequest, PartnerLegalInfo, User } = require('../models');

// Этап 1: Создание первичной заявки
const createInitialPartnerRequest = async (req, res) => {
  try {
    const {
      business_name,
      brand_name,
      category,
      description,
      address,
      location,
      phone,
      email,
      owner_name,
      owner_surname,
      floor_unit,
      whatsapp_consent,
      working_hours,
      user_id // fallback для тестов
    } = req.body;

    const user = req.user || (user_id ? { _id: user_id } : null);
    if (!user) {
      return res.status(401).json({ result: false, message: "User not authenticated" });
    }

    // Валидация обязательных полей
    if (!business_name || !category || !address || !phone || !email || !owner_name || !owner_surname) {
      return res.status(400).json({ 
        result: false, 
        message: "Missing required fields: business_name, category, address, phone, email, owner_name, owner_surname" 
      });
    }
    
    if (!location || location.lat == null || location.lng == null) {
      return res.status(400).json({ result: false, message: "Missing location coordinates!" });
    }
    
    if (!['restaurant', 'store'].includes(category)) {
      return res.status(400).json({ result: false, message: "Invalid category! Must be 'restaurant' or 'store'" });
    }

    // Проверка на существующую активную заявку
    const existingRequest = await InitialPartnerRequest.findOne({
      user_id: new mongoose.Types.ObjectId(user._id), // ✅ ИСПРАВЛЕНО
      status: { $in: ['pending', 'awaiting_legal_info'] }
    });
    
    if (existingRequest) {
      return res.status(400).json({ result: false, message: "You already have an active partner request!" });
    }

    let cover_image_url = null;
    if (req.uploadedFiles?.length > 0) {
      cover_image_url = req.uploadedFiles[0];
    }

    const newRequest = new InitialPartnerRequest({
      user_id: new mongoose.Types.ObjectId(user._id), // ✅ ИСПРАВЛЕНО
      business_data: {
        business_name,
        brand_name,
        category,
        description,
        address,
        location: {
          lat: parseFloat(location.lat),
          lng: parseFloat(location.lng)
        },
        phone,
        email,
        owner_name,
        owner_surname,
        floor_unit,
        cover_image_url
      },
      whatsapp_consent: whatsapp_consent || false,
      source: 'web',
      ip_address: req.ip || 'unknown',
      user_agent: req.get('User-Agent') || 'unknown'
    });

    await newRequest.save();

    res.status(201).json({
      result: true,
      message: "Initial partner request created successfully! Wait for approval to proceed with legal information.",
      request_id: newRequest._id,
      status: newRequest.status
    });

  } catch (error) {
    console.error('Error in createInitialPartnerRequest:', error);
    
    // Обработка ошибок валидации
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        result: false,
        message: "Validation error",
        errors: validationErrors
      });
    }
    
    // Обработка дублирования
    if (error.code === 11000) {
      return res.status(400).json({
        result: false,
        message: "Duplicate data: this information already exists in our system"
      });
    }
    
    res.status(500).json({ 
      result: false, 
      message: "Failed to create request", 
      error: error.message 
    });
  }
};

// Этап 2: Заполнение юридических данных
const submitPartnerLegalInfo = async (req, res) => {
  try {
    const { request_id } = req.params;
    const {
      legal_name,
      siret_number,
      legal_form,
      tva_number,
      legal_address,
      director_name,
      iban,
      bic,
      legal_email,
      legal_phone,
      user_id // fallback
    } = req.body;

    const user = req.user || (user_id ? { _id: user_id } : null);
    if (!user) {
      return res.status(401).json({ result: false, message: "User not authenticated" });
    }

    // Проверяем существующую заявку
    const request = await InitialPartnerRequest.findOne({
      _id: request_id,
      user_id: new mongoose.Types.ObjectId(user._id), // ✅ ИСПРАВЛЕНО
      status: 'awaiting_legal_info'
    });
    
    if (!request) {
      return res.status(404).json({ 
        result: false, 
        message: "Request not found or not approved yet. Please wait for initial approval." 
      });
    }

    // Проверка дубликатов
    const existingLegalInfo = await PartnerLegalInfo.findOne({ partner_request_id: request_id });
    if (existingLegalInfo) {
      return res.status(400).json({ result: false, message: "Legal info already submitted for this request" });
    }

    const legalInfo = new PartnerLegalInfo({
      partner_request_id: new mongoose.Types.ObjectId(request_id), // ✅ ИСПРАВЛЕНО
      user_id: new mongoose.Types.ObjectId(user._id), // ✅ ИСПРАВЛЕНО
      legal_data: {
        legal_name,
        siret_number,
        legal_form,
        tva_number,
        legal_address,
        director_name,
        iban: iban.replace(/\s/g, ''), // Убираем пробелы
        bic,
        legal_email: legal_email.toLowerCase(),
        legal_phone
      }
    });

    await legalInfo.save();

    // Обновляем статус заявки
    request.status = 'approved';
    await request.save();

    res.status(201).json({
      result: true,
      message: "Legal information submitted successfully! Your partnership request is now complete.",
      legal_info_id: legalInfo._id,
      request_status: 'approved'
    });

  } catch (error) {
    console.error('Error in submitPartnerLegalInfo:', error);
    
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      let message = "This information already exists in our system";
      
      if (duplicateField.includes('siret_number')) {
        message = "SIRET number already registered";
      }
      
      return res.status(400).json({ result: false, message });
    }
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        result: false,
        message: "Validation error",
        errors: validationErrors
      });
    }
    
    res.status(500).json({ 
      result: false, 
      message: "Failed to submit legal info", 
      error: error.message 
    });
  }
};

// Получение всех заявок (админ)
const getPartnerRequests = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    const filter = {};
    
    if (status && ['pending', 'approved', 'rejected', 'awaiting_legal_info'].includes(status)) {
      filter.status = status;
    }
    if (category && ['restaurant', 'store'].includes(category)) {
      filter['business_data.category'] = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const requests = await InitialPartnerRequest.find(filter)
      .populate('user_id', 'email')
      .populate('review_info.reviewed_by', 'full_name email')
      .sort({ submitted_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await InitialPartnerRequest.countDocuments(filter);

    res.status(200).json({
      result: true,
      message: "Partner requests fetched successfully",
      requests,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });

  } catch (error) {
    console.error('Error in getPartnerRequests:', error);
    res.status(500).json({ 
      result: false, 
      message: "Failed to get requests", 
      error: error.message 
    });
  }
};

// Обновление статуса заявки (админ)
const updatePartnerRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason, admin_notes } = req.body;
    const admin = req.admin || { _id: "64e8b2f0c2a4f91a12345679" }; // Fallback для тестов

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        result: false, 
        message: "Invalid status. Must be 'approved' or 'rejected'" 
      });
    }

    if (status === 'rejected' && !rejection_reason) {
      return res.status(400).json({
        result: false,
        message: "Rejection reason is required when rejecting a request"
      });
    }

    const request = await InitialPartnerRequest.findById(id);
    if (!request) {
      return res.status(404).json({ result: false, message: "Partner request not found" });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        result: false,
        message: `Request already processed. Current status: ${request.status}`
      });
    }

    if (status === 'approved') {
      await request.approve(new mongoose.Types.ObjectId(admin._id), admin_notes);
    } else {
      await request.reject(new mongoose.Types.ObjectId(admin._id), rejection_reason);
    }

    res.status(200).json({ 
      result: true, 
      message: `Request ${status} successfully`,
      request_id: id,
      new_status: request.status
    });

  } catch (error) {
    console.error('Error in updatePartnerRequestStatus:', error);
    res.status(500).json({ 
      result: false, 
      message: "Failed to update status", 
      error: error.message 
    });
  }
};

module.exports = {
  createInitialPartnerRequest,
  submitPartnerLegalInfo,
  getPartnerRequests,
  updatePartnerRequestStatus
};