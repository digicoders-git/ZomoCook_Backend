const express = require('express');
const router = express.Router();
const {
    createCandidate,
    getCandidates,
    getCandidate,
    updateCandidate,
    deleteCandidate,
    toggleCandidateStatus,
    getApplications,
    getCandidateMe,
    updateCandidateMe,
    generateResumeHtml
} = require('../controllers/candidateController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `candidate-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });
const cpUpload = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'cv', maxCount: 1 },
    { name: 'idProof', maxCount: 1 },
    { name: 'addressProof', maxCount: 1 },
    { name: 'policeVerification', maxCount: 1 },
    { name: 'academicCertificate', maxCount: 1 },
    { name: 'experienceCertificate', maxCount: 1 },
    { name: 'gallery', maxCount: 10 }
]);

router.route('/')
    .get(protect, getCandidates)
    .post(protect, cpUpload, createCandidate);

router.route('/applications')
    .get(protect, getApplications);

router.get('/:id/resume-cv', generateResumeHtml);

router.route('/me')
    .get(protect, getCandidateMe)
    .put(protect, cpUpload, updateCandidateMe);

router.route('/:id')
    .get(protect, getCandidate)
    .put(protect, cpUpload, updateCandidate)
    .delete(protect, deleteCandidate);

router.route('/:id/status')
    .patch(protect, toggleCandidateStatus);

module.exports = router;
