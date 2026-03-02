const mongoose = require("mongoose");
const { Schema } = mongoose;

// const orderSchema = new Schema({
//   userId: {
//     type: Schema.Types.ObjectId,
//     ref: "User",
//     required: true
//   },
//   orderId: {
//     type: String,
//     required: true,
//     default: () => `ORD${Date.now()}`,
//     unique: true
//   },

//   orderedItems: [{
//     product: {
//       type: Schema.Types.ObjectId,
//       ref: "Product",
//       required: true
//     },
//     quantity: { type: Number, required: true },
//     price: { type: Number, default: 0 }
//   }],
//  subtotal: {
//         type: Number,
//         required: true
//     },
//     discount: {
//         type: Number,
//         default: 0
//     },
//     couponCode: {
//         type: String,
//         default: null
//     },
//     shipping: {
//         type: Number,
//         default: 0
//     },
//     tax: {
//         type: Number,
//         default: 0
//     },
//     totalAmount: {
//         type: Number,
//         required: true
//     },
//   totalPrice: { type: Number, required: true },  // subtotal
//   discount: { type: Number, default: 0 },
//   tax: { type: Number, default: 0 },
//   shipping: { type: Number, default: 50 },
//   finalAmount: { type: Number, required: true },

//   address: {
//     name: String,
//     phone: String,
//     address: String,
//     city: String,
//     state: String,
//     pincode: String,
//     addressType: String
//   },

//   paymentMethod: { type: String, default: "COD" },
//   paymentStatus: { type: String, default: "Pending" },
//   cancellationReason: String,
//   returnReason: { type: String, default: null },
//   updatedAt: { type: Date, default: Date.now },
//   invoiceDate: { type: Date, default: Date.now },

//   razorpayOrderId: {
//   type: String,
//   default: null
// },
// razorpayPaymentId: {
//   type: String,
//   default: null
// },
// razorpaySignature: {
//   type: String,
//   default: null
// },
//   status: {
//     type: String,
//     required: true,
//     enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
//     default: "Pending"
//   },
//   statusHistory: [{
//     status: {
//       type: String,
//       required: true,
//       enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Request', 'Returned']
//     },
//     timestamp: { type: Date, default: Date.now },
//     reason: { type: String, default: null }  
//   }],
//   createdOn: { type: Date, default: Date.now },
//   couponApplied: { type: Boolean, default: false }
// });


const orderSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  orderId: {
    type: String,
    default: () => `ORD${Date.now()}`,
    unique: true
  },

  orderedItems: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],

  subtotal: {
    type: Number,
    default: function () {
    return this.totalPrice;
  }
  },
  totalPrice: {         
  type: Number,
  required: true
},
  discount: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
totalAmount: {
  type: Number,
  default: function () {
    return this.finalAmount;
  }
},
  couponCode: {
    type: String,
    default: null
  },
  couponApplied: {
    type: Boolean,
    default: false
  },

  address: {
    name: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    addressType: String
  },

  paymentMethod: { type: String, default: "COD" },
  paymentStatus: { type: String, default: "Pending" },

  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,

  status: {
    type: String,
    enum: [
      'Pending',
      'Processing',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Return Request',
      'Returned',
      'Payment Failed' 
    ],
    default: 'Pending'
  },

  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    reason: String
  }],

  cancellationReason: String,
  returnReason: String,

  createdOn: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});



const Order = mongoose.model("Order", orderSchema);


module.exports = Order;

