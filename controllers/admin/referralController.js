// controllers/admin/referralController.js
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const ReferralConfig = require("../../models/referralConfigSchema"); // Assuming this schema exists as per your code
const Joi = require('joi');
const crypto = require('crypto');

// Validation schemas
const configSchema = Joi.object({
  rewardType: Joi.string().valid('percentage', 'fixed').required(),
  rewardValue: Joi.number().min(0).required(),
  minOrder: Joi.number().min(0).default(0),
  expiryDays: Joi.number().min(1).required(),
  enableToken: Joi.boolean().default(true),
  enableCode: Joi.boolean().default(true),
  tokenExpiry: Joi.number().min(1).default(48),
  maxReferrals: Joi.number().min(0).allow(null),
});

// GET /admin/referral - View all referrals (aggregated from User.referrals)
const getReferrals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchQuery = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build search aggregation match
    let matchStage = {};
    if (searchQuery) {
      const searchUsers = await User.find({
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } },
          { referalCode: { $regex: searchQuery, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = searchUsers.map(u => u._id);
      matchStage = {
        $or: [
          { _id: { $in: userIds } }, // Referrer match
          { 'referrals.referee_id': { $in: userIds } }, // Referred user match
          { 'referrals.referralCode': { $regex: searchQuery, $options: 'i' } } // Code match
        ]
      };
    }

    // Use $facet for efficient pagination and count
    const facetPipeline = [
      { $match: matchStage },
      { $unwind: { path: '$referrals', preserveNullAndEmptyArrays: false } },
      { $lookup: {
          from: 'users',
          localField: 'referrals.referee_id',
          foreignField: '_id',
          as: 'referredUser'
        }
      },
      { $unwind: { path: '$referredUser', preserveNullAndEmptyArrays: true } },
      { $lookup: {
          from: 'coupons',
          localField: 'referrals.coupon_id',
          foreignField: '_id',
          as: 'coupon'
        }
      },
      { $unwind: { path: '$coupon', preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          data: [
            { $sort: { 'referrals.created_at': -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: '$_id', // User ID as referrer ID
                referralId: '$referrals._id', // Subdoc ID for actions
                referrer: {
                  name: '$name',
                  email: '$email'
                },
                referralCode: '$referrals.referralCode',
                referredUser: {
                  name: { $ifNull: ['$referredUser.name', null] },
                  email: { $ifNull: ['$referredUser.email', null] }
                },
                method: { $ifNull: ['$referrals.method', 'code'] },
                createdAt: '$referrals.created_at',
                rewardIssued: { $ne: ['$referrals.coupon_id', null] },
                couponIssued: { $ifNull: ['$coupon.code', null] }
              }
            }
          ],
          total: [{ $count: 'count' }]
        }
      }
    ];

    const result = await User.aggregate(facetPipeline);
    const referrals = result[0]?.data || [];
    const totalDocs = result[0]?.total[0]?.count || 0;
    const totalPages = Math.ceil(totalDocs / limit);

    // Calculate stats via separate aggregations
    const totalReferralsAgg = await User.aggregate([
      { $unwind: '$referrals' },
      { $count: 'total' }
    ]);
    const totalReferrals = totalReferralsAgg[0]?.total || 0;

    const successfulReferralsAgg = await User.aggregate([
      { $unwind: '$referrals' },
      { $match: { 'referrals.referee_id': { $ne: null } } },
      { $count: 'total' }
    ]);
    const successfulReferrals = successfulReferralsAgg[0]?.total || 0;

    const rewardsIssuedAgg = await User.aggregate([
      { $unwind: '$referrals' },
      { $match: { 'referrals.coupon_id': { $ne: null } } },
      { $count: 'total' }
    ]);
    const rewardsIssued = rewardsIssuedAgg[0]?.total || 0;

    const pendingRewardsAgg = await User.aggregate([
      { $unwind: '$referrals' },
      { $match: {
          'referrals.referee_id': { $ne: null },
          'referrals.coupon_id': null
        }
      },
      { $count: 'total' }
    ]);
    const pendingRewards = pendingRewardsAgg[0]?.total || 0;

    const stats = {
      totalReferrals,
      successfulReferrals,
      rewardsIssued,
      pendingRewards
    };

    res.render('referral', { // Adjust path to your EJS file
      referrals,
      currentPage: page,
      itemsPerPage: limit,
      totalPages,
      searchQuery,
      stats
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /admin/referral/:id - Get referral details (by subdoc _id)
const getReferralDetails = async (req, res) => {
  try {
    const { id } = req.params; // This is the referrals.subdoc _id
    const user = await User.findOne({ 'referrals._id': id });
    if (!user) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    const referral = user.referrals.id(id); // Mongoose subdoc
    await user.populate('referrals.referee_id', 'name email');
    await user.populate('referrals.coupon_id');
    res.json({ data: {
      referrer: { name: user.name, email: user.email, referralCode: user.referalCode },
      method: referral.method || 'code',
      referredUser: referral.referee_id ? { name: referral.referee_id.name, email: referral.referee_id.email } : null,
      rewardIssued: !!referral.coupon_id,
      couponIssued: referral.coupon_id ? referral.coupon_id.code : null,
      status: referral.status,
      createdAt: referral.created_at
    } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /admin/referral/config - Save referral configuration
const saveConfig = async (req, res) => {
  try {
    const { error } = configSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    // Update or create config (singleton pattern)
    let config = await ReferralConfig.findOne();
    if (config) {
      Object.assign(config, req.body);
      await config.save();
    } else {
      config = new ReferralConfig(req.body);
      await config.save();
    }
    res.json({ message: 'Configuration saved successfully', data: config });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /admin/referral/:id/issue-reward - Manually issue reward (by subdoc _id)
const issueReward = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ 'referrals._id': id });
    if (!user) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    const referral = user.referrals.id(id);
    if (!referral.referee_id) {
      return res.status(400).json({ error: 'No referred user yet' });
    }
    if (referral.coupon_id) {
      return res.status(400).json({ error: 'Reward already issued' });
    }
    // Get config
    const config = await ReferralConfig.findOne();
    if (!config) {
      return res.status(400).json({ error: 'Referral program not configured' });
    }
    // Create coupon for referrer
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + config.expiryDays);
    const coupon = new Coupon({
      code: `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      discountType: config.rewardType,
      discountValue: config.rewardValue,
      minOrderAmount: config.minOrder,
      maxUses: 1, // One-time use for referrer
      expiryDate: expiryDate,
      isActive: true,
      userId: user._id,
      createdBy: req.admin?._id || req.user?._id
    });
    await coupon.save();
    // Update referral subdoc
    referral.coupon_id = coupon._id;
    referral.status = 'claimed';
    referral.rewardIssuedAt = new Date(); // Add this field to schema if needed
    await user.save();
    res.json({
      message: 'Reward issued successfully',
      data: { referral, coupon }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getReferrals,
  getReferralDetails,
  saveConfig,
  issueReward
};