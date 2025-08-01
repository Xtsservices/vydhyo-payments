const Joi = require("joi");

const expenseModel = require("../models/expenseModel");

exports.createExpense = async (req, res) => {

     try {
        const userId = req.headers.userid
        console.log("User ID from headers:", userId);
        // Extract data from request body
        const { date, description, amount, notes } = req.body;

        // Validate required fields
        if (!date || !description || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Date, description, and amount are required'
            });
        }

        // Create new expense
        const newExpense = new expenseModel({
            userId,
            date: new Date(date),
            description,
            amount: parseFloat(amount),
            notes: notes || ''
        });

        // Save to database
        const savedExpense = await newExpense.save();

        // Send success response
        res.status(201).json({
            success: true,
            data: savedExpense,
            message: 'Expense created successfully'
        });

    } catch (error) {
         res.status(500)
      .json({ message: "Error creating Expense", error: error.message });
  }
    }

    const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
};
    exports.getExpenses = async (req, res) => {
    try {
          const userId = req.headers.userid
 // Extract query parameters for date range
        let { startDate, endDate } = req.query;
           if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required in headers'
            });
        }

        if(startDate && !endDate){
            endDate = startDate
        }
       

        // Build query object
         let query = { userId };
        if (startDate && endDate) {
            // Validate date formats
            if (!isValidDate(startDate) || !isValidDate(endDate)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format for startDate or endDate'
                });
            }

             const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include entire end day
            query.date = {
        $gte: start,
        $lte: end
    };
        } 

        // Fetch expenses from database
        const expenses = await expenseModel.find(query).sort({ date: -1 });

        // Send success response
        res.status(200).json({
            success: true,
            data: expenses,
            message: 'Expenses retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving expenses',
            error: error.message
        });
    }
};