const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    paymentId: { type: String, required: true },
    userId: { type: String, required: true },
    doctorId: { type: String, required: true },
    addressId: { type: String},
    appointmentId: { type: String },
      labTestID: { type: String },
      pharmacyMedID: { type: String },

    actualAmount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountType: {
        type: String,
        enum: ['percentage', 'flat'],
        default: 'flat'
    },
    finalAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },

     paymentFrom: {
        type: String,
        enum: ['appointment', 'lab', 'pharmacy'],
        required: true,
    },

    paymentMethod: {
        type: String,
        enum: ['card', 'upi', 'netbanking', 'cash', 'wallet'],
        required: true,
        default: 'cash'
    },
     appSource: {
        type: String,
        enum: ['patientApp', 'walkIn', null],
        required: false,   // 🔹 now optional
        default: null  
    },
    
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'cancelled', 'refund_pending', 'refunded', 'refund_failed'],
        default: 'pending'
    },
    transactionId: { type: String },
    paymentGateway: { type: String },
    paidAt: { type: Date, default: Date.now },
    createdBy: { type: String },
    updatedBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

paymentSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Payment', paymentSchema);
