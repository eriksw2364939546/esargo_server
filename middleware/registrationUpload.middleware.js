// middleware/registrationUpload.middleware.js - ИСПРАВЛЕННЫЙ БЕЗ ДУБЛИРОВАНИЯ
import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * ==================== КОНФИГУРАЦИЯ ПАПОК ДЛЯ PDF ==================== 
 */
const PDF_UPLOAD_CONFIGS = {
  couriers: {
    documents: "uploads/couriers/documentsPdf"
  },
  partners: {
    documents: "uploads/partners/documentsPdf"
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

// Создаем папки для PDF документов
Object.values(PDF_UPLOAD_CONFIGS.couriers).forEach(ensureDirectoryExists);
Object.values(PDF_UPLOAD_CONFIGS.partners).forEach(ensureDirectoryExists);

/**
 * ==================== КОНФИГУРАЦИЯ MULTER ДЛЯ PDF ====================
 */
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Определяем роль по URL запроса
    let userRole = 'couriers'; // по умолчанию
    
    if (req.originalUrl && req.originalUrl.includes('/partners/')) {
      userRole = 'partner';
    } else if (req.originalUrl && req.originalUrl.includes('/couriers/')) {
      userRole = 'courier';
    }
    let uploadDir;
    if (userRole === 'partner') {
      uploadDir = PDF_UPLOAD_CONFIGS.partners.documents;
    } else {
      uploadDir = PDF_UPLOAD_CONFIGS.couriers.documents;
    }
    console.log(`📁 MULTER DESTINATION: ${userRole} -> ${uploadDir}`);
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Создаем уникальное имя файла
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const documentType = file.fieldname; // id_card, bank_rib, etc.
    
    const filename = `${documentType}-${timestamp}-${random}${ext}`;
    cb(null, filename);
  }
});

// Фильтр для PDF файлов
const pdfFileFilter = (req, file, cb) => {
  // Разрешаем только PDF файлы
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error(`Поле ${file.fieldname}: разрешены только PDF файлы`), false);
  }
};

/**
 * ==================== MULTER ДЛЯ PDF ДОКУМЕНТОВ ====================
 */
const uploadPdfDocuments = multer({
  storage: pdfStorage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB для PDF
    files: 10 // До 10 файлов
  }
});

/**
 * ================ MULTER ДЛЯ РЕГИСТРАЦИИ КУРЬЕРОВ ================
 */
export const uploadCourierRegistrationDocuments = (req, res, next) => {
  // Устанавливаем роль для определения папки
  req.body.userRole = 'courier';
  
  // Поля для курьеров (в зависимости от типа транспорта)
  const courierFields = [
    { name: 'id_card', maxCount: 1 },
    { name: 'bank_rib', maxCount: 1 },
    { name: 'driver_license', maxCount: 1 },
    { name: 'insurance', maxCount: 1 },
    { name: 'vehicle_registration', maxCount: 1 }
  ];
  
  const upload = uploadPdfDocuments.fields(courierFields);
  
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        result: false,
        message: err.message || "Ошибка загрузки документов курьера"
      });
    }
    
    // Проверяем что загружены файлы
    const files = req.files;
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        result: false,
        message: "Необходимо загрузить хотя бы один документ"
      });
    }
    
    // Проверяем обязательные документы в зависимости от транспорта
    const vehicleType = req.body.vehicle_type;
    const requiredFields = ['id_card', 'bank_rib']; // Базовые для всех
    
    if (['motorbike', 'car'].includes(vehicleType)) {
      requiredFields.push('driver_license', 'insurance');
    }
    
    if (vehicleType === 'car') {
      requiredFields.push('vehicle_registration');
    }
    
    // Проверяем что все обязательные документы загружены
    const uploadedFields = Object.keys(files);
    const missingFields = requiredFields.filter(field => !uploadedFields.includes(field));
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        result: false,
        message: `Отсутствуют обязательные документы: ${missingFields.join(', ')}`,
        missing_documents: missingFields,
        required_documents: requiredFields
      });
    }
    
    console.log('📄 COURIER DOCUMENTS UPLOADED:', {
      uploaded_fields: uploadedFields,
      vehicle_type: vehicleType,
      required_fields: requiredFields
    });
    
    next();
  });
};

/**
 * ================ MULTER ДЛЯ ПОДАЧИ ДОКУМЕНТОВ ПАРТНЕРОВ ================
 */
export const uploadPartnerLegalDocuments = (req, res, next) => {
  // Устанавливаем роль для определения папки
  req.body.userRole = 'partner';
  
  // Поля для партнеров
  const partnerFields = [
    { name: 'kbis_document', maxCount: 1 },
    { name: 'id_document', maxCount: 1 }
  ];
  
  const upload = uploadPdfDocuments.fields(partnerFields);
  
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        result: false,
        message: err.message || "Ошибка загрузки документов партнера"
      });
    }
    
    const files = req.files;
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        result: false,
        message: "Необходимо загрузить хотя бы один документ"
      });
    }
    
    // Проверяем обязательные документы для легальной информации
    const uploadedFields = Object.keys(files);
    const requiredFields = ['kbis_document', 'id_document'];
    
    const missingFields = requiredFields.filter(field => !uploadedFields.includes(field));
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        result: false,
        message: `Отсутствуют обязательные документы: ${missingFields.join(', ')}`,
        missing_documents: missingFields,
        required_documents: requiredFields
      });
    }
    
    console.log('📄 PARTNER DOCUMENTS UPLOADED:', {
      uploaded_fields: uploadedFields,
      required_fields: requiredFields
    });
    
    next();
  });
};

/**
 * ================ ОБРАБОТКА ДОКУМЕНТОВ РЕГИСТРАЦИИ КУРЬЕРОВ ================
 */
export const processCourierRegistrationDocuments = (req, res, next) => {
  try {
    const files = req.files;
    
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        result: false,
        message: "Нет файлов для обработки"
      });
    }
    
    // ✅ ГЛАВНАЯ ЛОГИКА: Преобразуем файлы в URL поля для сервисов
    Object.keys(files).forEach(fieldName => {
      const fileArray = files[fieldName];
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0]; // Берем первый файл
        const relativePath = path.relative(process.cwd(), file.path);
        const url = `/${relativePath.replace(/\\/g, '/')}`; // Для Windows
        
        // Создаем URL поле для существующих сервисов
        req.body[`${fieldName}_url`] = url;
      }
    });
    
    // Логируем для отладки
    const urlFields = Object.keys(files).map(field => `${field}_url`);
    console.log('📄 COURIER REGISTRATION DOCUMENTS PROCESSED:', {
      uploaded_count: Object.keys(files).length,
      url_fields_created: urlFields,
      vehicle_type: req.body.vehicle_type
    });
    
    next();
    
  } catch (error) {
    console.error('🚨 PROCESS COURIER DOCUMENTS ERROR:', error);
    return res.status(500).json({
      result: false,
      message: "Ошибка обработки документов курьера",
      error: error.toString()
    });
  }
};

/**
 * ================ ОБРАБОТКА ДОКУМЕНТОВ ПАРТНЕРОВ ================
 */
export const processPartnerLegalDocuments = (req, res, next) => {
  try {
    const files = req.files;
    
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        result: false,
        message: "Нет файлов для обработки"
      });
    }
    
    // ✅ ГЛАВНАЯ ЛОГИКА: Создаем объект documents для сервиса партнеров
    req.body.documents = {};
    
    Object.keys(files).forEach(fieldName => {
      const fileArray = files[fieldName];
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0]; // Берем первый файл
        const relativePath = path.relative(process.cwd(), file.path);
        const url = `/${relativePath.replace(/\\/g, '/')}`; // Для Windows
        
        // Добавляем в объект documents
        req.body.documents[fieldName] = url;
      }
    });
    
    // Логируем для отладки
    console.log('📄 PARTNER LEGAL DOCUMENTS PROCESSED:', {
      uploaded_count: Object.keys(files).length,
      documents_object: Object.keys(req.body.documents)
    });
    
    next();
    
  } catch (error) {
    console.error('🚨 PROCESS PARTNER DOCUMENTS ERROR:', error);
    return res.status(500).json({
      result: false,
      message: "Ошибка обработки документов партнера",
      error: error.toString()
    });
  }
};

/**
 * ================ ЭКСПОРТ ================
 */
export default{
  uploadCourierRegistrationDocuments,
  uploadPartnerLegalDocuments,
  processCourierRegistrationDocuments,
  processPartnerLegalDocuments
};