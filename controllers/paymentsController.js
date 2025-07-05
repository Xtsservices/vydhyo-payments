const paymentModel = require("../models/paymentModel");
const sequenceSchema = require("../sequence/sequenceSchema");
const paymentSchema = require("../schemas/paymentSchema");
const { SEQUENCE_PREFIX } = require("../utils/constants");
const Joi = require("joi");

const axios = require("axios");


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

// Get total amount of all payments with paymentStatus 'success' for today, this week, and this month
exports.getTotalAmount = async (req, res) => {
  try {
    const now = new Date();

    // Today
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    // This week (assuming week starts on Sunday)
    const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
    const startOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - dayOfWeek
    );
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // This month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Doctor filter
    const doctorId = req.query.doctorId || req.body.doctorId;

    // Helper function for aggregation
    async function getTotal(start, end) {
      const match = {
        paymentStatus: "success",
        createdAt: { $gte: start, $lt: end },
      };
      if (doctorId) {
        match.doctorId = doctorId;
      }
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

    // Helper for all-time total
    async function getAllTimeTotal() {
      const match = { paymentStatus: "success" };
      if (doctorId) {
        match.doctorId = doctorId;
      }
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

    const [todayTotal, weekTotal, monthTotal, allTimeTotal] = await Promise.all(
      [
        getTotal(startOfToday, endOfToday),
        getTotal(startOfWeek, endOfWeek),
        getTotal(startOfMonth, endOfMonth),
        getAllTimeTotal(),
      ]
    );

    return res.status(200).json({
      today: todayTotal,
      week: weekTotal,
      month: monthTotal,
      total: allTimeTotal,
    });
  } catch (error) {
    res
      .status(500)
      .json({
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
    const endpoint = process.env.VIEW_USER;
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


exports.getDoctorTodayAndThisMonthRevenue = async (req, res) => {
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