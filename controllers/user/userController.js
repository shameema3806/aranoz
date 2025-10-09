
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

const loadHomepage = async (req, res) => {
  try {
    const userId = req.session.user;  
    const categories = await Category.find({ isListed: true });

    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map(category => category._id) },
      quantity: { $gt: 0 }
    });

    productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
    productData = productData.slice(0, 4);

    res.set("Cache-Control", "no-store");

    if (userId) {
      const userData = await User.findById(userId);
      res.render("home", { user: userData, products: productData });
    } else {
      res.render("home", { products: productData }); 
    }
  } catch (error) {
    console.log("Home page not found:", error); 
    res.status(500).send("Server error");
  }
};


const loadSignup = async(req,res)=>{
  try{
    // return res.render("signup",{msg1:req.flash('err1'),msg2:req.flash('err2'),msg3:req.flash('err3'),msg4:req.flash('err4'),msg5:req.flash('err5')});
   res.set('Cache-Control', 'no-store');
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

// const loadShopping = async (req,res)=>{
//   try{
//     res.set("Cache-Control", "no-store");  
//     return res.render("shop");

//   }catch(error){
//     console.log("shopping page not loading:",error);
//     res.status(500).send("Server Error")
//   }
// }
const loadShopping = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });

    const filter = {
      isBlocked: false,
      quantity: { $gt: 0 },
      category: { $in: categories.map(cat => cat._id) }
    };

    // Optional: filter by category
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Optional: search by name
    if (req.query.search) {
      const regex = new RegExp(req.query.search, "i");
      filter.productName  = regex;
    }

    const products = await Product.find(filter);

    res.set("Cache-Control", "no-store");
    const userId = req.session.user;
    const user = userId ? await User.findById(userId) : null;

    res.render("shop", {
      user,
      categories,
      products,
      selectedCategory: req.query.category || "",
      searchQuery: req.query.search || ""
    });

  } catch (error) {
    console.log("Shopping page not loading:", error);
    res.status(500).send("Server Error");
  }
};

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

const showVerifyOtpPage = (req, res) => {
    res.render('verify-otp'); 
};


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
      res.set('Cache-Control', 'no-store');
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
    console.log(req.body);

    const findUser = await User.findOne({isAdmin:0,email:email});

    if(!findUser){
      req.flash('err1', 'Invalid credentials');
      return res.redirect("/login")
    }

       if (findUser.isBlocked) {
            req.flash('err1', 'User is blocked by admin');
            return res.redirect('/login');
        }
    console.log(findUser);

    const passwordMatch = await bcrypt.compare(password,findUser.password);
    console.log('Password Match:', passwordMatch);

    if (!passwordMatch) {
            req.flash('err1', 'Incorrect password');
            return res.redirect('/login');
        }

        req.session.user = findUser._id;
        console.log('Redirecting to home');
        res.redirect('/');

    } catch (error) {
        console.error('Login error:', error);
        req.flash('err1', 'Login failed. Invalid credentials');
        res.redirect('/login');
    }
}


const logout = async (req,res)=>{
  try {
    req.session.destroy((err)=>{
      if(err){
       console.log("session destruction error",err.message);
       return res.redirect("/pageNotFound");
      }
      return res.redirect("/login")
    })
  } catch (error) {
    console.log("logout error",error);
    res.redirect("/pageNotFound")
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
    logout,
    loadShopping,
  
};