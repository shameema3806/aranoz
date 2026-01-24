// controllers/user/referralController.js
const User = require("../../models/userSchema");
const ReferralConfig = require("../../models/referralConfigSchema");
const crypto = require('crypto');

// ==================== USER-FACING ENDPOINTS ====================
// POST /user/referral/generate-token - Generate referral token URL
const generateReferralToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const config = await ReferralConfig.findOne();
    if (!config || !config.enableToken) {
      return res.status(400).json({ error: 'Token URL method is disabled' });
    }
    // Check max referrals limit
    if (config.maxReferrals) {
      const referralCount = await User.aggregate([
        { $match: { _id: userId } },
        { $unwind: '$referrals' },
        { $match: { 'referrals.referee_id': { $ne: null } } },
        { $count: 'total' }
      ]);
      const count = referralCount[0]?.total || 0;
      if (count >= config.maxReferrals) {
        return res.status(400).json({ error: 'Maximum referral limit reached' });
      }
    }
    // Generate token and add pending referral to user's referrals array
    const token = crypto.randomBytes(16).toString('hex');
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + config.tokenExpiry);
    const user = await User.findById(userId);
    user.referrals.push({
      method: 'token',
      referralToken: token,
      tokenExpiry: expiryDate,
      status: 'pending',
      created_at: new Date()
    });
    await user.save();
    // Generate URL (adjust domain as needed)
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const referralUrl = `${baseUrl}/register?ref=${token}`;
    res.json({
      message: 'Token generated successfully',
      data: { token, url: referralUrl, expiresAt: expiryDate }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper: Process referral during registration (call this in your auth/register controller after user creation)
const processReferralOnRegister = async (newUserId, referralToken, referralCode) => {
  let referral = null;
  // Handle token-based referral
  if (referralToken) {
    const referrerUser = await User.findOne({
      'referrals.referee_id': null,
      'referrals.referralToken': referralToken,
      'referrals.tokenExpiry': { $gt: new Date() },
      'referrals.method': 'token',
      'referrals.status': 'pending'
    });
    if (referrerUser) {
      const referralIndex = referrerUser.referrals.findIndex(r => 
        !r.referee_id && r.referralToken === referralToken && r.method === 'token' && r.status === 'pending'
      );
      if (referralIndex !== -1) {
        referrerUser.referrals[referralIndex].referee_id = newUserId;
        referrerUser.referrals[referralIndex].status = 'claimed';
        await referrerUser.save();
        referral = referrerUser.referrals[referralIndex];
        await autoIssueReward(referrerUser, referralIndex);
      }
    }
  }
  // Handle code-based referral (if no token)
  if (referralCode && !referral) {
    const referrerUser = await User.findOne({ referalCode: referralCode.toUpperCase() });
    if (referrerUser) {
      const config = await ReferralConfig.findOne();
      if (config && config.enableCode) {
        // Check max referrals
        if (config.maxReferrals) {
          const countAgg = await User.aggregate([
            { $match: { _id: referrerUser._id } },
            { $unwind: '$referrals' },
            { $match: { 'referrals.referee_id': { $ne: null } } },
            { $count: 'total' }
          ]);
          if (countAgg[0]?.total >= config.maxReferrals) {
            return { success: false, error: 'Referrer has reached max referral limit' };
          }
        }
        // Add new referral entry
        referrerUser.referrals.push({
          referee_id: newUserId,
          method: 'code',
          referralCode: referralCode.toUpperCase(),
          status: 'claimed',
          created_at: new Date()
        });
        await referrerUser.save();
        const newReferralIndex = referrerUser.referrals.length - 1;
        referral = referrerUser.referrals[newReferralIndex];
        await autoIssueReward(referrerUser, newReferralIndex);
      }
    }
  }
  return { success: true, referralApplied: !!referral };
};

// Helper: Auto-issue reward after successful referral
async function autoIssueReward(user, referralIndex) {
  try {
    const config = await ReferralConfig.findOne();
    if (!config) return;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + config.expiryDays);
    const coupon = new Coupon({
      code: `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      discountType: config.rewardType,
      discountValue: config.rewardValue,
      minOrderAmount: config.minOrder,
      maxUses: 1,
      expiryDate: expiryDate,
      isActive: true,
      userId: user._id
    });
    await coupon.save();
    // Update referral subdoc
    user.referrals[referralIndex].coupon_id = coupon._id;
    user.referrals[referralIndex].status = 'claimed';
    user.referrals[referralIndex].rewardIssuedAt = new Date(); // Add field if needed
    await user.save();
    return coupon;
  } catch (err) {
    console.error('Auto-issue reward error:', err);
  }
}

// GET /user/referral/my-referrals - User's referral history
const getMyReferrals = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('referrals.referee_id', 'name email').populate('referrals.coupon_id');
    const referrals = user.referrals || [];
    const stats = {
      total: referrals.length,
      successful: referrals.filter(r => r.referee_id).length,
      rewardsEarned: referrals.filter(r => r.coupon_id).length
    };
    res.json({ data: referrals, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  generateReferralToken,
  processReferralOnRegister, // Export as helper for auth controller
  getMyReferrals
};