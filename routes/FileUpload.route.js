// routes/FileUpload.route.js - Роуты для системы загрузки файлов ESARGO
import express from 'express';

// Middleware для загрузки файлов
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadDocuments,
  processImages,
  processDocuments,
  deleteFile,
  getFilesList,
  validateUploadType
} from '../middleware/fileUpload.middleware.js';

// Контроллеры
import PartnerFileController from '../controllers/FileUpload/PartnerFileController.js';
import CourierFileController from '../controllers/FileUpload/CourierFileController.js';
import AdminFileController from '../controllers/FileUpload/AdminFileController.js';
import CommonFileController from '../controllers/FileUpload/CommonFileController.js';

// Middleware авторизации (используем существующие)
import { checkPartnerToken, requirePartnerProfile } from '../middleware/partnerAuth.middleware.js';
import { checkCourierToken, requireApprovedCourier } from '../middleware/courierAuth.middleware.js';
import { checkAdminToken } from '../middleware/adminAuth.middleware.js';

const router = express.Router();

// ================ ИНФОРМАЦИОННЫЙ РОУТ ================
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ESARGO File Upload API',
    version: '1.0.0',
    supported_roles: ['partner', 'courier', 'admin'],
    
    file_types: {
      images: {
        formats: ['jpg', 'jpeg', 'png', 'webp'],
        processing: 'Конвертация в WebP, resize 800x800, качество 80%',
        max_size: '5MB'
      },
      documents: {
        formats: ['pdf'],
        processing: 'Без обработки',
        max_size: '5MB'
      }
    },
    
    upload_structure: {
      partners: {
        cover: 'uploads/partners/partnersImage/',
        menu: 'uploads/partners/menusImage/',
        documents: 'uploads/partners/documentsImage/'
      },
      couriers: {
        avatars: 'uploads/couriers/avatarsImage/',
        documents: 'uploads/couriers/documentsPdf/'
      },
      admins: {
        avatars: 'uploads/admins/avatarsImage/'
      }
    },
    
    endpoints: {
      partners: 'POST /api/uploads/partners/*',
      couriers: 'POST /api/uploads/couriers/*',
      admins: 'POST /api/uploads/admins/*',
      system: 'GET /api/uploads/system/*'
    }
  });
});

// ================ ПАРТНЕРСКИЕ РОУТЫ ================

/**
 * POST /api/uploads/partners/cover/upload - Загрузка обложки ресторана/магазина
 * Body: { profile_id, uploadType: 'restaurant-cover' }
 * File: single image
 */
router.post('/partners/cover/upload',
  checkPartnerToken,
  requirePartnerProfile,
  validateUploadType,
  uploadSingleImage,
  processImages,
  PartnerFileController.uploadCoverImage
);

/**
 * PUT /api/uploads/partners/cover/update - Обновление обложки
 * Body: { profile_id, uploadType: 'restaurant-cover' }
 * File: single image
 */
router.put('/partners/cover/update',
  checkPartnerToken,
  requirePartnerProfile,
  validateUploadType,
  uploadSingleImage,
  processImages,
  PartnerFileController.updateCoverImage
);

/**
 * POST /api/uploads/partners/gallery - Добавление изображений в галерею
 * Body: { profile_id, image_type, uploadType: 'restaurant-cover' }
 * Files: multiple images (max 10)
 */
router.post('/partners/gallery',
  checkPartnerToken,
  requirePartnerProfile,
  validateUploadType,
  uploadMultipleImages,
  processImages,
  PartnerFileController.addGalleryImages
);

/**
 * POST /api/uploads/partners/menu-item - Добавление фото к продукту меню
 * Body: { product_id, uploadType: 'menu-item' }
 * File: single image
 */
router.post('/partners/menu-item',
  checkPartnerToken,
  requirePartnerProfile,
  validateUploadType,
  uploadSingleImage,
  processImages,
  PartnerFileController.addMenuItemImage
);

/**
 * POST /api/uploads/partners/documents - Загрузка документов партнера
 * Body: { profile_id, uploadType: 'partner-documents' }
 * Files: multiple PDF documents (max 5)
 */
router.post('/partners/documents',
  checkPartnerToken,
  requirePartnerProfile,
  validateUploadType,
  uploadDocuments,
  processDocuments,
  PartnerFileController.uploadDocuments
);

/**
 * DELETE /api/uploads/partners/gallery/:profile_id/:filename - Удаление из галереи
 * Params: profile_id, filename
 * Body: { image_url, uploadType: 'restaurant-cover' }
 */
router.delete('/partners/gallery/:profile_id/:filename',
  checkPartnerToken,
  requirePartnerProfile,
  deleteFile,
  PartnerFileController.removeGalleryImage
);

/**
 * GET /api/uploads/partners/files/:profile_id - Получение всех файлов партнера
 */
router.get('/partners/files/:profile_id',
  checkPartnerToken,
  requirePartnerProfile,
  PartnerFileController.getFiles
);

/**
 * GET /api/uploads/partners/list/:uploadType - Список файлов по типу
 */
router.get('/partners/list/:uploadType',
  checkPartnerToken,
  requirePartnerProfile,
  getFilesList,
  PartnerFileController.getFilesList
);

// ================ КУРЬЕРСКИЕ РОУТЫ ================

/**
 * POST /api/uploads/couriers/avatar/upload - Загрузка аватара курьера
 * Body: { profile_id, uploadType: 'courier-avatar' }
 * File: single image
 */
router.post('/couriers/avatar/upload',
  checkCourierToken,
  requireApprovedCourier,
  validateUploadType,
  uploadSingleImage,
  processImages,
  CourierFileController.uploadAvatar
);

/**
 * PUT /api/uploads/couriers/avatar/update - Обновление аватара курьера
 * Body: { profile_id, uploadType: 'courier-avatar' }
 * File: single image
 */
router.put('/couriers/avatar/update',
  checkCourierToken,
  requireApprovedCourier,
  validateUploadType,
  uploadSingleImage,
  processImages,
  CourierFileController.updateAvatar
);

/**
 * POST /api/uploads/couriers/documents - Загрузка документов курьера
 * Body: { profile_id, uploadType: 'courier-documents' }
 * Files: multiple PDF documents (max 5)
 */
router.post('/couriers/documents',
  checkCourierToken,
  validateUploadType,
  uploadDocuments,
  processDocuments,
  CourierFileController.uploadDocuments
);

/**
 * DELETE /api/uploads/couriers/documents/:profile_id/:document_id/:filename - Удаление документа
 */
router.delete('/couriers/documents/:profile_id/:document_id/:filename',
  checkCourierToken,
  deleteFile,
  CourierFileController.removeDocument
);

/**
 * GET /api/uploads/couriers/files/:profile_id - Получение всех файлов курьера
 */
router.get('/couriers/files/:profile_id',
  checkCourierToken,
  CourierFileController.getFiles
);

/**
 * GET /api/uploads/couriers/documents/status/:profile_id - Статус документов курьера
 */
router.get('/couriers/documents/status/:profile_id',
  checkCourierToken,
  CourierFileController.getDocumentStatus
);

/**
 * GET /api/uploads/couriers/list/:uploadType - Список файлов курьера по типу
 */
router.get('/couriers/list/:uploadType',
  checkCourierToken,
  getFilesList,
  CourierFileController.getFilesList
);

// ================ АДМИНСКИЕ РОУТЫ ================

/**
 * POST /api/uploads/admins/avatar/upload - Загрузка аватара админа
 * Body: { admin_id, uploadType: 'admin-avatar' }
 * File: single image
 */
router.post('/admins/avatar/upload',
  checkAdminToken,
  validateUploadType,
  uploadSingleImage,
  processImages,
  AdminFileController.uploadAvatar
);

/**
 * PUT /api/uploads/admins/avatar/update - Обновление аватара админа
 * Body: { admin_id, uploadType: 'admin-avatar' }
 * File: single image
 */
router.put('/admins/avatar/update',
  checkAdminToken,
  validateUploadType,
  uploadSingleImage,
  processImages,
  AdminFileController.updateAvatar
);

/**
 * POST /api/uploads/admins/create-with-avatar - Создание админа с аватаром (только owner)
 * Body: { first_name, last_name, email, role, uploadType: 'admin-avatar' }
 * File: single image
 */
router.post('/admins/create-with-avatar',
  checkAdminToken,
  validateUploadType,
  uploadSingleImage,
  processImages,
  AdminFileController.createWithAvatar
);

/**
 * GET /api/uploads/admins/files/:admin_id - Получение файлов админа
 */
router.get('/admins/files/:admin_id',
  checkAdminToken,
  AdminFileController.getFiles
);

/**
 * GET /api/uploads/admins/statistics - Системная статистика файлов (только owner)
 */
router.get('/admins/statistics',
  checkAdminToken,
  AdminFileController.getSystemStatistics
);

/**
 * GET /api/uploads/admins/list/:uploadType - Список файлов админов по типу
 */
router.get('/admins/list/:uploadType',
  checkAdminToken,
  getFilesList,
  AdminFileController.getFilesList
);

// ================ СИСТЕМНЫЕ РОУТЫ (ОБЩИЕ) ================

/**
 * GET /api/uploads/system/statistics - Общая статистика загрузок (админы)
 */
router.get('/system/statistics',
  checkAdminToken,
  CommonFileController.getUploadStats
);

/**
 * GET /api/uploads/system/folder-size/:directory - Размер конкретной папки
 */
router.get('/system/folder-size/:directory',
  checkAdminToken,
  CommonFileController.getFolderSize
);

/**
 * POST /api/uploads/system/cleanup/:directory - Очистка старых файлов (только owner)
 * Body: { max_age_days }
 */
router.post('/system/cleanup/:directory',
  checkAdminToken,
  CommonFileController.cleanupFiles
);

/**
 * POST /api/uploads/system/create-directories - Создание структуры папок (только owner)
 */
router.post('/system/create-directories',
  checkAdminToken,
  CommonFileController.createDirectoryStructure
);

/**
 * DELETE /api/uploads/system/file/:uploadType/:filename - Удаление конкретного файла
 */
router.delete('/system/file/:uploadType/:filename',
  checkAdminToken,
  deleteFile,
  CommonFileController.deleteSpecificFile
);

/**
 * GET /api/uploads/system/health - Проверка состояния файловой системы (только owner)
 */
router.get('/system/health',
  checkAdminToken,
  CommonFileController.getSystemHealth
);

export default router;