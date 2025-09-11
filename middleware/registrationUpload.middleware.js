// middleware/registrationUpload.middleware.js - Адаптер для интеграции fileUpload с регистрацией
import { uploadDocuments, processDocuments } from './fileUpload.middleware.js';

/**
 * ================ MULTER ДЛЯ РЕГИСТРАЦИИ КУРЬЕРОВ ================
 * Переиспользует существующий uploadDocuments из fileUpload.middleware.js
 * Но с поддержкой именованных полей для каждого типа документа
 */
export const uploadCourierRegistrationDocuments = (req, res, next) => {
  // Устанавливаем uploadType для существующего middleware
  req.body.uploadType = 'courier-documents';
  req.body.userRole = 'courier';
  
  // Используем существующий uploadDocuments (поддерживает до 5 файлов)
  uploadDocuments(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        result: false,
        message: err.message || "Ошибка загрузки документов курьера"
      });
    }
    
    // Проверяем что загружены обязательные документы
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Необходимо загрузить хотя бы один документ"
      });
    }
    
    // Проверяем обязательные документы
    const vehicleType = req.body.vehicle_type;
    const requiredFields = ['id_card', 'bank_rib']; // Базовые для всех
    
    if (['motorbike', 'car'].includes(vehicleType)) {
      requiredFields.push('driver_license', 'insurance');
    }
    
    if (vehicleType === 'car') {
      requiredFields.push('vehicle_registration');
    }
    
    // Проверяем что все обязательные документы загружены
    const uploadedFields = files.map(file => file.fieldname);
    const missingFields = requiredFields.filter(field => !uploadedFields.includes(field));
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        result: false,
        message: `Отсутствуют обязательные документы: ${missingFields.join(', ')}`,
        missing_documents: missingFields,
        required_documents: requiredFields
      });
    }
    
    next();
  });
};

/**
 * ================ MULTER ДЛЯ ПОДАЧИ ДОКУМЕНТОВ ПАРТНЕРОВ ================
 * Переиспользует существующий uploadDocuments из fileUpload.middleware.js
 */
export const uploadPartnerLegalDocuments = (req, res, next) => {
  // Устанавливаем uploadType для существующего middleware
  req.body.uploadType = 'partner-documents';
  req.body.userRole = 'partner';
  
  // Используем существующий uploadDocuments
  uploadDocuments(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        result: false,
        message: err.message || "Ошибка загрузки документов партнера"
      });
    }
    
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Необходимо загрузить хотя бы один документ"
      });
    }
    
    // Проверяем что загружены обязательные документы для легальной информации
    const uploadedFields = files.map(file => file.fieldname);
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
    
    next();
  });
};

/**
 * ================ ОБРАБОТКА ДОКУМЕНТОВ РЕГИСТРАЦИИ ================
 * Переиспользует существующий processDocuments и создает URL поля
 */
export const processCourierRegistrationDocuments = (req, res, next) => {
  // Используем существующий processDocuments
  processDocuments(req, res, (err) => {
    if (err) {
      return next(err);
    }
    
    // Получаем обработанные документы
    const uploadedDocuments = req.uploadedDocuments || [];
    
    if (uploadedDocuments.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Не удалось обработать документы"
      });
    }
    
    // ✅ ГЛАВНАЯ ЛОГИКА: Преобразуем файлы в URL поля для сервисов
    uploadedDocuments.forEach(doc => {
      const fieldName = `${doc.documentType}_url`;
      req.body[fieldName] = doc.url; // Добавляем URL в req.body
    });
    
    // Логируем для отладки
    console.log('📄 COURIER REGISTRATION DOCUMENTS PROCESSED:', {
      uploaded_count: uploadedDocuments.length,
      url_fields_created: uploadedDocuments.map(doc => `${doc.documentType}_url`),
      vehicle_type: req.body.vehicle_type
    });
    
    next();
  });
};

/**
 * ================ ОБРАБОТКА ДОКУМЕНТОВ ПАРТНЕРОВ ================
 * Переиспользует существующий processDocuments и создает URL поля
 */
export const processPartnerLegalDocuments = (req, res, next) => {
  // Используем существующий processDocuments
  processDocuments(req, res, (err) => {
    if (err) {
      return next(err);
    }
    
    // Получаем обработанные документы
    const uploadedDocuments = req.uploadedDocuments || [];
    
    if (uploadedDocuments.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Не удалось обработать документы"
      });
    }
    
    // ✅ ГЛАВНАЯ ЛОГИКА: Создаем объект documents для сервиса партнеров
    req.body.documents = {};
    
    uploadedDocuments.forEach(doc => {
      req.body.documents[doc.documentType] = doc.url;
    });
    
    // Обрабатываем дополнительные документы (если есть)
    const additionalDocs = uploadedDocuments.filter(doc => 
      !['kbis_document', 'id_document'].includes(doc.documentType)
    );
    
    if (additionalDocs.length > 0) {
      req.body.documents.additional_documents = additionalDocs.map(doc => ({
        name: doc.originalName,
        url: doc.url,
        uploaded_at: new Date()
      }));
    }
    
    // Логируем для отладки
    console.log('📄 PARTNER LEGAL DOCUMENTS PROCESSED:', {
      uploaded_count: uploadedDocuments.length,
      documents_object: Object.keys(req.body.documents),
      additional_documents_count: additionalDocs.length
    });
    
    next();
  });
};

/**
 * ================ ЭКСПОРТ ================
 */
export {
  uploadCourierRegistrationDocuments,
  uploadPartnerLegalDocuments,
  processCourierRegistrationDocuments,
  processPartnerLegalDocuments
};