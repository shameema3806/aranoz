
const Coupon = require("../../models/couponSchema");
const { Schema } = require('mongoose');
const mongoose = require("mongoose");
const Joi = require('joi'); 

// Validation Schema
const couponSchema = Joi.object({
  code: Joi.string().trim().optional(),
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required(),
  minOrderAmount: Joi.number().min(0).default(0),
  maxUses: Joi.number().min(0).allow(null),
  expiryDate: Joi.date().min('now').required(),
  isActive: Joi.boolean().default(true),
});

const getcoupon = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const searchQuery = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build query
    let query = { isActive: true }; 
    if (searchQuery) {
      query.code = { $regex: searchQuery, $options: 'i' };
    }

    const totalDocs = await Coupon.countDocuments(query);
    const coupons = await Coupon.find(query)
      .populate('createdBy', 'name')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalDocs / limit);

    res.render('couponpage', {
      coupons,
      currentPage: page,
      itemsPerPage: limit,
      totalPages,
      searchQuery, 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const createCoupon = async (req, res) => {
  console.log('POST /admin/coupon hit!');
  console.log('req.body:', req.body);
  console.log('req.admin:', req.admin);  

  try {
    // Generate code if missing (mimics pre-save hook)
    if (!req.body.code) {
      req.body.code = `COUPON-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    const { error } = couponSchema.validate(req.body);
    if (error) {
      console.log('Joi validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check uniqueness (after code gen)
    const existing = await Coupon.findOne({ code: req.body.code });
    if (existing) return res.status(409).json({ error: 'Coupon code already exists' });

    const couponData = {
      ...req.body,
      createdBy: req.admin?._id,  
    };
    console.log('couponData before save:', couponData);

    const coupon = new Coupon(couponData);
    await coupon.save();
    console.log('Saved coupon ID:', coupon._id);

    await coupon.populate('createdBy userId');
    console.log('Populated coupon:', coupon);

    res.status(201).json({ message: 'Coupon created successfully', data: coupon });
  } catch (err) {
    console.error('Full createCoupon error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

// PUT /admin/coupons/:id - Edit
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = couponSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const coupon = await Coupon.findOne({ _id: id, createdBy: req.admin?._id || req.user?._id });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

    // Update fields
    Object.assign(coupon, req.body);
    await coupon.save();
    await coupon.populate('createdBy userId');

    res.json({ message: 'Coupon updated successfully', data: coupon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /admin/coupons/:id - Deactivate
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findOne({ _id: id, createdBy: req.admin?._id || req.user?._id });

    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

    if (coupon.usedCount > 0) {
      return res.status(409).json({ 
        error: 'Coupon has been used. Confirm to deactivate.',
        canHardDelete: false 
      });
    }

    coupon.isActive = false;
    await coupon.save();

    res.json({ message: 'Coupon deactivated successfully', data: coupon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getcoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};