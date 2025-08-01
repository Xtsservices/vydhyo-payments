const express = require('express');
const { createExpense, getExpenses } = require('../controllers/expenseController');
const router = express.Router();

router.post('/createExpense', createExpense);
router.get('/getExpense', getExpenses);


module.exports = router;