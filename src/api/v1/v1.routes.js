const express = require('express');

const project = require('../../constants/project');

const router = express.Router();

const user = require('./user/user.routes');
const wallet = require('./wallet/wallet.routes');
const webhook = require('./webhook/webhook.routes');
const account = require('./account/account.routes');
const transaction = require('./transaction/transaction.routes');
const request = require('./request/request.routes');

router.get('/', (req, res) => {
  res.json({
    message: `${project.message} V1`,
  });
});

router.use('/user', user);
router.use('/wallet', wallet);
router.use('/webhook', webhook);
router.use('/account', account);
router.use('/transaction', transaction);
router.use('/request', request);

module.exports = router;
