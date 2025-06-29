const express = require('express');
const router = express.Router();
const {
    createPayment,
    getAppointmentPayment,
    getMultipleAppointmentPayments, getTotalAmount, updatePaymentByAppointment
} = require('../controllers/paymentsController');

router.post('/createPayment', createPayment);
router.get('/getAppointmentPayment', getAppointmentPayment);
router.post('/getAppointmentPayments', getMultipleAppointmentPayments);
router.get('/getTotalAmount', getTotalAmount);
router.put('/updatePaymentByAppointment', updatePaymentByAppointment);

module.exports = router;