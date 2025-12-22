// const mongoose = require('mongoose');
// const {Schema} = mongoose;

// const couponSchema = new mongoose.Schema({
//     name:{
//         type:String,
//         required:true,
//         unique:true 
//      },
//      createdOn:{
//         type:Date,
//         default:Date.now,
//         required:true 
//      },
//      expireOn:{
//         type:Date,
//         required:true 
//      },
//      offerPrice:{
//         type:Number,
//         required:true 
//      },
//      minimumPrice:{
//         type:Numberr,
//         required:true 
//      },
//      isList:{
//         tyep:Boolean,
//         default:true
//      },
//      userId:[{
//         type:mongoose.Schema.Types.ObjectId,
//         ref:"User"
//      }]
// })


// const Coupon = mongoose.model("Coupon",couponSchema);
// module.exports = Coupon;

const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
    maxUses: {
      type: Number,
      required: false,
      default: null, // null = unlimited
      min: 0,
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', 
      required: false, 
    },
    userId: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }], 
    applicableTo: [{
      type: Schema.Types.ObjectId,
      refPath: 'applicableToModel', 
    }],
    applicableToModel: {
      type: String,
      enum: ['Product', 'Category'],
      default: null,
    },
  },
  {
    timestamps: true, 
  }
);

// Pre-save hook: Auto-generate code if empty
couponSchema.pre('save', function (next) {
  if (!this.code) {
    this.code = `COUPON-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  // Validate expiry > now
  if (this.expiryDate <= new Date()) {
    return next(new Error('Expiry date must be in the future'));
  }
  next();
});

// Indexes for perf
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ expiryDate: 1, isActive: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;