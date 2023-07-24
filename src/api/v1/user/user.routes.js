const router = require('express').Router();
const Sila = require('sila-sdk').default;

const authGuard = require('../../../lib/authGuard');

router.get('/checkHandle', async(req, res, next) => {
    try {
        // Check handle is available
        const availability = await Sila.checkHandle(req.query.handle);
        console.log("yes");
        console.log(availability);
        return res.json({
            message: 'success',
            data: {
                availability: availability.data.success,
                message: availability.data.message,
            },
        });
    } catch (error) {
        console.log("no");
        res.status(400);
        return next(error);
    }
});

router.get('/register', authGuard.auth(), async(req, res, next) => {
    try {
        if (!req.user.silaPrivateKey) {
            // Register new user
            const newUser = new Sila.User();
            const wallet = Sila.generateWallet();

            newUser.handle = req.user.silaHandle;
            [newUser.firstName, newUser.lastName] = req.user.displayName.split(' ');
            newUser.addressAlias = req.user.displayName;
            newUser.address = req.user.streetAddress1;
            newUser.address2 = req.user.streetAddress2;
            newUser.postal_code = req.user.postalCode;
            newUser.zip = req.user.postalCode;
            newUser.city = req.user.city;
            newUser.state = req.user.state;
            newUser.country = 'US';
            newUser.contactAlias = req.user.displayName;
            newUser.phone = req.user.phoneNumber;
            newUser.email = req.user.email;
            newUser.dateOfBirth = req.user.birthday;
            newUser.ssn = req.user.SSN;
            newUser.cryptoAlias = req.user.displayName;
            newUser.cryptoAddress = wallet.address;
            newUser.type = 'individual';

            const registeration = await Sila.register(newUser);

            if (registeration.data.success) {
                // Update user in the database
                await req.user.ref.update({
                    silaWalletAddress: wallet.address,
                    silaPrivateKey: wallet.privateKey,
                });

                // Request KYC verification
                const requestKYC = await Sila.requestKYC(req.user.silaHandle, wallet.privateKey, 'DOC_KYC');

                if (requestKYC.statusCode === 200) {
                    if (requestKYC.data.verification_status === 'passed') await req.user.ref.update({ verified: true });

                    return res.json({
                        message: 'success',
                        data: requestKYC.data,
                    });
                }
                throw new Error(JSON.stringify(requestKYC.data));
            }
            throw new Error(JSON.stringify(registeration.data));
        }
        throw new Error('Already registered!');
    } catch (error) {
        res.status(400);
        return next(error);
    }
});

router.post('/update', authGuard.auth(), async(req, res, next) => {
    try {
        if (req.user.silaPrivateKey) {
            const response = [];
            const silaUser = await Sila.getEntity(req.user.silaHandle, req.user.silaPrivateKey);

            if (silaUser.statusCode !== 200) throw new Error('Invalid user handle!');

            // Update email if provided
            if (req.body.email) {
                const email = {
                    uuid: silaUser.data.emails[0].uuid,
                    email: req.body.email,
                };
                const updateResponse = await Sila.updateEmail(
                    req.user.silaHandle, req.user.silaPrivateKey, email,
                );

                if (!updateResponse) throw new Error(JSON.stringify(updateResponse));
                updateResponse.data.method = 'email';
                response.push(updateResponse.data);
            }

            // Update phone if provided
            if (req.body.phoneNumber) {
                const phone = {
                    uuid: silaUser.data.phones[0].uuid,
                    phone: req.body.phoneNumber,
                    smsOptIn: false,
                };
                const updateResponse = await Sila.updatePhone(
                    req.user.silaHandle, req.user.silaPrivateKey, phone,
                );

                if (!updateResponse) throw new Error(JSON.stringify(updateResponse));
                updateResponse.data.method = 'phoneNumber';
                response.push(updateResponse.data);
            }

            // Update SSN if provided
            if (req.body.SSN) {
                const identity = {
                    identity_alias: 'SSN',
                    identity_value: req.body.SSN,
                    uuid: silaUser.data.identities[0].uuid,
                };
                const updateResponse = await Sila.updateIdentity(
                    req.user.silaHandle, req.user.silaPrivateKey, identity,
                );

                if (!updateResponse) throw new Error(JSON.stringify(updateResponse));
                updateResponse.data.method = 'SSN';
                response.push(updateResponse.data);
            }

            // Update address if provided
            if (req.body.address) {
                const address = {
                    street_address_1: (req.body.streetAddress1) ?
                        req.body.streetAddress1 : req.user.streetAddress1,
                    street_address_2: (req.body.streetAddress2) ?
                        req.body.streetAddress2 : req.user.streetAddress2,
                    city: (req.body.city) ? req.body.city : req.user.city,
                    state: (req.body.state) ? req.body.state : req.user.state,
                    postal_code: (req.body.postalCode) ? req.body.postalCode : req.user.postalCode,
                    uuid: silaUser.data.addresses[0].uuid,
                };

                const updateResponse = await Sila.updateAddress(
                    req.user.silaHandle, req.user.silaPrivateKey, address,
                );

                if (!updateResponse) throw new Error(JSON.stringify(updateResponse));
                updateResponse.data.method = 'address';
                response.push(updateResponse.data);
            }

            // Update entity if provided
            if (req.body.entity) {
                // Individual
                const entity = {
                    first_name: req.body.firstName ? req.body.firstName : req.user.displayName.split(' ')[0],
                    last_name: req.body.lastName ? req.body.lastName : req.user.displayName.split(' ')[0],
                    entity_name: `${req.body.firstName ? req.body.firstName : req.user.displayName.split(' ')[0]} ${req.body.lastName ? req.body.lastName : req.user.displayName.split(' ')[0]}`,
                    birthdate: req.body.birthday ? req.body.birthday : req.user.birthday,
                };

                const updateResponse = await Sila.updateEntity(
                    req.user.silaHandle, req.user.silaPrivateKey, entity,
                );

                if (!updateResponse) throw new Error(JSON.stringify(updateResponse));
                updateResponse.data.method = 'entity';
                response.push(updateResponse.data);
            }

            // If none of the update candidates were provided
            const validation = await Promise.all(
                ['email', 'phoneNumber', 'SSN', 'address', 'entity'].map((candidate) => Object.prototype.hasOwnProperty.call(req.body, candidate)),
            );
            if (!validation.find((candidate) => candidate)) { throw new Error('You must provide one of these objects: ["email", "phoneNumber", "SSN", "address", "entity"]'); }

            return res.json({
                message: 'success',
                data: response,
            });
        }
        throw new Error('User not registered yet!');
    } catch (error) {
        res.status(400);
        return next(error);
    }
});

router.get('/getHandle', authGuard.auth(), async(req, res, next) => {
    try {
        return res.json({
            message: 'success',
            data: {
                handle: req.user.silaHandle,
            },
        });
    } catch (error) {
        res.status(400);
        return next(error);
    }
});

router.get('/checkKYC', authGuard.auth(), async(req, res, next) => {
    try {
        // Check KYC status
        const statusKYC = await Sila.checkKYC(req.user.silaHandle, req.user.silaPrivateKey);

        if (statusKYC.statusCode === 200) {
            return res.json({
                message: 'success',
                data: statusKYC.data,
            });
        }
        throw new Error(JSON.stringify(statusKYC.data));
    } catch (error) {
        res.status(400);
        return next(error);
    }
});

router.get('/requestKYC', authGuard.auth(), async(req, res, next) => {
    try {
        if (!req.user.verified) {
            // Request KYC verification
            const requestKYC = await Sila.requestKYC(req.user.silaHandle, req.user.silaPrivateKey, 'DOC_KYC');

            if (requestKYC.statusCode === 200) {
                if (requestKYC.data.verification_status === 'passed') await req.user.ref.update({ verified: true });

                return res.json({
                    message: 'success',
                    data: requestKYC.data,
                });
            }
            throw new Error(JSON.stringify(requestKYC.data));
        } else {
            throw new Error('User already KYC verified');
        }
    } catch (error) {
        res.status(400);
        return next(error);
    }
});

module.exports = router;