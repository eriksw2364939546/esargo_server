// routes/FileUpload.route.js - УПРОЩЕННАЯ ФАЙЛОВАЯ СИСТЕМА (ТОЛЬКО ИЗОБРАЖЕНИЯ)
import express from 'express';

// Middleware для загрузки файлов (только изображения)
import {
  uploadSingleImage,
  uploadMultipleImages,
  processImages,
  deleteFile,
  getFilesList,
  validateUploadType
} from '../middleware/fileUpload.middleware.js';

// Контроллеры - ИСПРАВЛЕН ИМПОРТ PartnerFileController
import {
  uploadCoverImage,
  updateCoverImage,
  addGalleryImages,
  addMenuItemImage,
  uploadDocuments,
  removeGalleryImage,
  getFiles,
  getFilesList as getPartnerFilesList
} from '../controllers/FileUpload/PartnerFileController.js';

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
    message: 'ESARGO File Upload API - Images Only',
    version: '2.0.0', // ✅ ОБНОВЛЕНО
    supported_roles: ['partner', 'courier', 'admin'],
    
    // ✅ ОБНОВЛЕНО: Только изображения
    supported_file_types: {
      images: {
        formats: ['jpg', 'jpeg', 'png', 'webp'],
        processing: 'Конвертация в WebP, resize 800x800, качество 80%',
        max_size: '5MB',
        use_cases: ['Аватары', 'Обложки ресторанов', 'Фото меню', 'Галереи']
      }
    },
    
    // ✅ ОБНОВЛЕНО: PDF документы исключены
    upload_structure: {
      partners: {
        cover: 'uploads/partners/partnersImage/',
        menu: 'uploads/partners/menusImage/'
        // ✅ УДАЛЕНО: documents: 'uploads/partners/documentsImage/' (теперь в регистрации)
      },
      couriers: {
        avatars: 'uploads/couriers/avatarsImage/'
        // ✅ УДАЛЕНО: documents: 'uploads/couriers/documentsPdf/' (теперь в регистрации)
      },
      admins: {
        avatars: 'uploads/admins/avatarsImage/'
      }
    },
    
    // ✅ ОБНОВЛЕНО: Разделение ответственности
    system_separation: {
      this_api: "Изображения для одобренных профилей (аватары, обложки, галереи, меню)",
      registration_api: "PDF документы при регистрации курьеров и подаче документов партнеров"
    },
    
    endpoints: {
      partners: 'POST /api/uploads/partners/* (только изображения)',
      couriers: 'POST /api/uploads/couriers/* (только аватары)',
      admins: 'POST /api/uploads/admins/* (только аватары)',
      system: 'GET /api/uploads/system/*'
    }
  });
});

// ================ ПАРТНЕРСКИЕ РОУТЫ (ТОЛЬКО ИЗОБРАЖЕНИЯ) ================

/**
 * POST /api/uploads/partners/cover/upload - Загрузка обложки ресторана/магазина
 * Body: { profile_id, uploadType: 'restaurant-cover' }
 * File: single image
 */
router.post('/partners/cover/upload',
  checkPartnerToken,
  requirePartnerProfile,
  uploadSingleImage,
  validateUploadType,
  processImages,
  uploadCoverImage // ИСПРАВЛЕНО: прямой вызов функции
);

/**
 * PUT /api/uploads/partners/cover/update - Обновление обложки
 * Body: { profile_id, uploadType: 'restaurant-cover' }
 * File: single image
 */
router.put('/partners/cover/update',
  checkPartnerToken,
  requirePartnerProfile,
  uploadSingleImage,
  validateUploadType,
  processImages,
  updateCoverImage // ИСПРАВЛЕНО: прямой вызов функции
);

/**
 * POST /api/uploads/partners/gallery - Добавление изображений в галерею
 * Body: { profile_id, image_type, uploadType: 'restaurant-cover' }
 * Files: multiple images (max 10)
 */
router.post('/partners/gallery',
  checkPartnerToken,
  requirePartnerProfile,
  uploadMultipleImages,
  validateUploadType,
  processImages,
  addGalleryImages // ИСПРАВЛЕНО: прямой вызов функции
);

/**
 * POST /api/uploads/partners/menu-item - Добавление фото к продукту меню
 * Body: { product_id, uploadType: 'menu-item' }
 * File: single image
 */
router.post('/partners/menu-item',
  checkPartnerToken,
  requirePartnerProfile,
  uploadSingleImage,
  validateUploadType,
  processImages,
  addMenuItemImage // ИСПРАВЛЕНО: прямой вызов функции
);

// ✅ УДАЛЕНО: POST /api/uploads/partners/documents - теперь в регистрации!

/**
 * DELETE /api/uploads/partners/gallery/:profile_id/:filename - Удаление из галереи
 * Params: profile_id, filename
 * Body: { image_url, uploadType: 'restaurant-cover' }
 */
router.delete('/partners/gallery/:profile_id/:filename',
  checkPartnerToken,
  requirePartnerProfile,
  deleteFile,
  removeGalleryImage // ИСПРАВЛЕНО: прямой вызов функции
);

/**
 * GET /api/uploads/partners/files/:profile_id - Получение всех файлов партнера
 */
router.get('/partners/files/:profile_id',
  checkPartnerToken,
  requirePartnerProfile,
  getFiles // ИСПРАВЛЕНО: прямой вызов функции
);

/**
 * GET /api/uploads/partners/list/:uploadType - Список файлов по типу
 */
router.get('/partners/list/:uploadType',
  checkPartnerToken,
  requirePartnerProfile,
  getFilesList,
  getPartnerFilesList // ИСПРАВЛЕНО: использование переименованной функции
);

// ================ КУРЬЕРСКИЕ РОУТЫ (ТОЛЬКО АВАТАРЫ) ================

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

// ✅ УДАЛЕНО: POST /api/uploads/couriers/documents - теперь в регистрации!
// ✅ УДАЛЕНО: DELETE /api/uploads/couriers/documents/:profile_id/:document_id/:filename
// ✅ УДАЛЕНО: GET /api/uploads/couriers/documents/status/:profile_id

/**
 * GET /api/uploads/couriers/files/:profile_id - Получение всех файлов курьера
 */
router.get('/couriers/files/:profile_id',
  checkCourierToken,
  CourierFileController.getFiles
);

/**
 * GET /api/uploads/couriers/list/:uploadType - Список файлов курьера по типу
 */
router.get('/couriers/list/:uploadType',
  checkCourierToken,
  getFilesList,
  CourierFileController.getFilesList
);

// ================ АДМИНСКИЕ РОУТЫ (ТОЛЬКО АВАТАРЫ) ================

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
  AdminFileController.createAdminWithAvatar
);

/**
 * DELETE /api/uploads/admins/avatar/:admin_id/:filename - Удаление аватара админа
 */
router.delete('/admins/avatar/:admin_id/:filename',
  checkAdminToken,
  deleteFile,
  AdminFileController.removeAvatar
);

// ================ ОБЩИЕ СЛУЖЕБНЫЕ РОУТЫ ================

/**
 * GET /api/uploads/system/health - Проверка работоспособности файловой системы
 */
router.get('/system/health', CommonFileController.healthCheck);

/**
 * GET /api/uploads/system/stats - Статистика использования файлов
 */
router.get('/system/stats', 
  checkAdminToken, 
  CommonFileController.getStorageStats
);

/**
 * POST /api/uploads/system/cleanup - Очистка временных файлов (только owner)
 */
router.post('/system/cleanup',
  checkAdminToken,
  CommonFileController.cleanupTempFiles
);

// ================ ИНФОРМАЦИОННЫЕ РОУТЫ ================

/**
 * GET /api/uploads/supported-formats - Поддерживаемые форматы
 */
router.get('/supported-formats', (req, res) => {
  res.json({
    result: true,
    message: "Поддерживаемые форматы файлов",
    image_formats: {
      input: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'],
      output: 'webp (оптимизировано)',
      max_size: '5MB',
      processing: 'Автоматическое сжатие и оптимизация'
    },
    // ✅ ОБНОВЛЕНО: Убрано упоминание PDF
    document_formats: {
      note: "PDF документы теперь обрабатываются при регистрации",
      registration_endpoints: [
        "POST /api/couriers/register (PDF документы курьеров)",
        "POST /api/partners/legal-info/:id (PDF документы партнеров)"
      ]
    },
    restrictions: {
      file_count: {
        single_image: 1,
        gallery: 10,
        menu_images: "Без ограничений"
      },
      user_permissions: {
        partners: "Только для созданных профилей",
        couriers: "Только для одобренных курьеров", 
        admins: "Полный доступ"
      }
    }
  });
});

/**
 * GET /api/uploads/migration-info - Информация о миграции
 */
router.get('/migration-info', (req, res) => {
  res.json({
    result: true,
    message: "Информация о миграции файловой системы",
    changes: {
      version: "2.0.0",
      date: new Date().toISOString(),
      breaking_changes: [
        "PDF документы больше не загружаются через /api/uploads/",
        "Документы курьеров теперь загружаются при регистрации",
        "Документы партнеров теперь загружаются при подаче легальных данных"
      ],
      what_remains: [
        "Аватары курьеров (после одобрения)",
        "Обложки ресторанов",
        "Фото меню",
        "Галереи партнеров",
        "Аватары админов"
      ],
      migration_path: {
        old_document_uploads: "Удалены из FileUpload API",
        new_document_uploads: "Интегрированы в регистрацию",
        existing_files: "Остаются без изменений",
        new_workflow: "PDF при регистрации → Изображения после одобрения"
      }
    }
  });
});

export default router;