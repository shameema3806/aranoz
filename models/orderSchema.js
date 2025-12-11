const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orderId: {
    type: String,
    required: true,
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
    price: { type: Number, default: 0 }
  }],

  totalPrice: { type: Number, required: true },  // subtotal
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  shipping: { type: Number, default: 50 },
  finalAmount: { type: Number, required: true },

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
  cancellationReason: String,
  returnReason: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
  invoiceDate: { type: Date, default: Date.now },


  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
    default: "Pending"
  },
  statusHistory: [{
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Request', 'Returned']
    },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String, default: null }  
  }],
  createdOn: { type: Date, default: Date.now },
  couponApplied: { type: Boolean, default: false }
});





const Order = mongoose.model("Order", orderSchema);


module.exports = Order;

