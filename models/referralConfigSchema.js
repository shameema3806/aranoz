const mongoose = require("mongoose");
const { Schema } = mongoose;

const referralConfigSchema = new Schema({
  rewardType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true,
    default: 'percentage'
  },
  rewardValue: {
    type: Number,
    min: 0,
    required: true,
    default: 10
  },
  minOrder: {
    type: Number,
    min: 0,
    default: 0
  },
  expiryDays: {
    type: Number,
    min: 1,
    required: true,
    default: 30
  },
  enableToken: {
    type: Boolean,
    default: true
  },
  enableCode: {
    type: Boolean,
    default: true
  },
  tokenExpiry: {
    type: Number,
    min: 1,
    default: 48
  },
  maxReferrals: {
    type: Number,
    min: 0,
    default: null // null means unlimited
  }
}, {
  timestamps: true // Optional: adds createdAt/updatedAt
});


const ReferralConfig = mongoose.model("ReferralConfig", referralConfigSchema);

module.exports = ReferralConfig;