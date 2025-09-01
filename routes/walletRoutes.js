const express = require('express');
const { createWalletTransaction, getUserWallet, updateWalletTransaction } = require('../controllers/walletController');
const router = express.Router();

router.post('/createWalletTransaction', createWalletTransaction);
router.get('/:customerID', getUserWallet);
router.post('/updateWalletTransaction', updateWalletTransaction);


module.exports = router;