const express = require('express');
const { createWalletTransaction, getUserWallet } = require('../controllers/walletController');
const router = express.Router();

router.post('/createWalletTransaction', createWalletTransaction);
router.get('/:customerID', getUserWallet);


module.exports = router;