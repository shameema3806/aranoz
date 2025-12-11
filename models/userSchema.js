const mongoose = require("mongoose");
const {Schema} = mongoose;

const userSchema = new Schema({
   name : {
       type:String,
       required : true
   },
   email: {
       type : String,
       required:true,
       unique: true,
   },
   phone : {
       type : String,
       required: false,
       unique: false,
       sparse:true,
       default:null
   },
    googleId: {
     type: String,
     unique: true,
    sparse: true
    },
    

   password : {
       type:String,
       required :false
   },
   isBlocked: {
       type : Boolean,
       default:false
   },
   isAdmin : {
       type: Boolean,
       default:false
   },
   cart: {
       type : Array
   },
   wallet:{
       type:Number,
       default:0,
   },
   wishlist:[{
       type:Schema.Types.ObjectId,
       ref:"Wishlist"
   }],
   orderHistory:[{
       type:Schema.Types.ObjectId,
       ref:"Order"
   }],
   addresses: [{
       addressType: {
           type: String,
           enum: ['home', 'work', 'other'],
           required: true
       },
       name: {
           type: String,
           required: true
       },
       city: {
           type: String,
           required: true
       },
       state: {
           type: String,
           required: true
       },
       landMark: {
           type: String,
           required: true
       },
       pincode: {
           type: Number,
           required: true
       },
       phone: {
           type: String,
           required: true
       },
       allPhone: {
           type: String,
           required: true
       },
       default: {
           type: Boolean,
           default: false
       }
   }],
   createdOn : {
       type:Date,
       default:Date.now,
   },
   referalCode:{
       type:String
   },
   redeemed:{
       type:Boolean
   },
   redeemedUsers: [{
       type: Schema.Types.ObjectId,
       ref:"User"
   }],
   searchHistory: [{
       category: {
           type: Schema.Types.ObjectId,
           ref:"Category",
       },
       brand: {
           type : String
       },
       searchOn : {
           type: Date,
           default: Date.now
       }
   }]
 
})




const User = mongoose.model("User",userSchema);


module.exports = User;