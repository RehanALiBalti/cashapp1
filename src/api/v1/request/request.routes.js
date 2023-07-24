/* eslint-disable no-underscore-dangle */
const router = require('express').Router();
const admin = require('firebase-admin');
const Sila = require('sila-sdk').default;

const collections = require('../../../constants/collections');
const authGuard = require('../../../lib/authGuard');

router.get('/', authGuard.auth(true), async (req, res, next) => {
  try {
    // Fetch all requests made from database
    const sentRequestsRef = await admin.firestore().collection(collections.request).where('requesterID', '==', req.user.id);
    const receivedRequestsRef = await admin.firestore().collection(collections.request).where('requesteeID', '==', req.user.id);

    const sentRequestDocs = await sentRequestsRef.get();
    const receivedRequestsDocs = await receivedRequestsRef.get();

    let sent = [];
    let received = [];

    if (!sentRequestDocs.empty) {
      sent = await Promise.all(
        sentRequestDocs.docs.map(async (doc) => {
          const requestData = await doc.data();
          requestData.id = await doc.id;
          return requestData;
        }),
      );
    }

    if (!receivedRequestsDocs.empty) {
      received = await Promise.all(
        receivedRequestsDocs.docs.map(async (doc) => {
          const requestData = await doc.data();
          requestData.id = await doc.id;
          return requestData;
        }),
      );
    }

    return res.json({
      message: 'success',
      data: {
        sent,
        received,
      },
    });
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

router.post('/', authGuard.auth(true), async (req, res, next) => {
  try {
    // Check handle is in use
    const inUse = await Sila.checkHandle(req.body.destinationHandle);
    if (!inUse) throw new Error('Invalid destination handle!');

    // Get destination user details
    const requesteeRef = await admin.firestore().collection(collections.user).where('silaHandle', '==', req.body.destinationHandle);
    const requesteeDocs = await requesteeRef.get();
    if (requesteeDocs.empty) throw new Error('Failed to get destination user details');
    const requesteeData = await requesteeDocs.docs[0].data();
    if (requesteeDocs.docs[0].id === req.user.id) throw new Error('You cannot request money from yourself!');

    // Insert request to firestore
    const timestamp = await admin.firestore.FieldValue.serverTimestamp();
    const addedDocRef = await admin.firestore().collection(collections.request).add({
      amount: req.body.amount,
      requesteeID: requesteeDocs.docs[0].id,
      requesterID: req.user.id,
      status: 'pending',
      createdAt: timestamp,
    });

    // Send notification to requestee
    if (requesteeData.token) {
      const notification = {
        data: {
          amount: req.body.amount.toString(),
          destinationWallet: req.user.silaWalletAddress,
          requested_by: req.user.displayName,
          requester_id: req.user.id,
          request_id: addedDocRef.id,
        },
        notification: {
          title: 'Sila Money Request received',
          body: `${req.user.displayName} has requested Sila money from you.`,
        },
        token: requesteeData.token,
      };

      console.log(`Sending request notification to user: ${requesteeData.displayName} with token: ${requesteeData.token}`);
      const response = await admin.messaging().send(notification);
      console.log('Firebase Response: ', response);
    }

    return res.json({
      message: 'success',
      data: {
        request_id: addedDocRef.id,
      },
    });
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

router.get('/approve/:request_id', authGuard.auth(true), async (req, res, next) => {
  try {
    // Fetch request from firebase
    const requestRef = await admin.firestore().collection(collections.request)
      .doc(req.params.request_id);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) throw new Error('Invalid request id');

    const requestData = await requestDoc.data();
    if (requestData.requesterID === req.user.id) throw new Error('You cannot approve your own request');

    // Get requester details
    const requesterRef = await admin.firestore().collection(collections.user)
      .doc(requestData.requesterID);
    const requesterDoc = await requesterRef.get();
    if (!requesterDoc.exists) throw new Error('Invalid requester id');
    const requesterData = await requesterDoc.data();

    // Transfer the necessary funds
    const response = await Sila.transferSila(
      requestData.amount,
      req.user.silaHandle,
      req.user.silaPrivateKey,
      requesterData.silaHandle,
    );

    if (response.statusCode === 200) {
      // Send notification to requester
      if (requesterData.token) {
        const notification = {
          data: {
            request_id: req.params.request_id,
          },
          notification: {
            title: 'Your Sila Money Request has been approved',
            body: `${req.user.displayName} has approved your Sila money request.`,
          },
          token: requesterData.token,
        };

        console.log(`Sending request notification to user: ${requesterData.displayName} with token: ${requesterData.token}`);
        const firebaseResponse = await admin.messaging().send(notification);
        console.log('Firebase Response: ', firebaseResponse);
      }

      // Update request status in firestore
      await admin.firestore().collection(collections.request).doc(req.params.request_id).update({
        status: 'approved',
      });

      return res.json({
        message: 'success',
        data: response.data,
      });
    }
    throw new Error(JSON.stringify(response.data));
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

router.get('/decline/:request_id', authGuard.auth(true), async (req, res, next) => {
  try {
    // Fetch request from firebase
    const requestRef = await admin.firestore().collection(collections.request)
      .doc(req.params.request_id);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) throw new Error('Invalid request id');

    const requestData = await requestDoc.data();

    // Get requester details
    const requesterRef = await admin.firestore().collection(collections.user)
      .doc(requestData.requesterID);
    const requesterDoc = await requesterRef.get();
    if (!requesterDoc.exists) throw new Error('Invalid requester id');
    const requesterData = await requesterDoc.data();

    // Send notification to requester
    if (requestData.requesterID !== req.user.id) {
      if (requesterData.token) {
        const notification = {
          data: {
            request_id: req.params.request_id,
          },
          notification: {
            title: 'Your Sila Money Request has been declined',
            body: `${req.user.displayName} has declined your Sila money request.`,
          },
          token: requesterData.token,
        };

        console.log(`Sending request notification to user: ${requesterData.displayName} with token: ${requesterData.token}`);
        const firebaseResponse = await admin.messaging().send(notification);
        console.log('Firebase Response: ', firebaseResponse);
      }
    }

    // Update request status in firestore
    await admin.firestore().collection(collections.request).doc(req.params.request_id).update({
      status: (requestData.requesterID !== req.user.id) ? 'declined' : 'cancelled',
    });

    return res.json({
      message: 'success',
      data: {
        message: `Request successfully ${(requestData.requesterID !== req.user.id) ? 'declined' : 'cancelled'}!`,
      },
    });
  } catch (error) {
    res.status(400);
    return next(error);
  }
});

module.exports = router;
