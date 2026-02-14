// controllers/user/referralController.js - FIXED VERSION
const User = require("../../models/userSchema");
const ReferralConfig = require("../../models/referralConfigSchema");
const crypto = require('crypto');
const Coupon = require("../../models/couponSchema");
const Wallet = require("../../models/walletSchema");


const generateReferralToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const config = await ReferralConfig.findOne();
    if (!config || !config.enableToken) {
      return res.status(400).json({ error: 'Token URL method is disabled' });
    }
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
    // Generate URL 
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

const processReferralOnRegister = async (newUserId, referralToken, referralCode) => {
  let referral = null;
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
  // Handle code-based referral 
  if (referralCode && !referral) {
    const referrerUser = await User.findOne({ referralCode: referralCode.toUpperCase() });
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


async function autoIssueReward(user, referralIndex) {
  try {
    const config = await ReferralConfig.findOne();
    if (!config) {
      console.error("❌ Referral reward skipped: No ReferralConfig found.");
      return false;
    }

    console.log(`\n========== REFERRAL REWARD PROCESSING ==========`);
    console.log(`📋 Config Type: ${config.rewardType}`);
    console.log(`💰 Config Value: ${config.rewardValue}`);
    console.log(`👤 User: ${user.email} (ID: ${user._id})`);
    console.log(`📊 Referral Index: ${referralIndex}`);

    if (config.rewardType === 'percentage') {
      console.log(`\n🎟️  Processing PERCENTAGE reward (Coupon)...`);
      
      // Existing coupon logic for percentage
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (config.expiryDays || 30));

      const newCoupon = new Coupon({
        code: `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        userId: user._id,
        discountType: config.rewardType,
        discountValue: config.rewardValue,
        couponType: "referral",
        minCartValue: 0,
        expiryDate: expiryDate,
        isActive: true
      });

      await newCoupon.save();
      console.log(`✅ Coupon ${newCoupon.code} created successfully`);

      user.referrals[referralIndex].coupon_id = newCoupon._id;
      user.referrals[referralIndex].status = 'claimed';
      user.referrals[referralIndex].rewardIssuedAt = new Date();

      user.markModified('referrals');
      await user.save();
      console.log(`✅ User referral record updated`);
      console.log(`================================================\n`);

      return newCoupon;
      
    } else if (config.rewardType === 'fixed') {
      console.log(`\n💳 Processing FIXED amount reward (Wallet)...`);
      
      // Find or create wallet
      let wallet = await Wallet.findOne({ userId: user._id });
      console.log(`🔍 Wallet lookup result: ${wallet ? 'FOUND' : 'NOT FOUND'}`);
      
      if (!wallet) {
        console.log(`🆕 Creating new wallet...`);
        wallet = new Wallet({
          userId: user._id,
          balance: 0,
          transactions: []
        });
        console.log(`✅ New wallet instance created`);
      }

      // Store previous balance for logging
      const previousBalance = Number(wallet.balance) || 0;
      const rewardAmount = Number(config.rewardValue);
      
      console.log(`💵 Previous Balance: ₹${previousBalance}`);
      console.log(`💵 Reward Amount: ₹${rewardAmount}`);

      // Check wallet limit
      const WALLET_LIMIT = 10000;
      const newBalance = previousBalance + rewardAmount;

      if (newBalance > WALLET_LIMIT) {
        console.error(`❌ Wallet limit exceeded! New balance would be: ₹${newBalance}`);
        return false;
      }

      // Update balance
      wallet.balance = newBalance;
      console.log(`💵 New Balance (calculated): ₹${newBalance}`);

      // Add transaction to history
      const transaction = {
        type: 'Credit',
        amount: rewardAmount,
        description: 'Referral reward for successful referral',
        date: new Date()
      };

      wallet.transactions.push(transaction);
      console.log(`📝 Transaction added to array:`, transaction);

      // Save wallet with detailed error handling
      try {
        console.log(`💾 Attempting to save wallet...`);
        const savedWallet = await wallet.save();
        console.log(`✅ WALLET SAVED SUCCESSFULLY!`);
        console.log(`💰 Confirmed Balance: ₹${savedWallet.balance}`);
        console.log(`📊 Total Transactions: ${savedWallet.transactions.length}`);
        
        // Verify the save by re-fetching
        const verifyWallet = await Wallet.findOne({ userId: user._id });
        console.log(`🔍 Verification - Balance in DB: ₹${verifyWallet.balance}`);
        console.log(`🔍 Verification - Last transaction:`, verifyWallet.transactions[verifyWallet.transactions.length - 1]);
        
      } catch (walletErr) {
        console.error(`❌❌❌ WALLET SAVE FAILED ❌❌❌`);
        console.error(`Error name: ${walletErr.name}`);
        console.error(`Error message: ${walletErr.message}`);
        console.error(`Full error:`, walletErr);
        throw walletErr; // Don't proceed if wallet fails
      }

      // Only update user referral record if wallet saved successfully
      console.log(`\n📝 Updating user referral record...`);
      user.referrals[referralIndex].rewardAmount = rewardAmount;
      user.referrals[referralIndex].status = 'claimed';
      user.referrals[referralIndex].rewardIssuedAt = new Date();
      user.markModified('referrals');

      try {
        await user.save();
        console.log(`✅ User referral record updated successfully`);
      } catch (userErr) {
        console.error(`❌ User save failed:`, userErr);
        throw userErr;
      }

      console.log(`\n✅✅✅ REWARD PROCESSING COMPLETE ✅✅✅`);
      console.log(`================================================\n`);

      return { 
        rewardAmount: rewardAmount,
        previousBalance: previousBalance,
        newBalance: newBalance 
      };
      
    } else {
      console.error(`❌ Invalid rewardType in config: ${config.rewardType}`);
      console.log(`================================================\n`);
      return false;
    }
  } catch (err) {
    console.error('\n❌❌❌ AUTO-ISSUE REWARD ERROR ❌❌❌');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Stack trace:', err.stack);
    console.log(`================================================\n`);
    return false;
  }
}


const getMyReferrals = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('referrals.referee_id', 'name email').populate('referrals.coupon_id');
    const referrals = user.referrals || [];
    const stats = {
      total: referrals.length,
      successful: referrals.filter(r => r.referee_id).length,
      rewardsEarned: referrals.filter(r => r.coupon_id || r.rewardAmount > 0).length
    };
    res.json({ data: referrals, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  generateReferralToken,
  processReferralOnRegister,
  getMyReferrals
};