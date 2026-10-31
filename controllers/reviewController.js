const Review = require('../models/Review');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const User = require('../models/User');
const Application = require('../models/Application');

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
            applicationId,
            cookName,
            role,
            rating,
            tags = [],
            comment = '',
            reviewType = 'trial'
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
            if (applicationId) existingReview.application = applicationId;
            if (reviewType) existingReview.reviewType = reviewType;
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
                application: applicationId || null,
                reviewType: reviewType || 'trial',
                bookingId: bookingIdStr,
                role: role || 'Staff',
                rating: numRating,
                tags,
                comment,
                status: 'approved'
            });
        }

        // Update Application with review if applicationId provided or job/candidate match
        if (applicationId) {
            await Application.findByIdAndUpdate(applicationId, {
                $set: {
                    review: savedReview._id,
                    rating: numRating,
                    reviewComment: comment,
                    reviewTags: tags
                }
            });
        } else if (resolvedJob && candidate) {
            await Application.updateMany(
                { job: resolvedJob._id, candidate: candidate._id },
                {
                    $set: {
                        review: savedReview._id,
                        rating: numRating,
                        reviewComment: comment,
                        reviewTags: tags
                    }
                }
            );
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

        // Send push notification to cook about the new rating
        if (candidate) {
            const notificationController = require('./notificationController');
            const starText = `${numRating}-star`;
            const cookUserId = candidate.createdBy || candidate._id;
            notificationController.sendNotificationToUser({
                userId: cookUserId,
                userModel: 'Candidate',
                title: '⭐ New Customer Rating!',
                message: `You've received a ${starText} rating from a customer. Tap to view your feedback and rating.`,
                type: 'review',
                relatedId: savedReview._id,
                relatedModel: 'Review',
                actionUrl: '/profile/reviews'
            }).catch(err => console.error('Error sending review notification to cook:', err));
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

/**
 * @desc    Get all reviews for admin panel (search, filter, pagination, stats)
 * @route   GET /api/reviews
 * @access  Private (Admin)
 */
exports.getAllReviews = async (req, res) => {
    try {
        const {
            search,
            rating,
            reviewType,
            serviceCategory,
            category,
            dateRange,
            status,
            page = 1,
            limit = 10
        } = req.query;

        let query = {};

        if (status && status !== 'all' && status !== 'All') {
            query.status = status.toLowerCase();
        }

        // Rating filter
        if (rating && rating !== 'all' && rating !== 'All' && rating !== 'All Ratings') {
            const rStr = rating.toString().toLowerCase();
            if (rStr.includes('5')) {
                query.rating = { $gte: 4.8 };
            } else if (rStr.includes('4')) {
                query.rating = rStr.includes('+') || rStr.includes('above') ? { $gte: 3.8 } : { $gte: 3.8, $lt: 4.8 };
            } else if (rStr.includes('3')) {
                query.rating = rStr.includes('+') || rStr.includes('above') ? { $gte: 2.8 } : { $gte: 2.8, $lt: 3.8 };
            } else if (rStr.includes('2')) {
                query.rating = rStr.includes('+') || rStr.includes('above') ? { $gte: 1.8 } : { $gte: 1.8, $lt: 2.8 };
            } else if (rStr.includes('1')) {
                query.rating = { $lt: 2.0 };
            } else {
                const numR = Number(rating);
                if (!isNaN(numR)) query.rating = numR;
            }
        }

        // Date Range filter
        if (dateRange && dateRange !== 'all' && dateRange !== 'All' && dateRange !== 'All Time') {
            const now = new Date();
            const dr = dateRange.toString().toLowerCase().trim();
            if (dr.includes('today')) {
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                query.createdAt = { $gte: start };
            } else if (dr.includes('yesterday')) {
                const start = new Date();
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                const end = new Date();
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                query.createdAt = { $gte: start, $lte: end };
            } else if (dr.includes('7')) {
                const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                query.createdAt = { $gte: start };
            } else if (dr.includes('15')) {
                const start = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
                query.createdAt = { $gte: start };
            } else if (dr.includes('30')) {
                const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                query.createdAt = { $gte: start };
            }
        }

        // Service Category filter (Domestic, Commercial, Chef for Party, Daily Basis)
        const targetCategory = serviceCategory || category || reviewType;
        if (targetCategory && targetCategory !== 'all' && targetCategory !== 'All' && targetCategory !== 'All Categories') {
            const catStr = targetCategory.toString().trim();
            const catRegex = new RegExp(catStr, 'i');
            
            // Find jobs matching category
            const matchingJobs = await Job.find({
                $or: [
                    { jobCategory: catRegex },
                    { category: catRegex },
                    { title: catRegex },
                    { bookingType: catRegex }
                ]
            }).select('_id');
            const jobIds = matchingJobs.map(j => j._id);

            const catFilters = [
                { job: { $in: jobIds } },
                { role: catRegex }
            ];

            const lowCat = catStr.toLowerCase();
            if (lowCat.includes('daily')) {
                catFilters.push({ reviewType: 'booking' });
            } else if (lowCat.includes('party')) {
                catFilters.push({ reviewType: 'trial' });
            }

            query.$and = query.$and || [];
            query.$and.push({ $or: catFilters });
        }

        // Search Filter (Cook Name, Cook ID, Mobile, Customer Name, Booking ID, Comment)
        if (search && search.trim()) {
            const s = search.trim();
            const sRegex = new RegExp(s, 'i');

            // Also check candidates by name or phone
            const matchingCandidates = await Candidate.find({
                $or: [
                    { name: sRegex },
                    { phone: sRegex },
                    { phone: new RegExp(s.replace(/[^0-9]/g, ''), 'i') }
                ]
            }).select('_id');
            const candIds = matchingCandidates.map(c => c._id);

            const cleanId = s.replace(/[^0-9a-fA-F]/g, '');
            if (cleanId.length === 24) {
                candIds.push(cleanId);
            }

            const searchOr = [
                { cookName: sRegex },
                { cook: { $in: candIds } },
                { customerName: sRegex },
                { customerPhone: sRegex },
                { bookingId: sRegex },
                { role: sRegex },
                { comment: sRegex },
                { tags: sRegex }
            ];

            query.$and = query.$and || [];
            query.$and.push({ $or: searchOr });
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;

        const [reviews, totalCount, allReviewsForStats] = await Promise.all([
            Review.find(query)
                .populate('cook', 'name phone profileImage city state address age gender')
                .populate('customer', 'name phone email')
                .populate('job', 'title jobCode jobCategory category bookingType type city')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Review.countDocuments(query),
            Review.find({}) // For overall stats
        ]);

        const totalReviews = allReviewsForStats.length;
        const totalRatingSum = allReviewsForStats.reduce((sum, r) => sum + (r.rating || 5), 0);
        const avgRating = totalReviews > 0 ? parseFloat((totalRatingSum / totalReviews).toFixed(1)) : 5.0;

        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let approvedCount = 0;
        let pendingCount = 0;
        let rejectedCount = 0;

        allReviewsForStats.forEach(r => {
            const star = Math.round(r.rating || 5);
            if (breakdown[star] !== undefined) breakdown[star]++;
            if (r.status === 'approved') approvedCount++;
            else if (r.status === 'rejected') rejectedCount++;
            else pendingCount++;
        });

        res.status(200).json({
            success: true,
            count: reviews.length,
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            currentPage: pageNum,
            stats: {
                totalReviews,
                avgRating,
                breakdown,
                approvedCount,
                pendingCount,
                rejectedCount
            },
            reviews
        });
    } catch (error) {
        console.error('Error fetching all reviews:', error);
        res.status(500).json({ success: false, message: error.message, reviews: [] });
    }
};

/**
 * @desc    Update review status (approve, reject, pending)
 * @route   PATCH /api/reviews/:id/status
 * @access  Private (Admin)
 */
exports.updateReviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['approved', 'pending', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        // If candidate linked, recalculate approved ratings
        if (review.cook) {
            const approvedReviews = await Review.find({ cook: review.cook, status: 'approved' });
            const total = approvedReviews.length;
            const sum = approvedReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
            const avg = total > 0 ? parseFloat((sum / total).toFixed(1)) : 5.0;

            const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            approvedReviews.forEach(r => {
                const star = Math.round(r.rating || 5);
                if (breakdown[star] !== undefined) breakdown[star]++;
            });

            await Candidate.findByIdAndUpdate(review.cook, {
                $set: { rating: avg, totalReviews: total, ratingBreakdown: breakdown }
            });
        }

        res.status(200).json({
            success: true,
            message: `Review status updated to ${status}`,
            review
        });
    } catch (error) {
        console.error('Error updating review status:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete a review
 * @route   DELETE /api/reviews/:id
 * @access  Private (Admin)
 */
exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findByIdAndDelete(id);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        if (review.cook) {
            const approvedReviews = await Review.find({ cook: review.cook, status: 'approved' });
            const total = approvedReviews.length;
            const sum = approvedReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
            const avg = total > 0 ? parseFloat((sum / total).toFixed(1)) : 5.0;

            await Candidate.findByIdAndUpdate(review.cook, {
                $set: { rating: avg, totalReviews: total }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Review deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
