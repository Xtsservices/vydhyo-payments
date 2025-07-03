const Joi = require('joi');

const paymentValidationSchema = Joi.object({
  userId: Joi.string().required(),
  doctorId: Joi.string().required(),
  appointmentId: Joi.string().required(),

  actualAmount: Joi.number().positive().required(),
  discountType: Joi.string().valid('percentage', 'flat').default('flat'),
  discount: Joi.number().min(0).default(0),
  currency: Joi.string().valid('INR').default('INR'),

  paymentMethod: Joi.string()
    .valid('card', 'upi', 'netbanking', 'cash', 'wallet')
    .optional()
    .default('cash'),

  paymentStatus: Joi.string()
    .valid('pending', 'paid', 'cancelled', 'refund_pending', 'refunded', 'refund_failed')
    .default('pending'),

  transactionId: Joi.when('paymentMethod', {
    is: Joi.valid('cash'),
    then: Joi.string().optional().allow(null),
    otherwise: Joi.string().required()
  }),

  paymentGateway: Joi.when('paymentMethod', {
    is: Joi.valid('cash'),
    then: Joi.string().optional().allow(null),
    otherwise: Joi.string().required()
  }),

  paidAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional()
});

module.exports = paymentValidationSchema;
