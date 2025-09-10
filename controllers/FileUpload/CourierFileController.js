// controllers/FileUpload/CourierFileController.js
import {
  uploadCourierAvatar,
  updateCourierAvatar,
  saveCourierDocuments,
  getCourierFiles,
  removeCourierDocument,
  validateCourierFileAccess
} from '../../services/FileUpload/courier.fileUpload.service.js';

/**
 * ================== ЗАГРУЗКА АВАТАРА КУРЬЕРА ==================
 */
export const uploadAvatar = async (req, res) => {
  try {
    const { user, uploadedFiles } = req;
    const { profile_id } = req.body;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Файл аватара не загружен"
      });
    }

    if (uploadedFiles.length > 1) {
      return res.status(400).json({
        result: false,
        message: "Можно загрузить только один аватар"
      });
    }

    // Проверяем доступ
    await validateCourierFileAccess(profile_id, user._id);

    // Загружаем аватар
    const result = await uploadCourierAvatar(profile_id, uploadedFiles[0]);

    res.status(201).json({
      result: true,
      message: "Аватар успешно загружен",
      data: result
    });

  } catch (error) {
    console.error('🚨 UPLOAD COURIER AVATAR Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 :
                      error.message.includes('уже загружен') ? 409 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка загрузки аватара"
    });
  }
};

/**
 * ================== ОБНОВЛЕНИЕ АВАТАРА КУРЬЕРА ==================
 */
export const updateAvatar = async (req, res) => {
  try {
    const { user, uploadedFiles } = req;
    const { profile_id } = req.body;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Файл аватара не загружен"
      });
    }

    // Проверяем доступ
    await validateCourierFileAccess(profile_id, user._id);

    // Обновляем аватар
    const result = await updateCourierAvatar(profile_id, uploadedFiles[0]);

    res.status(200).json({
      result: true,
      message: "Аватар успешно обновлен",
      data: result
    });

  } catch (error) {
    console.error('🚨 UPDATE COURIER AVATAR Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка обновления аватара"
    });
  }
};

/**
 * ================== ЗАГРУЗКА ДОКУМЕНТОВ КУРЬЕРА ==================
 */
export const uploadDocuments = async (req, res) => {
  try {
    const { user, uploadedDocuments } = req;
    const { profile_id } = req.body;

    if (!uploadedDocuments || uploadedDocuments.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Документы не загружены"
      });
    }

    // Проверяем доступ
    await validateCourierFileAccess(profile_id, user._id);

    // Сохраняем документы
    const result = await saveCourierDocuments(profile_id, uploadedDocuments);

    res.status(201).json({
      result: true,
      message: `Загружено ${result.uploaded_documents} документов`,
      data: result
    });

  } catch (error) {
    console.error('🚨 UPLOAD COURIER DOCUMENTS Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 :
                      error.message.includes('лимит') ? 422 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка загрузки документов"
    });
  }
};

/**
 * ================== УДАЛЕНИЕ ДОКУМЕНТА КУРЬЕРА ==================
 */
export const removeDocument = async (req, res) => {
  try {
    const { user, deletedFile } = req;
    const { profile_id, document_id } = req.params;

    if (!deletedFile) {
      return res.status(400).json({
        result: false,
        message: "Файл не был удален из файловой системы"
      });
    }

    // Проверяем доступ
    await validateCourierFileAccess(profile_id, user._id);

    // Удаляем из базы данных
    const result = await removeCourierDocument(profile_id, document_id);

    res.status(200).json({
      result: true,
      message: "Документ успешно удален",
      data: {
        ...result,
        deleted_file: deletedFile
      }
    });

  } catch (error) {
    console.error('🚨 REMOVE COURIER DOCUMENT Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка удаления документа"
    });
  }
};

/**
 * ================== ПОЛУЧЕНИЕ ВСЕХ ФАЙЛОВ КУРЬЕРА ==================
 */
export const getFiles = async (req, res) => {
  try {
    const { user } = req;
    const { profile_id } = req.params;

    // Проверяем доступ
    await validateCourierFileAccess(profile_id, user._id);

    // Получаем все файлы
    const result = await getCourierFiles(profile_id);

    res.status(200).json({
      result: true,
      message: "Файлы курьера получены",
      data: result
    });

  } catch (error) {
    console.error('🚨 GET COURIER FILES Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка получения файлов курьера"
    });
  }
};

/**
 * ================== ПОЛУЧЕНИЕ СПИСКА ФАЙЛОВ ПО ТИПУ ==================
 */
export const getFilesList = async (req, res) => {
  try {
    const { user, filesList } = req;

    if (!filesList) {
      return res.status(400).json({
        result: false,
        message: "Список файлов не получен"
      });
    }

    res.status(200).json({
      result: true,
      message: "Список файлов получен",
      data: filesList
    });

  } catch (error) {
    console.error('🚨 GET COURIER FILES LIST Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения списка файлов"
    });
  }
};

/**
 * ================== ПОЛУЧЕНИЕ СТАТУСА ДОКУМЕНТОВ ==================
 */
export const getDocumentStatus = async (req, res) => {
  try {
    const { user } = req;
    const { profile_id } = req.params;

    // Проверяем доступ
    await validateCourierFileAccess(profile_id, user._id);

    // Получаем файлы с фокусом на статус документов
    const result = await getCourierFiles(profile_id);

    res.status(200).json({
      result: true,
      message: "Статус документов получен",
      data: {
        profile_id: result.profile_id,
        courier_name: result.courier_name,
        vehicle_type: result.vehicle_type,
        document_status: result.statistics.document_status,
        required_documents: result.statistics.required_documents,
        missing_documents: result.statistics.missing_documents,
        uploaded_documents: result.statistics.total_documents
      }
    });

  } catch (error) {
    console.error('🚨 GET DOCUMENT STATUS Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка получения статуса документов"
    });
  }
};

/**
 * ================== ЭКСПОРТ ==================
 */
export default {
  uploadAvatar,
  updateAvatar,
  uploadDocuments,
  removeDocument,
  getFiles,
  getFilesList,
  getDocumentStatus
};