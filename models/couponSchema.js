const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    minlength: 4,
    maxlength: 20,
  },
  couponType: {
    type: String,
    enum: ["regular", "referral"],
    default: "regular"
  }
  ,
  discountType: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed'],
  },

  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },

  minCartValue: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },

  maxDiscount: {
    type: Number,
    min: 0,
    default: null,          
  },

  usedCount: {
    type: Number,
    default: 0,
    min: 0,
  },

  expiryDate: {
    type: Date,
    required: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false 
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: false,
  },

  usedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],

}, {
  timestamps: true,
});

couponSchema.index({ isActive: 1, expiryDate: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;

