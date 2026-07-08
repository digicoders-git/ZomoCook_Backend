const express = require('express');
const router = express.Router();
const { 
    createReplacement, 
    getReplacements, 
    updateReplacement, 
    deleteReplacement,
    getReplacementCandidates,
    assignCandidate,
    resolveReplacement,
    postReplacementJob
} = require('../controllers/replacementController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createReplacement)
    .get(protect, getReplacements); // Assuming protect allows admins too

router.route('/:id')
    .put(protect, admin, updateReplacement)
    .delete(protect, admin, deleteReplacement);

router.route('/:id/candidates')
    .get(protect, admin, getReplacementCandidates);

router.route('/:id/assign-candidate')
    .put(protect, admin, assignCandidate);

router.route('/:id/resolve')
    .put(protect, admin, resolveReplacement);

router.route('/:id/post-job')
    .post(protect, admin, postReplacementJob);

module.exports = router;
