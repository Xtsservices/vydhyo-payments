const express = require('express');
const router = express.Router();
const {
    createPayment,
    getAppointmentPayment,
    getMultipleAppointmentPayments, getTotalAmount, updatePaymentByAppointment,
    getTodayRevenuebyDoctorId,
    getDoctorRevenueSummaryThismonth,

    getDoctorRevenue,
   
} = require('../controllers/paymentsController');

router.post('/createPayment', createPayment);
router.get('/getAppointmentPayment', getAppointmentPayment);
router.post('/getAppointmentPayments', getMultipleAppointmentPayments);
router.get('/getTotalAmount', getTotalAmount);
router.put('/updatePaymentByAppointment', updatePaymentByAppointment);
router.get('/getTodayRevenuebyDoctorId', getTodayRevenuebyDoctorId);
router.get('/getDoctorRevenueSummaryThismonth', getDoctorRevenueSummaryThismonth);

router.get('/getDoctorRevenue', getDoctorRevenue);



module.exports = router;