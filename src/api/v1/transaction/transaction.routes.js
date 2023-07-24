require('dotenv').config();
const router = require('express').Router();
const Sila = require('sila-sdk').default;

const authGuard = require('../../../lib/authGuard');

// Get transactions
router.get('/getTransactions', authGuard.auth(true), async (req, res, next) => {
  try {
    const transactions = await Sila.getTransactions(
      req.user.silaHandle,
      req.user.silaPrivateKey,
      req.query,
    );

    if (transactions.statusCode === 200) {
      return res.json({
        message: 'success',
        data: transactions.data,
      });
    }
    throw new Error(JSON.stringify(transactions.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Add money to your wallet
router.post('/addToWallet', authGuard.auth(true), authGuard.getRates(), async (req, res, next) => {
  try {
    // Check the user is adding at least 1 sila + commision charge
    const isAtLeastMinimum = req.body.amount >= (1 + req.charges[req.body.processingType]);
    if (!isAtLeastMinimum) {
      const data = {
        success: false,
        message: 'Insufficient account balance.',
        status: 'FAILURE',
      };
      throw new Error(JSON.stringify(data));
    }

    const transaction = await Sila.issueSila(
      req.body.amount,
      req.user.silaHandle,
      req.user.silaPrivateKey,
      req.body.accountName,
      undefined,
      undefined,
      req.body.processingType,
    );

    if (transaction.statusCode === 200) {
      const commission = req.charges[req.body.processingType];
      const commissionTransaction = await Sila.transferSila(
        commission,
        req.user.silaHandle,
        req.user.silaPrivateKey,
        req.company.silaHandle,
      );

      if (commissionTransaction.statusCode !== 200) {
        commissionTransaction.data.error = "Couldn't transact commision";
        throw new Error(JSON.stringify(commissionTransaction.data));
      }

      return res.json({
        message: 'success',
        data: transaction.data,
      });
    }
    throw new Error(JSON.stringify(transaction.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Send money to other user
router.post('/transferSila', authGuard.auth(true), async (req, res, next) => {
  try {
    const transaction = await Sila.transferSila(
      req.body.amount,
      req.user.silaHandle,
      req.user.silaPrivateKey,
      req.body.destinationHandle,
    );

    if (transaction.statusCode === 200) {
      return res.json({
        message: 'success',
        data: transaction.data,
      });
    }
    throw new Error(JSON.stringify(transaction.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Redeem sila to own bank account
router.post('/redeemSila', authGuard.auth(true), authGuard.getRates(), async (req, res, next) => {
  try {
    // Check wallet balance
    const getWalletBalance = await Sila.getSilaBalance(req.user.silaWalletAddress);
    if (getWalletBalance.statusCode !== 200) throw new Error('Failed to get own wallet balance.');

    // Check wallet has enough balance for this transaction
    const commission = req.charges[req.body.processingType];
    if (getWalletBalance.data.sila_balance < (req.body.amount + commission)) {
      const data = {
        success: false,
        message: 'Insufficient wallet balance.',
        status: 'FAILURE',
      };
      throw new Error(JSON.stringify(data));
    }

    const commissionTransaction = await Sila.transferSila(
      commission,
      req.user.silaHandle,
      req.user.silaPrivateKey,
      req.company.silaHandle,
    );

    if (commissionTransaction.statusCode !== 200) {
      commissionTransaction.data.error = "Couldn't transact commision";
      throw new Error(JSON.stringify(commissionTransaction.data));
    }

    const transaction = await Sila.redeemSila(
      req.body.amount,
      req.user.silaHandle,
      req.user.silaPrivateKey,
      req.body.accountName,
      undefined,
      undefined,
      req.body.processingType,
    );

    if (transaction.statusCode === 200) {
      return res.json({
        message: 'success',
        data: transaction.data,
      });
    }
    throw new Error(JSON.stringify(transaction.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Cancel transaction
router.delete('/cancelTransaction/:id', authGuard.auth(true), async (req, res, next) => {
  try {
    const cancelled = await Sila.cancelTransaction(
      req.user.silaHandle,
      req.user.silaPrivateKey,
      req.params.id,
    );

    if (cancelled.statusCode === 200) {
      return res.json({
        message: 'success',
        data: cancelled.data,
      });
    }
    throw new Error(JSON.stringify(cancelled.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

module.exports = router;
