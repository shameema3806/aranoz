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


// Verify Razorpay Payment
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // Create signature for verification
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // Payment verified successfully
      const order = await Order.findById(orderId).populate('orderedItems.product');

      if (!order) {
        return res.json({ success: false, message: "Order not found" });
      }

      // Update order status
      order.paymentStatus = 'Completed';
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;
      order.status = 'Processing'; // Move to processing after successful payment

      // Add to status history
      order.statusHistory.push({
        status: 'Processing',
        timestamp: new Date(),
        reason: 'Payment completed successfully'
      });

      await order.save();

      // Reduce stock after successful payment
      for (let item of order.orderedItems) {
        await Product.findByIdAndUpdate(item.product._id || item.product, {
          $inc: { stock: -item.quantity }
        });
      }

      // Clear cart
      await Cart.findOneAndUpdate(
        { userId: order.userId },
        { $set: { items: [] } }
      );

      if (req.session.appliedCoupon) {
        delete req.session.appliedCoupon;
      }

      return res.json({
        success: true,
        orderId: order._id,
        message: "Payment verified successfully"
      });

    } else {
      // Payment verification failed
      const order = await Order.findById(orderId);

      if (order) {
        order.paymentStatus = 'Failed';
        order.status = 'Payment Failed';
        order.statusHistory.push({
          status: 'Payment Failed',
          timestamp: new Date(),
          reason: 'Payment signature verification failed'
        });
        await order.save();
      }

      return res.json({
        success: false,
        message: "Payment verification failed"
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    res.json({
      success: false,
      message: "Payment verification error"
    });
  }
};

// Retry Payment for Failed Orders
const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus === 'Completed') {
      return res.json({ success: false, message: "Order already paid" });
    }

    // Check stock again before retry
    for (let item of order.orderedItems) {
      const product = await Product.findById(item.product);
      if (!product || product.stock < item.quantity) {
        return res.json({
          success: false,
          message: `Insufficient stock for one or more items`
        });
      }
    }

    // Create new Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.finalAmount * 100),
      currency: 'INR',
      receipt: order._id.toString(),
      notes: {
        orderId: order._id.toString(),
        userId: userId.toString(),
        retry: 'true'
      }
    });

    // Update order with new Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    order.paymentStatus = 'Pending';
    await order.save();

    // Get user details
    const user = await User.findById(userId);
    const addressDoc = await Address.findOne({ userId });

    return res.json({
      success: true,
      orderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.finalAmount,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
      customerDetails: {
        name: order.address.name,
        email: user.email,
        contact: order.address.phone
      }
    });

  } catch (error) {
    console.error('Retry payment error:', error);
    res.json({
      success: false,
      message: "Failed to retry payment"
    });
  }
};


let generateInvoice = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('orderedItems.product')
      .populate('couponCode')
      .lean();
    if (!order) return res.redirect('/orders');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Stream PDF to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderId}.pdf"`);
    doc.pipe(res);

    // Color scheme
    const primaryColor = '#2C3E50';
    const accentColor = '#3498DB';
    const lightGray = '#ECF0F1';
    const darkGray = '#7F8C8D';

    // Header Section with Background
    doc.rect(0, 0, 612, 120).fill(primaryColor);

    // Company Logo/Name
    doc.fillColor('#FFFFFF')
      .fontSize(32)
      .font('Helvetica-Bold')
      .text('ARANOZ', 50, 40);

    doc.fontSize(10)
      .font('Helvetica')
      .text('Premium Furnitures Store', 50, 75)
      .text('Email: aranoz@gmail.com | Phone: +91-1234567890', 50, 90);

    doc.fontSize(28)
      .font('Helvetica-Bold')
      .text('INVOICE', 400, 45, { align: 'right' });

    doc.moveDown(4);

    const infoBoxY = 140;
    doc.fillColor(lightGray)
      .rect(50, infoBoxY, 250, 90)
      .fill();

    doc.fillColor(primaryColor)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('ORDER DETAILS', 60, infoBoxY + 15);

    doc.fillColor(darkGray)
      .fontSize(11)
      .font('Helvetica')
      .text(`Order ID: `, 60, infoBoxY + 35)
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text(`${order.orderId}`, 130, infoBoxY + 35);

    doc.fillColor(darkGray)
      .font('Helvetica')
      .text(`Date: `, 60, infoBoxY + 52)
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text(`${new Date(order.createdOn).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`, 130, infoBoxY + 52);

    doc.fillColor(darkGray)
      .font('Helvetica')
      .text(`Status: `, 60, infoBoxY + 69);

    // Status badge with color
    const statusColor = order.status === 'Delivered' ? '#27AE60' :
      order.status === 'Cancelled' ? '#E74C3C' : accentColor;
    doc.fillColor(statusColor)
      .font('Helvetica-Bold')
      .text(order.status.toUpperCase(), 130, infoBoxY + 69);

    // Billing Address Card
    doc.fillColor(lightGray)
      .rect(320, infoBoxY, 242, 90)
      .fill();

    doc.fillColor(primaryColor)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('BILLING ADDRESS', 330, infoBoxY + 15);

    doc.fillColor(darkGray)
      .fontSize(10)
      .font('Helvetica')
      .text(order.address.name, 330, infoBoxY + 35, { width: 220 })
      .text(`${order.address.address}, ${order.address.city}`, 330, infoBoxY + 50, { width: 220 })
      .text(`${order.address.state} - ${order.address.pincode}`, 330, infoBoxY + 65, { width: 220 });

    // Items Table Header
    const tableTop = infoBoxY + 120;
    doc.fillColor(primaryColor)
      .rect(50, tableTop, 512, 30)
      .fill();

    doc.fillColor('#FFFFFF')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('PRODUCT', 60, tableTop + 10)
      .text('QTY', 350, tableTop + 10, { width: 50, align: 'center' })
      .text('PRICE', 420, tableTop + 10, { width: 60, align: 'right' })
      .text('TOTAL', 500, tableTop + 10, { width: 50, align: 'right' });

    // Table Items with alternating row colors
    let currentY = tableTop + 35;
    const rowHeight = 30;

    order.orderedItems.forEach((item, index) => {
      // Alternating background
      if (index % 2 === 0) {
        doc.fillColor('#F8F9FA')
          .rect(50, currentY - 5, 512, rowHeight)
          .fill();
      }

      const productName = item.product.productName;
      const quantity = item.quantity;
      const price = item.price;
      const lineTotal = price * quantity;

      doc.fillColor(primaryColor)
        .fontSize(10)
        .font('Helvetica')
        .text(productName, 60, currentY, { width: 280 })
        .text(quantity.toString(), 350, currentY, { width: 50, align: 'center' })
        .text(`₹ ${price.toFixed(2)}`, 420, currentY, { width: 60, align: 'right' })
        .font('Helvetica-Bold')
        .text(`₹ ${lineTotal.toFixed(2)}`, 500, currentY, { width: 50, align: 'right' });

      currentY += rowHeight;
    });

    // Summary Section with styled box
    currentY += 20;
    const summaryBoxY = currentY;

    // Calculate box height based on whether coupon is applied
    const hasCoupon = order.couponCode && order.discount > 0;
    const summaryBoxHeight = hasCoupon ? 132 : 110;

    doc.fillColor(lightGray)
      .rect(350, summaryBoxY, 212, summaryBoxHeight)
      .fill();

    const lineSpacing = 22;
    let summaryY = summaryBoxY + 15;

    // Subtotal
    doc.fillColor(darkGray)
      .fontSize(11)
      .font('Helvetica')
      .text('Subtotal:', 360, summaryY, { width: 120, align: 'left' })
      .fillColor(primaryColor)
      .text(`₹ ${order.totalPrice.toFixed(2)}`, 480, summaryY, { width: 70, align: 'right' });

    summaryY += lineSpacing;

    // Coupon or Discount
    if (hasCoupon) {
      doc.fillColor(darkGray)
        .text(`Coupon (${order.couponCode.code}):`, 360, summaryY, { width: 120 })
        .fillColor('#E74C3C')
        .text(`-₹ ${order.discount.toFixed(2)}`, 480, summaryY, { width: 70, align: 'right' });
      summaryY += lineSpacing;
    } else if (order.discount > 0) {
      doc.fillColor(darkGray)
        .text('Discount:', 360, summaryY, { width: 120 })
        .fillColor('#E74C3C')
        .text(`-₹ ${order.discount.toFixed(2)}`, 480, summaryY, { width: 70, align: 'right' });
      summaryY += lineSpacing;
    }
    // Shipping
    doc.fillColor(darkGray)
      .text('Shipping:', 360, summaryY, { width: 120 })
      .fillColor(primaryColor)
      .text(`₹ ${(order.shipping || 50).toFixed(2)}`, 480, summaryY, { width: 70, align: 'right' });

    summaryY += lineSpacing;

    // Divider line
    doc.strokeColor(darkGray)
      .lineWidth(1)
      .moveTo(360, summaryY - 5)
      .lineTo(552, summaryY - 5)
      .stroke();

    // Total with accent background
    doc.fillColor(accentColor)
      .rect(350, summaryY, 212, 30)
      .fill();

    doc.fillColor('#FFFFFF')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text('TOTAL:', 360, summaryY + 5, { width: 120 })
      .fontSize(14)
      .text(`₹${order.finalAmount.toFixed(2)}`, 480, summaryY + 5, { width: 70, align: 'right' });

    // Footer Section
    const footerY = 750;
    doc.strokeColor(primaryColor)
      .lineWidth(2)
      .moveTo(50, footerY)
      
      .lineTo(562, footerY)
      .stroke();

    doc.fillColor(darkGray)
      .fontSize(9)
      .font('Helvetica')
      .text('Thank you for shopping with Aranoz!', 50, footerY + 10, { align: 'center', width: 512 })
      .text('For queries, contact aranoz@gmail.com', 50, footerY + 25, { align: 'center', width: 512 });

    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.redirect('/orders');
  }
};

module.exports={
    verifyPayment,
    retryPayment,
    generateInvoice,
}