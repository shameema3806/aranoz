const User = require("../../models/userSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const session = require("express-session");
const Product = require("../../models/productSchema");
const Address = require('../../models/addressSchema');
const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const Coupon = require("../../models/couponSchema");
const crypto = require("crypto");
const path = require('path');
const fs = require('fs');



function generateOtp() {
  const digits = "1234567890"
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp
}

const sendVerificationEmail = async (email, otp) => {
  try {

    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      }
    })

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Your OTP for password reset",
      text: `Your OTP is ${otp}`,
      html: `<b><h4> Your OTP : ${otp} </h4><br></b>`,
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Email Sent:", info.messageId);
    return true;

  } catch (error) {
    console.error("Error sending email", error);
    return false
  }
}


const getForgetPassword = async (req, res) => {
  try {
    res.render("forgot-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Received email for password reset:', email); // Add this log
    const findUser = await User.findOne({ email: email });
    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;
        console.log('Session email set:', req.session.email, 'OTP:', otp); // Update log
        res.render("forgotPass-otp");
        console.log("OTP:", otp);
      } else {
        res.json({ success: false, message: "Failed to send OTP. Please try again" })
      }
    }

    else {
      res.render("forgot-password", {
        message: "User with this email does not exits"
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




const verifyForgotPassOtp = async (req, res) => {
  try {
    const enteredOtp = req.body.otp;
    if (enteredOtp === req.session.userOtp) {
      res.json({ success: true, redirectUrl: "/reset-password" });
    } else {
      res.json({ success: false, message: "OTP not matching" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "An error occured, Please try again" })
  }
}




const getResetPasspage = async (req, res) => {
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

    if (!email) {
      return res.status(400).json({ success: false, message: 'Session expired. Please try again.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    req.session.email = null;
    req.session.userOtp = null;

    return res.json({ success: true, message: 'Password reset successfully!' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};


console.log("Model Check:", typeof Wallet);
const userProfile = async (req, res) => {
  try {

    const userId = req.session.user;
    const userData = await User.findById(userId);
    if (!userData) {
      return res.redirect("/login");
    }

    if (!userData.referralCode) {
      const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      userData.referralCode = newCode;
      await userData.save();
    }

    let addressDoc = await Address.findOne({ userId });
    let addresses = [];
    if (addressDoc) {
      addresses = addressDoc.address || [];
    }

    const walletDoc = await Wallet.findOne({ userId });
    const walletBalance = walletDoc ? walletDoc.balance : 0;

    const orders = await Order.find({ userId })
      .populate('orderedItems.product')
      .sort({ createdOn: -1 })
      .limit(5)
      .lean();

    const coupons = await Coupon.find({
      userId: userId
    }).sort({ createdAt: -1 });

    console.log("Profile Page User ID:", userId);
    console.log("Coupons found for this user:", coupons);
    res.render('profile', {
      user: userData,
      walletBalance,
      addresses,
      orders,
      coupons: coupons
    })

  } catch (error) {

    console.error("Error retrieving profile data:", error);
    res.redirect("/pageNotFound")

  }
}



const editprofile = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId);

    if (!user) return res.redirect("/pageNotFound");

    res.render("edit-profile", { user });
  } catch (error) {
    console.error("Error rendering edit profile page:", error);
    res.redirect("/pageNotFound");
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.redirect("/login");

    const { name, phone } = req.body;

    const trimmedName = (name || '').trim();
    const trimmedPhone = (phone || '').trim();

    if (!trimmedName) {
      return res.redirect('/editprofile?error=nameRequired');
    }
    if (!/^[a-zA-Z\s]{2,}$/.test(trimmedName)) {
      return res.redirect('/editprofile?error=invalidName');
    }

    if (!trimmedPhone) {
      return res.redirect('/editprofile?error=phoneRequired');
    }
    const cleanPhone = trimmedPhone.replace(/[\s\-\(\)\+]/g, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.redirect('/editprofile?error=invalidPhone');
    }

    const updateData = {
      name: trimmedName,
      phone: trimmedPhone
    };

    if (req.file) {
      const uploadDir = path.join(__dirname, '..', 'public', 'profile-images');
      const fullPath = path.join(uploadDir, req.file.filename);

      if (!fs.existsSync(fullPath)) {
        console.error('File not saved! Check Multer config or permissions at:', fullPath);
        return res.redirect('/editprofile?error=fileUploadFailed');
      } else {
        console.log('File saved successfully at:', fullPath);
      }

      updateData.profileImage = `/profile-images/${req.file.filename}`;
      console.log('Updated user profileImage:', updateData.profileImage);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    if (!updatedUser) {
      return res.redirect("/pageNotFound");
    }
    res.redirect("/userProfile");
  } catch (error) {
    console.error("Error updating profile:", error);
    res.redirect("/pageNotFound");
  }
};


module.exports = {
  getForgetPassword,
  forgotEmailValid,
  resendsOtp,
  verifyForgotPassOtp,
  getResetPasspage,
  resetPassword,
  userProfile,
  editprofile,
  updateProfile,

};