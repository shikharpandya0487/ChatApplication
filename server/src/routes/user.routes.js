const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controllers.js');

// Import the testApi function directly
const testApi = require('../controllers/user.controllers.js');

router.get('/test', testApi);

module.exports = router;
