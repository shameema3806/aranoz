// const Coupon = require("../../models/couponSchema");
// const { Schema } = require('mongoose');
// const mongoose = require("mongoose");
// const Joi = require('joi'); 



const Coupon = require("../../models/couponSchema");
const { Schema } = require('mongoose');
const mongoose = require("mongoose");
const Joi = require('joi');
const Wallet = require("../../models/walletSchema");


// Validation for CREATE
const createCouponSchema = Joi.object({
  code: Joi.string().trim().optional().min(4).max(20),
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required(),
  minCartValue: Joi.number().min(0).default(0),
  maxDiscount: Joi.number().min(0).allow(null).custom((value, helpers) => {
    const type = helpers.state.ancestors[0].discountType;
    if (type === 'percentage' && value !== null && value > 100) {
      return helpers.error('any.invalid', { message: 'Max discount cannot exceed 100% for percentage coupons' });
    }
    return value;
  }),          
  expiryDate: Joi.date().min('now').required(),
});

const updateCouponSchema = Joi.object({
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required(),
  minCartValue: Joi.number().min(0).default(0),
  maxDiscount: Joi.number().min(0).allow(null).custom((value, helpers) => {
    const type = helpers.state.ancestors[0].discountType;
    if (type === 'percentage' && value !== null && value > 100) {
      return helpers.error('any.invalid', { message: 'Max discount cannot exceed 100% for percentage coupons' });
    }
    return value;
  }),
  expiryDate: Joi.date().required(),
});


const getcoupon = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.limit) || 5; 
    const searchQuery = req.query.search?.trim() || '';
    const skip = (page - 1) * itemsPerPage;

    let query = {};
    if (searchQuery) {
      query = {
        $or: [
          { code: { $regex: searchQuery, $options: 'i' } },
          { discountType: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }

    const totalDocs = await Coupon.countDocuments(query);
    query.couponType = "regular";
    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage);

    const totalPages = Math.ceil(totalDocs / itemsPerPage);

    res.render('couponpage', {
      coupons,
      currentPage: page,
      itemsPerPage,               // ← matches EJS <%= itemsPerPage %>
      totalPages,
      searchQuery,
    });
  } catch (err) {
    console.error('Error in getcoupon:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


// POST /admin/coupon - Create coupon
const createCoupon = async (req, res) => {
  console.log('POST /admin/coupon → Body:', req.body);

  try {
    // Auto-generate code if not provided
    if (!req.body.code?.trim()) {
      req.body.code = `COUPON-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    } else {
      req.body.code = req.body.code.trim().toUpperCase();
    }

    const { error } = createCouponSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.details.map(d => d.message).join(', ')
      });
    }

    // Prevent duplicate code
    const existing = await Coupon.findOne({ code: req.body.code });
    if (existing) {
      return res.status(409).json({ error: 'Coupon code already exists' });
    }

    const coupon = new Coupon({
      ...req.body,
      createdBy: req.admin?._id || null,  
      createdAt: new Date(),
    });

    await coupon.save();

    res.status(201).json({
      message: 'Coupon created successfully',
      data: coupon.toObject()
    });
  } catch (err) {
    console.error('Create coupon error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};


// PUT /admin/coupon/:id - Update coupon
const updateCoupon = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = updateCouponSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.details.map(d => d.message).join(', ')
      });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    // Optional: check ownership (uncomment if needed)
    // if (coupon.createdBy?.toString() !== req.admin?._id?.toString()) {
    //   return res.status(403).json({ error: 'Not authorized' });
    // }

    // Update fields (code is NOT updated - readonly in frontend)
    coupon.discountType = req.body.discountType;
    coupon.discountValue = req.body.discountValue;
    coupon.minCartValue = req.body.minCartValue ?? 0;
    coupon.maxDiscount = req.body.maxDiscount ?? null;
    coupon.expiryDate = new Date(req.body.expiryDate);
    // isActive is NOT updated from frontend

    await coupon.save();

    res.json({
      message: 'Coupon updated successfully',
      data: coupon.toObject()
    });
  } catch (err) {
    console.error('Update coupon error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


// DELETE /admin/coupon/:id - Real delete (matches current frontend)
const deleteCoupon = async (req, res) => {
  const { id } = req.params;

  try {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    // Optional: ownership check
    // if (coupon.createdBy?.toString() !== req.admin?._id?.toString()) {
    //   return res.status(403).json({ error: 'Not authorized' });
    // }

    await Coupon.deleteOne({ _id: id });

    res.json({ message: 'Coupon deleted successfully' });
  } catch (err) {
    console.error('Delete coupon error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


const getrefferal = async (req, res) => {
  try {
    res.render("referraloffer");
  } catch (error) {
    console.error('Referral page error:', error);
    res.status(500).send('Server error');
  }
};

module.exports = {
  getcoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getrefferal
};