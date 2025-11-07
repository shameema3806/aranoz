const User = require("../models/userSchema");

const userAuth = (req,res,next)=>{

    if(req.session.user){

    User.findById(req.session.user)
    .then(data =>{
        if(data && !data.isBlocked){
            next();
        }else{
            res.redirect("/login")
        }
    })
    .catch(error =>{
        console.log("Error in user Auth middleware",error);
        res.status(500).send("Internal server error")
    })
}else{
    res.redirect("/login")
}
}


// const userAuth = async (req, res, next) => {
//   try {
//     if (!req.session.user) {
//       console.log("❌ No session user found, redirecting to login");
//       return res.redirect("/login");
//     }

//     const user = await User.findById(req.session.user);
//     if (!user) {
//       console.log("❌ User not found, redirecting to login");
//       return res.redirect("/login");
//     }

//     if (user.isBlocked) {
//       console.log("🚫 User is blocked, redirecting to login");
//       return res.redirect("/login");
//     }

//     next();
//   } catch (err) {
//     console.error("Error in userAuth middleware:", err);
//     res.status(500).send("Internal server error");
//   }
// };


const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(date =>{
        if(date){
            next();
        }else{
            res.redirect("/admin/login")
        }
    }) 


    .catch(error=>{
    console.log("Error in adminauth middleware ",error)
     res.status(500).send("Internal server error")
       
})

}

module.exports = {
    userAuth,
    adminAuth
}