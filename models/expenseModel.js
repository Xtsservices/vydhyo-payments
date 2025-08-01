const mongoose = require('mongoose');

// Expense Schema
const expenseSchema = new mongoose.Schema({
     userId: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true
    },
    description: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'upi', 'netbanking', 'wallet'],
        default: 'cash'
    },  
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Expense', expenseSchema);

