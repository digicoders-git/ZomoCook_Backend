const express = require('express');
const router = express.Router();
const { getRoles, createRole, updateRole, deleteRole, getRoleById } = require('../controllers/roleController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
    .get(getRoles)
    .post(createRole);

router.route('/:id')
    .get(getRoleById)
    .put(updateRole)
    .delete(deleteRole);

module.exports = router;
