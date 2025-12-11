const Order = require("../../models/orderSchema"); 
const User = require("../../models/userSchema");
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Product = require("../../models/productSchema");
const PDFDocument = require('pdfkit');
const path = require('path');

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod } = req.body;

    if (!userId) return res.json({ success: false, message: "User not logged in" });

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) return res.json({ success: false, message: "Cart is empty" });

    // FIXED: Fetch parent doc, find sub-address by _id
    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address || !addressDoc.address.length) {
      return res.json({ success: false, message: "No addresses found" });
    }

    const addressIndex = addressDoc.address.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.json({ success: false, message: "Invalid address" });
    }
    const address = addressDoc.address[addressIndex];  // Extract subdoc

    const subtotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    const shipping = 50;
    const finalAmount = subtotal + shipping;

    const order = new Order({
      userId,
      orderedItems: cart.items.map(i => ({
        product: i.productId._id,
        quantity: i.quantity,
        price: i.price
      })),
      totalPrice: subtotal,
      shipping,
      finalAmount,
      address: {
        // FIXED: Map to embedded fields (adjust if your subdoc schema differs)
        name: address.name,  // Use 'name' (full name, no first/last split)
        phone: address.phone,
        address: address.landMark,  // Or 'address' if you have it; assuming landMark is the street
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        addressType: address.addressType
      },
      paymentMethod: paymentMethod.toUpperCase(),
      paymentStatus: "Pending",
      status: "Pending"
    });

    await order.save();

    // Empty cart after successful order placement
    cart.items = [];
    await cart.save();


    req.session.save(() => {
      res.json({
        success: true,
        orderId: order._id,
        displayOrderId: order.orderId
      });
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Failed to place order" });
  }
};

// let loadOrders = async (req, res) => {
//   try {
//     console.log("loadOrders session:", req.session);
// console.log("loadOrders userId:", req.session?.user);

//     const userId = req.session.user;
//     if (!userId) return res.redirect('/login');

//     const user = await User.findById(userId).lean(); 

//     let orders;
//     const searchTerm = req.query.q ? req.query.q.trim().toLowerCase() : ''; // Use 'q' param for search

//     if (searchTerm) {
//       // Fetch all orders for the user, populate products, then filter
//       const allOrders = await Order.find({ userId })
//         .populate('orderedItems.product')
//         .sort({ createdOn: -1 })
//         .lean();

//       // Filter by orderId or any product name
//       orders = allOrders.filter(order =>
//         order.orderId.toLowerCase().includes(searchTerm) ||
//         order.orderedItems.some(item =>
//           item.product && item.product.productName &&
//           item.product.productName.toLowerCase().includes(searchTerm)
//         )
//       );
//     } else {
//       // No search: Fetch normally
//       orders = await Order.find({ userId })
//         .populate('orderedItems.product')
//         .sort({ createdOn: -1 })
//         .lean();
//     }

//     res.render('orders', { orders, searchQuery: searchTerm ,user});
//   } catch (error) {
//     console.error('Error loading orders:', error);
//     res.redirect('/');
//   }
// };

const loadOrders = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId).lean();

    // Get search term from query
    const searchTerm = req.query.q ? req.query.q.trim().toLowerCase() : '';

    let orders;

    if (searchTerm) {
      // Fetch all orders for user and filter
      const allOrders = await Order.find({ userId })
        .populate('orderedItems.product')
        .sort({ createdOn: -1 })
        .lean();

      orders = allOrders.filter(order => 
        order.orderId.toLowerCase().includes(searchTerm) ||
        order.orderedItems.some(item => 
          item.product && item.product.productName && 
          item.product.productName.toLowerCase().includes(searchTerm)
        )
      );
    } else {
      // No search: fetch normally
      orders = await Order.find({ userId })
        .populate('orderedItems.product')
        .sort({ createdOn: -1 })
        .lean();
    }

    res.render('orders', { orders, searchQuery: searchTerm, user });
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
      .populate('orderedItems.product') // Populate products for items list
      .lean();

    if (!order) return res.redirect('/orders');

    res.render('order-details', { order ,user});
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
        $inc: { stock: item.quantity }
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
    const orderId  = req.params.id;
    const { reason } = req.body; 

    if (!reason) {
      return res.json({ success: false, message: 'Return reason is required' });
    }
    console.log('Return attempt:', { orderId, userId, reason });

    const order = await Order.findOne({ _id: orderId, userId });
    console.log('Found order:', order ? { _id: order._id, status: order.status } : 'Not found'); // Debug log
    
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


let generateInvoice = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('orderedItems.product')
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
    
    doc.fillColor(lightGray)
       .rect(350, summaryBoxY, 212, 110)
       .fill();

    const lineSpacing = 22;
    
    doc.fillColor(darkGray)
       .fontSize(11)
       .font('Helvetica')
       .text('Subtotal:', 360, summaryBoxY + 15, { width: 120, align: 'left' })
       .fillColor(primaryColor)
       .text(`₹ ${order.totalPrice.toFixed(2)}`, 480, summaryBoxY + 15, { width: 70, align: 'right' });
    
    doc.fillColor(darkGray)
       .text('Discount:', 360, summaryBoxY + 15 + lineSpacing, { width: 120 })
       .fillColor('#E74C3C')
       .text(`-₹ ${order.discount.toFixed(2)}`, 480, summaryBoxY + 15 + lineSpacing, { width: 70, align: 'right' });
    
    doc.fillColor(darkGray)
       .text('Shipping:', 360, summaryBoxY + 15 + (lineSpacing * 2), { width: 120 })
       .fillColor(primaryColor)
       .text(`₹ ${(order.shipping || 50).toFixed(2)}`, 480, summaryBoxY + 15 + (lineSpacing * 2), { width: 70, align: 'right' });
    
    // Divider line
    doc.strokeColor(darkGray)
       .lineWidth(1)
       .moveTo(360, summaryBoxY + 15 + (lineSpacing * 3) - 5)
       .lineTo(552, summaryBoxY + 15 + (lineSpacing * 3) - 5)
       .stroke();
    
    // Total with accent background
    doc.fillColor(accentColor)
       .rect(350, summaryBoxY + 15 + (lineSpacing * 3), 212, 30)
       .fill();
    
    doc.fillColor('#FFFFFF')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('TOTAL:', 360, summaryBoxY + 20 + (lineSpacing * 3), { width: 120 })
       .fontSize(14)
       .text(`₹${order.finalAmount.toFixed(2)}`, 480, summaryBoxY + 20 + (lineSpacing * 3), { width: 70, align: 'right' });

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

module.exports = {
  placeOrder,
  loadOrders,
  viewOrder,
  cancelOrder,
  returnOrder,
  updateOrderStatus,
  generateInvoice
};
