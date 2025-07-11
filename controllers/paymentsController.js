const paymentModel = require("../models/paymentModel");
const sequenceSchema = require("../sequence/sequenceSchema");
const paymentSchema = require("../schemas/paymentSchema");
const { SEQUENCE_PREFIX } = require("../utils/constants");
const Joi = require("joi");
const commanFunction=require("../CommanClass/commanFunctions"); 
const axios = require("axios");
const moment = require('moment-timezone');

exports.createPayment = async (req, res) => {
  try {
    console.log("paymentFrom", req.body);
    const { error } = paymentSchema.validate(req.body);
    console.log("paymentFrom 2", error);

    if (error) {
      return res.status(400).json({
        status: "fail",
        message: error.details[0].message,
      });
    }

    req.body.createdBy = req.headers ? req.headers.userid : null;
    req.body.updatedBy = req.headers ? req.headers.userid : null;

    const paymentCounter = await sequenceSchema.findByIdAndUpdate(
      {
        _id: SEQUENCE_PREFIX.PAYMENTS_SEQUENCE.PAYMENTS_MODEL,
      },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    console.log("paymentFrom 3", paymentCounter);

    req.body.paymentId = SEQUENCE_PREFIX.PAYMENTS_SEQUENCE.SEQUENCE.concat(
      paymentCounter.seq
    );
    req.body.finalAmount = calculateFinalAmount(
      req.body.actualAmount,
      req.body.discount,
      req.body.discountType
    );
    if (req.body.finalAmount < 0) {
      return res.status(400).json({
        status: "fail",
        message: "Final amount cannot be negative",
      });
    }
    console.log("paymentFrom 4", req.body);

    const payment = await paymentModel.create(req.body);
    console.log("paymentFrom 5", payment);

    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: "payment not created",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "payment created successfully",
      data: payment,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating appointment", error: error.message });
  }
};

function calculateFinalAmount(actualAmount, discount, discountType = "flat") {
  if (discountType === "percentage") {
    if (discount < 0 || discount > 100) {
      throw new Error(
        "Invalid input: discount percentage must be between 0 and 100"
      );
    }
    return actualAmount - actualAmount * (discount / 100);
  }
  // Assuming discountType is 'flat' or any other type that is not percentage
  if (typeof actualAmount !== "number" || typeof discount !== "number") {
    throw new Error("Invalid input: actualAmount and discount must be numbers");
  }
  if (actualAmount < 0 || discount < 0) {
    throw new Error(
      "Invalid input: actualAmount and discount must be non-negative"
    );
  }
  return actualAmount - discount;
}

exports.getAppointmentPayment = async (req, res) => {
  try {
    const { appointmentId } = req.query;
    if (!appointmentId) {
      return res.status(400).json({
        status: "fail",
        message: "Appointment ID is required",
      });
    }

    const payment = await paymentModel.findOne({ appointmentId });
    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: "Payment not found for this appointment",
      });
    }

    return res.status(200).json({
      status: "success",
      data: payment,
    });
  } catch (error) {
    res
      .status(500)
      .json({
      message: "Error fetching appointment payment",
      error: error.message,
    });
  }
};

exports.getMultipleAppointmentPayments = async (req, res) => {
  try {
    const { appointmentIds } = req.body;
    if (
      !appointmentIds ||
      !Array.isArray(appointmentIds) ||
      appointmentIds.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Appointment ID is required",
      });
    }

    const payments = await paymentModel.find({
      appointmentId: { $in: appointmentIds },
    });
    if (!payments || payments.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: "No payments found for this appointment",
      });
    }

    return res.status(200).json({
      status: "success",
      payments,
    });
  } catch (error) {
    res
      .status(500)
      .json({
      message: "Error fetching appointment payments",
      error: error.message,
    });
  }
};

// Get total amount of all payments with paymentStatus 'paid' for today, this week, and this month

exports.getTotalAmount = async (req, res) => {
  try {
    const now = new Date();

    // Today
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // This week (week starts on Sunday)
    const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // This month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Aggregation helper
    async function getTotal(start, end) {
      const match = {
        paymentStatus: "paid",
        createdAt: { $gte: start, $lt: end },
      };

      const result = await paymentModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$finalAmount" },
          },
        },
      ]);
      return result.length > 0 ? result[0].totalAmount : 0;
    }

    // All-time total
    async function getAllTimeTotal() {
      const result = await paymentModel.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$finalAmount" },
          },
        },
      ]);
      return result.length > 0 ? result[0].totalAmount : 0;
    }

    const [todayTotal, weekTotal, monthTotal, allTimeTotal] = await Promise.all([
      getTotal(startOfToday, endOfToday),
      getTotal(startOfWeek, endOfWeek),
      getTotal(startOfMonth, endOfMonth),
      getAllTimeTotal(),
    ]);

    return res.status(200).json({
      today: todayTotal,
      week: weekTotal,
      month: monthTotal,
      total: allTimeTotal,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error calculating total amount",
      error: error.message,
    });
  }
};


exports.updatePaymentByAppointment = async (req, res) => {
  try {
    const { appointmentId, status } = req.body;
    if (!appointmentId) {
      return res.status(400).json({
        status: "fail",
        message: "Appointment ID is required",
      });
    }
    if (!status) {
      return res.status(400).json({
        status: "fail",
        message: "Status is required",
      });
    }

    const payment = await paymentModel.findOneAndUpdate(
      { appointmentId: appointmentId },
      {
        $set: {
          paymentStatus: status,
          updatedBy: req.headers ? req.headers.userid : "",
          updatedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: `Payment not found with this appointment ID ${appointmentId}`,
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Payment updated successfully",
      data: payment,
    });
  } catch (error) {
    res
      .status(500)
      .json({
      status: "fail",
      message: "Error updating payment",
      error: error.message,
    });
  }
};

exports.getTodayRevenuebyDoctorId = async (req, res) => {
  try {
    const doctorId = req.headers.userid;
    if (!doctorId) {
      return res.status(400).json({
        status: "fail",
        message: "Doctor ID is required",
      });
    }

    const today = new Date();

    // Today range
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    // This month range
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Today's revenue
    const todayRevenue = await paymentModel.aggregate([
      {
        $match: {
          doctorId: doctorId,
          paymentStatus: "paid",
          createdAt: { $gte: startOfToday, $lt: endOfToday },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$finalAmount" },
        },
      },
    ]);

    // This month's revenue
    const monthRevenue = await paymentModel.aggregate([
      {
        $match: {
          doctorId: doctorId,
          paymentStatus: "paid",
          createdAt: { $gte: startOfMonth, $lt: endOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$finalAmount" },
        },
      },
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
        monthRevenue: monthRevenue.length > 0 ? monthRevenue[0].total : 0,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error fetching revenue", error: error.message });
  }
};

exports.getDoctorRevenueSummaryThismonth = async (req, res) => {
  try {
    const doctorId = req.headers.userid;
    if (!doctorId) {
      return res.status(400).json({
        status: "fail",
        message: "Doctor ID is required",
      });
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const revenueByCategory = await paymentModel.aggregate([
      {
        $match: {
          doctorId: doctorId,
          paymentStatus: "paid",
          createdAt: { $gte: startOfMonth, $lt: endOfMonth },
          paymentFrom: { $in: ['appointment', 'lab', 'pharmacy'] }
        },
      },
      {
        $group: {
          _id: "$paymentFrom",
          total: { $sum: "$finalAmount" },
        },
      },
    ]);

    // Convert to { appointment: X, lab: Y, pharmacy: Z }
    const summary = {
      appointment: 0,
      lab: 0,
      pharmacy: 0,
    };
console.log("revenueByCategory",revenueByCategory)
    revenueByCategory.forEach((item) => {
      summary[item._id] = item.total;
    });

    return res.status(200).json({
      status: "success",
      data: summary,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "fail",
      message: "Error fetching revenue summary",
      error: error.message,
    });
  }
};


//doctor revenue
exports.getDoctorRevenue = async (req, res) => {
  try {
    const doctorId = req.headers.userid;
    if (!doctorId) {
      return res.status(400).json({
        status: "fail",
        message: "Doctor ID is required",
      });
    }

    const doctorDashboard = await paymentModel.aggregate([
      {
        $match: {
          doctorId: doctorId,
          paymentStatus: "paid",
          paymentFrom: { $in: ["appointment", "lab", "pharmacy"] },
        },
      },
      {
        $facet: {
          totalRevenue: [
            {
              $group: {
                _id: null,
                total: { $sum: "$finalAmount" },
              },
            },
          ],
          lastThreeTransactions: [
            { $sort: { paidAt: -1 } },
            { $limit: 3 },
            { $project: { userId: 1, finalAmount: 1, paidAt: 1 } },
          ],
        },
      },
      {
        $project: {
          totalRevenue: { $arrayElemAt: ["$totalRevenue.total", 0] },
          lastThreeTransactions: 1,
        },
      },
    ]);

    const result = doctorDashboard[0];
    const userIds = result.lastThreeTransactions.map((tx) => tx.userId);

    const userDetailsMap = {};
    await Promise.all(
      userIds.map(async (userId) => {
        if (!userDetailsMap[userId]) {
          const user = await getUserDetails(userId);
          userDetailsMap[userId] = user?.firstname +" "+user?.lastname || "Unknown";

        }
      })
    );
    const minimalTransactions = result.lastThreeTransactions.map((tx) => ({
      username: userDetailsMap[tx.userId],
      finalAmount: tx.finalAmount,
      paidAt: tx.paidAt,
      userID: tx.userId,

    }));

    return res.status(200).json({
      status: "success",
      data: {
        totalRevenue: result.totalRevenue || 0,
        lastThreeTransactions: minimalTransactions,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "fail",
      message: "Error fetching revenue summary",
      error: error.message,
    });
  }
};

async function getUserDetails(userId) {
  try {
    const apiUrl = process.env.USER_SERVICE_URL;
    const endpoint = 'users/getUser';
    const fullUrl = `${apiUrl}${endpoint}`;

    const response = await axios.get(fullUrl, {
      params: { userId: userId },
    });
    return response.data?.data || null;
  } catch (error) {
    console.error(`Error fetching user details for ${userId}:`, error.message);
    return null;
  }
}

exports.createPharmacyPayment = async (req, res) => {
  try {
    console.log("paymentFrom", req.body);
    const { error } = pharmacyPaymentValidationSchema.validate(req.body);
    console.log("paymentFrom 2", error);

    if (error) {
      return res.status(400).json({
        status: "fail",
        message: error.details[0].message,
      });
    }

    req.body.createdBy = req.headers ? req.headers.userid : null;
    req.body.updatedBy = req.headers ? req.headers.userid : null;

    const paymentCounter = await sequenceSchema.findByIdAndUpdate(
      {
        _id: SEQUENCE_PREFIX.PAYMENTS_SEQUENCE.PAYMENTS_MODEL,
      },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    console.log("paymentFrom 3", paymentCounter);

    req.body.paymentId = SEQUENCE_PREFIX.PAYMENTS_SEQUENCE.SEQUENCE.concat(
      paymentCounter.seq
    );
    req.body.finalAmount = calculateFinalAmount(
      req.body.actualAmount,
      req.body.discount,
      req.body.discountType
    );
    if (req.body.finalAmount < 0) {
      return res.status(400).json({
        status: "fail",
        message: "Final amount cannot be negative",
      });
    }
    console.log("paymentFrom 4", req.body);

    const payment = await pharmacyPaymentModel.create(req.body);
    console.log("paymentFrom 5", payment);

    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: "payment not created",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "payment created successfully",
      data: payment,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating appointment", error: error.message });
  }
};

exports.getRevenueAndPatients = async (req, res) => {
  try {
    // Validate query parameters
    const { error } = Joi.object({
      doctorId: Joi.string().required()
    }).validate(req.query, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { doctorId } = req.query;

    // Get current date and time
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregation pipeline
    const pipeline = [
      // Match payments for the specific doctor and paid status
      {
        $match: {
          doctorId,
          paymentStatus: 'paid',
          paidAt: { $gte: startOfMonth }
        }
      },
      // Group by date ranges
      {
        $group: {
          _id: {
            $cond: [
              { $gte: ['$paidAt', startOfToday] },
              'today',
              'month'
            ]
          },
          revenue: { $sum: '$finalAmount' },
          patients: { $addToSet: '$userId' } // Collect unique patient IDs
        }
      },
      // Project to reshape the output
      {
        $project: {
          _id: 0,
          period: '$_id',
          revenue: 1,
          patientCount: { $size: '$patients' }
        }
      },
      // Reshape the results
      {
        $group: {
          _id: null,
          today: {
            $push: {
              $cond: [
                { $eq: ['$period', 'today'] },
                { revenue: '$revenue', patientCount: '$patientCount' },
                null
              ]
            }
          },
          month: {
            $push: {
              $cond: [
                { $eq: ['$period', 'month'] },
                { revenue: '$revenue', patientCount: '$patientCount' },
                null
              ]
            }
          }
        }
      },
      // Final projection
      {
        $project: {
          _id: 0,
          todayRevenue: { $arrayElemAt: ['$today.revenue', 0] },
          todayPatients: { $arrayElemAt: ['$today.patientCount', 0] },
          monthRevenue: { $sum: ['$today.revenue', '$month.revenue'] },
          monthPatients: {
            $size: {
              $setUnion: [
                { $arrayElemAt: ['$today.patients', 0] },
                { $arrayElemAt: ['$month.patients', 0] }
              ]
            }
          }
        }
      }
    ];

    const [result] = await Payment.aggregate(pipeline);

    // Handle case where no data is found
    const response = {
      status: ' success',
      data: {
        today: {
          revenue: result?.todayRevenue || 0,
          patients: result?.todayPatients || 0
        },
        month: {
          revenue: result?.monthRevenue || 0,
          patients: result?.monthPatients || 0
        }
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error calculating revenue and patients:', error);
    return res.status(500).json({
      status: 'fail',
      message: 'Internal server error'
    });
  }
};


exports.getDoctorTodayAndThisMonthRevenue2 = async (req, res) => {
  try {
    // Get doctorId from query params or headers
    const doctorId = req.query.doctorId || req.headers.userid;

    // Validate query and path parameters
    const { error } = Joi.object({
      doctorId: Joi.string().required(),
      paymentFrom: Joi.string().valid('pharmacy', 'lab').required()
    }).validate({ doctorId, paymentFrom: req.params.paymentFrom }, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { paymentFrom } = req.params;

    // Get current date in IST
    const now = new Date();
    now.setHours(now.getHours() + 5, now.getMinutes() + 30); // Adjust to IST (+5:30)

    // Set start of today and month in IST (midnight)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0); // 00:00 IST
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); // 00:00 IST, 1st of month

    // Convert to UTC
    const startOfTodayUTC = new Date(startOfToday.getTime() - (5 * 60 + 30) * 60 * 1000); // 18:30 previous day UTC
    const startOfMonthUTC = new Date(startOfMonth.getTime() - (5 * 60 + 30) * 60 * 1000); // 18:30 on 30th June UTC

    console.log("startOfTodayUTC====", startOfTodayUTC.toISOString()); // Should be 2025-07-04T18:30:00.000Z
    console.log("startOfMonthUTC====", startOfMonthUTC.toISOString()); // Should be 2025-06-30T18:30:00.000Z

    // Aggregation pipeline
    const pipeline = [
      // Match payments for the specific doctor, paid status, and paymentFrom
      {
        $match: {
          doctorId,
          paymentStatus: 'paid',
          paymentFrom,
          paidAt: { $gte: startOfMonthUTC }
        }
      },
      // Group by date ranges
      {
        $group: {
          _id: {
            $cond: [
              { $gte: ['$paidAt', startOfTodayUTC] },
              'today',
              'month'
            ]
          },
          revenue: { $sum: '$finalAmount' },
          patients: { $addToSet: '$userId' } // Collect unique userIds
        }
      },
      // Project to reshape the output
      {
        $project: {
          _id: 0,
          period: '$_id',
          revenue: 1,
          patients: 1, // Keep patients array for union
          patientCount: { $size: { $ifNull: ['$patients', []] } }
        }
      },
      // Reshape the results
      {
        $group: {
          _id: null,
          today: {
            $push: {
              $cond: [
                { $eq: ['$period', 'today'] },
                { revenue: '$revenue', patients: '$patients', patientCount: '$patientCount' },
                { revenue: 0, patients: [], patientCount: 0 }
              ]
            }
          },
          month: {
            $push: {
              $cond: [
                { $eq: ['$period', 'month'] },
                { revenue: '$revenue', patients: '$patients', patientCount: '$patientCount' },
                { revenue: 0, patients: [], patientCount: 0 }
              ]
            }
          }
        }
      },
      // Final projection
      {
        $project: {
          _id: 0,
          todayRevenue: { $arrayElemAt: ['$today.revenue', 0] },
          todayPatients: { $arrayElemAt: ['$today.patientCount', 0] },
          monthRevenue: {
            $sum: [
              { $ifNull: [{ $arrayElemAt: ['$today.revenue', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$month.revenue', 0] }, 0] }
            ]
          },
          monthPatients: {
            $size: {
              $setUnion: [
                { $ifNull: [{ $arrayElemAt: ['$today.patients', 0] }, []] },
                { $ifNull: [{ $arrayElemAt: ['$month.patients', 0] }, []] }
              ]
            }
          }
        }
      }
    ];

    const [result] = await paymentModel.aggregate(pipeline);
    console.log("result=======", JSON.stringify(result, null, 2));

    // Build response
    const response = {
      status: 'success',
      data: {
        today: {
          revenue: result?.todayRevenue || 0,
          patients: result?.todayPatients || 0
        },
        month: {
          revenue: result?.monthRevenue || 0,
          patients: result?.monthPatients || 0
        }
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error(`Error calculating ${req.params.paymentFrom} revenue and patients:`, error);
    return res.status(500).json({
      status: 'fail',
      message: 'Error fetching revenue summary',
      error: error.message
    });
  }
};

// Validation schema
const validationSchema = Joi.object({
  doctorId: Joi.string().required(),
  paymentFrom: Joi.string().valid('pharmacy', 'lab').required()
});

exports.getDoctorTodayAndThisMonthRevenue = async (req, res) => {
  try {
    // Get doctorId from query params or headers
    const doctorId = req.query.doctorId || req.headers.userid;
    const { paymentFrom } = req.params;

    // Validate input
    const { error } = validationSchema.validate({ doctorId, paymentFrom }, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Get current date in IST
    const now = moment.tz('Asia/Kolkata');

    // Define start of today and month in IST
    const startOfTodayIST = now.clone().startOf('day').toDate(); // 00:00:00 IST
    const startOfMonthIST = now.clone().startOf('month').toDate(); // 00:00:00 IST, 1st of month

    // Convert to UTC for MongoDB query (MongoDB stores dates in UTC)
    const startOfTodayUTC = moment(startOfTodayIST).utc().toDate();
    const startOfMonthUTC = moment(startOfMonthIST).utc().toDate();

    console.log('startOfTodayUTC:', startOfTodayUTC.toISOString()); // e.g., 2025-07-09T18:30:00.000Z
    console.log('startOfMonthUTC:', startOfMonthUTC.toISOString()); // e.g., 2025-06-30T18:30:00.000Z

    // Aggregation pipeline
    const pipeline = [
      // Match payments for the doctor, paid status, paymentFrom, and this month
      {
        $match: {
          doctorId,
          paymentStatus: 'paid',
          paymentFrom,
          paidAt: { $gte: startOfMonthUTC }
        }
      },
      // Group by period (today or earlier in the month)
      {
        $group: {
          _id: {
            $cond: [
              { $gte: ['$paidAt', startOfTodayUTC] },
              'today',
              'month'
            ]
          },
          revenue: { $sum: '$finalAmount' },
          patients: { $addToSet: '$userId' } // Unique user IDs
        }
      },
      // Project to format each period
      {
        $project: {
          _id: 0,
          period: '$_id',
          revenue: { $ifNull: ['$revenue', 0] },
          patients: { $ifNull: ['$patients', []] },
          patientCount: { $size: { $ifNull: ['$patients', []] } }
        }
      },
      // Pivot to combine today and month results
      {
        $group: {
          _id: null,
          results: {
            $push: {
              period: '$period',
              revenue: '$revenue',
              patients: '$patients',
              patientCount: '$patientCount'
            }
          }
        }
      },
      // Final projection
      {
        $project: {
          _id: 0,
          today: {
            $cond: [
              { $in: ['today', '$results.period'] },
              {
                revenue: {
                  $arrayElemAt: [
                    '$results.revenue',
                    { $indexOfArray: ['$results.period', 'today'] }
                  ]
                },
                patients: {
                  $arrayElemAt: [
                    '$results.patientCount',
                    { $indexOfArray: ['$results.period', 'today'] }
                  ]
                }
              },
              { revenue: 0, patients: 0 }
            ]
          },
          month: {
            revenue: { $sum: '$results.revenue' }, // Sum all revenue for the month
            patients: {
              $size: {
                $setUnion: [
                  {
                    $cond: [
                      { $in: ['today', '$results.period'] },
                      {
                        $arrayElemAt: [
                          '$results.patients',
                          { $indexOfArray: ['$results.period', 'today'] }
                        ]
                      },
                      []
                    ]
                  },
                  {
                    $cond: [
                      { $in: ['month', '$results.period'] },
                      {
                        $arrayElemAt: [
                          '$results.patients',
                          { $indexOfArray: ['$results.period', 'month'] }
                        ]
                      },
                      []
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ];

    const [result] = await paymentModel.aggregate(pipeline);

    // Build response
    const response = {
      status: 'success',
      data: {
        today: {
          revenue: result?.today?.revenue || 0,
          patients: result?.today?.patients || 0
        },
        month: {
          revenue: result?.month?.revenue || 0,
          patients: result?.month?.patients || 0
        }
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error(`Error calculating ${paymentFrom} revenue and patients:`, error.stack);
    return res.status(500).json({
      status: 'fail',
      message: 'Error fetching revenue summary',
      error: error.message
    });
  }
};


exports.getTransactionHistory = async (req, res) => {
  try {
    const doctorId = req.headers.userid;
    if (!doctorId) {
      return res.status(400).json({
        status: "fail",
        message: "Doctor ID is required",
      });
    }

    const {
      status,
      service,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
    } = req.body;

    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(limit));
    const skip = (pageNumber - 1) * pageSize;

    const query = { doctorId };
    if (status) query.paymentStatus = status.toLowerCase();
    if (service) query.paymentFrom = service.toLowerCase();
    if (startDate || endDate) {
      query.paidAt = {};
      if (startDate) query.paidAt.$gte = new Date(startDate + "T00:00:00.000Z");
      if (endDate) query.paidAt.$lte = new Date(endDate + "T23:59:59.999Z");
    }

    let transactions = await paymentModel.find(query).sort({ paidAt: -1 });

    const enriched = await Promise.all(
      transactions.map(async (txn) => {
        const user = await getUserDetails(txn.userId);
        const patientName = user
          ? `${user.firstname} ${user.lastname}`.trim()
          : "Unknown";

        return {
          ...txn.toObject(),
          patientName,
        };
      })
    );

    let filtered = enriched;
    if (search && typeof search === "string") {
      const lowerSearch = search.toLowerCase();
      filtered = enriched.filter(
        (txn) =>
          (txn.paymentId && txn.paymentId.toLowerCase().includes(lowerSearch)) ||
          (txn.patientName && txn.patientName.toLowerCase().includes(lowerSearch))
      );
    }

    const totalResults = filtered.length;
    const totalPages = Math.ceil(totalResults / pageSize);

    const paginatedData = filtered.slice(skip, skip + pageSize);

    if (pageNumber > totalPages && totalResults > 0) {
      return res.status(200).json({
        status: "success",
        message: `Page ${pageNumber} exceeds total pages (${totalPages})`,
        totalResults,
        totalPages,
        currentPage: pageNumber,
        data: [],
      });
    }

    return res.status(200).json({
      status: "success",
      totalResults,
      totalPages,
      currentPage: pageNumber,
      data: paginatedData,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "fail",
      message: "Error fetching transaction history",
      error: error.message,
    });
  }
};

exports.getPatientHistory = async (req, res) => {
  try {
    const paymentId = req.query.paymentId?.trim();
    if (!paymentId) {
      return res.status(400).json({
        status: "fail",
        message: "paymentId is required in query parameters",
      });
    }
    const payment = await paymentModel.findOne({ paymentId }).lean();

    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: `No transaction found for paymentId ${paymentId}`,
      });
    }
    let userDetails = null;
    userDetails = await getUserDetails(payment.userId);

    let appointmentDetails = null;
    if (payment?.appointmentId && payment?.paymentFrom == "appointment") {
      appointmentDetails = await commanFunction.getAppointmentById(
        payment?.appointmentId,
        "appointment"
      );
    }

    let pharmacyDetails = null;
    if (payment?.pharmacyMedID && payment?.paymentFrom == "pharmacy") {
      pharmacyDetails = await commanFunction.getAppointmentById(
        payment?.pharmacyMedID,
        "pharmacy"
      );
    }
    let labDetails = null;

    if (payment?.labTestID && payment?.paymentFrom == "lab") {
      labDetails = await commanFunction.getAppointmentById(
        payment?.labTestID,
        "lab"
      );
    }

    return res.status(200).json({
      status: "success",
      data: {
        ...payment,
        userDetails,
        appointmentDetails,
        pharmacyDetails,
        labDetails
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "fail",
      message: "Error fetching patient history",
      error: error.message,
    });
  }
};
