require('dotenv').config();
const app = require('./app');



console.log(process.env.SILA_PRIVATE_ETHERUM_KEY)


const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});