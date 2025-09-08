// services/Partner/partner.legal.service.js - ИСПРАВЛЕННЫЙ СЕРВИС ДЛЯ ЮРИДИЧЕСКИХ ДОКУМЕНТОВ
import { InitialPartnerRequest, PartnerLegalInfo } from '../../models/index.js';
import { cryptoString } from '../../utils/crypto.js';
import mongoose from 'mongoose';

/**
 * ================== ПОДАЧА ЮРИДИЧЕСКИХ ДОКУМЕНТОВ ==================
 */
export const submitPartnerLegalInfo = async (partnerId, requestId, legalData) => {
    const session = await mongoose.startSession();

    try {
        let result = null;

        await session.withTransaction(async () => {
            // Проверяем существование заявки
            const request = await InitialPartnerRequest.findOne({
                _id: requestId,
                user_id: partnerId,
                status: 'approved'
            });

            if (!request) {
                throw new Error('Заявка не найдена или не одобрена');
            }

            // Проверяем, не поданы ли уже юридические документы
            const existingLegal = await PartnerLegalInfo.findOne({
                user_id: partnerId,
                partner_request_id: requestId
            });

            if (existingLegal) {
                throw new Error('Юридические документы уже поданы для этой заявки');
            }

            // ✅ ИСПРАВЛЕНО: Валидируем обязательные поля с правильными именами
            if (!legalData.legal_data?.legal_name || 
                !legalData.legal_data?.siret_number ||
                !legalData.bank_details?.iban ||
                !legalData.legal_contact?.email) {
                throw new Error('Обязательные поля: legal_name, siret_number, iban, email');
            }

            // ✅ ИСПРАВЛЕНО: Шифруем юридические данные с правильными именами полей
            const encryptedLegalData = {
                legal_name: cryptoString(legalData.legal_data.legal_name),
                siret_number: cryptoString(legalData.legal_data.siret_number),
                tva_number: legalData.legal_data.tva_number ? 
                    cryptoString(legalData.legal_data.tva_number) : null,
                legal_address: cryptoString(legalData.legal_data.legal_address),
                legal_representative: cryptoString(legalData.legal_data.legal_representative),
                legal_form: legalData.legal_data.legal_form || 'Auto-entrepreneur'
            };

            const encryptedBankDetails = {
                iban: cryptoString(legalData.bank_details.iban),
                bic: legalData.bank_details.bic ? 
                    cryptoString(legalData.bank_details.bic) : null
            };

            const encryptedContactInfo = {
                email: cryptoString(legalData.legal_contact.email),
                phone: legalData.legal_contact.phone ? 
                    cryptoString(legalData.legal_contact.phone) : null
            };

            // Обрабатываем документы (если есть)
            let encryptedDocuments = {};
            if (legalData.documents) {
                if (legalData.documents.kbis_document) {
                    encryptedDocuments.kbis_document = cryptoString(legalData.documents.kbis_document);
                }
                if (legalData.documents.id_document) {
                    encryptedDocuments.id_document = cryptoString(legalData.documents.id_document);
                }
                if (legalData.documents.additional_documents) {
                    encryptedDocuments.additional_documents = legalData.documents.additional_documents.map(doc => ({
                        name: doc.name,
                        url: cryptoString(doc.url),
                        uploaded_at: doc.uploaded_at || new Date()
                    }));
                }
            }

            // Создаем запись в PartnerLegalInfo
            const newLegalInfo = new PartnerLegalInfo({
                user_id: partnerId,
                partner_request_id: requestId,
                legal_data: encryptedLegalData,
                bank_details: encryptedBankDetails,
                legal_contact: encryptedContactInfo,
                documents: encryptedDocuments,
                verification_status: 'pending',
                submitted_at: new Date()
            });

            await newLegalInfo.save({ session });

            // Обновляем workflow_stage заявки
            await InitialPartnerRequest.findByIdAndUpdate(requestId, {
                workflow_stage: 3,
                updated_at: new Date()
            }, { session });

            result = {
                legal_info_id: newLegalInfo._id,
                verification_status: newLegalInfo.verification_status,
                workflow_stage: 3
            };
        });

        return result;

    } catch (error) {
        console.error('🚨 SUBMIT PARTNER LEGAL INFO ERROR:', error);
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * ================== ПОЛУЧЕНИЕ ЮРИДИЧЕСКОЙ ИНФОРМАЦИИ ==================
 */
export const getPartnerLegalInfo = async (partnerId) => {
    try {
        const legalInfo = await PartnerLegalInfo.findOne({ 
            user_id: partnerId 
        });
        
        return legalInfo;
        
    } catch (error) {
        console.error('🚨 GET PARTNER LEGAL INFO ERROR:', error);
        throw error;
    }
};

/**
 * ================== ОБНОВЛЕНИЕ СТАТУСА ЮРИДИЧЕСКИХ ДОКУМЕНТОВ ==================
 */
export const updateLegalInfoStatus = async (legalInfoId, statusData) => {
    try {
        const legalInfo = await PartnerLegalInfo.findByIdAndUpdate(
            legalInfoId,
            statusData,
            { new: true }
        );
        
        if (!legalInfo) {
            throw new Error('Юридическая информация не найдена');
        }
        
        return legalInfo;
        
    } catch (error) {
        console.error('🚨 UPDATE LEGAL INFO STATUS ERROR:', error);
        throw error;
    }
};