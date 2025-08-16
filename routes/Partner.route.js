const express = require('express');
const router = express.Router();
const {
  createInitialPartnerRequest,
  submitPartnerLegalInfo,
  getPartnerRequests,
  updatePartnerRequestStatus
} = require('../controllers/PartnerController');

// const { authenticateUser, authenticateAdmin } = require('../middleware/auth');

// Пользовательские роуты

router.post('/initial-request', createInitialPartnerRequest);
router.post('/submit-legal-info', submitPartnerLegalInfo);
router.get('/requests', getPartnerRequests);
router.patch('/update-status', updatePartnerRequestStatus);


module.exports = router;
