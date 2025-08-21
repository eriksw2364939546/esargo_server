// ================ middleware/partnerAuth.middleware.js (ИСПРАВЛЕННЫЙ С META) ================
import jwt from "jsonwebtoken";
import Meta from "../models/Meta.model.js";
import { InitialPartnerRequest, PartnerProfile } from "../models/index.js";

/**
 * Декодирование и проверка токена партнера через Meta
 */
const decodeToken = async (token) => {
    try {
        console.log('🔍 DECODING PARTNER TOKEN...');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔍 DECODED TOKEN:', {
            user_id: decoded.user_id,
            _id: decoded._id,
            role: decoded.role,
            email: decoded.email
        });

        const { user_id, _id, role } = decoded;
        const partnerId = user_id || _id;

        // Проверяем что это партнер
        if (role !== "partner") {
            console.log('🚨 ROLE NOT PARTNER:', role);
            return { 
                message: "Access denied! Not a partner account!", 
                result: false, 
                status: 403 
            };
        }

        console.log('🔍 SEARCHING FOR PARTNER IN META:', partnerId);

        // ВАЖНО: Ищем через Meta с populate
        const metaInfo = await Meta.findOne({
            partner: partnerId,
            role: "partner"
        }).populate("partner");

        if (!metaInfo || !metaInfo.partner) {
            console.log('🚨 PARTNER NOT FOUND IN META');
            return { 
                message: "Access denied! Partner not found!", 
                result: false, 
                status: 404 
            };
        }

        const partner = metaInfo.partner;

        console.log('✅ PARTNER FOUND:', {
            id: partner._id,
            email: partner.email,
            role: partner.role,
            is_active: partner.is_active,
            meta_id: metaInfo._id
        });

        // Проверяем активность в Meta
        if (!metaInfo.is_active) {
            console.log('🚨 META NOT ACTIVE');
            return {
                message: "Access denied! Account is inactive!",
                result: false,
                status: 403
            };
        }

        // Проверяем активность партнера
        if (!partner.is_active) {
            console.log('🚨 PARTNER NOT ACTIVE');
            return {
                message: "Access denied! Partner account is inactive!",
                result: false,
                status: 403
            };
        }

        // Проверяем блокировку через Meta
        if (metaInfo.isAccountLocked && metaInfo.isAccountLocked()) {
            console.log('🚨 ACCOUNT LOCKED IN META');
            return {
                message: "Access denied! Account is locked!",
                result: false,
                status: 423
            };
        }

        console.log('✅ PARTNER ACCESS APPROVED');

        return { 
            message: "Access approved!", 
            result: true, 
            partner: partner,
            metaInfo: metaInfo
        };

    } catch (err) {
        console.error('🚨 TOKEN DECODE ERROR:', err);
        
        if (err.name === 'TokenExpiredError') {
            return { message: "Access denied! Token expired!", result: false, status: 401 };
        } else if (err.name === 'JsonWebTokenError') {
            return { message: "Access denied! Token invalid!", result: false, status: 401 };
        } else {
            return { message: "Access denied! Token error!", result: false, status: 401 };
        }
    }
};

/**
 * Базовая проверка токена партнера
 */
const checkPartnerToken = async (req, res, next) => {
    try {
        console.log('🔍 CHECK PARTNER TOKEN - START');
        
        const authHeader = req.headers["authorization"];
        console.log('🔍 AUTH HEADER:', authHeader);
        
        const token = authHeader?.split(" ")[1];
        console.log('🔍 EXTRACTED TOKEN:', token ? 'Present' : 'Missing');

        if (!token) {
            console.log('🚨 NO TOKEN PROVIDED');
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await decodeToken(token);
        if (!data.result) {
            console.log('🚨 TOKEN DECODE FAILED:', data.message);
            return res.status(data.status).json({
                message: data.message,
                result: false
            });
        }

        console.log('✅ TOKEN VERIFIED, SETTING REQ DATA');
        req.partner = data.partner;
        req.user = data.partner;
        req.metaInfo = data.metaInfo;

        next();

    } catch (error) {
        console.error('🚨 CHECK PARTNER TOKEN ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

/**
 * Проверка статуса партнера
 */
const checkPartnerStatus = (requiredStatuses) => {
    return async (req, res, next) => {
        try {
            console.log('🔍 CHECK PARTNER STATUS:', requiredStatuses);
            
            const authHeader = req.headers["authorization"];
            const token = authHeader?.split(" ")[1];

            if (!token) {
                console.log('🚨 NO TOKEN IN STATUS CHECK');
                return res.status(401).json({ 
                    message: "Access denied! Token required!", 
                    result: false 
                });
            }

            const data = await decodeToken(token);
            if (!data.result) {
                console.log('🚨 TOKEN FAILED IN STATUS CHECK');
                return res.status(data.status).json({
                    message: data.message,
                    result: false
                });
            }

            const partner = data.partner;

            // Получаем заявку партнера
            const partnerRequest = await InitialPartnerRequest.findOne({ 
                user_id: partner._id 
            });

            if (!partnerRequest) {
                console.log('🚨 PARTNER REQUEST NOT FOUND');
                return res.status(404).json({
                    message: "Partner request not found!",
                    result: false
                });
            }

            console.log('🔍 PARTNER REQUEST STATUS:', partnerRequest.status);

            // Проверяем статус
            if (!requiredStatuses.includes(partnerRequest.status)) {
                console.log('🚨 INSUFFICIENT STATUS:', {
                    required: requiredStatuses,
                    current: partnerRequest.status
                });
                return res.status(403).json({
                    message: `Access denied! Required status: ${requiredStatuses.join(' or ')}. Current: ${partnerRequest.status}`,
                    result: false
                });
            }

            console.log('✅ STATUS CHECK PASSED');
            req.partner = partner;
            req.user = partner;
            req.metaInfo = data.metaInfo;
            req.partnerRequest = partnerRequest;

            next();

        } catch (error) {
            console.error('🚨 STATUS CHECK ERROR:', error);
            res.status(500).json({ 
                message: "Access denied! Server error!", 
                result: false, 
                error: error.message 
            });
        }
    };
};

/**
 * Проверка наличия профиля партнера
 */
const requirePartnerProfile = async (req, res, next) => {
    try {
        console.log('🔍 REQUIRE PARTNER PROFILE - START');
        
        const authHeader = req.headers["authorization"];
        const token = authHeader?.split(" ")[1];

        if (!token) {
            console.log('🚨 NO TOKEN');
            return res.status(401).json({ 
                message: "Access denied! Token required!", 
                result: false 
            });
        }

        const data = await decodeToken(token);
        if (!data.result) {
            console.log('🚨 TOKEN DECODE FAILED');
            return res.status(data.status).json({
                message: data.message,
                result: false
            });
        }

        const partner = data.partner;

        // Проверяем наличие профиля
        const partnerProfile = await PartnerProfile.findOne({ 
            user_id: partner._id 
        });

        if (!partnerProfile) {
            console.log('🚨 PARTNER PROFILE NOT FOUND');
            return res.status(403).json({
                message: "Partner profile not created yet! Complete legal verification first.",
                result: false
            });
        }

        console.log('✅ PARTNER PROFILE FOUND:', partnerProfile._id);
        
        req.partner = partner;
        req.user = partner;
        req.metaInfo = data.metaInfo;
        req.partnerProfile = partnerProfile;

        next();

    } catch (error) {
        console.error('🚨 PROFILE CHECK ERROR:', error);
        res.status(500).json({ 
            message: "Access denied! Server error!", 
            result: false, 
            error: error.message 
        });
    }
};

/**
 * Проверка доступа по типу партнера (restaurant/store)
 */
const checkPartnerType = (allowedTypes) => {
    return async (req, res, next) => {
        try {
            console.log('🔍 CHECK PARTNER TYPE:', allowedTypes);
            
            const authHeader = req.headers["authorization"];
            const token = authHeader?.split(" ")[1];

            if (!token) {
                console.log('🚨 NO TOKEN');
                return res.status(401).json({ 
                    message: "Access denied! Token required!", 
                    result: false 
                });
            }

            const data = await decodeToken(token);
            if (!data.result) {
                console.log('🚨 TOKEN FAILED');
                return res.status(data.status).json({
                    message: data.message,
                    result: false
                });
            }

            // Получаем заявку для проверки типа
            const partnerRequest = await InitialPartnerRequest.findOne({ 
                user_id: data.partner._id 
            });

            if (!partnerRequest) {
                console.log('🚨 REQUEST NOT FOUND');
                return res.status(404).json({
                    message: "Partner request not found!",
                    result: false
                });
            }

            const partnerType = partnerRequest.business_data?.category;

            if (!allowedTypes.includes(partnerType)) {
                console.log('🚨 INVALID PARTNER TYPE:', partnerType);
                return res.status(403).json({
                    message: `Access denied! Required type: ${allowedTypes.join(' or ')}`,
                    result: false
                });
            }

            console.log('✅ PARTNER TYPE CHECK PASSED:', partnerType);
            req.partner = data.partner;
            req.user = data.partner;
            req.metaInfo = data.metaInfo;
            req.partnerType = partnerType;

            next();

        } catch (error) {
            console.error('🚨 TYPE CHECK ERROR:', error);
            res.status(500).json({ 
                message: "Access denied! Server error!", 
                result: false, 
                error: error.message 
            });
        }
    };
};

export { 
    checkPartnerToken, 
    checkPartnerStatus, 
    requirePartnerProfile,
    checkPartnerType
};