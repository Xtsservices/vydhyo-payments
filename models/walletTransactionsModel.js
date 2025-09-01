const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletTransactionsSchema = new Schema({
  customerID: { type: String, required: true }, // User ID (e.g., referredBy user for referral rewards)
  transactionID: { type: String, unique: true, required: true }, // Unique ID (e.g., "REF_REWARD_XYZ_123456")
  amount: { type: Number, required: true }, // Amount (e.g., 100 INR for referral reward)
  transactionType: { type: String, enum: ['credit', 'debit'], required: true }, // Credit (e.g., reward) or debit (e.g., payment)
  purpose: { type: String, required: true }, // Purpose (e.g., "referral_reward", "appointment_payment")
  description: { type: String }, // Details (e.g., "Reward for referral code XYZ")
  currency: { type: String, default: 'INR' }, // Currency (defaults to INR)
  appointmentId: { type: String, default: null },
  status: { type: String, enum: ['pending', 'approved', 'failed'], default: 'approved' }, // Transaction status
  createdAt: { type: Number, default: Date.now }, // Creation timestamp
  createdBy: { type: String, default: 'system' }, // Who created it (e.g., "system")
  updatedAt: { type: Number, default: Date.now }, // Update timestamp
  updatedBy: { type: String, default: 'system' }, // Who updated it
  statusHistory: [
    {
      note: { type: String }, // Note (e.g., "Reward credited")
      status: { type: String }, // Status (e.g., "approved")
      updatedAt: { type: Number }, // Timestamp
      updatedBy: { type: String }, // Who updated
    },
  ], // Tracks status changes
});

const walletTransactionsModel = mongoose.model('WalletTransactions', walletTransactionsSchema);

// Dynamic model for customer-specific collections
const customerWalletTransactionModel = (customerID) => {
  return mongoose.model(`${customerID}WalletTransactions`, walletTransactionsSchema);
};

module.exports = { walletTransactionsModel, customerWalletTransactionModel };