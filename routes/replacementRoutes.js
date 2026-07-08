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
    postReplacementJob,
    getMyReplacements
} = require('../controllers/replacementController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createReplacement)
    .get(protect, getReplacements); // Assuming protect allows admins too

router.route('/my-replacements')
    .get(protect, getMyReplacements);

router.route('/:id')
    .put(protect, updateReplacement)
    .delete(protect, deleteReplacement);

router.route('/:id/candidates')
    .get(protect, getReplacementCandidates);

router.route('/:id/assign-candidate')
    .put(protect, assignCandidate);

router.route('/:id/resolve')
    .put(protect, resolveReplacement);

router.route('/:id/post-job')
    .post(protect, postReplacementJob);

module.exports = router;
