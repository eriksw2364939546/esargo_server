// middleware/fileUpload.middleware.js - Универсальная система загрузки файлов для ESARGO-SERVER
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
      menu: "uploads/partners/menusImage", 
      documents: "uploads/partners/documentsImage"
    },
    store: {
      base: "uploads/partners/partnersImage",
      menu: "uploads/partners/menusImage",
      documents: "uploads/partners/documentsImage"
    }
  },
  couriers: {
    avatars: "uploads/couriers/avatarsImage",
    documents: "uploads/couriers/documentsPdf"
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

// Создаем все необходимые папки при запуске
Object.values(UPLOAD_CONFIGS.partners.restaurant).forEach(ensureDirectoryExists);
Object.values(UPLOAD_CONFIGS.couriers).forEach(ensureDirectoryExists);
Object.values(UPLOAD_CONFIGS.admins).forEach(ensureDirectoryExists);

/**
 * ==================== КОНФИГУРАЦИЯ MULTER ====================
 */
const storage = multer.memoryStorage();

// Фильтр файлов - изображения и PDF
const fileFilter = (req, file, cb) => {
  const { uploadType } = req.body;
  
  // Для изображений
  if (['restaurant-cover', 'menu-item', 'courier-avatar', 'admin-avatar'].includes(uploadType)) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Разрешены только изображения!"), false);
    }
  }
  
  // Для документов
  if (['partner-documents', 'courier-documents'].includes(uploadType)) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Разрешены только PDF документы!"), false);
    }
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
 * ==================== MIDDLEWARE ДЛЯ РАЗНЫХ ТИПОВ ЗАГРУЗКИ ====================
 */

// Одиночное изображение (аватарки, обложки)
export const uploadSingleImage = uploadBase.single("image");

// Множественные изображения (меню, галерея) 
export const uploadMultipleImages = uploadBase.array("images", 10);

// Документы PDF
export const uploadDocuments = uploadBase.array("documents", 5);

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
        message: "Файлы не загружены" 
      });
    }

    // Определяем папку назначения
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
          message: `Неизвестный тип загрузки: ${uploadType}`
        });
    }

    // Обрабатываем изображения
    const processedImages = await Promise.all(
      files.map(async (file, index) => {
        const uniqueSuffix = `${Date.now()}-${index}`;
        const filename = `${uploadType}-${uniqueSuffix}.webp`;
        const outputPath = path.join(uploadDir, filename);

        await sharp(file.buffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(outputPath);

        return {
          filename,
          originalName: file.originalname,
          size: file.size,
          path: outputPath,
          url: `/${uploadDir}/${filename}`,
          uploadType
        };
      })
    );

    req.uploadedFiles = processedImages;
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

/**
 * ==================== ОБРАБОТКА PDF ДОКУМЕНТОВ ====================
 */
export const processDocuments = async (req, res, next) => {
  try {
    const { uploadType, userRole } = req.body;
    
    const files = req.files || [];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ 
        result: false, 
        message: "Документы не загружены" 
      });
    }

    // Определяем папку назначения
    let uploadDir;
    switch (uploadType) {
      case 'partner-documents':
        uploadDir = UPLOAD_CONFIGS.partners.restaurant.documents;
        break;
      case 'courier-documents':
        uploadDir = UPLOAD_CONFIGS.couriers.documents;
        break;
      default:
        return res.status(400).json({
          result: false,
          message: `Неизвестный тип документов: ${uploadType}`
        });
    }

    // Сохраняем PDF документы
    const processedDocuments = await Promise.all(
      files.map(async (file, index) => {
        const uniqueSuffix = `${Date.now()}-${index}`;
        const filename = `${uploadType}-${uniqueSuffix}.pdf`;
        const outputPath = path.join(uploadDir, filename);

        // Сохраняем PDF как есть (без обработки)
        await fs.promises.writeFile(outputPath, file.buffer);

        return {
          filename,
          originalName: file.originalname,
          size: file.size,
          path: outputPath,
          url: `/${uploadDir}/${filename}`,
          uploadType,
          documentType: file.fieldname || 'document'
        };
      })
    );

    req.uploadedDocuments = processedDocuments;
    next();

  } catch (error) {
    console.error('🚨 PROCESS DOCUMENTS ERROR:', error);
    return res.status(500).json({
      result: false,
      message: "Ошибка обработки документов",
      error: error.toString()
    });
  }
};

/**
 * ==================== УДАЛЕНИЕ ФАЙЛОВ ====================
 */
export const deleteFile = async (req, res, next) => {
  try {
    const { filename, uploadType } = req.params;
    
    // Определяем папку по типу
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
      case 'partner-documents':
        uploadDir = UPLOAD_CONFIGS.partners.restaurant.documents;
        break;
      case 'courier-documents':
        uploadDir = UPLOAD_CONFIGS.couriers.documents;
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
    
    // Определяем папку по типу
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
      case 'partner-documents':
        uploadDir = UPLOAD_CONFIGS.partners.restaurant.documents;
        break;
      case 'courier-documents':
        uploadDir = UPLOAD_CONFIGS.couriers.documents;
        break;
      default:
        return res.status(400).json({
          result: false,
          message: `Неизвестный тип файлов: ${uploadType}`
        });
    }

    const fullPath = path.join(process.cwd(), uploadDir);
    const files = await fs.promises.readdir(fullPath);
    
    // Фильтруем файлы по расширению
    const filteredFiles = files.filter(file => {
      if (['partner-documents', 'courier-documents'].includes(uploadType)) {
        return file.match(/\.(pdf)$/i);
      } else {
        return file.match(/\.(jpg|jpeg|png|webp)$/i);
      }
    });

    req.filesList = {
      files: filteredFiles,
      uploadType,
      directory: uploadDir,
      count: filteredFiles.length
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

  // Проверяем соответствие роли и типа загрузки
  const rolePermissions = {
    partner: ['restaurant-cover', 'store-cover', 'menu-item', 'partner-documents'],
    courier: ['courier-avatar', 'courier-documents'],
    admin: ['admin-avatar']
  };

  if (userRole && !rolePermissions[userRole]?.includes(uploadType)) {
    return res.status(403).json({
      result: false,
      message: `Роль ${userRole} не имеет права загружать файлы типа ${uploadType}`
    });
  }

  next();
};

/**
 * ==================== ЭКСПОРТ ====================
 */
export default {
  // Основные функции загрузки
  uploadSingleImage,
  uploadMultipleImages,
  uploadDocuments,
  
  // Обработка файлов
  processImages,
  processDocuments,
  
  // Управление файлами
  deleteFile,
  getFilesList,
  
  // Валидация
  validateUploadType,
  
  // Конфигурация
  UPLOAD_CONFIGS
};