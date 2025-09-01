const Joi = require("joi");

const paymentValidationSchema = Joi.object({
  userId: Joi.string().required(),
  doctorId: Joi.string().required(),
  addressId: Joi.string(),
  labTestID: Joi.when("paymentFrom", {
    is: "lab",
    then: Joi.string().required().messages({
      "any.required": "labTestID is required for lab payments",
    }),
    otherwise: Joi.string().optional().allow(null),
  }),
  pharmacyMedID : Joi.when("paymentFrom", {
    is: "pharmacy",
    then: Joi.string().required().messages({
      "any.required": "pharmacyMedID is required for pharmacy payments",
    }),
    otherwise: Joi.string().optional().allow(null),
  }),
  // appointmentId: Joi.string().required(),
appointmentId: Joi.when("paymentFrom", {
    is: "appointment",
    then: Joi.string().required().messages({
      "any.required": "appointmentId is required for appointment payments",
    }),
    otherwise: Joi.string().optional().allow(null),
  }),
  actualAmount: Joi.number().positive().required(),
  discountType: Joi.string().valid("percentage", "flat").default("flat"),
  discount: Joi.number().min(0).default(0),
  currency: Joi.string().valid("INR").default("INR"),
  paymentFrom: Joi.string()
    .valid("appointment", "lab", "pharmacy")
    .required()
    .messages({
      "any.required": "paymentFrom is required",
      "any.only": "paymentFrom must be one of appointment, lab, or pharmacy",
      "string.base": "paymentFrom must be a string",
    }),
    appSource: Joi.string()
  .valid('patientApp', 'walkIn' ,'whatsapp')
   .optional()
    .allow(null),

  paymentMethod: Joi.string()
    .valid("card", "upi", "netbanking", "cash", "wallet", "free") //free means referral
    .optional()
    .default("cash"),

  paymentStatus: Joi.string()
    .valid(
      "pending",
      "paid",
      "cancelled",
      "refund_pending",
      "refunded",
      "refund_failed"
    )
    .default("pending"),

  transactionId: Joi.when("paymentMethod", {
    is: Joi.valid("cash",  "free", "wallet"),
    then: Joi.string().optional().allow(null),
    otherwise: Joi.string().required(),
  }),

  paymentGateway: Joi.when("paymentMethod", {
    is: Joi.valid("cash", "free", "wallet"),
    then: Joi.string().optional().allow(null),
    otherwise: Joi.string().required(),
  }),

  paidAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
  platformFee: Joi.number().optional().default(0),
  linkId: Joi.string().optional().allow(null),
});

module.exports = paymentValidationSchema;
