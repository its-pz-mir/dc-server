const express = require('express');
const router = express.Router();

const searchController = require('../controllers/searchController');
const calculationController = require('../controllers/calculationController');
const pdfController = require('../controllers/pdfController');
const parseController = require('../controllers/parseController');

// 1. Search endpoint (GET) - Handles AI parsing & matching
router.get('/search', searchController.searchProperties);

// 2. Calculation endpoint (POST) - Computes final numbers for a selected ID
router.post('/calculate', calculationController.calculateValuation);

// 3. PDF download endpoint (POST) - Streams the professional expenditure PDF
router.post('/download-pdf', pdfController.generateRegistryPdf);

// New dedicated route for AI address parsing & validation loading state on frontend
router.get('/parse-address', parseController.parseAndValidateAddress);

module.exports = router;