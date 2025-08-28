// controllers/AdminCourierController.js
import { CourierApplication, CourierProfile, User } from '../models/index.js';
import mongoose from 'mongoose';

/**
 * 1. Получение всех заявок курьеров
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

    console.log('📋 GET ALL COURIER APPLICATIONS:', {
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

    // Сортировка
    const sortOptions = {};
    sortOptions[sort_by] = sort_order === 'desc' ? -1 : 1;

    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Получение заявок с подсчетом
    const [applications, totalCount] = await Promise.all([
      CourierApplication.find(filters)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user_id', 'role is_active createdAt')
        .lean(),
      CourierApplication.countDocuments(filters)
    ]);

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
      message: "Заявки курьеров получены",
      applications: applications.map(app => ({
        id: app._id,
        personal_data: {
          first_name: app.personal_data.first_name,
          last_name: app.personal_data.last_name,
          email: app.personal_data.email,
          phone: app.personal_data.phone
        },
        vehicle_type: app.vehicle_info.vehicle_type,
        status: app.status,
        verification_status: app.verification.overall_verification_status,
        submitted_at: app.submitted_at,
        reviewed_at: app.review_info.reviewed_at,
        user_info: app.user_id
      })),
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
 * 2. Получение детальной информации о заявке
 * GET /api/admin/couriers/applications/:id
 */
const getCourierApplicationDetails = async (req, res) => {
  try {
    const { admin } = req;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        result: false,
        message: "Неверный ID заявки"
      });
    }

    const application = await CourierApplication.findById(id)
      .populate('user_id', 'role is_active createdAt last_login_at')
      .populate('review_info.reviewed_by', 'first_name last_name role');

    if (!application) {
      return res.status(404).json({
        result: false,
        message: "Заявка курьера не найдена"
      });
    }

    // Проверяем есть ли уже профиль курьера
    const existingProfile = await CourierProfile.findOne({ 
      user_id: application.user_id._id 
    });

    res.status(200).json({
      result: true,
      message: "Детали заявки курьера получены",
      application: {
        ...application.toObject(),
        has_courier_profile: !!existingProfile,
        courier_profile_id: existingProfile?._id
      }
    });

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

    // Одобрение заявки
    application.status = 'approved';
    application.review_info.reviewed_by = admin._id;
    application.review_info.reviewed_at = new Date();
    application.review_info.admin_notes = admin_notes;
    application.verification.overall_verification_status = 'completed';

    await application.save();

    // Создание профиля курьера автоматически
    try {
      const courierProfile = await application.createCourierProfile();
      
      console.log('✅ COURIER PROFILE CREATED:', {
        profile_id: courierProfile._id,
        user_id: application.user_id
      });

      res.status(200).json({
        result: true,
        message: "Заявка курьера одобрена, профиль создан",
        application: {
          id: application._id,
          status: application.status,
          reviewed_at: application.review_info.reviewed_at
        },
        courier_profile: {
          id: courierProfile._id,
          is_approved: courierProfile.is_approved,
          application_status: courierProfile.application_status
        },
        next_step: {
          action: "courier_can_work",
          description: "Курьер может начать работать"
        }
      });

    } catch (profileError) {
      console.error('🚨 CREATE COURIER PROFILE - Error:', profileError);
      
      // Откатываем статус заявки если не удалось создать профиль
      application.status = 'pending';
      application.review_info.reviewed_by = undefined;
      application.review_info.reviewed_at = undefined;
      await application.save();

      res.status(500).json({
        result: false,
        message: "Ошибка создания профиля курьера",
        error: profileError.message
      });
    }

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
    const { rejection_reason } = req.body;

    console.log('❌ REJECT COURIER APPLICATION:', {
      application_id: id,
      admin_id: admin._id
    });

    // Валидация прав
    if (!['manager', 'owner'].includes(admin.role)) {
      return res.status(403).json({
        result: false,
        message: "Недостаточно прав для отклонения заявок"
      });
    }

    if (!rejection_reason) {
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

    // Отклонение заявки
    application.status = 'rejected';
    application.review_info.reviewed_by = admin._id;
    application.review_info.reviewed_at = new Date();
    application.review_info.admin_notes = rejection_reason;
    application.verification.overall_verification_status = 'failed';

    await application.save();

    res.status(200).json({
      result: true,
      message: "Заявка курьера отклонена",
      application: {
        id: application._id,
        status: application.status,
        rejection_reason: rejection_reason,
        reviewed_at: application.review_info.reviewed_at
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
      status = 'all',
      availability = 'all', 
      page = 1, 
      limit = 20,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    // Фильтры
    const filters = {};
    
    if (status !== 'all') {
      filters.application_status = status;
    }
    
    if (availability === 'available') {
      filters.is_available = true;
      filters.is_online = true;
    } else if (availability === 'offline') {
      filters.$or = [
        { is_available: false },
        { is_online: false }
      ];
    }

    // Сортировка и пагинация
    const sortOptions = {};
    sortOptions[sort_by] = sort_order === 'desc' ? -1 : 1;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [profiles, totalCount] = await Promise.all([
      CourierProfile.find(filters)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user_id', 'role is_active createdAt')
        .populate('approved_by', 'first_name last_name')
        .lean(),
      CourierProfile.countDocuments(filters)
    ]);

    res.status(200).json({
      result: true,
      message: "Профили курьеров получены",
      profiles: profiles.map(profile => ({
        id: profile._id,
        full_name: `${profile.first_name} ${profile.last_name}`,
        phone: profile.phone,
        vehicle_type: profile.vehicle_type,
        is_approved: profile.is_approved,
        is_available: profile.is_available,
        is_online: profile.is_online,
        is_blocked: profile.is_blocked,
        application_status: profile.application_status,
        earnings: profile.earnings,
        ratings: profile.ratings,
        last_activity: profile.last_activity,
        approved_at: profile.approved_at,
        approved_by: profile.approved_by
      })),
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalCount / parseInt(limit)),
        total_items: totalCount
      }
    });

  } catch (error) {
    console.error('GET ALL COURIER PROFILES - Error:', error);
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
 * 7. Получение статистики курьеров
 * GET /api/admin/couriers/statistics
 */
const getCourierStatistics = async (req, res) => {
  try {
    const { admin } = req;
    const { period = 'today' } = req.query;

    // Определяем временные рамки
    const now = new Date();
    let startDate, endDate = now;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Статистика заявок
    const applicationStats = await CourierApplication.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Статистика профилей
    const profileStats = await CourierProfile.aggregate([
      {
        $group: {
          _id: null,
          total_couriers: { $sum: 1 },
          approved_couriers: {
            $sum: { $cond: ['$is_approved', 1, 0] }
          },
          available_couriers: {
            $sum: { $cond: ['$is_available', 1, 0] }
          },
          online_couriers: {
            $sum: { $cond: ['$is_online', 1, 0] }
          },
          blocked_couriers: {
            $sum: { $cond: ['$is_blocked', 1, 0] }
          },
          total_earnings: { $sum: '$earnings.total_earned' },
          total_orders: { $sum: '$earnings.completed_orders' }
        }
      }
    ]);

    // Статистика по типам транспорта
    const vehicleStats = await CourierProfile.aggregate([
      {
        $group: {
          _id: '$vehicle_type',
          count: { $sum: 1 },
          avg_rating: { $avg: '$ratings.avg_rating' }
        }
      }
    ]);

    // Формируем ответ
    const applications = {};
    applicationStats.forEach(stat => {
      applications[stat._id] = stat.count;
    });

    const profiles = profileStats[0] || {
      total_couriers: 0,
      approved_couriers: 0,
      available_couriers: 0,
      online_couriers: 0,
      blocked_couriers: 0,
      total_earnings: 0,
      total_orders: 0
    };

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
          pending: applications.pending || 0,
          approved: applications.approved || 0,
          rejected: applications.rejected || 0,
          total: Object.values(applications).reduce((sum, count) => sum + count, 0)
        },
        profiles: profiles,
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

export { getAllCourierApplications,
         getCourierApplicationDetails,
         approveCourierApplication,
         rejectCourierApplication,
         getAllCourierProfiles,
         blockCourierProfile,
         unblockCourierProfile,
         getCourierStatistics
        }