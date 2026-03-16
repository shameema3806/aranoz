const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
    max: 10000
  },
  transactions: [{
    type: {
      type: String,
      enum: ['Credit', 'Debit'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    orderId: {
      type: String,
      ref: 'Order',
      default: null
    },
    paymentId: {
      type: String,
      default: null
    }
  }]
}, {
  timestamps: true
});


module.exports = mongoose.model('Wallet', walletSchema);