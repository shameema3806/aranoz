const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require('../../models/cartSchema');
const mongoose = require('mongoose'); 
const Address = require('../../models/addressSchema');


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
    const discount = 0;
    const shipping = 30;
    const tax = 0;
    const total = subtotal + shipping + tax - discount;



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
      total: total.toFixed(2)
    });

  } catch (error) {
    console.log("Checkout load error:", error);
    res.redirect("/500");
  }
};

module.exports = { loadCheckout };
