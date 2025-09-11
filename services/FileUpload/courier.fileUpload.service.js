// services/FileUpload/courier.fileUpload.service.js
import { CourierProfile } from '../../models/index.js';
import { validateMongoId } from '../../utils/validation.utils.js';


export const uploadCourierAvatar = async (courierId, imageData) => {
  try {
    if (!validateMongoId(courierId)) {
      throw new Error('Неверный ID курьера');
    }

    const profile = await CourierProfile.findById(courierId);
    if (!profile) {
      throw new Error('Профиль курьера не найден');
    }

    if (profile.avatar_url) {
      throw new Error('Аватар уже загружен. Используйте функцию обновления');
    }

    // Загружаем первый аватар
    profile.avatar_url = imageData.url;
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      courier_name: `${profile.first_name} ${profile.last_name}`,
      avatar_url: profile.avatar_url,
      action: 'uploaded',
      updated_at: new Date()
    };

  } catch (error) {
    console.error('UPLOAD COURIER AVATAR ERROR:', error);
    throw error;
  }
};

/**
 * ================== ОБНОВЛЕНИЕ АВАТАРА КУРЬЕРА ==================
 */
export const updateCourierAvatar = async (courierId, imageData) => {
  try {
    if (!validateMongoId(courierId)) {
      throw new Error('Неверный ID курьера');
    }

    const profile = await CourierProfile.findById(courierId);
    if (!profile) {
      throw new Error('Профиль курьера не найден');
    }

    // Обновляем аватар
    profile.avatar_url = imageData.url;
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      courier_name: `${profile.first_name} ${profile.last_name}`,
      avatar_url: profile.avatar_url,
      updated_at: new Date()
    };

  } catch (error) {
    console.error('UPDATE COURIER AVATAR ERROR:', error);
    throw error;
  }
};

/**
 * ================== СОХРАНЕНИЕ ДОКУМЕНТОВ КУРЬЕРА ==================
 */
export const saveCourierDocuments = async (courierId, documentsData) => {
  try {
    if (!validateMongoId(courierId)) {
      throw new Error('Неверный ID курьера');
    }

    const profile = await CourierProfile.findById(courierId);
    if (!profile) {
      throw new Error('Профиль курьера не найден');
    }

    // Создаем записи документов
    const documentRecords = documentsData.map(docData => ({
      type: docData.documentType || 'identity_document',
      url: docData.url,
      filename: docData.filename,
      original_name: docData.originalName,
      size: docData.size,
      uploaded_at: new Date(),
      status: 'pending_review',
      document_category: getDocumentCategory(docData.documentType)
    }));

    // Обновляем документы в профиле курьера
       if (!profile.additional_documents) {
       profile.additional_documents = [];
     }

    // Проверяем лимит документов (максимум 10)
    if (profile.documents.length + documentRecords.length > 10) {
      throw new Error(`Превышен лимит документов. Максимум 10 документов. Текущее количество: ${profile.documents.length}`);
    }

    profile.additional_documents.push(...documentRecords);
    
    // Обновляем статус документов в зависимости от типа
    updateDocumentStatus(profile);
    
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      courier_name: `${profile.first_name} ${profile.last_name}`,
      uploaded_documents: documentRecords.length,
      total_documents: profile.additional_documents.length,
      documents: documentRecords,
      document_status: profile.documents_status || 'pending'
    };

  } catch (error) {
    console.error('SAVE COURIER DOCUMENTS ERROR:', error);
    throw error;
  }
};

/**
 * ================== ПОЛУЧЕНИЕ ВСЕХ ФАЙЛОВ КУРЬЕРА ==================
 */
export const getCourierFiles = async (courierId) => {
  try {
    if (!validateMongoId(courierId)) {
      throw new Error('Неверный ID курьера');
    }

    const profile = await CourierProfile.findById(courierId).select(
      'first_name last_name avatar_url additional_documents registration_documents vehicle_type application_status documents_status'
    );
    
    if (!profile) {
      throw new Error('Профиль курьера не найден');
    }

    // ✅ ИСПРАВЛЕНО: Группируем additional_documents по типам
    const additionalDocumentsByType = groupDocumentsByType(profile.additional_documents || []);

    return {
      success: true,
      profile_id: profile._id,
      courier_name: `${profile.first_name} ${profile.last_name}`,
      vehicle_type: profile.vehicle_type,
      application_status: profile.application_status,
      files: {
        avatar: profile.avatar_url || null,
        // ✅ РАЗДЕЛЕНИЕ: registration_documents (из заявки) и additional_documents (загруженные после)
        registration_documents: profile.registration_documents || {},
        additional_documents: additionalDocumentsByType
      },
      statistics: {
        total_additional_documents: profile.additional_documents?.length || 0, // ✅ ИСПРАВЛЕНО
        has_avatar: !!profile.avatar_url,
        document_status: profile.documents_status || 'not_required',
        required_documents: getRequiredDocuments(profile.vehicle_type),
        missing_documents: getMissingDocuments(profile)
      }
    };

  } catch (error) {
    console.error('GET COURIER FILES ERROR:', error);
    throw error;
  }
};

/**
 * ================== УДАЛЕНИЕ ДОКУМЕНТА КУРЬЕРА ==================
 */
export const removeCourierDocument = async (courierId, documentId) => {
  try {
    if (!validateMongoId(courierId) || !validateMongoId(documentId)) {
      throw new Error('Неверный ID курьера или документа');
    }

    const profile = await CourierProfile.findById(courierId);
    if (!profile) {
      throw new Error('Профиль курьера не найден');
    }

    // ✅ ИСПРАВЛЕНО: Ищем в additional_documents
    const documentIndex = profile.additional_documents.findIndex(doc => doc._id.toString() === documentId);
    if (documentIndex === -1) {
      throw new Error('Документ не найден');
    }

    const removedDocument = profile.additional_documents[documentIndex];
    profile.additional_documents.splice(documentIndex, 1);
    
    // Обновляем статус документов
    updateDocumentStatus(profile);
    
    await profile.save();

    return {
      success: true,
      profile_id: profile._id,
      removed_document: removedDocument,
      remaining_documents: profile.additional_documents.length, // ✅ ИСПРАВЛЕНО
      document_status: profile.documents_status
    };

  } catch (error) {
    console.error('REMOVE COURIER DOCUMENT ERROR:', error);
    throw error;
  }
};

/**
 * ================== ВАЛИДАЦИЯ ДОСТУПА К ФАЙЛАМ КУРЬЕРА ==================
 */
export const validateCourierFileAccess = async (courierId, userId) => {
  try {
    const profile = await CourierProfile.findById(courierId).select('user_id');
    
    if (!profile) {
      throw new Error('Профиль курьера не найден');
    }

    if (profile.user_id.toString() !== userId.toString()) {
      throw new Error('Доступ запрещен: можно управлять только своими файлами');
    }

    return true;

  } catch (error) {
    console.error('VALIDATE COURIER FILE ACCESS ERROR:', error);
    throw error;
  }
};

/**
 * ================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==================
 */

// Определение категории документа
const getDocumentCategory = (documentType) => {
  const categories = {
    'identity_document': 'Документ удостоверяющий личность',
    'driving_license': 'Водительские права',
    'vehicle_registration': 'Регистрация транспортного средства',
    'insurance': 'Страховка',
    'bank_details': 'Банковские реквизиты',
    'other': 'Прочие документы'
  };
  
  return categories[documentType] || 'Прочие документы';
};

// Группировка документов по типам
const groupDocumentsByType = (documents) => {
  const grouped = {};
  
  documents.forEach(doc => {
    const type = doc.type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(doc);
  });
  
  return grouped;
};

// Получение списка обязательных документов
const getRequiredDocuments = (vehicleType) => {
  const baseDocuments = ['identity_document', 'bank_details'];
  
  if (['bicycle', 'electric_scooter'].includes(vehicleType)) {
    return baseDocuments;
  }
  
  if (['motorcycle', 'car'].includes(vehicleType)) {
    return [...baseDocuments, 'driving_license', 'vehicle_registration', 'insurance'];
  }
  
  return baseDocuments;
};

// Определение недостающих документов
const getMissingDocuments = (profile) => {
  const required = getRequiredDocuments(profile.vehicle_type);
  const existing = (profile.additional_documents || []).map(doc => doc.type);
  
  return required.filter(type => !existing.includes(type));
};

// Обновление статуса документов
const updateDocumentStatus = (profile) => {
  const missing = getMissingDocuments(profile);
  const hasRejected = (profile.additional_documents || []).some(doc => doc.status === 'rejected');
  
  if (missing.length === 0 && !hasRejected) {
    profile.documents_status = 'complete';
  } else if (hasRejected) {
    profile.documents_status = 'needs_update';
  } else {
    profile.documents_status = 'incomplete';
  }
};

/**
 * ================== ЭКСПОРТ ==================
 */
export default {
  uploadCourierAvatar,
  updateCourierAvatar,
  saveCourierDocuments,
  getCourierFiles,
  removeCourierDocument,
  validateCourierFileAccess,
  getRequiredDocuments,
  getMissingDocuments
};