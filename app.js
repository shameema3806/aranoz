const express = require("express");
const app = express();
const path = require("path");
const session = require("express-session")
const passport = require("./config/passport")
const env = require("dotenv").config();
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const flash = require('connect-flash');
const adminRouter = require("./routes/adminRouter");
db();


app.use(express.static(path.join(__dirname, "public")));
app.use("/public", express.static(path.join(__dirname, "uploads")));

app.use('/profile-images', express.static(path.join(__dirname, 'public/profile-images')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const allowedOrigins = [
  process.env.ALLOWED_ORIGIN_LOCAL,
  process.env.ALLOWED_ORIGIN_NGROK
].filter(Boolean)
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  next();
});


app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 72 * 60 * 60 * 1000
  }

}))

app.use(flash());
app.use((req, res, next) => {
  res.locals.msg1 = req.flash('error'); 
  next();
});


app.use(passport.initialize());
app.use(passport.session());


app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
  path.join(__dirname, "views/index"),

]);

console.log("Using views path:", app.get("views"));

app.use((req, res, next) => {
  res.locals.user = req.session.user ? req.session.userData : null;
  next();
});

app.use('/admin', adminRouter);
app.use("/", userRouter);

app.use((req, res) => {
  res.status(404).render("page-404");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

