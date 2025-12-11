const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const productController = require("../controllers/user/productController");
const cartController = require('../controllers/user/cartController');
const { userAuth} = require("../middlewares/auth");
const uploads = require("../helpers/multer");
const profileUploads = require('../helpers/profileUploads');
const wishlistController = require("../controllers/user/wishlistController");
const checkoutController = require("../controllers/user/checkoutController")
const orderController = require("../controllers/user/orderController");
// const Order = require("../controllers/user/orderContorller");
const Order = require("../models/orderSchema");


//Error Management
router.get("/pageNotFound", userController.pageNotFound);

// Signup Management
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.Signup);
router.post("/verify-otp", userController.verifyOtp);
router.get('/verify-otp', (req, res) => {
  res.render('verify-otp');
});
router.post("/signup/resend-otp", userController.resendOtp);
router.get('/auth/google', passport.authenticate('google', { scope: ["profile", "email"] }));
router.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", failureFlash: true }),
  async (req, res) => {
    if (req.user) {
      req.session.user = req.user._id;
    }
    res.redirect('/');
  });


//shop page
router.get("/shop", userAuth, userController.loadShopping);

//product management
router.get("/productDetail", userAuth, productController.productDetail);
router.post("/product/:id/review", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/shop");

    const { userName, rating, comment } = req.body;

    product.reviews.push({ userName, rating: Number(rating), comment });

    product.rating =
      product.reviews.reduce((sum, r) => sum + r.rating, 0) /
      product.reviews.length;

    await product.save();

    res.redirect(`/productDetail?id=${product._id}`);
  } catch (err) {
    console.error(err);
    res.redirect("/shop");
  }
});



//login Management
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);

//logout
router.get("/", userController.loadHomepage);
router.post('/logout', userController.logout);

//Profile Management
router.get("/forgot-password", profileController.getForgetPassword);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPasspage);
router.post("/reset-password", profileController.resetPassword);
router.get("/userProfile", userAuth, profileController.userProfile);
router.get("/editprofile", userAuth, profileController.editprofile);
router.post('/updateprofile', userAuth, profileUploads.single('profileImage'), profileController.updateProfile);


router.get("/change-email", userAuth, profileController.changeEmail);
router.post("/change-email", userAuth, profileController.changeEmailvalid);
router.post("/verify-email-otp", userAuth, profileController.verifyEmailOtp);
router.post("/update-email", userAuth, profileController.updateEmail);

router.get("/change-password", userAuth, profileController.changePassword);
router.post("/change-password", userAuth, profileController.changepasswordvalid);
router.post("/verify-changepassword-otp", userAuth, profileController.verifyChangepassOtp);

//address Management
router.get("/addresses", userAuth, profileController.getAddresses);
router.post("/addresses/add", userAuth, profileController.addAddress);
router.get("/addresses/edit/:id", userAuth, profileController.getEditAddress);
router.post("/addresses/edit/:id", userAuth, profileController.updateAddress);
router.post("/addresses/delete/:id", userAuth, profileController.deleteAddress);
// router.get("/product/:id", profileController.loadProductDetails);
router.post("/forgot-password/resend-otp", profileController.resendsOtp);

//cart Management
router.get('/cart', userAuth, cartController.getCart);
router.post('/cart/add', userAuth, cartController.addToCart);
router.post('/cart/update', userAuth, cartController.updateCart);
router.post('/cart/remove', userAuth, cartController.removeFromCart);


// Wishlist Management
router.get('/wishlist', userAuth, wishlistController.getWishlist);
router.post('/wishlist/add', userAuth, wishlistController.addToWishlist);
router.post('/wishlist/remove', userAuth, wishlistController.removeFromWishlist);


//checkout Management
router.get("/checkout", userAuth, checkoutController.loadCheckout);

//order Management 
router.post("/place-order",userAuth, orderController.placeOrder);
router.get('/order-success', userAuth, async (req, res) => {
  try {
    const orderId = req.query.orderId;
    const userId = req.session.user;
    if (!orderId) {
      return res.redirect('/');
    }
    const orderDetails = await Order.findOne({ _id: orderId, userId })
      .populate('orderedItems.product')
      .lean();
    if (!orderDetails) {
      return res.redirect('/');
    }
    res.render('order-success', { order: orderDetails });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});
router.get('/order-failure', (req, res) => {
  const orderId = req.query.orderId;
  res.render('user/order-failure', { orderId });
});
router.get('/orders/:id', userAuth, orderController.viewOrder);

// Order listing page
router.get('/orders', userAuth, orderController.loadOrders);
// router.get('/orders/search', userAuth, orderController.loadOrders);

// Single order details

// Cancel /return
router.post('/orders/:id/cancel', userAuth, orderController.cancelOrder);
router.post('/orders/:id/return', userAuth, orderController.returnOrder);
router.get('/orders/:orderId/invoice',userAuth ,orderController.generateInvoice);

router.get('/orders/:id', userAuth, orderController.updateOrderStatus);


module.exports = router;