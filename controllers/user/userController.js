
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require('../../models/cartSchema');
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { render } = require("ejs");
const { processReferralOnRegister } = require('../user/refferralController');
const crypto = require("crypto");

// Generate referral code
function generateReferralCode(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Ensure uniqueness in DB
async function generateUniqueReferralCode() {
  let code;
  let exists = true;
  while (exists) {
    code = generateReferralCode();
    exists = await User.findOne({ referalCode: code });
  }
  return code;
}


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
    // productData = productData.slice(0,4);

    // Fetch only products with offers
    const offersPage = parseInt(req.query.offersPage) || 1;
    const offersLimit = 4;
    const offersSkip = (offersPage - 1) * offersLimit;

    const featuredOffersRaw = await Product.find({
      isBlocked: false,
      quantity: { $gt: 0 },
      $or: [
        { offer: { $gt: 0 } },
        { category: { $exists: true, $ne: null } }  // To populate and check category offer
      ]
    })
      .populate('category')
      .sort({ createdAt: -1 })
      .lean();

    //  effectiveOffer for all
    const allFeaturedOffers = featuredOffersRaw
      .map(product => {
        const now = new Date();
        const productOffer = (product.offer && (!product.offerExpiry || product.offerExpiry > now)) ? product.offer : 0;
        const categoryOffer = product.category && product.category.offer && (!product.category.offerExpiry || product.category.offerExpiry > now)
          ? product.category.offer
          : 0;
        const effectiveOffer = Math.max(productOffer, categoryOffer);
        product.effectiveOffer = effectiveOffer > 0 ? effectiveOffer : null;
        product.effectiveOfferPrice = effectiveOffer > 0
          ? (product.salePrice * (1 - effectiveOffer / 100)).toFixed(2)
          : null;
        return product;
      })
      .filter(product => product.effectiveOffer > 0);  // Only include with active offers

    const totalOffers = allFeaturedOffers.length;
    const totalOffersPages = Math.ceil(totalOffers / offersLimit);
    const featuredOffers = allFeaturedOffers.slice(offersSkip, offersSkip + offersLimit);  // Paginate

    res.set("Cache-Control", "no-store");

    if (userId) {
      const userData = await User.findById(userId);
      res.render("home", {
        user: userData,
        products: productData,
        featuredOffers,
        currentOffersPage: offersPage,
        totalOffersPages
      });
    } else {
      res.render("home", {
        products: productData,
        featuredOffers,
        currentOffersPage: offersPage,
        totalOffersPages
      });
    }
  } catch (error) {
    console.log("Home page not found:", error);
    res.status(500).send("Server error");
  }
};

// const loadHomepage = async (req, res) => {
//   try {
//     const userId = req.session.user;  
//     const categories = await Category.find({ isListed: true });

//     let productData = await Product.find({
//       isBlocked: false,
//       category: { $in: categories.map(category => category._id) },
//       quantity: { $gt: 0 }
//     });

//     productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
//     // productData = productData.slice(0,4);


//     // Fetch featured offers
//     const featuredOffers = await Product.find({ 
//       isBlocked: false, 
//       quantity: { $gt: 0 },
//       $or: [ 
//         { offer: { $gt: 0 } }, 
//         { category: { $exists: true, $ne: null } }  
//       ] 
//     })
//     .populate('category')
//     .limit(4)
//     .sort({ createdAt: -1 })
//     .lean();

//     featuredOffers.forEach(product => {
//       const now = new Date();
//       const productOffer = (product.offer && (!product.offerExpiry || product.offerExpiry > now)) ? product.offer : 0;
//       const categoryOffer = product.category && product.category.offer && (!product.category.offerExpiry || product.category.offerExpiry > now) 
//         ? product.category.offer 
//         : 0;
//       const effectiveOffer = Math.max(productOffer, categoryOffer);
//       product.effectiveOffer = effectiveOffer > 0 ? effectiveOffer : null;
//       product.effectiveOfferPrice = effectiveOffer > 0 
//         ? (product.salePrice * (1 - effectiveOffer / 100)).toFixed(2) 
//         : null;
//     });

//     res.set("Cache-Control", "no-store");

//     if (userId) {
//       const userData = await User.findById(userId);
//       res.render("home", { user: userData, products: productData ,featuredOffers});
//     } else {
//       res.render("home", { products: productData ,featuredOffers}); 
//     }
//   } catch (error) {
//     console.log("Home page not found:", error); 
//     res.status(500).send("Server error");
//   }
// };


const loadSignup = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.render("signup", {
      msg1: req.flash("err1")[0] || "",
      msg2: req.flash("err2")[0] || "",
      msg3: req.flash("err3")[0] || "",
      msg4: req.flash("err4")[0] || "",
      msg5: req.flash("err5")[0] || "",
      msg6: req.flash("err6")[0] || "",
    });
  } catch (error) {
    console.log("Home page not loading:", error);
    res.status(500).send("Server Error");
  }
}



const loadShopping = async (req, res) => {
  try {

    const categories = await Category.find({ isListed: true }).lean();

    let selectedCategory = null;
    if (req.query.category) {
      const category = await Category.findById(req.query.category).lean();
      if (!category || !category.isListed) {
        return res.redirect('/shop');
      }
      selectedCategory = req.query.category;
    }

    const filter = {
      isBlocked: false,
      quantity: { $gt: 0 },
      category: { $in: categories.map(cat => cat._id) },
    };

    if (selectedCategory) {
      filter.category = selectedCategory;
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.priceRange) {
      switch (req.query.priceRange) {
        case 'under5000':
          filter.salePrice = { $lt: 5000 };
          break;
        case '5000to10000':
          filter.salePrice = { $gte: 5000, $lte: 10000 };
          break;
        case 'above10000':
          filter.salePrice = { $gt: 10000 };
          break;
        case "above20000":
          filter.salePrice = { $gt: 20000 };
      }
    }

    if (req.query.search && req.query.search.trim()) {
      filter.productName = {
        $regex: req.query.search.trim(),
        $options: 'i',
      };
    }


    let sort = { createdAt: -1 };
    switch (req.query.sort) {
      case 'priceLow':
        sort = { salePrice: 1 };
        break;
      case 'priceHigh':
        sort = { salePrice: -1 };
        break;
      case 'az':
        sort = { productName: 1 };
        break;
      case 'za':
        sort = { productName: -1 };
        break;
      case 'new':
        sort = { createdAt: -1 };
        break;
    }


    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    const totalProducts = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('category')
      .collation({ locale: 'en', strength: 2 })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();


    const processedProducts = products.map(product => {
      const now = new Date();  // NEW: Current date for expiry checks
      const productOffer = (product.offer && (!product.offerExpiry || product.offerExpiry > now)) ? product.offer : 0;  // NEW: Product-level offer with expiry
      const categoryOffer = product.category && product.category.offer && (!product.category.offerExpiry || product.category.offerExpiry > now)
        ? product.category.offer
        : 0;  // NEW: Category-level offer with expiry (requires populate)
      const effectiveOffer = Math.max(productOffer, categoryOffer);  // NEW: Max of both
      const effectiveOfferPrice = effectiveOffer > 0
        ? Math.round(product.salePrice * (1 - effectiveOffer / 100))  // NEW: Computed price if offer valid
        : null;

      product.effectiveOffer = effectiveOffer > 0 ? effectiveOffer : null;  // NEW: Set only if >0
      product.effectiveOfferPrice = effectiveOfferPrice;  // NEW: Attach computed price

      return product;
    });
    const totalPages = Math.ceil(totalProducts / limit);

    const buildUrl = (newParams = {}) => {
      const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
      for (const [k, v] of url.searchParams.entries()) {
        if (!newParams[k]) newParams[k] = v;
      }
      Object.entries(newParams).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
        else url.searchParams.delete(k);
      });
      return url.pathname + url.search;
    };

    let cartCount = 0;
    if (req.user) {
      const cart = await Cart.findOne({ userId: req.user._id });
      cartCount = cart ? cart.items.length : 0;
    }

    res.render('shop', {
      categories,
      products: processedProducts,
      // selectedCategory: req.query.category || null,
      selectedCategory,
      selectedPriceRange: req.query.priceRange || null,
      searchQuery: req.query.search || '',
      sort: req.query.sort || '',
      user: req.session.user ? await User.findById(req.session.user).lean() : null,
      page,
      totalPages,
      totalProducts,
      buildUrl,
      cartCount
    });
  } catch (error) {
    console.error('loadShopping error:', error);
    res.status(500).send('Server Error');
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

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {

    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }

    })

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b> Your OTP : ${otp} </b>`,
    })

    return info.accepted.length > 0

  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}


const Signup = async (req, res) => {
  try {
    const { name, phone, email, password, cPassword, referralCode } = req.body;

    console.log(req.body)

    const emailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

    //Validate referral code (optional)
    if (referralCode && !/^[a-zA-Z0-9]{4,12}$/.test(referralCode)) {
      if (req.headers['content-type'] === 'application/json') {
        return res.status(400).json({ msg6: 'Invalid referral code: Must be 4-12 alphanumeric characters' });
      }
      req.flash('err6', 'Invalid referral code: Must be 4-12 alphanumeric characters');
      return res.redirect('/signup');
    }

    if (!name || name.trim() === '') {
      req.flash('err1', 'Invalid credentials: Name is empty');
      return res.redirect('/signup');
    }

    if (!email || !emailPattern.test(email)) {
      req.flash('err2', 'Email is not valid');
      return res.redirect('/signup');
    }

    if (phone.length < 10 || phone.length > 10) {
      req.flash('err3', ' Phone number must be 10 digits')
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

    let findUser;
    try {
      findUser = await User.findOne({ email });
      console.log(' DB Query SUCCEEDED. User exists?', !!findUser);
    } catch (dbError) {
      console.error(' DB Query FAILED:', dbError);
      req.flash('err2', 'Database check failed—try again');
      return res.redirect('/signup');
    }
    if (findUser) {
      console.log(' Redirecting: User already exists');
      req.flash("err2", "Email already exists");
      return res.redirect("/signup");
    }

    const otp = generateOtp();
    console.log("Generated OTP:", otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json("email-error")
    }

    req.session.userOtp = otp;
    req.session.userData = {
      name, phone, email, password, referralCode: referralCode || null,
      referralToken: req.query?.ref || null
    };


    req.session.save(err => {
      if (err) console.error("Session save error:", err);
      console.log("OTP Saved in session:", otp);
      res.render("verify-otp");
    });

  } catch (error) {
    console.error("signup error", error);
    res.redirect("/pageNotFound")
  }
}


const securePasswrod = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    return passwordHash;
  } catch (error) {

  }
}

const showVerifyOtpPage = (req, res) => {
  res.render('verify-otp');
};


// const verifyOtp = async (req, res) => {
//   try {
//     const { otp } = req.body;
//     console.log(otp);

//     if (!otp || otp.length !== 6) {
//       return res.status(400).json({ success: false, message: "OTP must be exactly 6 characters" });
//     }


//     if (otp === req.session.userOtp) {
//       const user = req.session.userData
//       const passwordHash = await securePasswrod(user.password);


//       const referralCodeGenerated = generateReferralCode();


//       const newUser = await User.create({
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         password: passwordHash,
//         referalCode: referralCodeGenerated,
//       });

//       await processReferralOnRegister(
//         newUser._id,
//         user.referralToken,
//         user.referralCode
//       );

//       req.session.user = {
//         _id: newUser._id,
//         referalCode: referralCodeGenerated
//       };

//       res.json({ success: true, redirectUrl: "/" })

//     } else {
//       res.status(400).json({ success: false, message: "Invalid OTP, Please try again" })
//     }

//   } catch (error) {
//     console.error("Error Verifying OTP", error);
//     res.status(500).json({ success: false, message: "An error occured" })
//   }
// }

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp || otp.length !== 6) {
      return res.status(400).json({ success: false, message: "OTP must be exactly 6 characters" });
    }

    if (otp === req.session.userOtp) {
      const userData = req.session.userData;
      const passwordHash = await securePasswrod(userData.password);

      // Generate unique referral code
      const referralCodeGenerated = await generateUniqueReferralCode();

      // Create new user
      const newUser = await User.create({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: passwordHash,
        referalCode: referralCodeGenerated, // saved in DB
      });

      // Process referral if user used a referral code or token
      await processReferralOnRegister(
        newUser._id,
        userData.referralToken,
        userData.referralCode // user-entered referral code
      );

      // Save user info in session
      req.session.user = {
        _id: newUser._id,
        referalCode: referralCodeGenerated
      };

      return res.json({ success: true, redirectUrl: "/" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
    }
  } catch (error) {
    console.error("Error Verifying OTP", error);
    return res.status(500).json({ success: false, message: "An error occurred" });
  }
};


const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" })
    }
    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP:", otp);
      res.status(200).json({ success: true, message: "OTP Resend Successfully" })
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again" });
    }

  } catch (error) {
    console.error("Error resending OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error.Please try again" });

  }
}


const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      res.set('Cache-Control', 'no-store');
      return res.render("login", { msg1: req.flash('err1') });

    } else {
      res.redirect("/")
    }
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}



const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);

    const findUser = await User.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      req.flash('err1', 'Invalid credentials');
      return res.redirect("/login")
    }

    if (findUser.isBlocked) {
      req.flash('err1', 'User is blocked by admin');
      return res.redirect('/login');
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      req.flash('err1', 'Incorrect password');
      return res.redirect('/login');
    }

    req.session.user = findUser._id;
    res.redirect('/');

  } catch (error) {
    req.flash('err1', 'Login failed. Invalid credentials');
    res.redirect('/login');
  }
}


const logout = async (req, res) => {
  try {
    req.session.user = null;
    return res.redirect("/login");
  }
  catch (error) {
    console.log("logout error", error);
    res.redirect("/pageNotFound")
  }
}





module.exports = {
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