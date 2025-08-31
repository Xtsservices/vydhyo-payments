const express = require('express');
const router = express.Router();
const {
    createPayment,
    getAppointmentPayment,
    getMultipleAppointmentPayments, getTotalAmount, updatePaymentByAppointment,
    getTodayRevenuebyDoctorId,
    getDoctorRevenueSummaryThismonth,

    getDoctorRevenue,
    getDoctorTodayAndThisMonthRevenue,
    getTransactionHistory,
    getPatientHistory,
    getPaymentsByDoctorAndUser,
    createPaymentOrder,
   
} = require('../controllers/paymentsController');
const { getUserWallet } = require('../controllers/walletController');

router.post('/createPayment', createPayment);
router.get('/getAppointmentPayment', getAppointmentPayment);
router.post('/getAppointmentPayments', getMultipleAppointmentPayments);
router.get('/getTotalAmount', getTotalAmount);
router.put('/updatePaymentByAppointment', updatePaymentByAppointment);
router.get('/getTodayRevenuebyDoctorId', getTodayRevenuebyDoctorId);
router.get('/getDoctorRevenueSummaryThismonth', getDoctorRevenueSummaryThismonth);

router.get('/getDoctorRevenue', getDoctorRevenue);
router.get('/getDoctorTodayAndThisMonthRevenue/:paymentFrom', getDoctorTodayAndThisMonthRevenue);

router.post('/getTransactionHistory', getTransactionHistory);
router.get('/getPatientHistory', getPatientHistory);
router.get('/getPaymentsByDoctorAndUser/:doctorId', getPaymentsByDoctorAndUser);

//payment sdk
router.post('/createPaymentOrder', createPaymentOrder);
router.get('/:customerID', getUserWallet);



module.exports = router;