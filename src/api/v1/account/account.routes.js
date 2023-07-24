require('dotenv').config();
const router = require('express').Router();
const Sila = require('sila-sdk').default;
const admin = require('firebase-admin');
const plaid = require('plaid');

const authGuard = require('../../../lib/authGuard');
const collections = require('../../../constants/collections');
const { uploadBase64 } = require('../../../lib/firebase');

const androidPackageName = 'com.buzzware.cash';

const plaidClient = new plaid.Client({
  clientID: process.env.PLAID_CLIENT_ID,
  secret: process.env.PLAID_SECRET,
  env: plaid.environments.sandbox,
  options: {
    version: '2020-09-14',
  },
});

// Get Accounts
router.get('/', authGuard.auth(true), async (req, res, next) => {
  try {
    // Get accounts associated with this user
    const accounts = await Sila.getAccounts(
      req.user.silaHandle, req.user.silaPrivateKey, req.query,
    );

    if (accounts.statusCode === 200) {
      return res.json({
        message: 'success',
        data: accounts.data,
      });
    }
    throw new Error(JSON.stringify(accounts.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Get Plaid Link Token
router.get('/plaidLinkToken', authGuard.auth(true), async (req, res, next) => {
  try {
    // Get fresh Plaid Link Token
    const token = await Sila.plaidLinkToken(
      req.user.silaHandle, req.user.silaPrivateKey, androidPackageName
    );

    if (token.statusCode === 200) {
      return res.json({
        message: 'success',
        data: token.data,
      });
    }
    throw new Error(JSON.stringify(token.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Get Account Balance
router.get('/:name', authGuard.auth(true), async (req, res, next) => {
  try {
    // Get balance of account associated with this user
    const accounts = await Sila.getAccountBalance(
      req.user.silaHandle, req.user.silaPrivateKey, req.params.name,
    );

    if (accounts.statusCode === 200) {
      return res.json({
        message: 'success',
        data: accounts.data,
      });
    }
    throw new Error(JSON.stringify(accounts.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Register new account
router.post('/', authGuard.auth(true), async (req, res, next) => {
  try {
    const plaidTokenType = 'link';
    let statusCode = 200;

    if (req.body.accountId.length !== req.body.accountName.length) throw new Error('Count of account ids must match account names');

    const accounts = [];

    req.body.accountName.forEach(
      // eslint-disable-next-line consistent-return
      async (accountName, idx) => {
        const response = await Sila.linkAccount(
          req.user.silaHandle,
          req.user.silaPrivateKey,
          req.body.plaidPublicToken,
          accountName,
          req.body.accountId[idx],
          plaidTokenType,
        );

        // No need to proceed because this account wasn't added at all
        if (response.statusCode !== 200) {
          statusCode = response.statusCode;
          return response.data;
        }

        // Check account exists in firestore
        const accountQuery = await admin.firestore().collection(collections.user).doc(req.user.id)
          .collection(collections.account)
          .where('accountId', '==', req.body.accountId[idx]);
        const accountDocs = await accountQuery.get();

        if (accountDocs.empty) {
          // Check institution exists in firestore
          let institutionQuery = await admin.firestore().collection(collections.institution).where('id', '==', req.body.institutionId[idx]);
          let institutionDocs = await institutionQuery.get();

          // If image for this institution is not already in our db, upload it
          if (institutionDocs.empty) {
            const institution = await plaidClient.getInstitutionById(
              req.body.institutionId[idx],
              ['US'],
              {
                include_optional_metadata: true,
              },
            );

            const filePath = `${collections.institution}/${new Date().getTime()}`;
            const imageUrl = await uploadBase64(filePath, institution.institution.logo);

            await admin.firestore().collection(collections.institution).add({
              id: req.body.institutionId[idx],
              image_url: imageUrl,
            });

            // Update reference to institution doc
            institutionQuery = await admin.firestore().collection(collections.institution).where('id', '==', req.body.institutionId[idx]);
            institutionDocs = await institutionQuery.get();
          }

          const institutionData = institutionDocs.docs[0].data();

          await admin.firestore().collection(collections.user).doc(req.user.id)
            .collection(collections.account)
            .add({
              accountId: req.body.accountId[idx],
              accountName,
              image_url: institutionData.image_url,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        accounts.push(response.data);
      },
    );

    if (statusCode === 200) {
      return res.json({
        message: 'success',
        data: accounts,
      });
    }
    throw new Error(JSON.stringify(accounts));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Update existing account
router.put('/', authGuard.auth(true), async (req, res, next) => {
  try {
    const data = {
      account_name: req.body.oldAccountName,
      new_account_name: req.body.newAccountName,
    };

    // Update account associated with this user
    const accounts = await Sila.updateAccount(
      data,
      req.user.silaHandle,
      req.user.silaPrivateKey,
    );

    if (accounts.statusCode === 200) {
      return res.json({
        message: 'success',
        data: accounts.data,
      });
    }
    throw new Error(JSON.stringify(accounts.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

// Delete account
router.delete('/:id', authGuard.auth(true), async (req, res, next) => {
  try {
    const accountQuery = await admin.firestore().collection(collections.user).doc(req.user.id)
      .collection(collections.account)
      .where('accountId', '=', req.params.id);
    const accountDocs = await accountQuery.get();

    if (!accountDocs.empty) {
      const accountData = accountDocs.docs[0].data();

      // Delete account associated with this user
      const accounts = await Sila.deleteAccount(
        req.user.silaHandle,
        accountData.accountName,
        req.user.silaPrivateKey,
      );

      if (accounts.statusCode === 200) {
        // Delete account logo reference
        await admin.firestore().collection(collections.user).doc(req.user.id)
          .collection(collections.account)
          .doc(accountDocs.docs[0].id)
          .delete();

        return res.json({
          message: 'success',
          data: accounts.data,
        });
      }
      throw new Error(JSON.stringify(accounts.data));
    }
    throw new Error('Invalid account id!');
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

module.exports = router;
