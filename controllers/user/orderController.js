const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Product = require("../../models/productSchema");
const PDFDocument = require('pdfkit');
const path = require('path');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require("dotenv").config();


// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "User not logged in" });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    // Fetch and Validate Address
    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address?.length) {
      return res.json({ success: false, message: "No addresses found" });
    }

    const address = addressDoc.address.find(addr => addr._id.toString() === addressId);
    if (!address) {
      return res.json({ success: false, message: "Invalid address" });
    }

    // Validate stock before creating anything
    for (let item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product || product.quantity < item.quantity) {
        return res.json({
          success: false,
          message: `Insufficient stock for ${item.productId.productName}`
        });
      }
    }

    // Calculate totals
    const subtotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    const appliedCoupon = req.session?.appliedCoupon || null;
    const discount = appliedCoupon ? (appliedCoupon.discount || 0) : 0;
    const shipping = 50; // Fixed ₹50 delivery charge always
    const finalAmount = Math.max(0, subtotal + shipping - discount);

    // Block COD for orders above ₹1000
    if (paymentMethod === 'cod' && finalAmount > 1000) {
      return res.json({
        success: false,
        message: 'Cash on Delivery is not available for orders above ₹1000. Please choose Online Payment.'
      });
    }

    if (paymentMethod === 'cod') {
      const order = new Order({
        userId,
        orderedItems: cart.items.map(i => ({
          product: i.productId._id,
          quantity: i.quantity,
          price: i.price
        })),
        totalPrice: subtotal,
        discount,
        couponCode: appliedCoupon?.id || null,
        shipping,
        finalAmount,
        address: {
          name: address.name,
          phone: address.phone,
          address: address.landMark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          addressType: address.addressType
        },
        paymentMethod: 'COD',
        status: 'Pending',
        paymentStatus: 'Pending'
      });

      await order.save();

      for (let item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });

      }
      await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
      delete req.session.appliedCoupon;

      return res.json({ success: true, orderId: order._id, displayOrderId: order.orderId });
    }

    if (paymentMethod === 'online') {
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(finalAmount * 100),
        currency: 'INR',
        receipt: `pending_${Date.now()}`
      });

      req.session.pendingOrder = {
        userId,
        orderedItems: cart.items.map(i => ({
          product: i.productId._id,
          quantity: i.quantity,
          price: i.price
        })),
        totalPrice: subtotal,
        discount,
        couponCode: appliedCoupon?.id || null,
        shipping,
        finalAmount,
        address: {
          name: address.name,
          phone: address.phone,
          address: address.landMark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          addressType: address.addressType
        },
        paymentMethod: 'ONLINE'
      };

      const user = await User.findById(userId);
      return res.json({
        success: true,
        razorpayOrderId: razorpayOrder.id,
        amount: finalAmount,
        key: process.env.RAZORPAY_KEY_ID,
        customerDetails: { name: address.name, email: user.email, contact: address.phone }
      });
    }

  } catch (err) {
    console.error('Place order error:', err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const loadOrders = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId).lean();
    const searchTerm = req.query.q ? req.query.q.trim().toLowerCase() : '';
    const page = parseInt(req.query.page) || 1;
    const perPage = 6;
    const skip = (page - 1) * perPage;
    let orders;
    let query = { userId };
    let totalOrders;

    if (searchTerm) {
      const allOrders = await Order.find(query)
        .populate('orderedItems.product')
        .lean();

      const filteredOrders = allOrders.filter(order =>
        order.orderId.toLowerCase().includes(searchTerm) ||
        order.orderedItems.some(item =>
          item.product && item.product.productName &&
          item.product.productName.toLowerCase().includes(searchTerm)
        )
      );

      totalOrders = filteredOrders.length;
      orders = filteredOrders.slice(skip, skip + perPage);
    } else {
      totalOrders = await Order.countDocuments(query);
      orders = await Order.find(query)
        .populate('orderedItems.product')
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(perPage)
        .lean();
    }

    const totalPages = Math.ceil(totalOrders / perPage);

    res.render('orders', {
      orders,
      searchQuery: searchTerm,
      user,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.error("Error loading orders:", err);
    res.redirect('/');
  }
};


let viewOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;
    const user = await User.findById(userId).lean();

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('orderedItems.product')
      .lean();

    if (!order) return res.redirect('/orders');

    res.render('order-details', { order, user });
  } catch (error) {
    console.error('Error viewing order:', error);
    res.redirect('/orders');
  }
};

let cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order || order.status !== 'Pending' && order.status !== 'Processing') {
      return res.json({ success: false, message: 'Cannot cancel this order' });
    }

    order.status = 'Cancelled';
    order.cancellationReason = reason || 'No reason provided';
    order.updatedAt = new Date();
    await order.save();

    for (let item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity }
      });
    }

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.json({ success: false, message: 'Failed to cancel order' });
  }
};

let returnOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;
    const { reason } = req.body;

    if (!reason) {
      return res.json({ success: false, message: 'Return reason is required' });
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order || order.status !== 'Delivered') {
      return res.json({ success: false, message: 'Cannot return this order' });
    }


    order.status = 'Return Request';
    order.returnReason = reason;
    order.updatedAt = new Date();
    order.statusHistory.push({
      status: 'Return Request',
      timestamp: new Date(),
      reason: reason
    });
    await order.save();
    res.json({ success: true, message: 'Return request submitted' });
  } catch (error) {
    console.error('Error returning order:', error);
    res.json({ success: false, message: 'Failed to return order' });
  }
};

let updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.json({ success: false, message: 'Order not found' });

    if (!['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Request', 'Returned'].includes(status)) {
      return res.json({ success: false, message: 'Invalid status' });
    }

    order.statusHistory.push({
      status,
      timestamp: new Date(),
      reason: reason || null
    });

    order.status = status;
    order.updatedAt = new Date();
    await order.save();

    if (status === 'Delivered') {
      order.paymentStatus = 'Completed';
      await order.save();
    }

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.json({ success: false, message: 'Failed to update status' });
  }
};

module.exports = {
  placeOrder,
  loadOrders,
  viewOrder,
  cancelOrder,
  returnOrder,
  updateOrderStatus,
};
