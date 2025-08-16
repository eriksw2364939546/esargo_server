const mongoose = require('mongoose');
const { InitialPartnerRequest, PartnerLegalInfo, User } = require('../models');

// Этап 1: Создание первичной заявки
const createInitialPartnerRequest = async (req, res) => {
  try {
    const {
      business_name,
      category,
      description,
      address,
      location,
      phone,
      owner_name,
      owner_surname,
      working_hours,
      user_id // fallback для тестов
    } = req.body;

    const user = req.user || (user_id ? { _id: user_id } : null);
    if (!user) {
      return res.status(401).json({ result: false, message: "User not authenticated" });
    }

    // Валидация обязательных полей
    if (!business_name || !category || !address || !phone || !owner_name || !owner_surname) {
      return res.status(400).json({ result: false, message: "Missing required business fields!" });
    }
    if (!location || location.lat == null || location.lng == null) {
      return res.status(400).json({ result: false, message: "Missing location coordinates!" });
    }
    if (!['restaurant', 'store'].includes(category)) {
      return res.status(400).json({ result: false, message: "Invalid category!" });
    }

    // Проверка на существующую активную заявку
    const existingRequest = await InitialPartnerRequest.findOne({
      user_id: mongoose.Types.ObjectId(user._id),
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
      user_id: mongoose.Types.ObjectId(user._id),
      business_data: {
        business_name,
        category,
        description,
        address,
        location: {
          lat: parseFloat(location.lat),
          lng: parseFloat(location.lng)
        },
        phone,
        owner_name,
        owner_surname,
        cover_image_url,
        working_hours
      },
      source: 'web',
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    await newRequest.save();

    res.status(201).json({
      result: true,
      message: "Initial partner request created. Wait for approval.",
      request_id: newRequest._id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ result: false, message: "Failed to create request", error: error.message });
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
      user_id: mongoose.Types.ObjectId(user._id),
      status: 'awaiting_legal_info'
    });
    if (!request) {
      return res.status(404).json({ result: false, message: "Request not found or not approved yet" });
    }

    // Проверка дубликатов
    const existingLegalInfo = await PartnerLegalInfo.findOne({ partner_request_id: request_id });
    if (existingLegalInfo) {
      return res.status(400).json({ result: false, message: "Legal info already submitted" });
    }

    const legalInfo = new PartnerLegalInfo({
      partner_request_id: request_id,
      user_id: mongoose.Types.ObjectId(user._id),
      legal_data: {
        legal_name,
        siret_number,
        legal_form,
        tva_number,
        legal_address,
        director_name,
        iban,
        bic,
        legal_email,
        legal_phone
      }
    });

    await legalInfo.save();

    // Обновляем статус заявки
    request.status = 'approved';
    await request.save();

    res.status(201).json({
      result: true,
      message: "Legal info submitted successfully",
      legal_info_id: legalInfo._id
    });

  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ result: false, message: "SIRET already exists" });
    }
    res.status(500).json({ result: false, message: "Failed to submit legal info", error: error.message });
  }
};

// Получение всех заявок (админ)
const getPartnerRequests = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter['business_data.category'] = category;

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
      message: "Requests fetched",
      requests,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ result: false, message: "Failed to get requests", error: error.message });
  }
};

// Обновление статуса заявки (админ)
const updatePartnerRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason, admin_notes } = req.body;
    const { admin } = req;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ result: false, message: "Invalid status" });
    }

    const request = await InitialPartnerRequest.findById(id);
    if (!request) {
      return res.status(404).json({ result: false, message: "Request not found" });
    }

    if (status === 'approved') {
      await request.approve(admin._id, admin_notes);
    } else {
      await request.reject(admin._id, rejection_reason);
    }

    res.status(200).json({ result: true, message: `Request ${status}` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ result: false, message: "Failed to update status", error: error.message });
  }
};

module.exports = {
  createInitialPartnerRequest,
  submitPartnerLegalInfo,
  getPartnerRequests,
  updatePartnerRequestStatus
};
