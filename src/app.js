const express = require('express');
const morgan = require('morgan');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const Sila = require('sila-sdk').default;
const base64url = require('base64url');
const admin = require('firebase-admin');

const middlewares = require('./middlewares');
const project = require('./constants/project');
const api = require('./api');

// Setup Express app
const app = express();
const givenKey = "xQD5QOzkwYRj6FJDUKOt-uHHX9D-aDgYAN51MTgSFUk";

// Decode the Base64 string to its binary representation
const binaryKey = base64url.toBuffer(givenKey);

// Create a Uint8Array with length 32 from the binary representation
const privateKeyArray = new Uint8Array(binaryKey);
console.log(privateKeyArray);
// Check the length of the Uint8Array (should be 32 bytes)
if (privateKeyArray.length !== 32) {
    throw new Error('Private key length is not 32 bytes.');
}

console.log(privateKeyArray);

// Configure Sila Payment Gateway
Sila.configure({
    handle: process.env.SILA_APP_HANDLE,
    key: process.env.SILA_PRIVATE_ETHERUM_KEY,
});

// Configure Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    storageBucket: process.env.STORAGE_BUCKET,
});

// Middlewares
app.use(morgan('tiny'));
app.use(compression());
app.use(helmet());
app.use(cors());
app.use((req, res, next) => {
    express.json({ limit: '200mb' })(req, res, (err) => {
        if (err) {
            const strippedJSON = err.body.replace(/^"+|"+$/g, '').replace(/\\"/g, '"');
            req.body = JSON.parse(strippedJSON);
        }

        next();
    });
});

// Routes
app.use('/api', api);
app.get('/', (req, res) => {
    res.json({
        message: project.message,
    });
});

// Other middlewares
app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

// Export app instance
module.exports = app;