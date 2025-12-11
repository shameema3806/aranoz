const User = require("../../models/userSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const session = require("express-session");
const Product = require("../../models/productSchema");
const Address = require('../../models/addressSchema');
const Order = require("../../models/orderSchema")
const path = require('path');
const fs = require('fs');  


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


  
const userProfile = async (req, res)=>{
try {

const userId = req.session.user;
const userData = await User.findById(userId);

    let addressDoc = await Address.findOne({ userId });
    let addresses = [];
    if (addressDoc) {
      addresses = addressDoc.address || [];
    }

    const orders = await Order.find({ userId })
      .populate('orderedItems.product') 
      .sort({ createdOn: -1 })
      .limit(5)
      .lean();

        res.render('profile',{
        user: userData,
        addresses,
        orders
        })

} catch (error) {

console.error("Error retrieving profile data:", error);
res.redirect("/pageNotFound")

}}



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


const changeEmail = async(req,res) =>{
    try{
      res.render("change-email");
    }
  catch (error) {
    res.redirect("/pageNotFound");
  }
}

const changeEmailvalid = async (req,res)=>{
  try {
    
    const {email} = req.body;
    const userExists = await User.findOne({email})
    if(userExists){
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email,otp);
      if(emailSent){
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("change-email-otp");
        console.log("Email Sent:",email);
        console.log("OTP:",otp);
      }else{
        res.json("email-error")
      }
    }else{
      res.render("change-email",{
      message:"User with this email does not exist"
      })
    }
  } catch (error) {
        res.redirect("/pageNotFound");

  }
}

const verifyEmailOtp = async(req,res) =>{
  try {
    const enteredOtp = req.body.otp;
    if(enteredOtp === req.session.userOtp){
      req.session.userData = req.body.userData;
      res.render("new-email",{
        userData : req.session.userData,

      })
    }else{
      res.render("change-email-otp",{
        message: "OTP do not match",
        userData: req.session.userData
      })
    }
  } catch (error) {
     res.redirect("/pageNotFound");

  }

}


const updateEmail = async (req,res)=>{
  try {
    const newEmail = req.body.newEmail;
    const userId = req.session.user;
    await User.findByIdAndUpdate(userId,{email:newEmail});
    res.redirect("/userProfile");

  } catch (error) {
     res.redirect("/pageNotFound");
  }
}


const changePassword = async(req,res) =>{
  try {
    res.render("change-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}


const changepasswordvalid = async (req,res) =>{
  try {
    const {email} = req.body;
    const userExists = await User.findOne({email});
    if(userExists){
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email,otp);
      if(emailSent){
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("change-password-otp");
        console.log("OTP: ",otp);
      }else{
        res.json({
          success:false,
          message:"failed to send otp , Please try again"
        })
      }

    }else{
      res.render("change-password",{
        message:"User with this email does not exist"
      })
    }
  } catch (error) {
    console.log("error in change password validation", Error);
    res.redirect("/pageNotFound");
  }
}



const verifyChangepassOtp = async (req,res) =>{
  try {
    const eneteredOtp = req.body.otp;
    if(eneteredOtp === req.session.userOtp){
      res.json({success:true,redirectUrl:"/reset-password"})
    }else{
      res.json({success:false,message:"OTP do not match"});
    }
  } catch (error) {
    res.status(500).json({success:false, message:"An error occured Please try again later"})
  }
};






const getAddresses = async (req, res) => {
  try {
    let userId;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else if (req.session && req.session.userId) {  
      userId = req.session.userId;
    } else {
      console.log("No user found - redirecting to login");
      return res.redirect("/login");
    }

    const addressDoc = await Address.findOne({ userId });
    const addresses = addressDoc ? addressDoc.address : [];

    res.render("manage-address", {
      user: req.user,
      addresses,
      address: null,
      index: null
    });
  } catch (error) {
    console.log("Error in getAddresses:", error);
    res.redirect("/pageNotFound");
  }
};



const addAddress = async (req, res) => {
  try {
    let userId = req.user?._id || req.session?.userId;
    if (!userId) return res.redirect("/login");

    const { addressType, name, city, landMark, state, pincode, phone, allPhone } = req.body;
    
    // CHANGE: Added server-side validation for all address fields (mirrors client-side rules). If invalid, redirect back with query param for error display
    const trimmedName = (name || '').trim();
    const trimmedCity = (city || '').trim();
    const trimmedState = (state || '').trim();
    const trimmedLandMark = (landMark || '').trim();
    const trimmedPhone = (phone || '').trim();
    const trimmedAllPhone = (allPhone || '').trim();
    const pincodeNum = pincode ? Number(pincode) : NaN;
    
    if (!addressType) {
      return res.redirect('/addresses?error=addressTypeRequired');  // Redirect back with error flag
    }
    if (!trimmedName) {
      return res.redirect('/addresses?error=nameRequired');
    }
    if (!/^[a-zA-Z\s]{2,}$/.test(trimmedName)) {
      return res.redirect('/addresses?error=invalidName');
    }
    if (!trimmedCity) {
      return res.redirect('/addresses?error=cityRequired');
    }
    if (!/^[a-zA-Z\s]+$/.test(trimmedCity)) {
      return res.redirect('/addresses?error=invalidCity');
    }
    if (!trimmedState) {
      return res.redirect('/addresses?error=stateRequired');
    }
    if (!/^[a-zA-Z\s]+$/.test(trimmedState)) {
      return res.redirect('/addresses?error=invalidState');
    }
    if (!trimmedLandMark) {
      return res.redirect('/addresses?error=landMarkRequired');
    }
    if (trimmedLandMark.length < 2) {
      return res.redirect('/addresses?error=invalidLandMark');
    }
    if (!pincodeNum || isNaN(pincodeNum) || pincodeNum.toString().length !== 6) {
      return res.redirect('/addresses?error=invalidPincode');
    }
    if (!trimmedPhone) {
      return res.redirect('/addresses?error=phoneRequired');
    }
    const cleanPhone = trimmedPhone.replace(/[\s\-\(\)\+]/g, '');  // Strip non-digits
    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.redirect('/addresses?error=invalidPhone');
    }
    if (!trimmedAllPhone) {
      return res.redirect('/addresses?error=allPhoneRequired');
    }
    const cleanAllPhone = trimmedAllPhone.replace(/[\s\-\(\)\+]/g, '');  // Strip non-digits
    if (!/^\d{10}$/.test(cleanAllPhone)) {
      return res.redirect('/addresses?error=invalidAllPhone');
    }
    
    // CHANGE: Removed redundant check since validations above cover it

    let addressDoc = await Address.findOne({ userId });
    if (!addressDoc) addressDoc = new Address({ userId, address: [] });

    // If coming from checkout, make this address default
    const isCheckout = req.query.redirect === "checkout";

    // If isCheckout, unset any previous default
    if (isCheckout && addressDoc.address.length > 0) {
      addressDoc.address.forEach(a => (a.default = false));
    }

    addressDoc.address.push({
      addressType,
      name: trimmedName,
      city: trimmedCity,
      landMark: trimmedLandMark,
      state: trimmedState,
      pincode: pincodeNum,
      phone: trimmedPhone,  // CHANGE: Use trimmed but formatted original for display
      allPhone: trimmedAllPhone,  // CHANGE: Use trimmed but formatted original for display
      default: isCheckout ? true : false
    });

    await addressDoc.save();

    // Redirect back based on ?redirect=checkout
    if (isCheckout) return res.redirect("/checkout");
    else return res.redirect("/addresses");

  } catch (err) {
    console.log("Error in addAddress:", err);
    res.redirect("/pageNotFound");
  }
};

const getEditAddress = async (req, res) => {
  try {
    let userId;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      console.log("No user found in getEditAddress - redirecting to login");
      return res.redirect("/login");
    }

    const index = req.params.id;

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address[index]) {
      console.log("Invalid address index or no addressDoc in getEditAddress");
      return res.redirect("/addresses");
    }
    const address = addressDoc.address[index];

    res.render("edit-address", {
      user: req.user,
      addresses: addressDoc.address,
      address,
      index
    });
  } catch (err) {
    console.log("Error in getEditAddress:", err);
    res.redirect("/pageNotFound");
  }
};

const updateAddress = async (req, res) => {
  try {
    let userId;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      console.log("No user found in updateAddress - redirecting to login");
      return res.redirect("/login");
    }

    const { id } = req.params;
    const { addressType, name, city, landMark, state, pincode, phone, allPhone } = req.body;
    
    const trimmedName = (name || '').trim();
    const trimmedCity = (city || '').trim();
    const trimmedState = (state || '').trim();
    const trimmedLandMark = (landMark || '').trim();
    const trimmedPhone = (phone || '').trim();
    const trimmedAllPhone = (allPhone || '').trim();
    const pincodeNum = pincode ? Number(pincode) : NaN;
    
    if (!addressType) {
      return res.redirect(`/addresses/edit/${id}?error=addressTypeRequired`);  
    }
    if (!trimmedName) {
      return res.redirect(`/addresses/edit/${id}?error=nameRequired`);
    }
    if (!/^[a-zA-Z\s]{2,}$/.test(trimmedName)) {
      return res.redirect(`/addresses/edit/${id}?error=invalidName`);
    }
    if (!trimmedCity) {
      return res.redirect(`/addresses/edit/${id}?error=cityRequired`);
    }
    if (!/^[a-zA-Z\s]+$/.test(trimmedCity)) {
      return res.redirect(`/addresses/edit/${id}?error=invalidCity`);
    }
    if (!trimmedState) {
      return res.redirect(`/addresses/edit/${id}?error=stateRequired`);
    }
    if (!/^[a-zA-Z\s]+$/.test(trimmedState)) {
      return res.redirect(`/addresses/edit/${id}?error=invalidState`);
    }
    if (!trimmedLandMark) {
      return res.redirect(`/addresses/edit/${id}?error=landMarkRequired`);
    }
    if (trimmedLandMark.length < 2) {
      return res.redirect(`/addresses/edit/${id}?error=invalidLandMark`);
    }
    if (!pincodeNum || isNaN(pincodeNum) || pincodeNum.toString().length !== 6) {
      return res.redirect(`/addresses/edit/${id}?error=invalidPincode`);
    }
    if (!trimmedPhone) {
      return res.redirect(`/addresses/edit/${id}?error=phoneRequired`);
    }
    const cleanPhone = trimmedPhone.replace(/[\s\-\(\)\+]/g, '');  
    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.redirect(`/addresses/edit/${id}?error=invalidPhone`);
    }
    if (!trimmedAllPhone) {
      return res.redirect(`/addresses/edit/${id}?error=allPhoneRequired`);
    }
    const cleanAllPhone = trimmedAllPhone.replace(/[\s\-\(\)\+]/g, ''); 
    if (!/^\d{10}$/.test(cleanAllPhone)) {
      return res.redirect(`/addresses/edit/${id}?error=invalidAllPhone`);
    }
    
    if (!addressType || !name || !city || !landMark || !state || !pincode || !phone || !allPhone) {
      console.log("Validation failed in updateAddress: Missing fields", req.body);
      res.redirect('/addresses');
      return;
    }
    
    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address[id]) {
      console.log("Invalid address ID in updateAddress");
      res.redirect("/addresses");
      return;
    }
    
    addressDoc.address[id] = {
      addressType,
      name: trimmedName,
      city: trimmedCity,
      landMark: trimmedLandMark,
      state: trimmedState,
      pincode: pincodeNum,
      phone: trimmedPhone,  
      allPhone: trimmedAllPhone  
    };
    
    await addressDoc.save();
    console.log("Address updated successfully for user:", userId);
    res.redirect('/addresses?updated=true'); 
  } catch (error) {
    console.log("Error in updateAddress:", error);
    res.redirect("/pageNotFound");
  }
};

const deleteAddress = async (req, res) => {
  try {
    // Safeguard: Get userId from req.user or session
    let userId;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else if (req.session && req.session.userId) {
      userId = req.session.userId;
    } else {
      console.log("No user found in deleteAddress - redirecting to login");
      return res.redirect("/login");
    }

    const { id } = req.params;
    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address[id]) {
      console.log("Invalid address ID in deleteAddress");
      res.redirect("/addresses");
      return;
    }
    
    addressDoc.address.splice(id, 1);
    await addressDoc.save();
    
    console.log("Address deleted successfully for user:", userId);
   res.redirect('/addresses?deleted=true');
  } catch (error) {
    console.log("Error in deleteAddress:", error);
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
  changeEmail,
  changeEmailvalid,
  verifyEmailOtp,
  updateEmail,
  changePassword,
  changepasswordvalid,
  verifyChangepassOtp,
  getAddresses,
  addAddress,
  getEditAddress,
  updateAddress,
  deleteAddress
};