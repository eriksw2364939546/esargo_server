// controllers/AdminCourierController.js - ПОЛНЫЙ ФАЙЛ с расшифровкой данных
import { CourierApplication, CourierProfile, User } from '../models/index.js';
import { decryptString } from '../utils/crypto.js';
import mongoose from 'mongoose';

/**
 * 1. Получение всех заявок курьеров - С РАСШИФРОВКОЙ
 * GET /api/admin/couriers/applications
 */
const getAllCourierApplications = async (req, res) => {
  try {
    const { admin } = req;
    const { 
      status = 'all', 
      page = 1, 
      limit = 20, 
      sort_by = 'submitted_at',
      sort_order = 'desc',
      vehicle_type = 'all'
    } = req.query;

    console.log('📋 GET ALL COURIER APPLICATIONS WITH DECRYPTION:', {
      admin_id: admin._id,
      filters: { status, vehicle_type },
      pagination: { page, limit }
    });

    // Построение фильтров
    const filters = {};
    
    if (status !== 'all') {
      filters.status = status;
    }
    
    if (vehicle_type !== 'all') {
      filters['vehicle_info.vehicle_type'] = vehicle_type;
    }

    // Сортировка и пагинация
    const sortOptions = {};
    sortOptions[sort_by] = sort_order === 'desc' ? -1 : 1;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 🔐 ПОЛУЧЕНИЕ ЗАЯВОК (зашифрованные данные)
    const [applications, totalCount] = await Promise.all([
      CourierApplication.find(filters)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user_id', 'role is_active createdAt')
        .lean(),
      CourierApplication.countDocuments(filters)
    ]);

    // 🔐 РАСШИФРОВКА ДАННЫХ для админа
    const decryptedApplications = applications.map(app => {
      try {
        return {
          id: app._id,
          // ✅ ПОКАЗЫВАЕМ ОТКРЫТЫЕ ПОИСКОВЫЕ ПОЛЯ  
          search_data: app.search_data, // Имя и фамилия открыто
          
          // 🔐 РАСШИФРОВЫВАЕМ ЧУВСТВИТЕЛЬНЫЕ ДАННЫЕ
          personal_data: {
            first_name: app.search_data?.first_name || 'Н/Д', // Берем из открытых данных
            last_name: app.search_data?.last_name || 'Н/Д',   // Берем из открытых данных
            email: app.personal_data?.email ? decryptString(app.personal_data.email) : 'Ошибка расшифровки',
            phone: app.personal_data?.phone ? decryptString(app.personal_data.phone) : 'Ошибка расшифровки',
            city: app.search_data?.city || 'Н/Д' // Берем из открытых данных
          },
          
          vehicle_type: app.vehicle_info?.vehicle_type,
          status: app.status,
          verification_status: app.verification?.overall_verification_status,
          submitted_at: app.submitted_at,
          reviewed_at: app.review_info?.reviewed_at,
          user_info: app.user_id
        };
      } catch (decryptError) {
        console.error('🚨 DECRYPTION ERROR for application:', app._id, decryptError);
        return {
          id: app._id,
          search_data: app.search_data,
          personal_data: {
            first_name: app.search_data?.first_name || 'Н/Д',
            last_name: app.search_data?.last_name || 'Н/Д',
            email: 'Ошибка расшифровки',
            phone: 'Ошибка расшифровки',
            city: app.search_data?.city || 'Н/Д'
          },
          vehicle_type: app.vehicle_info?.vehicle_type,
          status: app.status,
          error: 'Ошибка расшифровки данных'
        };
      }
    });

    // Статистика по статусам
    const statusStats = await CourierApplication.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stats = {
      total: totalCount,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    statusStats.forEach(stat => {
      if (stats.hasOwnProperty(stat._id)) {
        stats[stat._id] = stat.count;
      }
    });

    res.status(200).json({
      result: true,
      message: "Заявки курьеров получены (с расшифровкой)",
      applications: decryptedApplications,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalCount / parseInt(limit)),
        total_items: totalCount,
        items_per_page: parseInt(limit)
      },
      statistics: stats
    });

  } catch (error) {
    console.error('🚨 GET ALL COURIER APPLICATIONS - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения заявок курьеров",
      error: error.message
    });
  }
};

/**
 * 2. Получение детальной информации о заявке - С ПОЛНОЙ РАСШИФРОВКОЙ
 * GET /api/admin/couriers/applications/:id
 */
const getCourierApplicationDetails = async (req, res) => {
  try {
    const { admin } = req;
    const { id } = req.params;

    console.log('🔍 GET COURIER APPLICATION DETAILS WITH DECRYPTION:', {
      application_id: id,
      admin_id: admin._id
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        result: false,
        message: "Неверный ID заявки"
      });
    }

    // 🔐 ПОЛУЧАЕМ ЗАШИФРОВАННУЮ ЗАЯВКУ
    const application = await CourierApplication.findById(id)
      .populate('user_id', 'role is_active createdAt last_login_at')
      .populate('review_info.reviewed_by', 'full_name role');

    if (!application) {
      return res.status(404).json({
        result: false,
        message: "Заявка курьера не найдена"
      });
    }

    // 🔐 ПОЛНАЯ РАСШИФРОВКА ВСЕХ ДАННЫХ
    try {
      const decryptedApplication = {
        ...application.toObject(),
        
        // 🔐 РАСШИФРОВАННЫЕ ПЕРСОНАЛЬНЫЕ ДАННЫЕ
        personal_data: {
          first_name: decryptString(application.personal_data.first_name),
          last_name: decryptString(application.personal_data.last_name),
          email: decryptString(application.personal_data.email),
          phone: decryptString(application.personal_data.phone),
          date_of_birth: application.personal_data.date_of_birth,
          address: {
            street: decryptString(application.personal_data.address.street),
            city: decryptString(application.personal_data.address.city),
            postal_code: decryptString(application.personal_data.address.postal_code),
            country: application.personal_data.address.country
          }
        },
        
        // 🔐 РАСШИФРОВАННЫЕ ДОКУМЕНТЫ
        documents: {
          id_card_url: decryptString(application.documents.id_card_url),
          bank_rib_url: decryptString(application.documents.bank_rib_url),
          driver_license_url: application.documents.driver_license_url ? 
            decryptString(application.documents.driver_license_url) : null,
          insurance_url: application.documents.insurance_url ? 
            decryptString(application.documents.insurance_url) : null,
          vehicle_registration_url: application.documents.vehicle_registration_url ? 
            decryptString(application.documents.vehicle_registration_url) : null
        },
        
        // 🔐 РАСШИФРОВАННЫЕ ДАННЫЕ ТРАНСПОРТА
        vehicle_info: {
          ...application.vehicle_info,
          license_plate: application.vehicle_info.license_plate ? 
            decryptString(application.vehicle_info.license_plate) : null,
          insurance_policy_number: application.vehicle_info.insurance_policy_number ? 
            decryptString(application.vehicle_info.insurance_policy_number) : null
        }
      };

      // Проверяем есть ли уже профиль курьера
      const existingProfile = await CourierProfile.findOne({ 
        user_id: application.user_id._id 
      });

      res.status(200).json({
        result: true,
        message: "Детали заявки курьера получены (полностью расшифровано)",
        application: decryptedApplication,
        has_courier_profile: !!existingProfile,
        courier_profile_id: existingProfile?._id
      });

    } catch (decryptError) {
      console.error('🚨 FULL DECRYPTION ERROR:', decryptError);
      
      // Возвращаем частично расшифрованные данные
      res.status(200).json({
        result: true,
        message: "Детали заявки получены (частичная расшифровка)",
        application: {
          ...application.toObject(),
          decryption_error: "Некоторые поля не удалось расшифровать"
        }
      });
    }

  } catch (error) {
    console.error('🚨 GET COURIER APPLICATION DETAILS - Error:', error);
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

    // Валидация прав доступа
    if (!['manager', 'owner'].includes(admin.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для одобрения заявок курьеров"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        result: false,
        message: "Неверный ID заявки"
      });
    }

    // Получение заявки
    const application = await CourierApplication.findById(id);

    if (!application) {
      return res.status(404).json({
        result: false,
        message: "Заявка курьера не найдена"
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        result: false,
        message: `Заявка уже обработана. Текущий статус: ${application.status}`
      });
    }

    // Проверяем, что профиль еще не создан
    const existingProfile = await CourierProfile.findOne({ 
      user_id: application.user_id 
    });

    if (existingProfile) {
      return res.status(400).json({
        result: false,
        message: "Профиль курьера уже существует"
      });
    }

    // Одобряем заявку
    await application.approve(admin._id, admin_notes);

    // Создаем профиль курьера
    const courierProfile = await application.createCourierProfile();

    console.log('✅ COURIER APPROVED AND PROFILE CREATED:', {
      application_id: application._id,
      profile_id: courierProfile._id,
      user_id: application.user_id
    });

    res.status(200).json({
      result: true,
      message: "Заявка курьера одобрена и профиль создан",
      application: {
        id: application._id,
        status: application.status,
        approved_at: application.review_info.approved_at,
        approved_by: admin._id
      },
      courier_profile: {
        id: courierProfile._id,
        first_name: courierProfile.first_name,
        last_name: courierProfile.last_name,
        is_approved: courierProfile.is_approved
      }
    });

  } catch (error) {
    console.error('🚨 APPROVE COURIER APPLICATION - Error:', error);
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

    // Валидация прав доступа
    if (!['manager', 'owner'].includes(admin.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для отклонения заявок курьеров"
      });
    }

    if (!rejection_reason || rejection_reason.trim().length === 0) {
      return res.status(400).json({
        result: false,
        message: "Причина отклонения обязательна"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        result: false,
        message: "Неверный ID заявки"
      });
    }

    // Получение заявки
    const application = await CourierApplication.findById(id);

    if (!application) {
      return res.status(404).json({
        result: false,
        message: "Заявка курьера не найдена"
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        result: false,
        message: `Заявка уже обработана. Текущий статус: ${application.status}`
      });
    }

    // Отклоняем заявку
    await application.reject(admin._id, rejection_reason.trim(), admin_notes);

    console.log('❌ COURIER APPLICATION REJECTED:', {
      application_id: application._id,
      rejected_by: admin._id,
      reason: rejection_reason
    });

    res.status(200).json({
      result: true,
      message: "Заявка курьера отклонена",
      application: {
        id: application._id,
        status: application.status,
        rejected_at: application.review_info.reviewed_at,
        rejection_reason: application.review_info.rejection_reason,
        rejected_by: admin._id
      }
    });

  } catch (error) {
    console.error('🚨 REJECT COURIER APPLICATION - Error:', error);
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
    const { 
      page = 1, 
      limit = 20, 
      is_available = 'all',
      is_blocked = 'all',
      vehicle_type = 'all'
    } = req.query;

    console.log('👥 GET ALL COURIER PROFILES:', {
      admin_id: admin._id,
      filters: { is_available, is_blocked, vehicle_type }
    });

    // Построение фильтров
    const filters = {};
    
    if (is_available !== 'all') {
      filters.is_available = is_available === 'true';
    }
    
    if (is_blocked !== 'all') {
      filters.is_blocked = is_blocked === 'true';
    }
    
    if (vehicle_type !== 'all') {
      filters.vehicle_type = vehicle_type;
    }

    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Получение профилей курьеров
    const [profiles, totalCount] = await Promise.all([
      CourierProfile.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user_id', 'role is_active createdAt')
        .populate('approved_by', 'full_name role')
        .lean(),
      CourierProfile.countDocuments(filters)
    ]);

    res.status(200).json({
      result: true,
      message: "Профили курьеров получены",
      profiles: profiles.map(profile => ({
        id: profile._id,
        user_id: profile.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        vehicle_type: profile.vehicle_type,
        is_available: profile.is_available,
        is_online: profile.is_online,
        is_approved: profile.is_approved,
        is_blocked: profile.is_blocked,
        location: profile.location,
        work_radius: profile.work_radius,
        ratings: profile.ratings,
        approved_by: profile.approved_by,
        approved_at: profile.approved_at,
        createdAt: profile.createdAt
      })),
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalCount / parseInt(limit)),
        total_items: totalCount,
        items_per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('🚨 GET ALL COURIER PROFILES - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения профилей курьеров",
      error: error.message
    });
  }
};

/**
 * 6. Блокировка/разблокировка курьера
 * POST /api/admin/couriers/profiles/:id/block
 * POST /api/admin/couriers/profiles/:id/unblock
 */
const blockCourierProfile = async (req, res) => {
  try {
    const { admin } = req;
    const { id } = req.params;
    const { reason, duration_hours } = req.body;

    if (!['manager', 'owner'].includes(admin.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для блокировки курьеров"
      });
    }

    if (!reason) {
      return res.status(400).json({
        result: false,
        message: "Причина блокировки обязательна"
      });
    }

    const courierProfile = await CourierProfile.findById(id);

    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    // Блокируем курьера
    const duration = duration_hours ? duration_hours * 60 * 60 * 1000 : null;
    await courierProfile.block(reason, duration);

    res.status(200).json({
      result: true,
      message: "Курьер заблокирован",
      profile: {
        id: courierProfile._id,
        is_blocked: courierProfile.is_blocked,
        blocked_reason: courierProfile.blocked_reason,
        blocked_until: courierProfile.blocked_until
      }
    });

  } catch (error) {
    console.error('BLOCK COURIER - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка блокировки курьера",
      error: error.message
    });
  }
};

const unblockCourierProfile = async (req, res) => {
  try {
    const { admin } = req;
    const { id } = req.params;

    if (!['manager', 'owner'].includes(admin.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для разблокировки курьеров"
      });
    }

    const courierProfile = await CourierProfile.findById(id);

    if (!courierProfile) {
      return res.status(404).json({
        result: false,
        message: "Профиль курьера не найден"
      });
    }

    await courierProfile.unblock();

    res.status(200).json({
      result: true,
      message: "Курьер разблокирован",
      profile: {
        id: courierProfile._id,
        is_blocked: courierProfile.is_blocked
      }
    });

  } catch (error) {
    console.error('UNBLOCK COURIER - Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка разблокировки курьера",
      error: error.message
    });
  }
};

/**
 * 7. Статистика курьеров
 * GET /api/admin/couriers/statistics
 */
const getCourierStatistics = async (req, res) => {
  try {
    const { admin } = req;
    const { period = '30' } = req.query;

    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    console.log('📊 GET COURIER STATISTICS:', {
      admin_id: admin._id,
      period: `${days} days`,
      date_range: { startDate, endDate }
    });

    // Статистика заявок
    const applications = await CourierApplication.aggregate([
      {
        $match: {
          submitted_at: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Статистика профилей
    const profiles = await CourierProfile.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$is_available', true] }, 1, 0] } },
          blocked: { $sum: { $cond: [{ $eq: ['$is_blocked', true] }, 1, 0] } },
          avg_rating: { $avg: '$ratings.average_rating' }
        }
      }
    ]);

    // Статистика по типам транспорта
    const vehicleStats = await CourierProfile.aggregate([
      {
        $group: {
          _id: '$vehicle_type',
          count: { $sum: 1 },
          avg_rating: { $avg: '$ratings.average_rating' }
        }
      }
    ]);

    // Преобразование данных заявок
    const applicationStats = applications.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { pending: 0, approved: 0, rejected: 0 });

    res.status(200).json({
      result: true,
      message: "Статистика курьеров получена",
      period: period,
      date_range: {
        start: startDate,
        end: endDate
      },
      statistics: {
        applications: {
          pending: applicationStats.pending || 0,
          approved: applicationStats.approved || 0,
          rejected: applicationStats.rejected || 0,
          total: Object.values(applicationStats).reduce((sum, count) => sum + count, 0)
        },
        profiles: profiles[0] || {
          total: 0,
          active: 0,
          blocked: 0,
          avg_rating: 0
        },
        vehicles: vehicleStats.reduce((acc, vehicle) => {
          acc[vehicle._id] = {
            count: vehicle.count,
            avg_rating: vehicle.avg_rating || 0
          };
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('GET COURIER STATISTICS - Error:', error);
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