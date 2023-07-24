const admin = require('firebase-admin');
const collections = require('../constants/collections');

function auth(mustBeVerifed = false) {
    return async(req, res, next) => {
        try {
            const token = req.header('Authorization');
            if (!token) {
                throw new Error('Missing access token!');
            }
            const bearerToken = token.split(' ');
            console.log(bearerToken);
            if (bearerToken.length < 2) throw new Error();

            // Check user exists in firestore
            const userRef = await admin.firestore().collection(collections.user).doc(bearerToken[1]);
            const userDoc = await userRef.get();

            if (!userDoc.exists) { throw new Error('Access Denied!'); }

            const userData = await userDoc.data();
            console.log(userData);

            if (!userData.verified && mustBeVerifed) { throw new Error('User is not KYC verified yet!'); }

            req.user = userData;
            // eslint-disable-next-line prefer-destructuring
            req.user.id = bearerToken[1];
            req.user.ref = userRef;
            return next();
        } catch (error) {
            res.status(401);
            return res.json({
                message: error.message,
            });
        }
    };
}

function getRates() {
    return async(req, res, next) => {
        try {
            const chargesRef = await admin.firestore().collection(collections.charges);
            const chargesDoc = await chargesRef.get();

            if (chargesDoc.empty) { throw new Error('Charges not found in database'); }

            req.charges = {};
            req.company = {};
            req.company.silaHandle = 'buzzware';
            await Promise.all(
                chargesDoc.docs.map(async(charge) => {
                    const chargeData = await charge.data();
                    req.charges[chargeData.type] = chargeData.price;
                }),
            );
            return next();
        } catch (error) {
            res.status(400);
            return res.json({
                message: error.message,
            });
        }
    };
}

module.exports = {
    auth,
    getRates,
};