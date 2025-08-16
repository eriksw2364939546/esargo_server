// controllers/PartnerController.js (исправленная версия)
import { 
  loginPartner, 
  getPartnerProfile, 
  getPartnerRequestStatus 
} from '../services/partner.service.js';
import {
  approveInitialPartnerRequest,
  rejectInitialPartnerRequest,
  approveLegalInfoAndCreatePartner,
  rejectLegalInfo,
  getAllPartnerRequests,
  getPartnerRequestDetails
} from '../services/admin.partner.service.js';
import { InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import mongoose from 'mongoose';

// ================ ПУБЛИЧНЫЕ МЕТОДЫ ================

/**
 * Этап 1: Создание первичной заявки
 */
export const createInitialPartnerRequest = async (req, res) => {
  try {
    const {
      business_name,
      brand_name,        // ← Вернул обратно
      category,
      description,
      address,
      location,
      phone,
      email,             // ← Вернул обратно
      owner_name,
      owner_surname,
      floor_unit,        // ← Вернул обратно
      whatsapp_consent,  // ← Вернул обратно
      working_hours,
      user_id // fallback для тестов
    } = req.body;

    const user = req.user || (user_id ? { _id: user_id } : null);
    if (!user) {
      return res.status(401).json({ result: false, message: "User not authenticated" });
    }

    // Валидация обязательных полей (с email!)
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

    // Проверка на существующую активную заявку (с under_review!)
    const existingRequest = await InitialPartnerRequest.findOne({
      user_id: new mongoose.Types.ObjectId(user._id), // ← Исправил
      status: { $in: ['pending', 'awaiting_legal_info', 'under_review'] } // ← Добавил under_review
    });
    
    if (existingRequest) {
      return res.status(400).json({ result: false, message: "You already have an active partner request!" });
    }

    let cover_image_url = null;
    if (req.uploadedFiles?.length > 0) {
      cover_image_url = req.uploadedFiles[0];
    }

    const newRequest = new InitialPartnerRequest({
      user_id: new mongoose.Types.ObjectId(user._id), // ← Исправил
      business_data: {
        business_name,
        brand_name,        // ← Вернул
        category,
        description,
        address,
        location: {
          lat: parseFloat(location.lat),
          lng: parseFloat(location.lng)
        },
        phone,
        email,             // ← Вернул
        owner_name,
        owner_surname,
        floor_unit,        // ← Вернул
        cover_image_url
      },
      whatsapp_consent: whatsapp_consent || false, // ← Вернул
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
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        result: false,
        message: "Validation error",
        errors: validationErrors
      });
    }
    
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

/**
 * Этап 2: Заполнение юридических данных
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
      return res.status(401).json({ result: false, message: "User not authenticated" });
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
        iban: iban.replace(/\s/g, ''), // убираем пробелы
        bic,
        legal_email: legal_email.toLowerCase(),
        legal_phone
      }
    });

    await legalInfo.save();

    // Обновляем статус заявки
    request.status = 'under_review'; // ✅ Ваша правильная версия!
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

// ================ НОВЫЕ МЕТОДЫ С СЕРВИСАМИ ================

/**
 * Авторизация партнера
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
 * Получение профиля партнера
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

    const partnerProfile = await getPartnerProfile(user._id);

    res.status(200).json({
      result: true,
      message: "Профиль партнера получен",
      partner: partnerProfile
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
 * Получение статуса заявки партнера
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

    const status = await getPartnerRequestStatus(user._id);

    res.status(200).json({
      result: true,
      message: "Статус заявки получен",
      ...status
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
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      sort_by: req.query.sort_by || 'submitted_at',
      sort_order: req.query.sort_order || 'desc'
    };

    const result = await getAllPartnerRequests(filters);

    res.status(200).json({
      result: true,
      message: "Partner requests fetched successfully",
      requests: result.requests,
      pagination: result.pagination
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
      if (!rejection_reason) {
        return res.status(400).json({
          result: false,
          message: "Rejection reason is required"
        });
      }
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
      message: "Failed to update status", 
      error: error.message 
    });
  }
};

/**
 * Одобрение юридических данных и создание партнера
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
 * Отклонение юридических данных
 */
export const rejectLegalInfoData = async (req, res) => {
  try {
    const { legal_info_id } = req.params;
    const { rejection_reason, correction_notes } = req.body;
    const admin = req.user;

    if (!rejection_reason) {
      return res.status(400).json({
        result: false,
        message: "Rejection reason is required"
      });
    }

    const result = await rejectLegalInfo(legal_info_id, admin._id, rejection_reason, correction_notes);

    res.status(200).json({
      result: true,
      message: result.message,
      legal_info: result.legalInfo
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
 * Получение подробной информации о заявке
 */
export const getRequestDetails = async (req, res) => {
  try {
    const { request_id } = req.params;

    const result = await getPartnerRequestDetails(request_id);

    res.status(200).json({
      result: true,
      message: "Request details fetched successfully",
      request: result.request,
      legal_info: result.legal_info
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
