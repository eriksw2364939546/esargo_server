// routes/AdminPartner.route.js - АДМИНСКИЕ РОУТЫ ДЛЯ ПАРТНЕРОВ С НОВОЙ MIDDLEWARE 🏪
import express from 'express';
import {
  approveInitialPartnerRequest,
  rejectInitialPartnerRequest,
  approveLegalInfoAndCreatePartner,
  rejectLegalInfo,
  getAllPartnerRequests,
  approvePartnerContentAndPublish  
} from '../services/admin.partner.service.js';
import { 
  InitialPartnerRequest, 
  PartnerLegalInfo,
  PartnerProfile 
} from '../models/index.js';

// 🆕 ИМПОРТ НОВЫХ АДМИНСКИХ MIDDLEWARE
// import { 
//   checkAdminToken,
//   checkAdminAccessByGroup,
//   requireOwner,
//   requireManagerOrOwner,
//   requireAnyAdmin
// } from '../middleware/adminAuth.middleware.js';

const router = express.Router();

// ================ HEALTH CHECK ================

/**
 * 🏥 HEALTH CHECK АДМИНСКИХ ПАРТНЕРСКИХ РОУТОВ
 * GET /api/admin/partners/health
 */
router.get('/health', (req, res) => {
  res.json({
    result: true,
    message: "🏪 Admin Partner routes with NEW MIDDLEWARE",
    service_layer: "enabled",
    meta_model: "enabled",
    admin_permissions: "role_based",
    
    // 🎯 WORKFLOW УПРАВЛЕНИЯ ПАРТНЕРАМИ
    partner_admin_workflow: {
      description: "Полный цикл одобрения партнеров с контролем ролей",
      steps: {
        "ЭТАП 0": "Партнер регистрируется через POST /api/partners/register",
        "ЭТАП 1→2": "POST /requests/:id/approve - Админ одобряет заявку (Manager+)",
        "ЭТАП 2": "Партнер подает юр.данные через POST /api/partners/legal-info/:request_id",
        "ЭТАП 3→4": "POST /legal/:id/approve - Админ одобряет юр.данные (Manager+)",
        "ЭТАП 4": "Партнер наполняет контент в профиле",
        "ЭТАП 5→6": "POST /profiles/:id/approve - Админ публикует (Manager+)"
      }
    },
    
    // 🔐 ПРАВА ДОСТУПА ПО РОЛЯМ
    access_control: {
      owner: {
        description: "Полный доступ ко всем операциям",
        can_do: ["approve", "reject", "view", "delete", "system_settings"]
      },
      manager: {
        description: "Управление партнерами и одобрение",
        can_do: ["approve", "reject", "view", "manage_workflow"]
      },
      admin: {
        description: "Просмотр и базовые операции",
        can_do: ["view", "basic_operations"]
      },
      support: {
        description: "Поддержка партнеров",
        can_do: ["view", "communicate"]
      },
      moderator: {
        description: "Модерация контента",
        can_do: ["view", "moderate_content"]
      }
    },
    
    // 📋 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ MIDDLEWARE
    middleware_examples: {
      view_only: "checkAdminAccessByGroup(['admin', 'support', 'moderator'])",
      management: "requireManagerOrOwner",
      critical: "requireOwner",
      any_admin: "requireAnyAdmin"
    },
    
    timestamp: new Date().toISOString()
  });
});

// ================ ПРОСМОТР ЗАЯВОК (ЛЮБОЙ АДМИН) ================

/**
 * 📋 ПОЛУЧЕНИЕ ВСЕХ ЗАЯВОК ПАРТНЕРОВ
 * GET /api/admin/partners/requests
 * Доступ: Любой админ может просматривать
 */
router.get('/requests', requireAnyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    
    // Строим фильтр
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.business_category = category;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const requests = await InitialPartnerRequest.find(filter)
      .populate('user_id', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const totalCount = await InitialPartnerRequest.countDocuments(filter);
    
    res.status(200).json({
      result: true,
      message: "Список заявок партнеров",
      admin_role: req.admin_role,
      requests: requests.map(request => ({
        id: request._id,
        business_name: request.business_name,
        business_category: request.business_category,
        contact_person: request.contact_person,
        email: request.user_id?.email,
        status: request.status,
        created_at: request.createdAt,
        // 🎯 Показываем доступные действия в зависимости от роли
        available_actions: getAvailableActionsForRole(req.admin_role, request.status)
      })),
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get partner requests error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при получении заявок партнеров"
    });
  }
});

/**
 * 🔍 ПОЛУЧЕНИЕ ДЕТАЛЬНОЙ ИНФОРМАЦИИ О ЗАЯВКЕ
 * GET /api/admin/partners/requests/:request_id
 * Доступ: Любой админ
 */
router.get('/requests/:request_id', requireAnyAdmin, async (req, res) => {
  try {
    const { request_id } = req.params;
    
    const request = await InitialPartnerRequest.findById(request_id)
      .populate('user_id', 'email role is_active')
      .populate('approved_by', 'full_name role')
      .populate('rejected_by', 'full_name role');
      
    if (!request) {
      return res.status(404).json({
        result: false,
        message: "Заявка не найдена"
      });
    }
    
    res.status(200).json({
      result: true,
      message: "Детальная информация о заявке",
      admin_role: req.admin_role,
      request: {
        ...request.toObject(),
        available_actions: getAvailableActionsForRole(req.admin_role, request.status)
      }
    });
    
  } catch (error) {
    console.error('Get request details error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при получении информации о заявке"
    });
  }
});

// ================ ОДОБРЕНИЕ ЗАЯВОК (MANAGER+ ТОЛЬКО) ================

/**
 * ✅ ОДОБРЕНИЕ ПЕРВИЧНОЙ ЗАЯВКИ ПАРТНЕРА (ЭТАП 1→2)
 * POST /api/admin/partners/requests/:request_id/approve
 * Доступ: Manager или Owner
 */
router.post('/requests/:request_id/approve', requireManagerOrOwner, async (req, res) => {
  try {
    const { request_id } = req.params;
    const { approval_notes } = req.body;
    
    const result = await approveInitialPartnerRequest(
      request_id, 
      req.admin._id,
      approval_notes
    );
    
    if (!result.success) {
      return res.status(400).json({
        result: false,
        message: result.message
      });
    }
    
    res.status(200).json({
      result: true,
      message: "Заявка партнера одобрена успешно!",
      approved_by: {
        id: req.admin._id,
        name: req.admin.full_name,
        role: req.admin_role
      },
      request: result.request,
      next_step: "Партнер может теперь подать юридические данные"
    });
    
  } catch (error) {
    console.error('Approve partner request error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при одобрении заявки партнера"
    });
  }
});

/**
 * ❌ ОТКЛОНЕНИЕ ПЕРВИЧНОЙ ЗАЯВКИ ПАРТНЕРА
 * POST /api/admin/partners/requests/:request_id/reject
 * Доступ: Manager или Owner
 */
router.post('/requests/:request_id/reject', requireManagerOrOwner, async (req, res) => {
  try {
    const { request_id } = req.params;
    const { rejection_reason } = req.body;
    
    if (!rejection_reason) {
      return res.status(400).json({
        result: false,
        message: "Причина отклонения обязательна"
      });
    }
    
    const result = await rejectInitialPartnerRequest(
      request_id,
      req.admin._id,
      rejection_reason
    );
    
    if (!result.success) {
      return res.status(400).json({
        result: false,
        message: result.message
      });
    }
    
    res.status(200).json({
      result: true,
      message: "Заявка партнера отклонена",
      rejected_by: {
        id: req.admin._id,
        name: req.admin.full_name,
        role: req.admin_role
      },
      rejection_reason,
      request: result.request
    });
    
  } catch (error) {
    console.error('Reject partner request error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при отклонении заявки партнера"
    });
  }
});

// ================ ЮРИДИЧЕСКИЕ ДАННЫЕ (MANAGER+ ТОЛЬКО) ================

/**
 * 📋 ПОЛУЧЕНИЕ ЮРИДИЧЕСКИХ ДАННЫХ
 * GET /api/admin/partners/legal
 * Доступ: Manager или Owner
 */
router.get('/legal', requireManagerOrOwner, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const legalInfos = await PartnerLegalInfo.find(filter)
      .populate('request_id', 'business_name contact_person')
      .populate('approved_by', 'full_name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const totalCount = await PartnerLegalInfo.countDocuments(filter);
    
    res.status(200).json({
      result: true,
      message: "Список юридических данных партнеров",
      admin_role: req.admin_role,
      legal_infos: legalInfos,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get legal infos error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при получении юридических данных"
    });
  }
});

/**
 * ✅ ОДОБРЕНИЕ ЮРИДИЧЕСКИХ ДАННЫХ И СОЗДАНИЕ ПРОФИЛЯ (ЭТАП 3→4)
 * POST /api/admin/partners/legal/:legal_info_id/approve
 * Доступ: Manager или Owner
 */
router.post('/legal/:legal_info_id/approve', requireManagerOrOwner, async (req, res) => {
  try {
    const { legal_info_id } = req.params;
    const { approval_notes } = req.body;
    
    const result = await approveLegalInfoAndCreatePartner(
      legal_info_id,
      req.admin._id,
      approval_notes
    );
    
    if (!result.success) {
      return res.status(400).json({
        result: false,
        message: result.message
      });
    }
    
    res.status(200).json({
      result: true,
      message: "🎉 Юридические данные одобрены! PartnerProfile создан!",
      approved_by: {
        id: req.admin._id,
        name: req.admin.full_name,
        role: req.admin_role
      },
      legal_info: result.legalInfo,
      partner_profile: result.partnerProfile,
      next_step: "Партнер может теперь наполнять контент в профиле"
    });
    
  } catch (error) {
    console.error('Approve legal info error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при одобрении юридических данных"
    });
  }
});

// ================ ПРОФИЛИ ПАРТНЕРОВ (MANAGER+ ТОЛЬКО) ================

/**
 * 📋 ПОЛУЧЕНИЕ ПРОФИЛЕЙ ПАРТНЕРОВ
 * GET /api/admin/partners/profiles
 * Доступ: Manager или Owner
 */
router.get('/profiles', requireManagerOrOwner, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const profiles = await PartnerProfile.find(filter)
      .populate('user_id', 'email')
      .populate('approved_by', 'full_name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const totalCount = await PartnerProfile.countDocuments(filter);
    
    res.status(200).json({
      result: true,
      message: "Список профилей партнеров",
      admin_role: req.admin_role,
      profiles: profiles,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get partner profiles error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при получении профилей партнеров"
    });
  }
});

/**
 * ✅ ОДОБРЕНИЕ КОНТЕНТА И ПУБЛИКАЦИЯ (ЭТАП 5→6)
 * POST /api/admin/partners/profiles/:profile_id/approve
 * Доступ: Manager или Owner
 */
router.post('/profiles/:profile_id/approve', requireManagerOrOwner, async (req, res) => {
  try {
    const { profile_id } = req.params;
    const { approval_notes } = req.body;
    
    const result = await approvePartnerContentAndPublish(
      profile_id,
      req.admin._id,
      approval_notes
    );
    
    if (!result.success) {
      return res.status(400).json({
        result: false,
        message: result.message
      });
    }
    
    res.status(200).json({
      result: true,
      message: "🚀 Контент одобрен! Партнер опубликован в системе!",
      approved_by: {
        id: req.admin._id,
        name: req.admin.full_name,
        role: req.admin_role
      },
      partner_profile: result.partnerProfile,
      next_step: "Партнер теперь видим клиентам и может принимать заказы"
    });
    
  } catch (error) {
    console.error('Approve content error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при одобрении контента партнера"
    });
  }
});

// ================ СИСТЕМНЫЕ ФУНКЦИИ (ТОЛЬКО OWNER) ================

/**
 * 🗑️ УДАЛЕНИЕ ЗАЯВКИ ПАРТНЕРА (КРИТИЧЕСКАЯ ОПЕРАЦИЯ)
 * DELETE /api/admin/partners/requests/:request_id
 * Доступ: Только Owner
 */
router.delete('/requests/:request_id', requireOwner, async (req, res) => {
  try {
    const { request_id } = req.params;
    const { deletion_reason } = req.body;
    
    if (!deletion_reason) {
      return res.status(400).json({
        result: false,
        message: "Причина удаления обязательна"
      });
    }
    
    const request = await InitialPartnerRequest.findById(request_id);
    if (!request) {
      return res.status(404).json({
        result: false,
        message: "Заявка не найдена"
      });
    }
    
    await InitialPartnerRequest.findByIdAndDelete(request_id);
    
    // Логируем критическое действие
    console.log(`🚨 CRITICAL: Partner request deleted by Owner`, {
      request_id,
      business_name: request.business_name,
      deleted_by: req.admin.full_name,
      deletion_reason,
      timestamp: new Date()
    });
    
    res.status(200).json({
      result: true,
      message: "Заявка партнера удалена",
      deleted_by: {
        id: req.admin._id,
        name: req.admin.full_name,
        role: req.admin_role
      },
      deletion_reason
    });
    
  } catch (error) {
    console.error('Delete partner request error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка при удалении заявки партнера"
    });
  }
});

// ================ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ================

/**
 * 🎯 ПОЛУЧЕНИЕ ДОСТУПНЫХ ДЕЙСТВИЙ В ЗАВИСИМОСТИ ОТ РОЛИ
 */
function getAvailableActionsForRole(adminRole, currentStatus) {
  const actions = [];
  
  // Просмотр доступен всем
  actions.push('view');
  
  // Manager и Owner могут управлять
  if (['manager', 'owner'].includes(adminRole)) {
    if (currentStatus === 'pending') {
      actions.push('approve', 'reject');
    }
    if (currentStatus === 'approved') {
      actions.push('view_legal_status');
    }
  }
  
  // Только Owner может удалять
  if (adminRole === 'owner') {
    actions.push('delete');
  }
  
  return actions;
}

// ================ MIDDLEWARE ДЛЯ ОБРАБОТКИ ОШИБОК ================
router.use((error, req, res, next) => {
  console.error('Admin Partner Route Error:', error);
  
  res.status(error.statusCode || 500).json({
    result: false,
    message: error.message || 'Ошибка в админских партнерских роутах',
    error_code: error.code || 'ADMIN_PARTNER_ROUTE_ERROR',
    timestamp: new Date().toISOString()
  });
});

export default router;