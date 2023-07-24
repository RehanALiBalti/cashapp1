const express = require('express');

const project = require('../constants/project');
const v1 = require('./v1/v1.routes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: `${project.message} V1`,
  });
});

router.use('/v1', v1);

module.exports = router;
