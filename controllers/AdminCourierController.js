// controllers/AdminCourierController.js - ПОЛНЫЙ ФАЙЛ с соблюдением архитектуры
import {
  approveCourierApplication as approveService,
  rejectCourierApplication as rejectService,
  getAllCourierApplications as getAllApplicationsService,
  getCourierApplicationDetails as getDetailsService,
  getAllCourierProfiles as getAllProfilesService,
  blockCourierProfile as blockService,
  unblockCourierProfile as unblockService,
  getCourierStatistics as getStatisticsService
} from '../services/Courier/adminCourier.service.js';

/**
 * 1. Получение всех заявок курьеров
 * GET /api/admin/couriers/applications
 */
const getAllCourierApplications = async (req, res) => {
  try {
    const { admin } = req;
    
    // Извлекаем параметры из req
    const filters = {
      status: req.query.status || 'all',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      vehicle_type: req.query.vehicle_type || 'all',
      sort_by: req.query.sort_by || 'submitted_at',
      sort_order: req.query.sort_order || 'desc'
    };

    console.log('📋 GET ALL COURIER APPLICATIONS:', {
      admin_id: admin._id,
      filters
    });

    // Вызов сервиса
    const result = await getAllApplicationsService(filters);

    // Возврат ответа
    res.status(200).json({
      result: true,
      message: "Список заявок курьеров получен",
      ...result
    });

  } catch (error) {
    console.error('🚨 GET ALL COURIER APPLICATIONS - Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения заявок курьеров",
      error: error.message
    });
  }
};

/**
 * 2. Получение деталей заявки курьера
 * GET /api/admin/couriers/applications/:id
 */
const getCourierApplicationDetails = async (req, res) => {
  try {
    const { admin } = req;
    const { id } = req.params;

    console.log('🔍 GET COURIER APPLICATION DETAILS:', {
      admin_id: admin._id,
      application_id: id
    });

    // Вызов сервиса
    const result = await getDetailsService(id);

    // Возврат ответа
    res.status(200).json({
      result: true,
      message: "Детали заявки курьера получены",
      ...result
    });

  } catch (error) {
    console.error('🚨 GET COURIER APPLICATION DETAILS - Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения деталей заявки",
      error: error.message
    });
  }
};

/**
 * 3. Одобрение заявки курьера
 * POST /api/admin/couriers/applications/:id/approve
 */
const approveCourierApplication = async (req, res) => {
  try {
    const { admin } = req;
    const { id } = req.params;
    const { admin_notes = '' } = req.body;

    console.log('✅ APPROVE COURIER APPLICATION:', {
      application_id: id,
      admin_id: admin._id
    });

    // Проверка доступа (контроллер может проверить права)
    if (!['manager', 'owner'].includes(admin.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для одобрения заявок курьеров"
      });
    }

    // Вызов сервиса
    const result = await approveService(id, admin._id, admin_notes);

    // Возврат ответа
    res.status(200).json({
      result: true,
      message: "Заявка курьера одобрена и профиль создан",
      ...result
    });

  } catch (error) {
    console.error('🚨 APPROVE COURIER APPLICATION - Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка одобрения заявки курьера",
      error: error.message
    });
  }
};

/**
 * 4. Отклонение заявки курьера
 * POST /api/admin/couriers/applications/:id/reject
 */
const rejectCourierApplication = async (req, res) => {
  try {
    const { admin } = req;
    const { id } = req.params;
    const { rejection_reason, admin_notes = '' } = req.body;

    console.log('❌ REJECT COURIER APPLICATION:', {
      application_id: id,
      admin_id: admin._id,
      reason: rejection_reason
    });

    // Проверка доступа (контроллер может проверить права)
    if (!['manager', 'owner'].includes(admin.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для отклонения заявок курьеров"
      });
    }

    // Базовая валидация входных данных
    if (!rejection_reason || rejection_reason.trim().length === 0) {
      return res.status(400).json({
        result: false,
        message: "Причина отклонения обязательна"
      });
    }

    // Вызов сервиса
    const result = await rejectService(id, admin._id, rejection_reason, admin_notes);

    // Возврат ответа
    res.status(200).json({
      result: true,
      message: "Заявка курьера отклонена",
      ...result
    });

  } catch (error) {
    console.error('🚨 REJECT COURIER APPLICATION - Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка отклонения заявки курьера",
      error: error.message
    });
  }
};

/**
 * 5. Получение всех профилей курьеров
 * GET /api/admin/couriers/profiles
 */
const getAllCourierProfiles = async (req, res) => {
  try {
    const { admin } = req;
    
    // Извлекаем параметры из req
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      is_available: req.query.is_available || 'all',
      is_blocked: req.query.is_blocked || 'all',
      vehicle_type: req.query.vehicle_type || 'all',
      sort_by: req.query.sort_by || 'createdAt',
      sort_order: req.query.sort_order || 'desc'
    };

    console.log('👥 GET ALL COURIER PROFILES:', {
      admin_id: admin._id,
      filters
    });

    // Вызов сервиса
    const result = await getAllProfilesService(filters);

    // Возврат ответа
    res.status(200).json({
      result: true,
      message: "Профили курьеров получены",
      ...result
    });

  } catch (error) {
    console.error('🚨 GET ALL COURIER PROFILES - Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения профилей курьеров",
      error: error.message
    });
  }
};

/**
 * 6. Блокировка курьера
 * POST /api/admin/couriers/profiles/:id/block
 */
const blockCourierProfile = async (req, res) => {
  try {
    const { admin } = req;
    const { id } = req.params;
    const { reason, duration_hours } = req.body;

    console.log('🚫 BLOCK COURIER PROFILE:', {
      profile_id: id,
      admin_id: admin._id,
      reason,
      duration_hours
    });

    // Проверка доступа
    if (!['manager', 'owner'].includes(admin.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для блокировки курьеров"
      });
    }

    // Базовая валидация
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        result: false,
        message: "Причина блокировки обязательна"
      });
    }

    // Вызов сервиса
    const result = await blockService(id, admin._id, reason, duration_hours);

    // Возврат ответа
    res.status(200).json({
      result: true,
      message: "Курьер заблокирован",
      ...result
    });

  } catch (error) {
    console.error('🚨 BLOCK COURIER PROFILE - Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка блокировки курьера",
      error: error.message
    });
  }
};

/**
 * 7. Разблокировка курьера
 * POST /api/admin/couriers/profiles/:id/unblock
 */
const unblockCourierProfile = async (req, res) => {
  try {
    const { admin } = req;
    const { id } = req.params;
    const { unblock_reason = 'Разблокирован администратором' } = req.body;

    console.log('✅ UNBLOCK COURIER PROFILE:', {
      profile_id: id,
      admin_id: admin._id,
      unblock_reason
    });

    // Проверка доступа
    if (!['manager', 'owner'].includes(admin.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для разблокировки курьеров"
      });
    }

    // Вызов сервиса
    const result = await unblockService(id, admin._id, unblock_reason);

    // Возврат ответа
    res.status(200).json({
      result: true,
      message: "Курьер разблокирован",
      ...result
    });

  } catch (error) {
    console.error('🚨 UNBLOCK COURIER PROFILE - Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка разблокировки курьера",
      error: error.message
    });
  }
};

/**
 * 8. Статистика курьеров
 * GET /api/admin/couriers/statistics
 */
const getCourierStatistics = async (req, res) => {
  try {
    const { admin } = req;
    
    // Извлекаем параметры из req
    const params = {
      period: req.query.period || '30',
      detailed: req.query.detailed === 'true'
    };

    console.log('📊 GET COURIER STATISTICS:', {
      admin_id: admin._id,
      params
    });

    // Вызов сервиса
    const result = await getStatisticsService(params);

    // Возврат ответа
    res.status(200).json({
      result: true,
      message: "Статистика курьеров получена",
      ...result
    });

  } catch (error) {
    console.error('🚨 GET COURIER STATISTICS - Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения статистики курьеров",
      error: error.message
    });
  }
};

export {
  getAllCourierApplications,
  getCourierApplicationDetails,
  approveCourierApplication,
  rejectCourierApplication,
  getAllCourierProfiles,
  blockCourierProfile,
  unblockCourierProfile,
  getCourierStatistics
};