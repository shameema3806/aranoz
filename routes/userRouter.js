const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController");
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


router.get("/shop", userController.loadShopping);

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