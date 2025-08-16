// services/admin.partner.service.js
import { InitialPartnerRequest, PartnerLegalInfo } from '../models/index.js';
import { finalApprovePartner } from './partner.service.js';
import mongoose from 'mongoose';

/**
 * Одобрение первичной заявки партнера (переход к юридическим данным)
 * @param {string} requestId - ID заявки
 * @param {string} adminId - ID администратора  
 * @param {string} adminNotes - Заметки администратора
 * @returns {object} - Результат одобрения
 */
export const approveInitialPartnerRequest = async (requestId, adminId, adminNotes = '') => {
  try {
    const request = await InitialPartnerRequest.findById(requestId);
    
    if (!request) {
      throw new Error('Заявка не найдена');
    }

    if (request.status !== 'pending') {
      throw new Error('Заявка уже обработана');
    }

    // Используем метод модели для одобрения
    await request.approve(adminId, adminNotes);

    return {
      success: true,
      message: 'Первичная заявка одобрена. Партнер может заполнить юридические данные.',
      request: request
    };

  } catch (error) {
    console.error('Approve initial partner request error:', error);
    throw error;
  }
};

/**
 * Отклонение первичной заявки партнера
 * @param {string} requestId - ID заявки
 * @param {string} adminId - ID администратора
 * @param {string} rejectionReason - Причина отклонения
 * @returns {object} - Результат отклонения
 */
export const rejectInitialPartnerRequest = async (requestId, adminId, rejectionReason) => {
  try {
    const request = await InitialPartnerRequest.findById(requestId);
    
    if (!request) {
      throw new Error('Заявка не найдена');
    }

    if (request.status !== 'pending') {
      throw new Error('Заявка уже обработана');
    }

    // Используем метод модели для отклонения
    await request.reject(adminId, rejectionReason);

    return {
      success: true,
      message: 'Заявка отклонена.',
      request: request
    };

  } catch (error) {
    console.error('Reject initial partner request error:', error);
    throw error;
  }
};

/**
 * Одобрение юридических данных (финальное создание партнера)
 * @param {string} legalInfoId - ID юридической информации
 * @param {string} adminId - ID администратора
 * @param {string} adminNotes - Заметки администратора
 * @returns {object} - Результат создания партнера
 */
export const approveLegalInfoAndCreatePartner = async (legalInfoId, adminId, adminNotes = '') => {
  try {
    // Финальное одобрение через partner.service
    const result = await finalApprovePartner(legalInfoId, adminId);

    return {
      success: true,
      message: 'Партнер успешно создан! Юридические данные одобрены.',
      partner: result.partner,
      legalInfo: result.legalInfo
    };

  } catch (error) {
    console.error('Approve legal info and create partner error:', error);
    throw error;
  }
};

/**
 * Отклонение юридических данных
 * @param {string} legalInfoId - ID юридической информации
 * @param {string} adminId - ID администратора
 * @param {string} rejectionReason - Причина отклонения
 * @param {string} correctionNotes - Заметки для исправления
 * @returns {object} - Результат отклонения
 */
export const rejectLegalInfo = async (legalInfoId, adminId, rejectionReason, correctionNotes = '') => {
  try {
    const legalInfo = await PartnerLegalInfo.findById(legalInfoId);
    
    if (!legalInfo) {
      throw new Error('Юридическая информация не найдена');
    }

    if (legalInfo.verification_status !== 'pending') {
      throw new Error('Юридическая информация уже обработана');
    }

    // Обновляем статус
    legalInfo.verification_status = 'needs_correction';
    legalInfo.verified_by = adminId;
    legalInfo.verified_at = new Date();
    legalInfo.correction_notes = `${rejectionReason}. ${correctionNotes}`;

    await legalInfo.save();

    return {
      success: true,
      message: 'Юридические данные отклонены. Требуется исправление.',
      legalInfo: legalInfo
    };

  } catch (error) {
    console.error('Reject legal info error:', error);
    throw error;
  }
};

/**
 * Получение всех заявок с фильтрацией
 * @param {object} filters - Фильтры поиска
 * @returns {object} - Список заявок
 */
export const getAllPartnerRequests = async (filters = {}) => {
  try {
    const {
      status,
      category, 
      page = 1,
      limit = 10,
      sort_by = 'submitted_at',
      sort_order = 'desc'
    } = filters;

    // Строим фильтр для InitialPartnerRequest
    const initialRequestFilter = {};
    if (status && ['pending', 'approved', 'rejected', 'awaiting_legal_info'].includes(status)) {
      initialRequestFilter.status = status;
    }
    if (category && ['restaurant', 'store'].includes(category)) {
      initialRequestFilter['business_data.category'] = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = sort_order === 'desc' ? -1 : 1;

    // Получаем первичные заявки
    const initialRequests = await InitialPartnerRequest.find(initialRequestFilter)
      .populate('user_id', 'email role')
      .populate('review_info.reviewed_by', 'full_name email')
      .sort({ [sort_by]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit));

    // Для каждой заявки получаем связанную юридическую информацию
    const requestsWithLegalInfo = await Promise.all(
      initialRequests.map(async (request) => {
        let legalInfo = null;
        
        if (request.status === 'approved') {
          legalInfo = await PartnerLegalInfo.findOne({
            partner_request_id: request._id
          }).populate('verified_by', 'full_name email');
        }

        return {
          ...request.toObject(),
          legal_info: legalInfo
        };
      })
    );

    const totalCount = await InitialPartnerRequest.countDocuments(initialRequestFilter);

    return {
      success: true,
      requests: requestsWithLegalInfo,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    };

  } catch (error) {
    console.error('Get all partner requests error:', error);
    throw error;
  }
};

/**
 * Получение подробной информации о заявке
 * @param {string} requestId - ID заявки
 * @returns {object} - Подробная информация
 */
export const getPartnerRequestDetails = async (requestId) => {
  try {
    const request = await InitialPartnerRequest.findById(requestId)
      .populate('user_id', 'email role created_at')
      .populate('review_info.reviewed_by', 'full_name email');

    if (!request) {
      throw new Error('Заявка не найдена');
    }

    // Получаем юридическую информацию если есть
    let legalInfo = null;
    if (request.status === 'approved') {
      legalInfo = await PartnerLegalInfo.findOne({
        partner_request_id: request._id
      }).populate('verified_by', 'full_name email');
    }

    return {
      success: true,
      request: request,
      legal_info: legalInfo
    };

  } catch (error) {
    console.error('Get partner request details error:', error);
    throw error;
  }
};