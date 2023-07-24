const router = require('express').Router();
const Sila = require('sila-sdk').default;

const authGuard = require('../../../lib/authGuard');

router.get('/', authGuard.auth(true), async (req, res, next) => {
  try {
    // Get wallets associated with this user
    const wallets = await Sila.getWallets(
      req.user.silaHandle, req.user.silaPrivateKey, req.query,
    );

    if (wallets.statusCode === 200) {
      return res.json({
        message: 'success',
        data: wallets.data,
      });
    }
    throw new Error(JSON.stringify(wallets.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Get Others Wallet Balance
router.post('/balance', authGuard.auth(true), async (req, res, next) => {
  try {
    // Get balance of wallet associated with some other user
    const walletResponse = await Sila.getSilaBalance(req.body.address);

    if (walletResponse.statusCode === 200) {
      return res.json({
        message: 'success',
        data: walletResponse.data,
      });
    }
    throw new Error(JSON.stringify(walletResponse.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Get Own Wallet Balance
router.get('/balance', authGuard.auth(true), async (req, res, next) => {
  try {
    // Get balance of wallet associated with this user
    const walletResponse = await Sila.getSilaBalance(req.user.silaWalletAddress);

    if (walletResponse.statusCode === 200) {
      return res.json({
        message: 'success',
        data: walletResponse.data,
      });
    }
    throw new Error(JSON.stringify(walletResponse.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

module.exports = router;
