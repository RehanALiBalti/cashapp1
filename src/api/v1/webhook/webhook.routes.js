const router = require('express').Router();
const admin = require('firebase-admin');
const collections = require('../../../constants/collections');
const notifications = require('./notifications.json');

const allowedOutcomes = ['passed', 'failed', 'success'];
const companyHandle = 'buzzware';

router.post('/kycUpdate', async (req, res, next) => {
  try {
    const event = req.body.event_details;

    // Check user exists in firestore
    const userRef = await admin.firestore().collection(collections.user).where('silaHandle', '==', event.entity);
    const userDocs = await userRef.get();

    if (userDocs.empty) console.error('No user found with this handle!');
    else {
      userDocs.forEach(async (doc) => {
        const user = doc.data();

        if (allowedOutcomes.includes(event.outcome)) {
          let verified = false;

          // Update verified flag in database
          if (event.outcome === 'passed') verified = true;
          else if (event.outcome === 'failed') verified = false;
          await admin.firestore().collection(collections.user).doc(doc.id).update({ verified });

          // Send notification to the user if he's logged in
          if (user.token && user.token !== '') {
            const notification = {
              data: {
                user_id: doc.id,
              },
              notification: notifications.kycUpdate[event.outcome],
              token: user.token,
            };

            console.log(`Sending notification to user: ${doc.id} with token: ${user.token}`);
            const response = await admin.messaging().send(notification);
            console.log('Firebase Response: ', response);
          }
        }
      });
    }

    return res.json({
      message: 'success',
    });
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

router.post('/transactionUpdate', async (req, res, next) => {
  try {
    const event = req.body.event_details;

    // No need to send notification for company commission transactions
    if (event.entity !== companyHandle) {
      // Check user exists in firestore
      const userRef = await admin.firestore().collection(collections.user).where('silaHandle', '==', event.entity);
      const userDocs = await userRef.get();

      if (userDocs.empty) console.error('No user found with this handle!');
      else {
        userDocs.forEach(async (doc) => {
          const user = doc.data();

          if (allowedOutcomes.includes(event.outcome)) {
          // Send notification to the user if he's logged in
            if (user.token && user.token !== '') {
              const data = {
                user_id: doc.id,
                transaction_id: event.transaction,
                transaction_outcome: event.outcome,
              };

              if (event.transaction_type) data.transaction_type = event.transaction_type;

              const notification = {
                data,
                notification: notifications.transactionUpdate[event.outcome],
                token: user.token,
              };

              console.log(`Sending notification for TxID: ${event.transaction} to user: ${doc.id} with token: ${user.token}`);
              const response = await admin.messaging().send(notification);
              console.log('Firebase Response: ', response);
            }
          }
        });
      }
    }

    return res.json({
      message: 'success',
    });
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

module.exports = router;
