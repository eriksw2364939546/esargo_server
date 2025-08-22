// ================ services/Partner/admin.partner.service.js (ИСПРАВЛЕННЫЕ ПУТИ) ================
import { InitialPartnerRequest, PartnerLegalInfo, PartnerProfile, User, Product } from '../../models/index.js';
import Meta from '../../models/Meta.model.js';
import { cryptoString } from '../../utils/crypto.js';
import mongoose from 'mongoose';

/**
 * Обновление статуса заявки партнера
 * Только сохранение в БД
 */
export const updatePartnerRequestStatus = async (requestId, statusData) => {
    try {
        const request = await InitialPartnerRequest.findByIdAndUpdate(
            requestId,
            statusData,
            { new: true }
        );
        return request;
    } catch (error) {
        throw error;
    }
};

/**
 * Обновление статуса юридических документов
 * Только сохранение в БД
 */
export const updateLegalInfoStatus = async (legalInfoId, statusData) => {
    try {
        const legalInfo = await PartnerLegalInfo.findByIdAndUpdate(
            legalInfoId,
            statusData,
            { new: true }
        );
        return legalInfo;
    } catch (error) {
        throw error;
    }
};

/**
 * Создание профиля партнера после одобрения документов
 * Только создание в БД
 */
export const createPartnerProfile = async (profileData) => {
    const session = await mongoose.startSession();
    
    try {
        let result = null;
        
        await session.withTransaction(async () => {
            // Создаем PartnerProfile
            const newProfile = new PartnerProfile(profileData);
            await newProfile.save({ session });
            
            // Обновляем статус заявки
            await InitialPartnerRequest.findOneAndUpdate(
                { user_id: profileData.user_id },
                { 
                    status: 'profile_created',
                    workflow_stage: 4
                },
                { session }
            );
            
            result = newProfile;
        });
        
        return result;
        
    } catch (error) {
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Публикация партнера (финальное одобрение)
 * Только обновление в БД
 */
export const publishPartnerProfile = async (profileId, publishData) => {
    const session = await mongoose.startSession();
    
    try {
        let result = null;
        
        await session.withTransaction(async () => {
            // Обновляем профиль
            const profile = await PartnerProfile.findByIdAndUpdate(
                profileId,
                publishData,
                { new: true, session }
            );
            
            if (!profile) {
                throw new Error('Профиль партнера не найден');
            }
            
            // Обновляем статус заявки
            await InitialPartnerRequest.findOneAndUpdate(
                { user_id: profile.user_id },
                { 
                    status: 'completed',
                    workflow_stage: 6
                },
                { session }
            );
            
            result = profile;
        });
        
        return result;
        
    } catch (error) {
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Получение заявок партнеров с фильтрами
 * Только запрос к БД
 */
export const getPartnerRequests = async (filters, pagination) => {
    try {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
        const skip = (page - 1) * limit;
        
        const requests = await InitialPartnerRequest
            .find(filters)
            .populate('user_id', 'email')
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip(skip)
            .limit(limit);
            
        const total = await InitialPartnerRequest.countDocuments(filters);
        
        return {
            requests,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
        
    } catch (error) {
        throw error;
    }
};

/**
 * Получение полной информации о заявке
 * Только запрос к БД
 */
export const getPartnerRequestDetails = async (requestId) => {
    try {
        const request = await InitialPartnerRequest
            .findById(requestId)
            .populate('user_id')
            .populate('approved_by', 'full_name role')
            .populate('rejected_by', 'full_name role');
            
        if (!request) return null;
        
        // Получаем связанные данные
        const legalInfo = await PartnerLegalInfo.findOne({ 
            partner_request_id: requestId 
        });
        
        const profile = await PartnerProfile.findOne({ 
            user_id: request.user_id 
        });
        
        return {
            request,
            legalInfo,
            profile
        };
        
    } catch (error) {
        throw error;
    }
};

/**
 * Получение статистики партнеров
 * Только запрос к БД
 */
export const getPartnerStats = async () => {
    try {
        const stats = await InitialPartnerRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const profileStats = await PartnerProfile.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        return {
            requests: stats,
            profiles: profileStats
        };
        
    } catch (error) {
        throw error;
    }
};