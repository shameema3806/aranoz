const mongoose = require('mongoose');
const {Schema} = mongoose;


const brandSchema = new Schema({

  brandName: {
    type: String,
    required: true,
  },
  brandImage:{
    type:[String],
    required:true 
  },
  isBlocked:{
    type:Boolean,
    dafault:false 
  },
  createdAt:{
    type:Date,
    dafault :Date.now 
  }
  
});
 
const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand;
