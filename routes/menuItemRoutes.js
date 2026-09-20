const express = require('express');
const router = express.Router();
const {
  getMenuItems,
  getActiveMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  seedMenuItems
} = require('../controllers/menuItemController');

router.route('/')
  .get(getMenuItems)
  .post(createMenuItem);

router.route('/active')
  .get(getActiveMenuItems);

router.route('/seed')
  .post(seedMenuItems);

router.route('/:id')
  .put(updateMenuItem)
  .delete(deleteMenuItem);

module.exports = router;
