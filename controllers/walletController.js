const Joi = require("joi");

const { customerWalletTransactionModel, walletTransactionsModel } = require('../models/walletTransactionsModel');

async function createDualWalletTransaction(transactionData) {
  try {
    const { customerID, transactionID } = transactionData;

    // Create transaction in main WalletTransactions collection
    const mainTransaction = await walletTransactionsModel.create(transactionData);
    console.log(`Main WalletTransactions created:`, mainTransaction);

    // Create transaction in user-specific collection
    const CustomerWalletTransaction = customerWalletTransactionModel(customerID);
    const userTransaction = await CustomerWalletTransaction.create(transactionData);
    console.log(`User-specific WalletTransactions created for ${customerID}:`, userTransaction);

    return mainTransaction;
  } catch (err) {
    console.error('Error creating dual wallet transaction:', err.message);
    if (err.code === 11000) {
      throw {
        statusCode: 400,
        message: `Transaction ID ${transactionData.transactionID} already exists`,
      };
    }
    throw {
      statusCode: 500,
      message: 'Error creating wallet transaction',
      error: err.message,
    };
  }
}

exports.createWalletTransaction = async (req, res) => {
    console.log("Request Body:", req.body);
  try {
    const {
      customerID,
      transactionID,
      amount,
      transactionType,
      purpose,
      description,
      currency = 'INR',
      status = 'approved',
      createdAt = Date.now(),
      createdBy = 'system',
      updatedAt = Date.now(),
      updatedBy = 'system',
      statusHistory,
    } = req.body;

    // Validate required fields
    if (!customerID || !transactionID || !amount || !transactionType || !purpose) {
      return res.status(400).json({
        status: 'fail',
        message: 'Missing required fields: customerID, transactionID, amount, transactionType, or purpose',
      });
    }

    if (!['credit', 'debit'].includes(transactionType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid transactionType. Must be "credit" or "debit"',
      });
    }

    if (!['pending', 'approved', 'failed'].includes(status)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid status. Must be "pending", "approved", or "failed"',
      });
    }

    // Validate statusHistory if provided
    if (statusHistory && !Array.isArray(statusHistory)) {
      return res.status(400).json({
        status: 'fail',
        message: 'statusHistory must be an array',
      });
    }
console.log("Creating transaction for customer:", customerID);

    const transactionData = {
      customerID,
      transactionID,
      amount,
      transactionType,
      purpose,
      description,
      currency,
      status,
      createdAt,
      createdBy,
      updatedAt,
      updatedBy,
      statusHistory: statusHistory || [
        {
          note: description || `Transaction ${transactionType} for ${purpose}`,
          status,
          updatedAt: Date.now(),
          updatedBy: 'system',
        },
      ],
    }

    // Create transaction in both collections
    const transaction = await createDualWalletTransaction(transactionData);
    console.log("Transaction created:", transaction);

    return res.status(200).json({
      status: 'success',
      message: 'Wallet transaction created successfully',
      data: {
        customerID: transaction.customerID,
        transactionID: transaction.transactionID,
        amount: transaction.amount,
        transactionType: transaction.transactionType,
        purpose: transaction.purpose,
        description: transaction.description,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt,
        createdBy: transaction.createdBy,
        updatedAt: transaction.updatedAt,
        updatedBy: transaction.updatedBy,
      },
    });
  } catch (err) {
    console.error('Error creating wallet transaction:', err.message);
    if (err.code === 11000) { // Duplicate transactionID
      return res.status(400).json({
        status: 'fail',
        message: 'Transaction ID already exists',
      });
    }
    return res.status(500).json({
      status: 'fail',
      message: 'Error creating wallet transaction',
      error: err.message,
    });
  }
};


// GET API to retrieve all wallet transactions and total balance for a specific user
exports.getUserWallet = async (req, res) => {
    console.log("Request Params:", req.params);
  const { customerID } = req.params;

  try {
    if (!customerID) {
      return res.status(400).json({
        status: 'fail',
        message: 'customerID is required',
      });
    }

     const normalizedCustomerID = customerID.toUpperCase();
    // Query user-specific collection
    const CustomerWalletTransaction = customerWalletTransactionModel(normalizedCustomerID);
    // const transactions = await CustomerWalletTransaction.find({ normalizedCustomerID })
    const transactions = await CustomerWalletTransaction.find({ customerID: normalizedCustomerID })
      .sort({ createdAt: -1 })
      .limit(100);

    // Calculate total balance (approved transactions only)
    const balance = transactions.reduce((total, transaction) => {
      if (transaction.status !== 'approved') return total;
      return transaction.transactionType === 'credit'
        ? total + transaction.amount
        : total - transaction.amount;
    }, 0);

    return res.status(200).json({
      status: 'success',
      message: `Wallet transactions and balance for ${normalizedCustomerID} retrieved successfully`,
      data: {
        customerID,
        balance,
        currency: 'INR',
        transactions,
      },
    });
  } catch (err) {
    console.error(`Error retrieving wallet transactions for ${normalizedCustomerID}:`, err.message);
    return res.status(500).json({
      status: 'fail',
      message: `Error retrieving wallet transactions for ${normalizedCustomerID}`,
      error: err.message,
    });
  }
};