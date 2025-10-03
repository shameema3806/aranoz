const User = require("../../models/userSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const session = require("express-session");
const Product = require("../../models/productSchema");

function generateOtp(){
    const digits = "1234567890"
    let otp = "";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];
    }
    return otp
}

const sendVerificationEmail = async (email,otp)=>{
    try {

        const transporter = nodemailer.createTransport({
                 service:"gmail",
                 port:587,
                 secure:false,
                 requireTLS:true,
                 auth:{
                   user:process.env.NODEMAILER_EMAIL,
                   pass:process.env.NODEMAILER_PASSWORD,
        }
    })
    
   const mailOptions = {
    from:process.env.NODEMAILER_EMAIL,
    to:email,
    subject:"Your OTP for password reset",
    text:`Your OTP is ${otp}`,
    html:`<b><h4> Your OTP : ${otp} </h4><br></b>`,
   }

    const info = await transporter.sendMail(mailOptions);
    console.log("Email Sent:",info.messageId);
    return true;  

    } catch (error) {
        console.error("Error sending email",error);
        return false
    }
    }


     const getForgetPassword = async (req,res)=>{
    try {
        res.render("forgot-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
       }

    const forgotEmailValid = async (req,res)=>{
    try {
        const {email} = req.body;
        console.log('Received email for password reset:', email); // Add this log
        const findUser = await User.findOne({email:email});
        if(findUser){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp = otp;
                req.session.email = email;
                console.log('Session email set:', req.session.email, 'OTP:', otp); // Update log
                res.render("forgotPass-otp");
                console.log("OTP:",otp);
            }else{
                res.json({success:false,message:"Failed to send OTP. Please try again"})
            }
        }

        else{
            res.render("forgot-password",{
                message:"User with this email does not exits"
            })
          }
        } catch (error) {
        res.redirect("/pageNotFound");
       }
    }

    const resendsOtp = async (req, res) => {
    try {
        console.log("Session data:", req.session);

        const email = req.session.email;

        if (!email) {
            return res.status(400).json({ success: false, message: "Session expired. Please re-enter your email." });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("resent OTP:", otp);
            return res.json({ success: true, message: "OTP resent successfully." });
        } else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP." });
        }
       } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
      }
    };
    



    const verifyForgotPassOtp = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"});
        }else{
            res.json({success:false,message:"OTP not matching"});
        }
    } catch (error) {
      res.status(500).json({success:false,message:"An error occured, Please try again"})  
    }
    }
     
        

     
      const getResetPasspage = async(req,res)=>{
        try {
            res.render("reset-password");
        } catch (error) {
            res.redirect("/pageNotFound");
        }
      }


const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.session.email;

    // Validate session email
    if (!email) {
      console.error('No email in session');
      req.flash('err1', 'Session expired. Please re-enter your email.');
      return res.redirect('/forgot-password');
    }

    // Validate password
    if (!password || password.length < 8) {
      console.error('Invalid password:', password);
      req.flash('err1', 'Password must be at least 6 characters long.');
      return res.redirect('/reset-password');
    }

    // Verify user exists
    const user = await User.findOne({ email: email });
    if (!user) {
      console.error('User not found for email:', email);
      req.flash('err1', 'User not found. Please try again.');
      return res.redirect('/forgot-password');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('New Hashed Password:', hashedPassword);

    // Update the password in DB
    const updateResult = await User.findOneAndUpdate(
      { email: email },
      { $set: { password: hashedPassword } },
      { new: true }
    );

    if (!updateResult) {
      console.error('Failed to update password for email:', email);
      req.flash('err1', 'Failed to update password. Please try again.');
      return res.redirect('/reset-password');
    }

    console.log('Updated User Password:', updateResult.password);

    // Clear session data
    req.session.userOtp = null;
    req.session.email = null;
    req.session.user = null;

    req.flash('success', 'Password reset successfully. Please log in.');
    res.redirect('/login');
  } catch (error) {
    console.error('Reset Password Error:', error);
    req.flash('err1', 'Something went wrong. Please try again.');
    res.redirect('/reset-password');
  }
};


  
const userProfile = async (req, res)=>{
try {

const userId = req.session. user;
const userData = await User.findById(userId);
res.render('profile',{
user: userData,
})

} catch (error) {

console.error("Error for retrieve profile data",error) ;
res.redirect("/pageNotFound")

}}


const loadProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findOne({
      _id: productId,
      isBlocked: false,
      quantity: { $gt: 0 }
    }).populate("category").populate("reviews");

    if (!product) {
      return res.redirect("/shop"); // Redirect if blocked/unavailable
    }

    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isBlocked: false,
      quantity: { $gt: 0 }
    }).limit(4);

    res.render("user/productDetail", { product, relatedProducts });
  } catch (error) {
    console.log("Product details error:", error);
    res.redirect("/shop");
  }
};



module.exports={
    getForgetPassword,
    forgotEmailValid,
    resendsOtp,
    verifyForgotPassOtp,
    getResetPasspage,
    resetPassword,
    userProfile,
    loadProductDetails
    

}