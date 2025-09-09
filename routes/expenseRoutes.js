const express = require('express');
const { createExpense, getExpenses } = require('../controllers/expenseController');
const router = express.Router();

router.post('/createExpense', createExpense);
router.get('/getExpense/:userId', getExpenses);


module.exports = router;