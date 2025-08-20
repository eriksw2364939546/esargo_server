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
import { 
 authenticateUser, 
 requireRole,
 requireAdminPermission
} from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/health', (req, res) => {
 res.json({
   result: true,
   message: "🏪 Admin Partner routes working",
   service_layer: "enabled",
   meta_model: "enabled",
   admin_permissions: "enabled",
   partner_admin_workflow: {
     description: "Полный цикл одобрения партнеров администратором",
     steps: {
       "ЭТАП 0": "Партнер регистрируется через POST /api/partners/register",
       "ЭТАП 1→2": "POST /requests/:id/approve - Админ одобряет первичную заявку",
       "ЭТАП 2": "Партнер подает юр.данные через POST /api/partners/legal-info/:request_id",
       "ЭТАП 3→4": "POST /legal/:id/approve - Админ одобряет юр.данные → создает PartnerProfile",
       "ЭТАП 4": "Партнер наполняет контент в своем профиле",
       "ЭТАП 5→6": "POST /profiles/:id/approve - Админ одобряет контент → публикует"
     }
   },
   available_endpoints: {
     get_all_requests: "GET /api/admin/partners/requests",
     get_request_details: "GET /api/admin/partners/requests/:request_id",
     get_legal_info: "GET /api/admin/partners/legal/:legal_info_id",
     approve_initial_request: "POST /api/admin/partners/requests/:request_id/approve",
     reject_initial_request: "POST /api/admin/partners/requests/:request_id/reject",
     approve_legal_info: "POST /api/admin/partners/legal/:legal_info_id/approve",
     reject_legal_info: "POST /api/admin/partners/legal/:legal_info_id/reject",
     approve_content: "POST /api/admin/partners/profiles/:profile_id/approve",
     reject_content: "POST /api/admin/partners/profiles/:profile_id/reject"
   },
   timestamp: new Date().toISOString()
 });
});

router.get('/requests',
 authenticateUser,
 requireRole('admin'),
 async (req, res) => {
   try {
     const filters = {
       status: req.query.status,
       category: req.query.category,
       page: parseInt(req.query.page) || 1,
       limit: parseInt(req.query.limit) || 10,
       sort_by: req.query.sort_by || 'submitted_at',
       sort_order: req.query.sort_order || 'desc'
     };

     const result = await getAllPartnerRequests(filters);

     res.status(200).json({
       result: true,
       message: "Список заявок партнеров получен",
       pagination: {
         current_page: filters.page,
         per_page: filters.limit,
         total_pages: result.totalPages,
         total_items: result.totalCount
       },
       filters_applied: filters,
       requests: result.requests
     });

   } catch (error) {
     console.error('Get all partner requests error:', error);
     res.status(500).json({
       result: false,
       message: "Ошибка получения заявок партнеров"
     });
   }
 }
);

router.get('/requests/:request_id',
 authenticateUser,
 requireRole('admin'),
 async (req, res) => {
   try {
     const { request_id } = req.params;

     const request = await InitialPartnerRequest.findById(request_id);
     
     if (!request) {
       return res.status(404).json({
         result: false,
         message: "Заявка не найдена"
       });
     }

     const legalInfo = await PartnerLegalInfo.findOne({
       partner_request_id: request_id
     });

     const partnerProfile = await PartnerProfile.findOne({
       user_id: request.user_id
     });

     res.status(200).json({
       result: true,
       message: "Детали заявки получены",
       request: request,
       legal_info: legalInfo,
       partner_profile: partnerProfile,
       workflow_status: {
         current_step: request.status,
         can_approve_initial: request.status === 'pending',
         can_approve_legal: legalInfo && legalInfo.verification_status === 'pending',
         can_approve_content: partnerProfile && !partnerProfile.is_public
       }
     });

   } catch (error) {
     console.error('Get request details error:', error);
     res.status(500).json({
       result: false,
       message: "Ошибка получения деталей заявки"
     });
   }
 }
);

router.post('/requests/:request_id/approve',
 authenticateUser,
 requireRole('admin'),
 async (req, res) => {
   try {
     const { request_id } = req.params;
     const { admin_notes } = req.body;
     const { user } = req;

     const result = await approveInitialPartnerRequest(
       request_id, 
       user._id, 
       admin_notes || 'Заявка одобрена'
     );

     res.status(200).json({
       result: true,
       message: "🎯 ЭТАП 1→2 ЗАВЕРШЕН: Первичная заявка одобрена!",
       admin_action: "Заявка одобрена",
       next_step: "Партнер может подать юридические данные",
       request: result.request,
       workflow: {
         previous_step: 1,
         current_step: 2,
         step_name: "Партнер заполняет юридические данные"
       }
     });

   } catch (error) {
     console.error('Approve initial request error:', error);
     res.status(400).json({
       result: false,
       message: error.message || "Ошибка одобрения заявки"
     });
   }
 }
);

router.post('/requests/:request_id/reject',
 authenticateUser,
 requireRole('admin'),
 async (req, res) => {
   try {
     const { request_id } = req.params;
     const { rejection_reason } = req.body;
     const { user } = req;

     if (!rejection_reason) {
       return res.status(400).json({
         result: false,
         message: "Причина отклонения обязательна"
       });
     }

     const result = await rejectInitialPartnerRequest(
       request_id, 
       user._id, 
       rejection_reason
     );

     res.status(200).json({
       result: true,
       message: "Заявка отклонена",
       admin_action: "Заявка отклонена",
       rejection_reason: rejection_reason,
       request: result.request
     });

   } catch (error) {
     console.error('Reject initial request error:', error);
     res.status(400).json({
       result: false,
       message: error.message || "Ошибка отклонения заявки"
     });
   }
 }
);

router.get('/legal/:legal_info_id',
 authenticateUser,
 requireRole('admin'),
 async (req, res) => {
   try {
     const { legal_info_id } = req.params;

     const legalInfo = await PartnerLegalInfo.findById(legal_info_id);
     
     if (!legalInfo) {
       return res.status(404).json({
         result: false,
         message: "Юридические данные не найдены"
       });
     }

     res.status(200).json({
       result: true,
       message: "Юридические данные получены",
       legal_info: legalInfo,
       can_approve: legalInfo.verification_status === 'pending',
       workflow_note: "После одобрения будет создан PartnerProfile"
     });

   } catch (error) {
     console.error('Get legal info error:', error);
     res.status(500).json({
       result: false,
       message: "Ошибка получения юридических данных"
     });
   }
 }
);

router.post('/legal/:legal_info_id/approve',
 authenticateUser,
 requireRole('admin'),
 async (req, res) => {
   try {
     const { legal_info_id } = req.params;
     const { admin_notes } = req.body;
     const { user } = req;

     const result = await approveLegalInfoAndCreatePartner(
       legal_info_id, 
       user._id, 
       admin_notes || 'Юридические данные одобрены'
     );

     res.status(200).json({
       result: true,
       message: "🎯 ЭТАП 3→4 ЗАВЕРШЕН: Партнер создан! Юридические данные одобрены.",
       admin_action: "Юридические данные одобрены",
       partner_created: true,
       next_step: "Партнер может наполнять контент в профиле",
       partner: result.partner,
       legal_info: result.legalInfo,
       workflow: {
         previous_step: 3,
         current_step: 4,
         step_name: "Наполнение контента партнером",
         milestone: "PartnerProfile создан!"
       }
     });

   } catch (error) {
     console.error('Approve legal info error:', error);
     res.status(400).json({
       result: false,
       message: error.message || "Ошибка одобрения юридических данных"
     });
   }
 }
);

router.post('/legal/:legal_info_id/reject',
 authenticateUser,
 requireRole('admin'),
 async (req, res) => {
   try {
     const { legal_info_id } = req.params;
     const { rejection_reason, correction_notes } = req.body;
     const { user } = req;

     if (!rejection_reason) {
       return res.status(400).json({
         result: false,
         message: "Причина отклонения обязательна"
       });
     }

     const result = await rejectLegalInfo(
       legal_info_id, 
       user._id, 
       rejection_reason,
       correction_notes || ''
     );

     res.status(200).json({
       result: true,
       message: "Юридические данные отклонены",
       admin_action: "Юридические данные отклонены",
       rejection_reason: rejection_reason,
       correction_notes: correction_notes,
       legal_info: result.legalInfo
     });

   } catch (error) {
     console.error('Reject legal info error:', error);
     res.status(400).json({
       result: false,
       message: error.message || "Ошибка отклонения юридических данных"
     });
   }
 }
);

router.post('/profiles/:profile_id/approve',
 authenticateUser,
 requireRole('admin'),
 async (req, res) => {
   try {
     const { profile_id } = req.params;
     const { admin_notes } = req.body;
     const { user } = req;

     const result = await approvePartnerContentAndPublish(
       profile_id,
       user._id,
       admin_notes
     );

     res.status(200).json(result);

   } catch (error) {
     console.error('Approve content error:', error);
     res.status(400).json({
       result: false,
       message: error.message || "Ошибка одобрения контента"
     });
   }
 }
);

router.post('/profiles/:profile_id/reject',
 authenticateUser,
 requireRole('admin'),
 async (req, res) => {
   try {
     const { profile_id } = req.params;
     const { rejection_reason } = req.body;

     res.status(200).json({
       result: true,
       message: "❌ ЭТАП 5: Отклонение контента (В РАЗРАБОТКЕ)",
       note: "Этот функционал будет реализован",
       profile_id: profile_id,
       rejection_reason: rejection_reason
     });

   } catch (error) {
     console.error('Reject content error:', error);
     res.status(500).json({
       result: false,
       message: "Ошибка отклонения контента"
     });
   }
 }
);

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