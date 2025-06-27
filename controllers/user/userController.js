
const User = require("../../models/userSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");


const loadHomepage = async (req,res)=>{
  try{
         return res.render("home");
  }catch (error){
    console.log("Home page not found");
    res.status(500).send("server error");
  }
}


const loadSignup = async(req,res)=>{
  try{
    // return res.render("signup",{msg1:req.flash('err1'),msg2:req.flash('err2'),msg3:req.flash('err3'),msg4:req.flash('err4'),msg5:req.flash('err5')});
return res.render("signup", {
  msg1: req.flash("err1")[0] || "",
  msg2: req.flash("err2")[0] || "", 
  msg3: req.flash("err3")[0] || "",
  msg4: req.flash("err4")[0] || "",
  msg5: req.flash("err5")[0] || "",
});
  }catch(error){
    console.log("Home page not loading:",error);
    res.status(500).send("Server Error");
  }
}

const loadShopping = async (req,res)=>{
  try{
    return res.render("shop");

  }catch(error){
    console.log("shopping page not loading:",error);
    res.status(500).send("Server Error")
  }
}

const pageNotFound = async (req, res) => {
  try {
    res.status(404).render("page-404"); 
  } catch (error) {
    console.log("Error rendering 404 page:", error);
    res.status(500).send("Internal Server Error");
  }
};

function generateOtp(){
  return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp){
  try{
     
    const transporter = nodemailer.createTransport({
    service:"gmail",
    port:587,
    secure:false,
    requireTLS:true,
    auth:{
      user:process.env.NODEMAILER_EMAIL,
      pass:process.env.NODEMAILER_PASSWORD
    }

   })

   const info = await transporter.sendMail({
    from:process.env.NODEMAILER_EMAIL,
    to:email,
    subject:"Verify your account",
    text:`Your OTP is ${otp}`,
    html:`<b> Your OTP : ${otp} </b>`,
   })

   return info.accepted.length >0

  }catch (error){
   console.error("Error sending email",error);
   return false;
  }
}


const Signup = async(req,res)=>{
  try{
    const {name,phone,email,password,cPassword} = req.body;
console.log(req.body)
const emailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

    if (!name || name.trim() === '') {
      req.flash('err1', 'Invalid credentials: Name is empty');
      return res.redirect('/signup');
    }

    if (!email || !emailPattern.test(email)) {
      req.flash('err2', 'Email is not valid');
      return res.redirect('/signup');
    }

        if(phone.length<10 || phone.length>10){
        req.flash('err3',' Phone number must be 10 digits')
       return res.redirect('/signup')
     
     }

    if (!password || password.length < 6 || password !== cPassword) {
  if (!password || password.length < 6) {
    req.flash('err5', 'Password must be at least 6 characters long');
  } else if (password !== cPassword) {
    req.flash('err4', 'Passwords do not match');
  }
  return res.redirect('/signup');
}

    
    const findUser = await User.findOne({email});
    if(findUser){
      // return res.render("signup",{message:"User with this email alreaady exists"});
     req.flash("err2", "Email already exists");
  return res.redirect("/signup");
    }

    const otp = generateOtp();
;
    const emailSent = await sendVerificationEmail(email,otp);


    if(!emailSent){

      return res.json("email-error")
    }

    req.session.userOtp = otp;
    req.session.userData = {name,phone,email,password};
  
     
    res.render("verify-otp");
    console.log("OTP Sent",otp);

  }catch(error){
    console.error("signup error",error);
    res.redirect("/pageNotFound")
  }
}


const securePasswrod = async (password)=>{
  try{
    const passwordHash = await bcrypt.hash(password,10)
    return passwordHash;
  }catch (error){

  }
}



const verifyOtp = async (req,res)=>{
  try{
   const {otp} = req.body;
   console.log(otp);

   if(otp === req.session.userOtp){
    const user = req.session.userData
    const passwordHash = await securePasswrod(user.password);
    
    const saveUserData = new User({
      name:user.name,
      email:user.email,
      phone:user.phone,
      password:passwordHash,

    })

    await saveUserData.save();
    req.session.user = saveUserData._id;
    res.json({success:true,redirectUrl:"/"})
    
  }else {
    res.status(400).json({success:false,message:"Invalid OTP, Please try again"})
  }
  
  }catch(error){
       console.error("Error Verifying OTP",error);
       res.status(500).json({success:false,message:"An error occured"})
  }
}


const resendOtp = async (req,res)=>{
  try{
    const {email} = req.session.userData;
    if(!email){
      return res.status(400).json({success:false,message:"Email not found in session"})
    }
    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email,otp);
    if(emailSent){
      console.log("Resend OTP:" , otp);
      res.status(200).json({success:true,message:"OTP Resend Successfully"})
    }else{
      res.status(500).json({success:false,message:"Failed to resend OTP. Please try again"});
    }

  }catch (error){
   console.error("Error resending OTP",error);
   res.status(500).json({success:false,message:"Internal Server Error.Please try again"});

  }
}


const loadLogin = async (req,res)=>{
  try {
    if(!req.session.user){
      // return res.render("login")
          return res.render("login",{msg1:req.flash('err1')});

    }else{
      res.redirect("/")
    }
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}



const login = async(req,res)=>{
  try {
    const {email,password} = req.body;
    console.log(req.body)
    const findUser = await User.findOne({isAdmin:0,email:email});

    if(!findUser){
      // return res.render("login",{message:"User not found"})
      req.flash('err1', 'Invalid credentials');
      return res.redirect("/login")
    }

    if(findUser.isBlocked){
      return res.render("login",{message:"User is blocked by admin"})
    }
    console.log(findUser);

    const passwordMatch = await bcrypt.compare(password,findUser.password);

    if(!passwordMatch){
      return res.render("login",{message:"Incorrect password"})
    }

    req.session.user = findUser._id;
    console.log("redirectiong")
    res.redirect("/")

  } catch (error) {
    
    console.error("login error",error);
    res.render("login",{message:"login failed. Please try again later"})
  }
}

module.exports ={
    loadHomepage,
    pageNotFound,
    loadSignup,
    Signup,
    verifyOtp, 
    resendOtp,
    loadLogin,
    login,
    loadShopping,
};