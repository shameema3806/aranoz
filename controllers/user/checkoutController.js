const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require('../../models/cartSchema');
const mongoose = require('mongoose'); 
const Address = require('../../models/addressSchema');
const Coupon = require("../../models/couponSchema");


const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      console.log("Checkout: No session user, redirecting");
      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("Checkout: User not found");
      return res.redirect("/login");
    }

    // CART
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) return res.redirect("/cart");

    const products = cart.items.map(item => ({
      productId: item.productId,
      productName: item.productId.productName || item.productId.name,
      quantity: item.quantity,
      price: item.price,
      totalprice: item.totalPrice
    }));

    const itemCount = products.length;
    const subtotal = cart.items.reduce((acc, p) => acc + p.totalPrice, 0);

  
    const appliedCoupon = req.session?.appliedCoupon || null;
    let discount = 0;

    // Recalculate discount if coupon is applied
    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'percentage') {
        discount = (subtotal * appliedCoupon.discountValue) / 100;
        
        // Apply max discount cap if set
        if (appliedCoupon.maxDiscount && discount > appliedCoupon.maxDiscount) {
          discount = appliedCoupon.maxDiscount;
        }
      } else if (appliedCoupon.discountType === 'fixed') {
        discount = appliedCoupon.discountValue;
        
        // Discount cannot exceed subtotal
        if (discount > subtotal) {
          discount = subtotal;
        }
      }
      
      // Round discount to 2 decimal places
      discount = Math.round(discount * 100) / 100;
      
      // Update discount in session
      req.session.appliedCoupon.discount = discount;
    }

    const shipping = subtotal > 5000 ? 0 : 50; // Free shipping above ₹5000
    const tax = 0;
    const total = subtotal + shipping + tax - discount;

    // ADDRESSES
    let addresses = [];
    const addressDoc = await Address.findOne({ userId });
    if (addressDoc && addressDoc.address.length > 0) {
      addresses = addressDoc.address.map(addr => ({
        _id: addr._id,
        firstName: addr.name.split(" ")[0],
        lastName: addr.name.split(" ").slice(1).join(" "),
        phone: addr.phone,
        address: addr.landMark,
        state: addr.state,
        pinCode: addr.pincode,
        city: addr.city,
        addressType: addr.addressType,
        isDefault: addr.default || false
      }));

      if (!addresses.some(a => a.isDefault)) {
        addresses[0].isDefault = true;
      }
    }

    res.render("checkout", {
      user, 
      addresses,
      cart: { products },
      itemCount,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      shipping: shipping.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      appliedCoupon  // ← PASS COUPON DATA TO TEMPLATE
    });

  } catch (error) {
    console.log("Checkout load error:", error);
    res.redirect("/500");
  }
};


// ============================================
// COUPON ROUTES
// ============================================

// GET /get-available-coupons - Get all active coupons for user
const getAvailableCoupons = async (req, res) => {
  try {
    const currentDate = new Date();
    
    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gte: currentDate }
    })
    .select('code discountType discountValue minCartValue maxDiscount expiryDate')
    .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      coupons
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons'
    });
  }
};

// POST /apply-coupon - Apply coupon to cart
const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login to apply coupon'
      });
    }
    
    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }
    
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true
    });
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }
    
    // Check if coupon is expired
    if (new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This coupon has expired'
      });
    }
    
    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }
    
    // Calculate cart subtotal
    const subtotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    
    // Check minimum cart value
    if (subtotal < coupon.minCartValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum cart value of ₹${coupon.minCartValue} required`
      });
    }
    
    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (subtotal * coupon.discountValue) / 100;
      
      // Apply max discount cap if set
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else if (coupon.discountType === 'fixed') {
      discount = coupon.discountValue;
      
      // Discount cannot exceed subtotal
      if (discount > subtotal) {
        discount = subtotal;
      }
    }
    
    // Round discount to 2 decimal places
    discount = Math.round(discount * 100) / 100;
    
    // Store coupon in session
    req.session.appliedCoupon = {
      id: coupon._id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minCartValue: coupon.minCartValue,
      maxDiscount: coupon.maxDiscount,
      discount: discount
    };
    
    res.json({
      success: true,
      message: 'Coupon applied successfully',
      discount: discount,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      }
    });
    
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply coupon'
    });
  }
};

// POST /remove-coupon - Remove applied coupon
const removeCoupon = async (req, res) => {
  try {
    // Remove coupon from session
    if (req.session && req.session.appliedCoupon) {
      delete req.session.appliedCoupon;
    }
    
    res.json({
      success: true,
      message: 'Coupon removed successfully'
    });
    
  } catch (error) {
    console.error('Error removing coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove coupon'
    });
  }
};


module.exports = { 
  loadCheckout,
  getAvailableCoupons,
  applyCoupon,
  removeCoupon
};









// const User = require("../../models/userSchema");
// const Product = require("../../models/productSchema");
// const Cart = require('../../models/cartSchema');
// const mongoose = require('mongoose'); 
// const Address = require('../../models/addressSchema');
// const Coupon = require("../../models/couponSchema");


// const loadCheckout = async (req, res) => {
//   try {
//     const userId = req.session.user;

//     if (!userId) {
//       console.log("Checkout: No session user, redirecting");
//       return res.redirect("/login");
//     }

//     const user = await User.findById(userId);
//     if (!user) {
//       console.log("Checkout: User not found");
//       return res.redirect("/login");
//     }

//     // CART
//     const cart = await Cart.findOne({ userId }).populate("items.productId");
//     if (!cart || cart.items.length === 0) return res.redirect("/cart");

//     const products = cart.items.map(item => ({
//       productId: item.productId,
//       productName: item.productId.productName || item.productId.name,
//       quantity: item.quantity,
//       price: item.price,
//       totalprice: item.totalPrice
//     }));

//     const itemCount = products.length;
//     const subtotal = cart.items.reduce((acc, p) => acc + p.totalPrice, 0);
//     const discount = 0;
//     const shipping = 30;
//     const tax = 0;
//     const total = subtotal + shipping + tax - discount;



//     let addresses = [];
//   const addressDoc = await Address.findOne({ userId });
//   if (addressDoc && addressDoc.address.length > 0) {
//   addresses = addressDoc.address.map(addr => ({
//     _id: addr._id,
//     firstName: addr.name.split(" ")[0],
//     lastName: addr.name.split(" ").slice(1).join(" "),
//     phone: addr.phone,
//     address: addr.landMark,
//     state: addr.state,
//     pinCode: addr.pincode,
//     city: addr.city,
//     addressType: addr.addressType,
//     isDefault: addr.default || false
//   }));

//   if (!addresses.some(a => a.isDefault)) {
//     addresses[0].isDefault = true;
//   }
// }


//     res.render("checkout", {
//       user, 
//       addresses,
//       cart: { products },
//       itemCount,
//       subtotal: subtotal.toFixed(2),
//       discount: discount.toFixed(2),
//       shipping: shipping.toFixed(2),
//       tax: tax.toFixed(2),
//       total: total.toFixed(2)
//     });

//   } catch (error) {
//     console.log("Checkout load error:", error);
//     res.redirect("/500");
//   }
// };



// module.exports = { loadCheckout };



