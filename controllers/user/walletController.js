const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay for wallet payments
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Load Wallet Page
const loadWallet = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect('/login');
    }
    const user = await User.findById(userId).lean();
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        transactions: []
      });
      await wallet.save();
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get transactions sorted by date (newest first)
    const transactions = wallet.transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(skip, skip + limit);

    const totalTransactions = wallet.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('wallet', {
      user,
      walletBalance: wallet.balance,
      transactions,
      currentPage: page,
      totalPages: totalPages || 1
    });

  } catch (error) {
    console.error('Add money error:', error);
    res.json({ success: false, message: "Failed to add money to wallet" });
  }
};

// Add Money to Wallet
const addMoneyToWallet = async (req, res) => {
  try {
    const userId = req.session.user;
    const { amount } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "Please login to continue" });
    }

    const amountNum = parseFloat(amount);

    // Validate amount
    if (!amountNum || amountNum <= 0) {
      return res.json({ success: false, message: "Invalid amount" });
    }

    if (amountNum < 1) {
      return res.json({ success: false, message: "Minimum amount is ₹1" });
    }

    // Get wallet
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        transactions: []
      });
    }

    // Check wallet limit
    const WALLET_LIMIT = 10000;
    const newBalance = wallet.balance + amountNum;

    if (newBalance > WALLET_LIMIT) {
      const maxAddable = WALLET_LIMIT - wallet.balance;
      return res.json({
        success: false,
        message: `Wallet limit exceeded. You can add up to ₹${maxAddable.toFixed(2)} more.`
      });
    }

    const shortReceipt = `wlt_${userId.toString().slice(-10)}_${Date.now()}`;

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amountNum * 100),
      currency: 'INR',
      receipt: shortReceipt,
      notes: {
        userId: userId.toString(),
        type: 'wallet_recharge'
      }
    });

    const user = await User.findById(userId);

    return res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: amountNum,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
      customerDetails: {
        name: user.name,
        email: user.email,
        contact: user.phone || ''
      }
    });

  } catch (error) {
    console.error('Add money error:', error);
    res.json({ success: false, message: "Failed to add money to wallet" });
  }
};

// Verify Wallet Payment
const verifyWalletPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "Please login to continue" });
    }

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // Payment verified - Add money to wallet
      let wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: 0,
          transactions: []
        });
      }

      const amountNum = parseFloat(amount);

      // Add transaction
      wallet.transactions.push({
        type: 'Credit',
        amount: amountNum,
        description: 'Money added to wallet',
        date: new Date(),
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      });

      // Update balance
      wallet.balance += amountNum;
      await wallet.save();

      return res.json({
        success: true,
        message: "Money added successfully",
        newBalance: wallet.balance
      });

    } else {
      return res.json({
        success: false,
        message: "Payment verification failed"
      });
    }

  } catch (error) {
    console.error('Verify wallet payment error:', error);
    res.json({ success: false, message: "Payment verification failed" });
  }
};

const useWalletForPayment = async (userId, orderAmount) => {
  try {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet || wallet.balance < orderAmount) {
      return { success: false, message: "Insufficient wallet balance" };
    }

    // Deduct amount
    wallet.balance -= orderAmount;

    // Add transaction
    wallet.transactions.push({
      type: 'Debit',
      amount: orderAmount,
      description: 'Payment for order',
      date: new Date()
    });

    await wallet.save();

    return { success: true, newBalance: wallet.balance };

  } catch (error) {
    console.error('Use wallet payment error:', error);
    return { success: false, message: "Failed to process wallet payment" };
  }
};

// Refund to Wallet for Cancelled Orders
const refundToWallet = async (userId, orderId, amount, reason) => {
  try {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        transactions: []
      });
    }

    // Check wallet limit
    const WALLET_LIMIT = 10000;
    const newBalance = wallet.balance + amount;

    if (newBalance > WALLET_LIMIT) {
      return {
        success: false,
        message: `Refund exceeds wallet limit. Please contact support.`
      };
    }

    // Add refund transaction
    wallet.transactions.push({
      type: 'Credit',
      amount: amount,
      description: `Refund for ${reason}`,
      date: new Date(),
      orderId: orderId
    });

    // Update balance
    wallet.balance += amount;
    await wallet.save();

    return {
      success: true,
      message: "Refund processed successfully",
      newBalance: wallet.balance
    };

  } catch (error) {
    console.error('Refund to wallet error:', error);
    return { success: false, message: "Failed to process refund" };
  }
};

// Get Wallet Balance (for checkout page)
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.json({ success: false, balance: 0 });
    }

    const wallet = await Wallet.findOne({ userId });
    const balance = wallet ? wallet.balance : 0;

    res.json({ success: true, balance });

  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.json({ success: false, balance: 0 });
  }
};

// Process Order Cancellation Refund
const processCancellationRefund = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.params;

    if (!userId) {
      return res.json({ success: false, message: "Please login to continue" });
    }

    // Get order
    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }
    // Check if order can be cancelled
    if (!['Pending', 'Processing'].includes(order.status)) {
      return res.json({ success: false, message: "Order cannot be cancelled" });
    }

    // Check if payment was made online
    if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'Completed') {
      // Refund to wallet
      const refundResult = await refundToWallet(
        userId,
        orderId,
        order.finalAmount,
        'Order Cancellation'
      );

      if (!refundResult.success) {
        return res.json({ success: false, message: refundResult.message });
      }
    }

    // Update order status
    order.status = 'Cancelled';
    order.paymentStatus = order.paymentMethod === 'ONLINE' ? 'Refunded' : 'Cancelled';
    await order.save();

    res.json({
      success: true,
      message: order.paymentMethod === 'ONLINE'
        ? "Order cancelled and amount refunded to wallet"
        : "Order cancelled successfully"
    });

  } catch (error) {
    console.error('Process cancellation refund error:', error);
    res.json({ success: false, message: "Failed to process cancellation" });
  }
};

// Process Return Refund (Admin approval required)
const processReturnRefund = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Check if order is in return request status
    if (order.status !== 'Return Request') {
      return res.json({ success: false, message: "Invalid return status" });
    }

    // Approve return and refund to wallet if payment was online
    if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'Completed') {
      const refundResult = await refundToWallet(
        order.userId,
        orderId,
        order.finalAmount,
        'Order Return Approved'
      );

      if (!refundResult.success) {
        return res.json({ success: false, message: refundResult.message });
      }

      order.paymentStatus = 'Refunded';
    }

    // Update order status
    order.status = 'Returned';
    order.statusHistory.push({
      status: 'Returned',
      timestamp: new Date(),
      reason: 'Return approved by admin'
    });
    await order.save();

    res.json({
      success: true,
      message: order.paymentMethod === 'ONLINE'
        ? "Return approved and amount refunded to wallet"
        : "Return approved successfully"
    });

  } catch (error) {
    console.error('Process return refund error:', error);
    res.json({ success: false, message: "Failed to process return" });
  }
};

module.exports = {
  loadWallet,
  addMoneyToWallet,
  verifyWalletPayment,
  useWalletForPayment,
  refundToWallet,
  getWalletBalance,
  processCancellationRefund,
  processReturnRefund,
};