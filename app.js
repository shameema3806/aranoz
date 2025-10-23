const express = require("express");
const app = express();
const path = require("path");
const session = require("express-session")
const passport = require("./config/passport")
const env = require("dotenv").config();
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const flash = require('connect-flash');
const adminRouter = require("./routes/adminRouter")
db();

   app.use((req, res, next) => {
          res.setHeader("Access-Control-Allow-Origin", "https://dcad7fb668c6.ngrok-free.app");
          next();
        });
    
// app.use("/public",express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

app.use("/public", express.static(path.join(__dirname, "uploads")));
// app.use(express.static(path.join(__dirname, "public")));
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(flash());
console.log(__dirname,"this is form dirname");
app.use(express.json());
app.use(express.urlencoded({extended:true}));


app.use(session({
  secret:process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized:true,
  cookie:{
    secure:false,
    httpOnly:true,
    maxAge:72*60*60*1000
  }

}))


app.use(passport.initialize());
app.use(passport.session());


app.set("view engine","ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
  path.join(__dirname, "views/index"),

]);

console.log("Using views path:", app.get("views"));
// app.use(express.static(path.join(__dirname,"public")));

app.use((req, res, next) => {
  res.locals.user = req.session.user ? req.session.userData : null;
  next();
});




app.use("/",userRouter);
app.use('/admin',adminRouter);


const PORT=3000|| process.env.PORT ;
app.listen(PORT,() =>{
    console.log("server is running");
})

module.exports = app;