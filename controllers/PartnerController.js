const mongoose = require('mongoose');
const { PartnerRequest, User } = require('../models/indexForModels');

const createPartnerRequest = async (req, res) => {
	try {
		const {
			// Основные данные бизнеса
			business_name,
			category,
			description,
			address,
			location,
			phone,
			owner_name,
			owner_surname,
			working_hours,
			
			// Юридические данные
			legal_name,
			siret_number,
			legal_form,
			tva_number,
			legal_address,
			director_name,
			iban,
			bic,
			legal_email,
			legal_phone
		} = req.body;

		const { user } = req; // Предполагаем что пользователь авторизован

		// Проверка обязательных полей
		if (!business_name || !category || !address || !phone || !owner_name || !owner_surname) {
			return res.status(400).json({ result: false, message: "Missing business fields!" });
		}

		if (!legal_name || !siret_number || !legal_form || !legal_address || !director_name || !iban || !bic || !legal_email || !legal_phone) {
			return res.status(400).json({ result: false, message: "Missing legal fields!" });
		}

		if (!location || !location.lat || !location.lng) {
			return res.status(400).json({ result: false, message: "Missing location coordinates!" });
		}

		// Проверка категории
		if (!['restaurant', 'store'].includes(category)) {
			return res.status(400).json({ result: false, message: "Invalid category! Must be 'restaurant' or 'store'" });
		}

		// Проверка есть ли уже заявка от этого пользователя
		const existingRequest = await PartnerRequest.findOne({
			user_id: user._id,
			status: { $in: ['pending', 'approved'] }
		});

		if (existingRequest) {
			return res.status(400).json({ result: false, message: "You already have a pending or approved partner request!" });
		}

		// Получаем изображение обложки если загружено
		let cover_image_url = null;
		if (req.uploadedFiles && Array.isArray(req.uploadedFiles) && req.uploadedFiles.length > 0) {
			cover_image_url = req.uploadedFiles[0]; // Берем первое изображение
		}

		const newPartnerRequest = new PartnerRequest({
			user_id: user._id,
			business_data: {
				business_name,
				category,
				description,
				address,
				location: {
					lat: parseFloat(location.lat),
					lng: parseFloat(location.lng)
				},
				phone,
				owner_name,
				owner_surname,
				cover_image_url,
				working_hours
			},
			legal_data: {
				legal_name,
				siret_number,
				legal_form,
				tva_number,
				legal_address,
				director_name,
				iban,
				bic,
				legal_email,
				legal_phone
			},
			source: 'web',
			ip_address: req.ip,
			user_agent: req.get('User-Agent')
		});

		// Проверяем на дублирование данных
		await newPartnerRequest.checkForDuplicates();

		await newPartnerRequest.save();

		res.status(201).json({ 
			result: true, 
			message: "Partner request was created! Your application will be reviewed within 24-48 hours.",
			request_id: newPartnerRequest._id
		});

	} catch (error) {
		console.error(error);
		
		// Обработка ошибок валидации MongoDB
		if (error.name === 'ValidationError') {
			const validationErrors = Object.values(error.errors).map(err => err.message);
			return res.status(400).json({ 
				result: false, 
				message: "Validation error", 
				errors: validationErrors 
			});
		}

		// Обработка ошибки дублирования
		if (error.code === 11000) {
			return res.status(400).json({ 
				result: false, 
				message: "SIRET number already exists in our system!" 
			});
		}

		res.status(500).json({ 
			message: "Failed to create partner request", 
			result: false, 
			error: error.message 
		});
	}
};

const getPartnerRequests = async (req, res) => {
	try {
		const { status, category, page = 1, limit = 10 } = req.query;

		// Строим фильтр
		const filter = {};
		if (status && ['pending', 'approved', 'rejected'].includes(status)) {
			filter.status = status;
		}
		if (category && ['restaurant', 'store'].includes(category)) {
			filter['business_data.category'] = category;
		}

		const skip = (parseInt(page) - 1) * parseInt(limit);

		const partnerRequests = await PartnerRequest.find(filter)
			.populate('user_id', 'email')
			.populate('review_info.reviewed_by', 'full_name email')
			.sort({ submitted_at: -1 })
			.skip(skip)
			.limit(parseInt(limit));

		const totalCount = await PartnerRequest.countDocuments(filter);

		if (!partnerRequests || partnerRequests.length === 0) {
			return res.status(200).json({ 
				result: false, 
				message: "Partner requests not found",
				total: 0,
				page: parseInt(page),
				limit: parseInt(limit)
			});
		}

		res.status(200).json({ 
			result: true, 
			message: "Partner requests received", 
			requests: partnerRequests,
			total: totalCount,
			page: parseInt(page),
			limit: parseInt(limit),
			totalPages: Math.ceil(totalCount / parseInt(limit))
		});

	} catch (error) {
		console.error(error);
		res.status(500).json({ 
			message: "Failed to get partner requests", 
			result: false, 
			error: error.message 
		});
	}
};

const getPartnerRequestById = async (req, res) => {
	try {
		const { id } = req.params;

		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ result: false, message: "Invalid request ID" });
		}

		const partnerRequest = await PartnerRequest.findById(id)
			.populate('user_id', 'email createdAt')
			.populate('review_info.reviewed_by', 'full_name email');

		if (!partnerRequest) {
			return res.status(404).json({ result: false, message: "Partner request not found" });
		}

		res.status(200).json({ 
			result: true, 
			message: "Partner request received!", 
			request: partnerRequest 
		});

	} catch (error) {
		console.error(error);
		res.status(500).json({ 
			message: "Failed to get partner request", 
			result: false, 
			error: error.message 
		});
	}
};

const updatePartnerRequestStatus = async (req, res) => {
	try {
		const { id } = req.params;
		const { status, rejection_reason, admin_notes } = req.body;
		const { admin } = req; // Предполагаем что админ авторизован

		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ result: false, message: "Invalid request ID" });
		}

		if (!['approved', 'rejected'].includes(status)) {
			return res.status(400).json({ result: false, message: "Invalid status! Must be 'approved' or 'rejected'" });
		}

		if (status === 'rejected' && !rejection_reason) {
			return res.status(400).json({ result: false, message: "Rejection reason is required!" });
		}

		const partnerRequest = await PartnerRequest.findById(id);

		if (!partnerRequest) {
			return res.status(404).json({ result: false, message: "Partner request not found" });
		}

		if (partnerRequest.status !== 'pending') {
			return res.status(400).json({ result: false, message: "Request already processed!" });
		}

		// Обновляем статус
		if (status === 'approved') {
			await partnerRequest.approve(admin._id, admin_notes);
			
			// Создаем PartnerProfile после одобрения
			try {
				await partnerRequest.createPartnerProfile();
			} catch (profileError) {
				console.error('Failed to create partner profile:', profileError);
				// Не откатываем одобрение, просто логируем ошибку
			}
		} else {
			await partnerRequest.reject(admin._id, rejection_reason, admin_notes);
		}

		res.status(200).json({ 
			result: true, 
			message: `Partner request ${status} successfully!`,
			request: partnerRequest
		});

	} catch (error) {
		console.error(error);
		res.status(500).json({ 
			message: "Failed to update partner request", 
			result: false, 
			error: error.message 
		});
	}
};

const deletePartnerRequestById = async (req, res) => {
	try {
		const { id } = req.params;

		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ result: false, message: "Invalid request ID" });
		}

		const deletedRequest = await PartnerRequest.findByIdAndDelete(id);

		if (!deletedRequest) {
			return res.status(404).json({ result: false, message: "Partner request not found" });
		}

		res.status(200).json({
			result: true,
			message: "Partner request is deleted"
		});

	} catch (error) {
		console.error(error);
		res.status(500).json({ 
			message: "Failed to delete partner request", 
			result: false, 
			error: error.message 
		});
	}
};

module.exports = { 
	createPartnerRequest, 
	getPartnerRequests, 
	getPartnerRequestById, 
	updatePartnerRequestStatus, 
	deletePartnerRequestById 
};