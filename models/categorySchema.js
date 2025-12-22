const mongoose = require("mongoose");
const {Schema} = mongoose;

const categorySchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true,
        trim: true,
    },
    description:{
         type:String,
        required:true,
    },
    isListed:{
         type:Boolean,
        default:true,
    },
    offer:{
        type:Number,
         default:null,  
         min: 0,
         max: 100
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
})

const Category = mongoose.model("Category",categorySchema);
module.exports = Category;