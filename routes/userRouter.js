const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
const productController = require("../controllers/user/productController");
const { userAuth } = require("../middlewares/auth");


//Error Management
router.get("/pageNotFound",userController.pageNotFound);

// Signup Management
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.Signup);
router.post("/verify-otp",userController.verifyOtp);
router.get('/verify-otp', (req, res) => {
    res.render('verify-otp');
});
router.post("/signup/resend-otp",userController.resendOtp);
router.get('/auth/google',passport.authenticate('google',{scope:["profile","email"]}));
router.get("/auth/google/callback", 
  passport.authenticate("google", { failureRedirect: "/signup" }),
  async (req, res) => {
    if (req.user) {
      req.session.user = req.user._id;
    }
    res.redirect('/');
});

//shop page
router.get("/shop", userController.loadShopping);


//product management
router.get("/productDetail",productController.productDetail);
// POST review
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
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);

//logout
router.get("/",userController.loadHomepage);
router.post('/logout',userController.logout);

//Profile Management
router.get("/forgot-password",profileController.getForgetPassword);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPasspage);
router.post('/reset-password', profileController.resetPassword);
router.get("/userProfile",userAuth,profileController.userProfile);
router.get("/product/:id", profileController.loadProductDetails);

router.post("/forgot-password/resend-otp", profileController.resendsOtp);

module.exports = router;