// services/Admin/adminCourier.service.js - ПОЛНЫЙ СЕРВИСНЫЙ СЛОЙ
import { CourierApplication, CourierProfile } from '../../models/index.js';
import { decryptString } from '../../utils/crypto.js';
import mongoose from 'mongoose';

/**
 * ОДОБРЕНИЕ ЗАЯВКИ КУРЬЕРА
 * Бизнес-логика одобрения заявки и создания профиля
 */
const approveCourierApplication = async (applicationId, adminId, adminNotes = '') => {
  try {
    // Валидация ID
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      throw new Error('Неверный ID заявки');
    }

    // Получение заявки с пользователем
    const application = await CourierApplication.findById(applicationId).populate('user_id');

    if (!application) {
      throw new Error('Заявка курьера не найдена');
    }

    if (application.status !== 'pending') {
      throw new Error(`Заявка уже обработана. Текущий статус: ${application.status}`);
    }

    // Проверяем, что профиль еще не создан
    const existingProfile = await CourierProfile.findOne({ 
      user_id: application.user_id._id 
    });

    if (existingProfile) {
      throw new Error('Профиль курьера уже существует');
    }

    // Получаем email для профиля (расшифровываем из заявки)
    let courierEmail;
    try {
      courierEmail = decryptString(application.personal_data.email);
    } catch (decryptError) {
      throw new Error('Ошибка расшифровки данных заявки');
    }

    // Одобряем заявку
    await application.approve(adminId, adminNotes);

    // Создаем профиль курьера с обязательными полями
    const courierProfile = new CourierProfile({
      user_id: application.user_id._id,
      
      // Основная информация (из открытых данных)
      first_name: application.search_data.first_name,
      last_name: application.search_data.last_name,
      
      // Email - тот же что и в User
      email: courierEmail,
      
      // Зашифрованный телефон
      phone: application.personal_data.phone,
      
      // Временная локация - курьер обновит при включении геоданных
      location: {
        type: 'Point',
        coordinates: [0, 0] // Будут обновлены при первом использовании
      },
      
      // Информация о транспорте
      vehicle_type: application.vehicle_info.vehicle_type,
      
      // Документы
      documents: application.documents,
      
      // Статусы
      is_approved: true,
      application_status: 'approved',
      approved_by: adminId,
      approved_at: new Date(),
      
      // Дефолтные значения - курьер сам включит доступность
      is_available: false,  
      is_online: false,
      is_active: true
    });

    await courierProfile.save();

    return {
      success: true,
      application: {
        id: application._id,
        status: application.status,
        approved_at: application.review_info.approved_at,
        approved_by: adminId
      },
      courier_profile: {
        id: courierProfile._id,
        first_name: courierProfile.first_name,
        last_name: courierProfile.last_name,
        email: courierProfile.email,
        is_approved: courierProfile.is_approved
      }
    };

  } catch (error) {
    console.error('🚨 ADMIN COURIER SERVICE - APPROVE ERROR:', error);
    throw error;
  }
};

/**
 * ОТКЛОНЕНИЕ ЗАЯВКИ КУРЬЕРА
 * Бизнес-логика отклонения заявки
 */
const rejectCourierApplication = async (applicationId, adminId, rejectionReason, adminNotes = '') => {
  try {
    // Валидация входных данных
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      throw new Error('Неверный ID заявки');
    }

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('Причина отклонения обязательна');
    }

    // Получение заявки
    const application = await CourierApplication.findById(applicationId);

    if (!application) {
      throw new Error('Заявка курьера не найдена');
    }

    if (application.status !== 'pending') {
      throw new Error(`Заявка уже обработана. Текущий статус: ${application.status}`);
    }

    // Отклоняем заявку
    await application.reject(adminId, rejectionReason.trim(), adminNotes);

    return {
      success: true,
      application: {
        id: application._id,
        status: application.status,
        rejected_at: application.review_info.reviewed_at,
        rejection_reason: application.review_info.rejection_reason,
        rejected_by: adminId
      }
    };

  } catch (error) {
    console.error('🚨 ADMIN COURIER SERVICE - REJECT ERROR:', error);
    throw error;
  }
};

/**
 * ПОЛУЧЕНИЕ ВСЕХ ЗАЯВОК КУРЬЕРОВ
 * Фильтрация и пагинация заявок с расшифровкой данных
 */
const getAllCourierApplications = async (filters = {}) => {
  try {
    const { 
      status = 'all', 
      page = 1, 
      limit = 20,
      vehicle_type = 'all',
      sort_by = 'submitted_at',
      sort_order = 'desc'
    } = filters;

    // Построение фильтра
    const filter = {};
    
    if (status !== 'all') {
      filter.status = status;
    }
    
    if (vehicle_type !== 'all') {
      filter['vehicle_info.vehicle_type'] = vehicle_type;
    }

    // Построение сортировки
    const sortOrder = sort_order === 'asc' ? 1 : -1;
    const sortObj = { [sort_by]: sortOrder };

    // Пагинация
    const skip = (page - 1) * limit;

    // Получение заявок
    const applications = await CourierApplication
      .find(filter)
      .populate('user_id', 'role is_active created_at')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();

    // Подсчет общего количества
    const total = await CourierApplication.countDocuments(filter);

    // Расшифровка данных для админа
    const decryptedApplications = applications.map(app => {
      try {
        return {
          id: app._id,
          // Открытые поисковые поля  
          search_data: app.search_data,
          
          // Расшифрованные чувствительные данные
          personal_data: {
            first_name: app.search_data?.first_name || 'Н/Д',
            last_name: app.search_data?.last_name || 'Н/Д',
            email: app.personal_data?.email ? decryptString(app.personal_data.email) : 'Ошибка расшифровки',
            phone: app.personal_data?.phone ? decryptString(app.personal_data.phone) : 'Ошибка расшифровки',
            city: app.search_data?.city || 'Н/Д'
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
      total,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    statusStats.forEach(stat => {
      if (stats.hasOwnProperty(stat._id)) {
        stats[stat._id] = stat.count;
      }
    });

    return {
      success: true,
      applications: decryptedApplications,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: limit
      },
      statistics: stats
    };

  } catch (error) {
    console.error('🚨 ADMIN COURIER SERVICE - GET ALL ERROR:', error);
    throw error;
  }
};

/**
 * ПОЛУЧЕНИЕ ДЕТАЛЕЙ ЗАЯВКИ С РАСШИФРОВКОЙ
 * Расшифровывает чувствительные данные для админа
 */
const getCourierApplicationDetails = async (applicationId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      throw new Error('Неверный ID заявки');
    }

    const application = await CourierApplication
      .findById(applicationId)
      .populate('user_id', 'role is_active created_at');

    if (!application) {
      throw new Error('Заявка курьера не найдена');
    }

    // Расшифровка данных для админа
    try {
      const decryptedPersonalData = {
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
      };

      const decryptedDocuments = {
        id_card_url: decryptString(application.documents.id_card_url),
        bank_rib_url: decryptString(application.documents.bank_rib_url),
        driver_license_url: application.documents.driver_license_url ? 
          decryptString(application.documents.driver_license_url) : null,
        insurance_url: application.documents.insurance_url ? 
          decryptString(application.documents.insurance_url) : null,
        vehicle_registration_url: application.documents.vehicle_registration_url ? 
          decryptString(application.documents.vehicle_registration_url) : null
      };

      const decryptedVehicleInfo = {
        ...application.vehicle_info.toObject(),
        license_plate: application.vehicle_info.license_plate ? 
          decryptString(application.vehicle_info.license_plate) : null,
        insurance_policy_number: application.vehicle_info.insurance_policy_number ? 
          decryptString(application.vehicle_info.insurance_policy_number) : null
      };

      const decryptedApplication = {
        ...application.toObject(),
        decrypted_personal_data: decryptedPersonalData,
        decrypted_documents: decryptedDocuments,
        decrypted_vehicle_info: decryptedVehicleInfo
      };

      // Проверяем есть ли уже профиль курьера
      const existingProfile = await CourierProfile.findOne({ 
        user_id: application.user_id._id 
      });

      return {
        success: true,
        application: decryptedApplication,
        has_courier_profile: !!existingProfile,
        courier_profile_id: existingProfile?._id
      };

    } catch (decryptError) {
      console.error('🚨 DECRYPTION ERROR:', decryptError);
      // Возвращаем частично расшифрованные данные
      return {
        success: true,
        application: application.toObject(),
        decryption_error: 'Некоторые поля не удалось расшифровать'
      };
    }

  } catch (error) {
    console.error('🚨 ADMIN COURIER SERVICE - GET DETAILS ERROR:', error);
    throw error;
  }
};

/**
 * ПОЛУЧЕНИЕ ВСЕХ ПРОФИЛЕЙ КУРЬЕРОВ
 * Фильтрация и пагинация профилей
 */
const getAllCourierProfiles = async (filters = {}) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      is_available = 'all',
      is_blocked = 'all',
      vehicle_type = 'all',
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = filters;

    // Построение фильтров
    const filter = {};
    
    if (is_available !== 'all') {
      filter.is_available = is_available === 'true';
    }
    
    if (is_blocked !== 'all') {
      filter.is_blocked = is_blocked === 'true';
    }
    
    if (vehicle_type !== 'all') {
      filter.vehicle_type = vehicle_type;
    }

    // Сортировка и пагинация
    const sortOrder = sort_order === 'asc' ? 1 : -1;
    const sortObj = { [sort_by]: sortOrder };
    const skip = (page - 1) * limit;

    // Получение профилей курьеров
    const [profiles, totalCount] = await Promise.all([
      CourierProfile.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('user_id', 'role is_active created_at')
        .populate('approved_by', 'full_name role')
        .lean(),
      CourierProfile.countDocuments(filter)
    ]);

    // Форматирование данных профилей
    const formattedProfiles = profiles.map(profile => ({
      id: profile._id,
      user_id: profile.user_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      vehicle_type: profile.vehicle_type,
      is_available: profile.is_available,
      is_online: profile.is_online,
      is_approved: profile.is_approved,
      is_blocked: profile.is_blocked,
      blocked_reason: profile.blocked_reason,
      blocked_until: profile.blocked_until,
      location: profile.location,
      ratings: profile.ratings,
      earnings: profile.earnings,
      work_stats: profile.work_stats,
      approved_by: profile.approved_by,
      approved_at: profile.approved_at,
      last_activity: profile.last_activity,
      created_at: profile.createdAt
    }));

    return {
      success: true,
      profiles: formattedProfiles,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalCount / limit),
        total_items: totalCount,
        items_per_page: limit
      }
    };

  } catch (error) {
    console.error('🚨 ADMIN COURIER SERVICE - GET ALL PROFILES ERROR:', error);
    throw error;
  }
};

/**
 * БЛОКИРОВКА КУРЬЕРА
 * Бизнес-логика блокировки профиля курьера
 */
const blockCourierProfile = async (profileId, adminId, reason, durationHours = null) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      throw new Error('Неверный ID профиля курьера');
    }

    const courierProfile = await CourierProfile.findById(profileId);

    if (!courierProfile) {
      throw new Error('Профиль курьера не найден');
    }

    if (courierProfile.is_blocked) {
      throw new Error('Курьер уже заблокирован');
    }

    // Блокируем курьера
    courierProfile.is_blocked = true;
    courierProfile.blocked_reason = reason;
    courierProfile.blocked_by = adminId;
    courierProfile.blocked_at = new Date();

    // Устанавливаем длительность блокировки если указана
    if (durationHours) {
      const blockedUntil = new Date();
      blockedUntil.setHours(blockedUntil.getHours() + durationHours);
      courierProfile.blocked_until = blockedUntil;
    }

    // Автоматически делаем курьера недоступным
    courierProfile.is_available = false;
    courierProfile.is_online = false;

    await courierProfile.save();

    return {
      success: true,
      profile: {
        id: courierProfile._id,
        is_blocked: courierProfile.is_blocked,
        blocked_reason: courierProfile.blocked_reason,
        blocked_at: courierProfile.blocked_at,
        blocked_until: courierProfile.blocked_until,
        blocked_by: adminId
      }
    };

  } catch (error) {
    console.error('🚨 ADMIN COURIER SERVICE - BLOCK ERROR:', error);
    throw error;
  }
};

/**
 * РАЗБЛОКИРОВКА КУРЬЕРА
 * Бизнес-логика разблокировки профиля курьера
 */
const unblockCourierProfile = async (profileId, adminId, unblockReason = 'Разблокирован администратором') => {
  try {
    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      throw new Error('Неверный ID профиля курьера');
    }

    const courierProfile = await CourierProfile.findById(profileId);

    if (!courierProfile) {
      throw new Error('Профиль курьера не найден');
    }

    if (!courierProfile.is_blocked) {
      throw new Error('Курьер не заблокирован');
    }

    // Разблокируем курьера
    courierProfile.is_blocked = false;
    courierProfile.blocked_reason = null;
    courierProfile.blocked_until = null;
    courierProfile.blocked_by = null;
    courierProfile.blocked_at = null;
    
    // Записываем информацию о разблокировке
    courierProfile.unblocked_by = adminId;
    courierProfile.unblocked_at = new Date();
    courierProfile.unblock_reason = unblockReason;

    await courierProfile.save();

    return {
      success: true,
      profile: {
        id: courierProfile._id,
        is_blocked: courierProfile.is_blocked,
        unblocked_by: adminId,
        unblocked_at: courierProfile.unblocked_at,
        unblock_reason: unblockReason
      }
    };

  } catch (error) {
    console.error('🚨 ADMIN COURIER SERVICE - UNBLOCK ERROR:', error);
    throw error;
  }
};

/**
 * СТАТИСТИКА КУРЬЕРОВ
 * Получение подробной статистики по курьерам
 */
const getCourierStatistics = async (params = {}) => {
  try {
    const { period = '30', detailed = false } = params;

    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    // Статистика заявок за период
    const applicationStats = await CourierApplication.aggregate([
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

    // Общая статистика профилей
    const profileStats = await CourierProfile.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$is_available', true] }, 1, 0] } },
          online: { $sum: { $cond: [{ $eq: ['$is_online', true] }, 1, 0] } },
          blocked: { $sum: { $cond: [{ $eq: ['$is_blocked', true] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$is_approved', true] }, 1, 0] } },
          avg_rating: { $avg: '$ratings.avg_rating' }
        }
      }
    ]);

    // Статистика по типам транспорта
    const vehicleStats = await CourierProfile.aggregate([
      {
        $group: {
          _id: '$vehicle_type',
          count: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$is_available', true] }, 1, 0] } },
          avg_rating: { $avg: '$ratings.avg_rating' }
        }
      }
    ]);

    // Статистика заработка (если детальная статистика запрошена)
    let earningsStats = null;
    if (detailed) {
      earningsStats = await CourierProfile.aggregate([
        {
          $group: {
            _id: null,
            total_earnings: { $sum: '$earnings.total_earned' },
            avg_earnings: { $avg: '$earnings.total_earned' },
            top_earner: { $max: '$earnings.total_earned' },
            active_earners: { 
              $sum: { 
                $cond: [
                  { $and: [
                    { $gt: ['$earnings.total_earned', 0] },
                    { $eq: ['$is_available', true] }
                  ]}, 
                  1, 
                  0 
                ] 
              } 
            }
          }
        }
      ]);
    }

    // Преобразование данных заявок
    const applications = applicationStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { pending: 0, approved: 0, rejected: 0 });

    const profiles = profileStats[0] || {
      total: 0,
      active: 0,
      online: 0,
      blocked: 0,
      approved: 0,
      avg_rating: 0
    };

    const vehicles = vehicleStats.reduce((acc, vehicle) => {
      acc[vehicle._id] = {
        count: vehicle.count,
        active: vehicle.active,
        avg_rating: vehicle.avg_rating || 0
      };
      return acc;
    }, {});

    const result = {
      success: true,
      period: `${days} days`,
      date_range: {
        start: startDate,
        end: endDate
      },
      statistics: {
        applications: {
          ...applications,
          total: Object.values(applications).reduce((sum, count) => sum + count, 0)
        },
        profiles,
        vehicles,
        summary: {
          total_couriers: profiles.total,
          active_percentage: profiles.total > 0 ? 
            Math.round((profiles.active / profiles.total) * 100) : 0,
          online_percentage: profiles.total > 0 ? 
            Math.round((profiles.online / profiles.total) * 100) : 0,
          blocked_percentage: profiles.total > 0 ? 
            Math.round((profiles.blocked / profiles.total) * 100) : 0
        }
      }
    };

    // Добавляем детальную статистику заработка если запрошена
    if (detailed && earningsStats && earningsStats[0]) {
      result.statistics.earnings = earningsStats[0];
    }

    return result;

  } catch (error) {
    console.error('🚨 ADMIN COURIER SERVICE - GET STATISTICS ERROR:', error);
    throw error;
  }
};

export {
  approveCourierApplication,
  rejectCourierApplication,
  getAllCourierApplications,
  getCourierApplicationDetails,
  getAllCourierProfiles,
  blockCourierProfile,
  unblockCourierProfile,
  getCourierStatistics
};