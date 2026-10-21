const Review = require('../models/Review');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const User = require('../models/User');

/**
 * @desc    Submit a review / rating for a cook
 * @route   POST /api/reviews
 * @access  Private (Customer)
 */
exports.submitReview = async (req, res) => {
    try {
        const {
            jobId,
            candidateId,
            cookName,
            role,
            rating,
            tags = [],
            comment = ''
        } = req.body;

        const numRating = Number(rating);
        if (!numRating || numRating < 1 || numRating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }

        const currentUser = req.user || req.admin;
        const customerId = currentUser ? currentUser._id : null;
        const customerName = currentUser?.name || 'Customer';
        const customerPhone = currentUser?.phone || '';

        let resolvedJob = null;
        let bookingIdStr = '';
        if (jobId) {
            const cleanJobId = String(jobId).trim();
            if (cleanJobId.match(/^[0-9a-fA-F]{24}$/)) {
                resolvedJob = await Job.findById(cleanJobId);
            }
            if (!resolvedJob) {
                resolvedJob = await Job.findOne({
                    $or: [
                        { jobCode: cleanJobId },
                        { title: cleanJobId }
                    ]
                });
            }
            if (resolvedJob) {
                bookingIdStr = resolvedJob.jobCode || resolvedJob.title || '';
            }
        }

        // Clean candidateId if object or stringified map was passed
        let cleanCandidateId = candidateId;
        if (cleanCandidateId && typeof cleanCandidateId === 'object') {
            cleanCandidateId = (cleanCandidateId._id || cleanCandidateId.id || '').toString();
        } else if (typeof cleanCandidateId === 'string' && cleanCandidateId.includes('_id')) {
            const m = cleanCandidateId.match(/[0-9a-fA-F]{24}/);
            if (m) cleanCandidateId = m[0];
        }

        // Resolve Candidate
        let candidate = null;
        if (cleanCandidateId && typeof cleanCandidateId === 'string' && cleanCandidateId.match(/^[0-9a-fA-F]{24}$/)) {
            candidate = await Candidate.findById(cleanCandidateId);
            if (!candidate) {
                // Check if candidateId is actually a User id
                candidate = await Candidate.findOne({
                    $or: [
                        { _id: cleanCandidateId },
                        { createdBy: cleanCandidateId }
                    ]
                });
            }
        }

        // If still not found, search by cookName in job assignedStaff
        if (!candidate && resolvedJob && cookName) {
            const staffEntry = (resolvedJob.assignedStaff || []).find(s => 
                (s.name || '').trim().toLowerCase() === cookName.trim().toLowerCase()
            );
            if (staffEntry) {
                if (staffEntry.candidate) {
                    const cId = staffEntry.candidate._id || staffEntry.candidate;
                    candidate = await Candidate.findById(cId);
                }
                if (!candidate && staffEntry.phone) {
                    candidate = await Candidate.findOne({
                        $or: [
                            { phone: staffEntry.phone },
                            { phone: staffEntry.phone.replace('+91', '') },
                            { phone: `+91${staffEntry.phone.replace('+91', '')}` }
                        ]
                    });
                }
            }
        }

        // Also search candidate by cookName directly if not found
        if (!candidate && cookName) {
            candidate = await Candidate.findOne({
                name: new RegExp(`^${cookName.trim()}$`, 'i')
            });
        }

        // Check for existing review by this customer for this cook on this job
        let existingReview = null;
        if (resolvedJob) {
            const orList = [];
            if (candidate) orList.push({ cook: candidate._id });
            if (cookName) orList.push({ cookName: new RegExp(`^${cookName.trim()}$`, 'i') });
            if (orList.length > 0) {
                existingReview = await Review.findOne({
                    job: resolvedJob._id,
                    $or: orList
                });
            }
        }

        let savedReview;
        if (existingReview) {
            existingReview.rating = numRating;
            existingReview.tags = tags;
            existingReview.comment = comment;
            existingReview.role = role || existingReview.role;
            if (customerName) existingReview.customerName = customerName;
            savedReview = await existingReview.save();
        } else {
            savedReview = await Review.create({
                cook: candidate?._id,
                cookUser: candidate?.createdBy,
                cookName: cookName || candidate?.name || 'Cook',
                customer: customerId,
                customerName,
                customerPhone,
                job: resolvedJob?._id,
                bookingId: bookingIdStr,
                role: role || 'Staff',
                rating: numRating,
                tags,
                comment,
                status: 'approved'
            });
        }

        // Update Job assignedStaff entry with rating
        if (resolvedJob && resolvedJob.assignedStaff) {
            let staffMatched = false;
            resolvedJob.assignedStaff.forEach(s => {
                const isMatch = (candidate && s.candidate?.toString() === candidate._id.toString()) ||
                                (cookName && (s.name || '').trim().toLowerCase() === cookName.trim().toLowerCase());
                if (isMatch) {
                    s.review = savedReview._id;
                    s.rating = numRating;
                    staffMatched = true;
                }
            });
            if (staffMatched) {
                await Job.findByIdAndUpdate(resolvedJob._id, {
                    $set: { assignedStaff: resolvedJob.assignedStaff }
                });
            }
        }

        // Recalculate candidate's overall rating & total reviews
        if (candidate) {
            const allCookReviews = await Review.find({
                cook: candidate._id,
                status: 'approved'
            });

            const total = allCookReviews.length;
            const sum = allCookReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
            const avg = total > 0 ? (sum / total) : 5.0;

            const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            allCookReviews.forEach(r => {
                const star = Math.round(r.rating);
                if (breakdown[star] !== undefined) breakdown[star]++;
            });

            const finalRating = parseFloat(avg.toFixed(1));
            await Candidate.findByIdAndUpdate(candidate._id, {
                $set: {
                    rating: finalRating,
                    totalReviews: total,
                    ratingBreakdown: breakdown
                }
            });

            // Also keep job.assignedStaff synced with new candidate rating
            if (resolvedJob && resolvedJob.assignedStaff) {
                resolvedJob.assignedStaff.forEach(s => {
                    const isMatch = (s.candidate?.toString() === candidate._id.toString()) ||
                                    (cookName && (s.name || '').trim().toLowerCase() === cookName.trim().toLowerCase());
                    if (isMatch) {
                        s.rating = finalRating;
                        s.totalReviews = total;
                    }
                });
                await Job.findByIdAndUpdate(resolvedJob._id, {
                    $set: { assignedStaff: resolvedJob.assignedStaff }
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Feedback submitted successfully',
            review: savedReview
        });

    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get cook reviews, rating summary & breakdown
 * @route   GET /api/reviews/cook/:cookId
 * @access  Public / Private
 */
exports.getCookReviews = async (req, res) => {
    try {
        let { cookId } = req.params;
        const currentUser = req.user || req.admin;

        let candidate = null;
        if (cookId && cookId !== 'self' && cookId.match(/^[0-9a-fA-F]{24}$/)) {
            candidate = await Candidate.findById(cookId);
            if (!candidate) {
                candidate = await Candidate.findOne({ createdBy: cookId });
            }
        }

        if ((!candidate || cookId === 'self') && currentUser) {
            candidate = await Candidate.findOne({
                $or: [
                    { _id: currentUser._id },
                    { createdBy: currentUser._id },
                    { phone: currentUser.phone },
                    { phone: `+91${(currentUser.phone || '').replace('+91', '')}` },
                    { phone: (currentUser.phone || '').replace('+91', '') },
                    { email: currentUser.email || '___none___' }
                ]
            });
        }

        const matchQuery = { status: 'approved' };
        if (candidate) {
            matchQuery.$or = [
                { cook: candidate._id },
                { cookUser: candidate.createdBy },
                { cookName: new RegExp(`^${candidate.name.trim()}$`, 'i') }
            ];
        } else if (cookId && cookId !== 'self') {
            matchQuery.$or = [
                { cookName: new RegExp(`^${cookId.trim()}$`, 'i') }
            ];
        } else {
            return res.status(200).json({
                success: true,
                rating: 5.0,
                totalReviews: 0,
                breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
                reviews: []
            });
        }

        const reviews = await Review.find(matchQuery).sort({ createdAt: -1 });

        const totalReviews = reviews.length;
        const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
        const rating = totalReviews > 0 ? parseFloat((sum / totalReviews).toFixed(1)) : (candidate?.rating || 5.0);

        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
            const star = Math.round(r.rating);
            if (breakdown[star] !== undefined) breakdown[star]++;
        });

        res.status(200).json({
            success: true,
            rating,
            totalReviews,
            breakdown,
            reviews
        });

    } catch (error) {
        console.error('Error fetching cook reviews:', error);
        res.status(500).json({ success: false, message: error.message, reviews: [] });
    }
};

/**
 * @desc    Get all reviews submitted for a specific job
 * @route   GET /api/reviews/job/:jobId
 * @access  Private
 */
exports.getJobReviews = async (req, res) => {
    try {
        const { jobId } = req.params;
        const reviews = await Review.find({ job: jobId });
        res.status(200).json({
            success: true,
            reviews
        });
    } catch (error) {
        console.error('Error fetching job reviews:', error);
        res.status(500).json({ success: false, message: error.message, reviews: [] });
    }
};
