// controllers/FileUpload/PartnerFileController.js
import {
  uploadPartnerCoverImage,
  updatePartnerCoverImage,
  addPartnerGalleryImages,
  addMenuItemImage,
  savePartnerDocuments,
  removePartnerGalleryImage,
  getPartnerFiles,
  validatePartnerFileAccess
} from '../../services/FileUpload/partner.fileUpload.service.js';

/**
 * ================== ЗАГРУЗКА ОБЛОЖКИ РЕСТОРАНА/МАГАЗИНА ==================
 */
export const uploadCoverImage = async (req, res) => {
  try {
    const { user, uploadedFiles } = req;
    const { profile_id } = req.body;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Файл обложки не загружен"
      });
    }

    if (uploadedFiles.length > 1) {
      return res.status(400).json({
        result: false,
        message: "Можно загрузить только одну обложку"
      });
    }

    // Проверяем доступ
    await validatePartnerFileAccess(profile_id, user._id);

    // Загружаем обложку
    const result = await uploadPartnerCoverImage(profile_id, uploadedFiles[0]);

    res.status(201).json({
      result: true,
      message: "Обложка успешно загружена",
      data: result
    });

  } catch (error) {
    console.error('🚨 UPLOAD COVER IMAGE Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 :
                      error.message.includes('уже загружена') ? 409 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка загрузки обложки"
    });
  }
};

/**
 * ================== ОБНОВЛЕНИЕ ОБЛОЖКИ ==================
 */
export const updateCoverImage = async (req, res) => {
  try {
    const { user, uploadedFiles } = req;
    const { profile_id } = req.body;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Файл обложки не загружен"
      });
    }

    // Проверяем доступ
    await validatePartnerFileAccess(profile_id, user._id);

    // Обновляем обложку
    const result = await updatePartnerCoverImage(profile_id, uploadedFiles[0]);

    res.status(200).json({
      result: true,
      message: "Обложка успешно обновлена",
      data: result
    });

  } catch (error) {
    console.error('🚨 UPDATE COVER IMAGE Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка обновления обложки"
    });
  }
};

/**
 * ================== ДОБАВЛЕНИЕ ИЗОБРАЖЕНИЙ В ГАЛЕРЕЮ ==================
 */
export const addGalleryImages = async (req, res) => {
  try {
    const { user, uploadedFiles } = req;
    const { profile_id, image_type = 'other' } = req.body;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Изображения не загружены"
      });
    }

    // Проверяем доступ
    await validatePartnerFileAccess(profile_id, user._id);

    // Добавляем в галерею
    const result = await addPartnerGalleryImages(profile_id, uploadedFiles, image_type);

    res.status(201).json({
      result: true,
      message: `Добавлено ${result.added_images} изображений в галерею`,
      data: result
    });

  } catch (error) {
    console.error('🚨 ADD GALLERY IMAGES Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 :
                      error.message.includes('лимит') ? 422 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка добавления изображений в галерею"
    });
  }
};

/**
 * ================== ДОБАВЛЕНИЕ ФОТО К ПРОДУКТУ МЕНЮ ==================
 */
export const addMenuItemImage = async (req, res) => {
  try {
    const { user, uploadedFiles } = req;
    const { product_id } = req.body;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        result: false,
        message: "Изображение продукта не загружено"
      });
    }

    if (uploadedFiles.length > 1) {
      return res.status(400).json({
        result: false,
        message: "Можно загрузить только одно изображение для продукта"
      });
    }

    // Добавляем фото к продукту (проверка доступа внутри сервиса)
    const result = await addMenuItemImage(product_id, uploadedFiles[0]);

    res.status(201).json({
      result: true,
      message: "Изображение продукта успешно добавлено",
      data: result
    });

  } catch (error) {
    console.error('🚨 ADD MENU ITEM IMAGE Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка добавления изображения продукта"
    });
  }
};

/**
 * ================== ЗАГРУЗКА ДОКУМЕНТОВ ПАРТНЕРА ==================
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
    await validatePartnerFileAccess(profile_id, user._id);

    // Сохраняем документы
    const result = await savePartnerDocuments(profile_id, uploadedDocuments);

    res.status(201).json({
      result: true,
      message: `Загружено ${result.uploaded_documents} документов`,
      data: result
    });

  } catch (error) {
    console.error('🚨 UPLOAD DOCUMENTS Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка загрузки документов"
    });
  }
};

/**
 * ================== УДАЛЕНИЕ ИЗОБРАЖЕНИЯ ИЗ ГАЛЕРЕИ ==================
 */
export const removeGalleryImage = async (req, res) => {
  try {
    const { user, deletedFile } = req;
    const { profile_id } = req.params;
    const { image_url } = req.body;

    if (!deletedFile) {
      return res.status(400).json({
        result: false,
        message: "Файл не был удален из файловой системы"
      });
    }

    // Проверяем доступ
    await validatePartnerFileAccess(profile_id, user._id);

    // Удаляем из базы данных
    const result = await removePartnerGalleryImage(profile_id, image_url);

    res.status(200).json({
      result: true,
      message: "Изображение успешно удалено из галереи",
      data: {
        ...result,
        deleted_file: deletedFile
      }
    });

  } catch (error) {
    console.error('🚨 REMOVE GALLERY IMAGE Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка удаления изображения"
    });
  }
};

/**
 * ================== ПОЛУЧЕНИЕ ВСЕХ ФАЙЛОВ ПАРТНЕРА ==================
 */
export const getFiles = async (req, res) => {
  try {
    const { user } = req;
    const { profile_id } = req.params;

    // Проверяем доступ
    await validatePartnerFileAccess(profile_id, user._id);

    // Получаем все файлы
    const result = await getPartnerFiles(profile_id);

    res.status(200).json({
      result: true,
      message: "Файлы партнера получены",
      data: result
    });

  } catch (error) {
    console.error('🚨 GET PARTNER FILES Controller Error:', error);
    
    const statusCode = error.message.includes('не найден') ? 404 :
                      error.message.includes('доступ') ? 403 : 500;

    res.status(statusCode).json({
      result: false,
      message: error.message || "Ошибка получения файлов партнера"
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
    console.error('🚨 GET FILES LIST Controller Error:', error);
    res.status(500).json({
      result: false,
      message: "Ошибка получения списка файлов"
    });
  }
};

/**
 * ================== ЭКСПОРТ ==================
 */
export default {
  uploadCoverImage,
  updateCoverImage,
  addGalleryImages,
  addMenuItemImage,
  uploadDocuments,
  removeGalleryImage,
  getFiles,
  getFilesList
};