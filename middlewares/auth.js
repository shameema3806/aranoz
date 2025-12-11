const User = require("../models/userSchema");

// const userAuth = (req,res,next)=>{

//     if(req.session.user){

//     User.findById(req.session.user)
//     .then(data =>{
//         if(data && !data.isBlocked){
//             next();
//         }else{
//             res.redirect("/login?blocked=true")
//             console.log("Auth middleware running, req.user:", req.user);
//         }
//     })
//     .catch(error =>{
//         console.log("Error in user Auth middleware",error);
//         res.status(500).send("Internal server error")
//     })
// }else{
//     res.redirect("/login")
// }
// }



const userAuth = (req, res, next) => {
  if (req.session && req.session.user) {  // Ensure session exists
    User.findById(req.session.user)  // Assuming req.session.user is the _id string
      .then(data => {
        if (data && !data.isBlocked) {
          req.user = data;  // ATTACH FULL USER OBJECT TO REQ (critical fix!)
        //   console.log("Auth successful: User attached", data._id);  // Debug log
          next();
        } else {
          console.log("User blocked or not found - redirecting");
          req.session.destroy();  // Clear invalid session
          res.redirect("/login?blocked=true");
        }
      })
      .catch(error => {
        console.log("Error in user Auth middleware:", error);
        res.status(500).send("Internal server error");
      });
  } else {
    console.log("No session.user - redirecting to login");
    res.redirect("/login");
  }
};

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