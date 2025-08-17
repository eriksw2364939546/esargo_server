// controllers/PartnerController.js (исправленный)
import { 
  loginPartner, 
  getPartnerById 
} from '../services/partner.service.js';
import {
  approveInitialPartnerRequest,
  rejectInitialPartnerRequest,
  approveLegalInfoAndCreatePartner
} from '../services/admin.partner.service.js';
import { InitialPartnerRequest, PartnerLegalInfo, PartnerProfile } from '../models/index.js';
import mongoose from 'mongoose';

// ================ ПУБЛИЧНЫЕ МЕТОДЫ ================

/**
 * 🆕 ИСПРАВЛЕНО: Авторизация партнера
 */
export const loginPartnerUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        result: false,
        message: "Email и пароль обязательны"
      });
    }

    const loginResult = await loginPartner({ email, password });

    res.status(200).json({
      result: true,
      message: "Вход выполнен успешно",
      user: loginResult.user,
      token: loginResult.token
    });

  } catch (error) {
    console.error('Partner login error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка при входе",
      error: error.message
    });
  }
};

/**
 * Этап 1: Создание первичной заявки
 */
export const createInitialPartnerRequest = async (req, res) => {
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
      return res.status(401).json({ 
        result: false, 
        message: "User not authenticated" 
      });
    }

    // Валидация обязательных полей
    if (!business_name || !category || !address || !phone || !email || !owner_name || !owner_surname) {
      return res.status(400).json({ 
        result: false, 
        message: "Missing required fields: business_name, category, address, phone, email, owner_name, owner_surname" 
      });
    }
    
    if (!location || location.lat == null || location.lng == null) {
      return res.status(400).json({ 
        result: false, 
        message: "Missing location coordinates!" 
      });
    }
    
    if (!['restaurant', 'store'].includes(category)) {
      return res.status(400).json({ 
        result: false, 
        message: "Invalid category! Must be 'restaurant' or 'store'" 
      });
    }

    // Проверка на существующую активную заявку
    const existingRequest = await InitialPartnerRequest.findOne({
      user_id: new mongoose.Types.ObjectId(user._id),
      status: { $in: ['pending', 'awaiting_legal_info', 'under_review'] }
    });
    
    if (existingRequest) {
      return res.status(400).json({ 
        result: false, 
        message: "You already have an active partner request!" 
      });
    }

    // Создание новой заявки
    const newRequest = new InitialPartnerRequest({
      user_id: new mongoose.Types.ObjectId(user._id),
      business_data: {
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
        whatsapp_consent: whatsapp_consent || false,
        working_hours: working_hours || {
          monday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          tuesday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          wednesday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          thursday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          friday: { is_open: true, open_time: '09:00', close_time: '21:00' },
          saturday: { is_open: true, open_time: '10:00', close_time: '22:00' },
          sunday: { is_open: false, open_time: null, close_time: null }
        }
      },
      status: 'pending'
    });

    await newRequest.save();

    res.status(201).json({
      result: true,
      message: "Initial partner request created successfully! Await admin approval.",
      request_id: newRequest._id,
      status: newRequest.status
    });

  } catch (error) {
    console.error('Error in createInitialPartnerRequest:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        result: false, 
        message: "Duplicate business information detected" 
      });
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
      message: "Failed to create partner request",
      error: error.message
    });
  }
};

/**
 * Этап 2: Подача юридических данных
 */
export const submitPartnerLegalInfo = async (req, res) => {
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
      user_id // fallback для тестов
    } = req.body;

    const user = req.user || (user_id ? { _id: user_id } : null);
    if (!user) {
      return res.status(401).json({ 
        result: false, 
        message: "User not authenticated" 
      });
    }

    // Проверяем существующую заявку
    const request = await InitialPartnerRequest.findOne({
      _id: request_id,
      user_id: new mongoose.Types.ObjectId(user._id),
      status: 'awaiting_legal_info'
    });
    
    if (!request) {
      return res.status(404).json({
        result: false,
        message: "Request not found or not ready for legal info submission"
      });
    }

    // Проверяем, не были ли уже поданы юр. данные
    const existingLegalInfo = await PartnerLegalInfo.findOne({
      partner_request_id: request_id
    });
    
    if (existingLegalInfo) {
      return res.status(400).json({
        result: false,
        message: "Legal info already submitted for this request"
      });
    }

    // Создаем новую запись юридических данных
    const legalInfo = new PartnerLegalInfo({
      partner_request_id: new mongoose.Types.ObjectId(request_id),
      user_id: new mongoose.Types.ObjectId(user._id),
      legal_data: {
        legal_name,
        siret_number,
        legal_form,
        tva_number,
        legal_address,
        director_name,
        iban: iban ? iban.replace(/\s/g, '') : '', // убираем пробелы
        bic,
        legal_email: legal_email ? legal_email.toLowerCase() : '',
        legal_phone
      }
    });

    await legalInfo.save();

    // Обновляем статус заявки
    request.status = 'under_review';
    await request.save();

    res.status(201).json({
      result: true,
      message: "Legal information submitted successfully! Your partnership request is under review.",
      legal_info_id: legalInfo._id,
      request_status: request.status
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

/**
 * 🆕 ИСПРАВЛЕНО: Получение профиля партнера
 */
export const getPartnerProfileData = async (req, res) => {
  try {
    const { user } = req;

    if (!user || user.role !== 'partner') {
      return res.status(403).json({
        result: false,
        message: "Доступ разрешен только для партнеров"
      });
    }

    // 🆕 ИСПРАВЛЕНО: Используем новый метод
    const partnerData = await getPartnerById(user._id);

    if (!partnerData || !partnerData.profile) {
      return res.status(404).json({
        result: false,
        message: "Профиль партнера не найден"
      });
    }

    res.status(200).json({
      result: true,
      message: "Профиль партнера получен",
      user: {
        id: partnerData._id,
        email: partnerData.email,
        role: partnerData.role,
        is_email_verified: partnerData.is_email_verified
      },
      partner: partnerData.profile
    });

  } catch (error) {
    console.error('Get partner profile error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при получении профиля"
    });
  }
};

/**
 * 🆕 ИСПРАВЛЕНО: Получение статуса заявки партнера
 */
export const getRequestStatus = async (req, res) => {
  try {
    const { user } = req;

    if (!user) {
      return res.status(401).json({
        result: false,
        message: "Пользователь не аутентифицирован"
      });
    }

    // Ищем первичную заявку
    const initialRequest = await InitialPartnerRequest.findOne({
      user_id: user._id
    }).sort({ submitted_at: -1 });

    if (!initialRequest) {
      return res.status(200).json({
        result: true,
        hasRequest: false,
        status: null,
        message: 'Заявка не найдена'
      });
    }

    // Ищем юридическую информацию
    let legalInfo = null;
    if (initialRequest.status === 'awaiting_legal_info' || initialRequest.status === 'under_review') {
      legalInfo = await PartnerLegalInfo.findOne({
        partner_request_id: initialRequest._id
      });
    }

    // Ищем профиль партнера
    const partnerProfile = await PartnerProfile.findOne({
      user_id: user._id
    });

    res.status(200).json({
      result: true,
      hasRequest: true,
      initialRequest: {
        id: initialRequest._id,
        status: initialRequest.status,
        submitted_at: initialRequest.submitted_at,
        business_data: initialRequest.business_data
      },
      legalInfo: legalInfo ? {
        id: legalInfo._id,
        verification_status: legalInfo.verification_status,
        submitted_at: legalInfo.submitted_at
      } : null,
      partnerProfile: partnerProfile ? {
        id: partnerProfile._id,
        is_approved: partnerProfile.is_approved,
        is_active: partnerProfile.is_active
      } : null
    });

  } catch (error) {
    console.error('Get request status error:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Ошибка при получении статуса"
    });
  }
};

// ================ АДМИНСКИЕ МЕТОДЫ ================

/**
 * Получение всех заявок (админ)
 */
export const getPartnerRequests = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      category: req.query.category,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      sort_by: req.query.sort_by || 'submitted_at',
      sort_order: req.query.sort_order || 'desc'
    };

    const skip = (filters.page - 1) * filters.limit;
    const query = {};
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.category) {
      query['business_data.category'] = filters.category;
    }

    const requests = await InitialPartnerRequest.find(query)
      .populate('user_id', 'email')
      .sort({ [filters.sort_by]: filters.sort_order === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(filters.limit);

    const totalCount = await InitialPartnerRequest.countDocuments(query);

    res.status(200).json({
      result: true,
      message: "Partner requests fetched successfully",
      requests,
      pagination: {
        total: totalCount,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(totalCount / filters.limit)
      }
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

/**
 * Обновление статуса заявки (админ)
 */
export const updatePartnerRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason, admin_notes } = req.body;
    const admin = req.user;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        result: false, 
        message: "Invalid status. Must be 'approved' or 'rejected'" 
      });
    }

    let result;
    if (status === 'approved') {
      result = await approveInitialPartnerRequest(id, admin._id, admin_notes);
    } else {
      result = await rejectInitialPartnerRequest(id, admin._id, rejection_reason);
    }

    res.status(200).json({
      result: true,
      message: result.message,
      request: result.request
    });

  } catch (error) {
    console.error('Error in updatePartnerRequestStatus:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Failed to update request status",
      error: error.message
    });
  }
};

/**
 * Одобрение юридических данных и создание партнера (админ)
 */
export const approveLegalInfoAndCreate = async (req, res) => {
  try {
    const { legal_info_id } = req.params;
    const { admin_notes } = req.body;
    const admin = req.user;

    const result = await approveLegalInfoAndCreatePartner(legal_info_id, admin._id, admin_notes);

    res.status(200).json({
      result: true,
      message: result.message,
      partner: result.partner,
      legal_info: result.legalInfo
    });

  } catch (error) {
    console.error('Error in approveLegalInfoAndCreate:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Failed to approve legal info",
      error: error.message
    });
  }
};

/**
 * Отклонение юридических данных (админ)
 */
export const rejectLegalInfoData = async (req, res) => {
  try {
    const { legal_info_id } = req.params;
    const { rejection_reason } = req.body;
    const admin = req.user;

    if (!rejection_reason) {
      return res.status(400).json({
        result: false,
        message: "Rejection reason is required"
      });
    }

    const legalInfo = await PartnerLegalInfo.findById(legal_info_id);
    if (!legalInfo) {
      return res.status(404).json({
        result: false,
        message: "Legal info not found"
      });
    }

    legalInfo.verification_status = 'rejected';
    legalInfo.rejection_reason = rejection_reason;
    legalInfo.rejected_by = admin._id;
    legalInfo.rejected_at = new Date();
    await legalInfo.save();

    // Обновляем статус заявки
    const request = await InitialPartnerRequest.findById(legalInfo.partner_request_id);
    if (request) {
      request.status = 'awaiting_legal_info';
      await request.save();
    }

    res.status(200).json({
      result: true,
      message: "Legal info rejected successfully",
      legal_info: legalInfo
    });

  } catch (error) {
    console.error('Error in rejectLegalInfoData:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Failed to reject legal info",
      error: error.message
    });
  }
};

/**
 * Получение подробной информации о заявке (админ)
 */
export const getRequestDetails = async (req, res) => {
  try {
    const { request_id } = req.params;

    const request = await InitialPartnerRequest.findById(request_id)
      .populate('user_id', 'email createdAt');

    if (!request) {
      return res.status(404).json({
        result: false,
        message: "Request not found"
      });
    }

    let legalInfo = null;
    if (request.status === 'under_review' || request.status === 'awaiting_legal_info') {
      legalInfo = await PartnerLegalInfo.findOne({
        partner_request_id: request_id
      });
    }

    res.status(200).json({
      result: true,
      message: "Request details fetched successfully",
      request,
      legal_info: legalInfo
    });

  } catch (error) {
    console.error('Error in getRequestDetails:', error);
    res.status(500).json({
      result: false,
      message: error.message || "Failed to get request details",
      error: error.message
    });
  }
};

// ================ ЭКСПОРТ ================

export default {
  // Этапы регистрации партнера
  createInitialPartnerRequest,
  submitPartnerLegalInfo,
  
  // Авторизация и профиль партнера
  loginPartnerUser,
  getPartnerProfileData,
  getRequestStatus,
  
  // Админские методы
  getPartnerRequests,
  updatePartnerRequestStatus,
  approveLegalInfoAndCreate,
  rejectLegalInfoData,
  getRequestDetails
};