// middleware/fileUpload.middleware.js - УПРОЩЕННАЯ СИСТЕМА (ТОЛЬКО ИЗОБРАЖЕНИЯ)
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";

/**
 * ==================== КОНФИГУРАЦИЯ ПАПОК ====================
 */
const UPLOAD_CONFIGS = {
  partners: {
    restaurant: {
      base: "uploads/partners/partnersImage",
      menu: "uploads/partners/menusImage"
      // ✅ УДАЛЕНО: documents: "uploads/partners/documentsImage" (теперь в регистрации)
    },
    store: {
      base: "uploads/partners/partnersImage",
      menu: "uploads/partners/menusImage"
      // ✅ УДАЛЕНО: documents: "uploads/partners/documentsImage" (теперь в регистрации)
    }
  },
  couriers: {
    avatars: "uploads/couriers/avatarsImage"
    // ✅ УДАЛЕНО: documents: "uploads/couriers/documentsPdf" (теперь в регистрации)
  },
  admins: {
    avatars: "uploads/admins/avatarsImage"
  }
};

/**
 * ==================== СОЗДАНИЕ ПАПОК ====================
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
};

// Создаем все необходимые папки при запуске (только для изображений)
Object.values(UPLOAD_CONFIGS.partners.restaurant).forEach(ensureDirectoryExists);
Object.values(UPLOAD_CONFIGS.couriers).forEach(ensureDirectoryExists);
Object.values(UPLOAD_CONFIGS.admins).forEach(ensureDirectoryExists);

/**
 * ==================== КОНФИГУРАЦИЯ MULTER ====================
 */
const storage = multer.memoryStorage();

// ✅ УПРОЩЕННЫЙ фильтр файлов - ТОЛЬКО ИЗОБРАЖЕНИЯ
const fileFilter = (req, file, cb) => {
  // Проверяем только изображения
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Разрешены только изображения!"), false);
  }
  
  cb(null, true);
};

/**
 * ==================== БАЗОВЫЙ MULTER ====================
 */
const uploadBase = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    fieldSize: 50 * 1024 * 1024
  }
});

/**
 * ==================== MIDDLEWARE ДЛЯ ИЗОБРАЖЕНИЙ ====================
 */

// Одиночное изображение (аватарки, обложки)
export const uploadSingleImage = uploadBase.single("image");

// Множественные изображения (меню, галерея) 
export const uploadMultipleImages = uploadBase.array("images", 10);

// ✅ УДАЛЕНО: uploadDocuments - теперь в registrationUpload.middleware.js

/**
 * ==================== ОБРАБОТКА ИЗОБРАЖЕНИЙ ====================
 */
export const processImages = async (req, res, next) => {
  try {
    const { uploadType, userRole } = req.body;
    
    // Определяем откуда брать файлы
    const files = req.files || (req.file ? [req.file] : []);
    
    if (!files || files.length === 0) {
      return res.status(400).json({ 
        result: false, 
        message: "Изображения не загружены" 
      });
    }

    // ✅ УПРОЩЕННОЕ определение папки назначения (только изображения)
    let uploadDir;
    switch (uploadType) {
      case 'restaurant-cover':
      case 'store-cover':
        uploadDir = UPLOAD_CONFIGS.partners.restaurant.base;
        break;
      case 'menu-item':
        uploadDir = UPLOAD_CONFIGS.partners.restaurant.menu;
        break;
      case 'courier-avatar':
        uploadDir = UPLOAD_CONFIGS.couriers.avatars;
        break;
      case 'admin-avatar':
        uploadDir = UPLOAD_CONFIGS.admins.avatars;
        break;
      default:
        return res.status(400).json({
          result: false,
          message: `Неизвестный тип изображения: ${uploadType}`
        });
    }

    // Обрабатываем и сохраняем изображения
    const processedImages = await Promise.all(
      files.map(async (file, index) => {
        const uniqueSuffix = `${Date.now()}-${index}`;
        const filename = `${uploadType}-${uniqueSuffix}.webp`;
        const outputPath = path.join(uploadDir, filename);

        // Обрабатываем изображение через Sharp
        await sharp(file.buffer)
          .resize(800, 800, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .webp({ quality: 80 })
          .toFile(outputPath);

        return {
          filename,
          originalName: file.originalname,
          size: file.size,
          path: outputPath,
          url: `/${uploadDir}/${filename}`,
          uploadType,
          format: 'webp',
          dimensions: '800x800 max'
        };
      })
    );

    req.uploadedImages = processedImages;
    next();

  } catch (error) {
    console.error('🚨 PROCESS IMAGES ERROR:', error);
    return res.status(500).json({
      result: false,
      message: "Ошибка обработки изображений",
      error: error.toString()
    });
  }
};

// ✅ УДАЛЕНО: processDocuments - теперь в registrationUpload.middleware.js

/**
 * ==================== УДАЛЕНИЕ ФАЙЛОВ ====================
 */
export const deleteFile = async (req, res, next) => {
  try {
    const { filename, uploadType } = req.params;
    
    // ✅ УПРОЩЕННОЕ определение папки (только изображения)
    let uploadDir;
    switch (uploadType) {
      case 'restaurant-cover':
      case 'store-cover':
        uploadDir = UPLOAD_CONFIGS.partners.restaurant.base;
        break;
      case 'menu-item':
        uploadDir = UPLOAD_CONFIGS.partners.restaurant.menu;
        break;
      case 'courier-avatar':
        uploadDir = UPLOAD_CONFIGS.couriers.avatars;
        break;
      case 'admin-avatar':
        uploadDir = UPLOAD_CONFIGS.admins.avatars;
        break;
      default:
        return res.status(400).json({
          result: false,
          message: `Неизвестный тип файла: ${uploadType}`
        });
    }

    const filePath = path.join(process.cwd(), uploadDir, filename);

    // Проверяем существование файла
    await fs.promises.access(filePath, fs.constants.F_OK);
    
    // Удаляем файл
    await fs.promises.unlink(filePath);

    req.deletedFile = {
      filename,
      uploadType,
      path: filePath
    };

    next();

  } catch (error) {
    console.error('🚨 DELETE FILE ERROR:', error);
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({ 
        result: false, 
        message: "Файл не найден" 
      });
    }
    
    return res.status(500).json({
      result: false,
      message: "Ошибка при удалении файла",
      error: error.toString()
    });
  }
};

/**
 * ==================== ПОЛУЧЕНИЕ СПИСКА ФАЙЛОВ ====================
 */
export const getFilesList = async (req, res, next) => {
  try {
    const { uploadType } = req.params;
    
    // ✅ УПРОЩЕННОЕ определение папки (только изображения)
    let uploadDir;
    switch (uploadType) {
      case 'restaurant-cover':
      case 'store-cover':
        uploadDir = UPLOAD_CONFIGS.partners.restaurant.base;
        break;
      case 'menu-item':
        uploadDir = UPLOAD_CONFIGS.partners.restaurant.menu;
        break;
      case 'courier-avatar':
        uploadDir = UPLOAD_CONFIGS.couriers.avatars;
        break;
      case 'admin-avatar':
        uploadDir = UPLOAD_CONFIGS.admins.avatars;
        break;
      default:
        return res.status(400).json({
          result: false,
          message: `Неизвестный тип файлов: ${uploadType}`
        });
    }

    const fullPath = path.join(process.cwd(), uploadDir);
    const files = await fs.promises.readdir(fullPath);
    
    // ✅ УПРОЩЕННАЯ фильтрация файлов (только изображения)
    const filteredFiles = files.filter(file => {
      return file.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i);
    });

    req.filesList = {
      files: filteredFiles,
      uploadType,
      directory: uploadDir,
      count: filteredFiles.length,
      file_type: 'images_only' // ✅ НОВОЕ
    };

    next();

  } catch (error) {
    console.error('🚨 GET FILES LIST ERROR:', error);
    return res.status(500).json({
      result: false,
      message: "Ошибка при получении списка файлов",
      error: error.toString()
    });
  }
};

/**
 * ==================== ВАЛИДАЦИЯ ТИПОВ ЗАГРУЗКИ ====================
 */
export const validateUploadType = (req, res, next) => {
  const { uploadType, userRole } = req.body;
  
  if (!uploadType) {
    return res.status(400).json({
      result: false,
      message: "Тип загрузки (uploadType) обязателен"
    });
  }

  // ✅ УПРОЩЕННЫЕ права доступа (только изображения)
  const rolePermissions = {
    partner: ['restaurant-cover', 'store-cover', 'menu-item'],
    courier: ['courier-avatar'],
    admin: ['admin-avatar']
  };

  // ✅ УДАЛЕНО: 'partner-documents', 'courier-documents' (теперь в регистрации)

  if (userRole && !rolePermissions[userRole]?.includes(uploadType)) {
    return res.status(403).json({
      result: false,
      message: `Роль ${userRole} не имеет права загружать файлы типа ${uploadType}`,
      allowed_types: rolePermissions[userRole] || []
    });
  }

  next();
};

/**
 * ==================== ЭКСПОРТ ====================
 */
export default {
  // ✅ ТОЛЬКО функции для изображений
  uploadSingleImage,
  uploadMultipleImages,
  processImages,
  
  // Управление файлами
  deleteFile,
  getFilesList,
  
  // Валидация
  validateUploadType,
  
  // Конфигурация
  UPLOAD_CONFIGS
  
  // ✅ УДАЛЕНО: uploadDocuments, processDocuments (теперь в registrationUpload.middleware.js)
};