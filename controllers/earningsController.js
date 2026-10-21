const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const Job = require('../models/Job');

/**
 * @desc    Get cook earnings (self or by candidateId) including Daily Basis Staff and Chef for Party
 * @route   GET /api/earnings
 * @access  Private / Public with query
 */
const getCookEarnings = async (req, res) => {
    try {
        const currentUser = req.user || req.admin;
        let candidateId = req.query.cookId || req.query.candidateId;

        let candidate = null;
        if (candidateId && candidateId !== 'self' && candidateId.match(/^[0-9a-fA-F]{24}$/)) {
            candidate = await Candidate.findById(candidateId);
        }

        // If 'self' or candidateId not found as Candidate doc, resolve from logged in user
        if (!candidate && currentUser) {
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

        const candIds = [];
        if (candidate) candIds.push(candidate._id.toString());
        if (currentUser) candIds.push(currentUser._id.toString());
        if (candidateId && candidateId !== 'self' && !candIds.includes(candidateId)) {
            candIds.push(candidateId);
        }

        const candPhones = [];
        const addPhone = (p) => {
            if (!p) return;
            const clean = p.toString().trim();
            const raw = clean.replace('+91', '').trim();
            if (raw && !candPhones.includes(raw)) candPhones.push(raw);
            if (clean && !candPhones.includes(clean)) candPhones.push(clean);
            const withPlus = `+91${raw}`;
            if (!candPhones.includes(withPlus)) candPhones.push(withPlus);
        };

        if (candidate?.phone) addPhone(candidate.phone);
        if (currentUser?.phone) addPhone(currentUser.phone);

        if (candIds.length === 0 && candPhones.length === 0) {
            return res.status(200).json({
                success: true,
                totalEarnings: 0,
                pendingEarnings: 0,
                withdrawnEarnings: 0,
                earningsList: [],
                message: 'No cook profile found for earnings'
            });
        }

        const seenJobIds = new Set();
        const earningsList = [];
        let totalEarnings = 0;
        let pendingEarnings = 0;

        // ── 1. Daily Basis Staff & Chef for Party from Job.assignedStaff ───────────────
        const assignedJobsQuery = {
            $or: [
                { 'assignedStaff.candidate': { $in: candIds } },
                { 'assignedStaff.phone': { $in: candPhones } }
            ]
        };

        const assignedJobs = await Job.find(assignedJobsQuery).sort({ createdAt: -1 });

        for (const job of assignedJobs) {
            const jobIdStr = job._id.toString();
            if (seenJobIds.has(jobIdStr)) continue;
            seenJobIds.add(jobIdStr);

            // Find matching staff entry
            const staffEntry = (job.assignedStaff || []).find(s => {
                const sCand = s.candidate?.toString();
                const sPhone = (s.phone || '').replace('+91', '').trim();
                return (sCand && candIds.includes(sCand)) || (sPhone && candPhones.includes(sPhone));
            }) || job.assignedStaff?.[0];

            const assignedRole = staffEntry?.role || 'Staff';
            const staffStatus = (staffEntry?.status || job.status || 'Assigned').toLowerCase();

            const isParty = job.jobCategory === 'party' || 
                            job.bookingType === 'party' || 
                            (job.hiringType && job.hiringType.toLowerCase().includes('party')) ||
                            (job.title && job.title.toLowerCase().includes('party')) ||
                            (job.partyRequirement && Object.keys(job.partyRequirement).length > 0);

            const isDaily = !isParty && (
                            job.jobCategory === 'daily' || 
                            job.bookingType === 'daily' || 
                            (job.hiringType && job.hiringType.toLowerCase().includes('daily')) ||
                            (job.staffRequirements && job.staffRequirements.length > 0) ||
                            (job.title && job.title.toLowerCase().startsWith('daily staff'))
            );

            let amount = 0;
            let title = '';
            let categoryLabel = '';

            if (isDaily) {
                categoryLabel = 'Daily Basis Staff';
                // Look up matching requirement for role
                const matchingReq = (job.staffRequirements || []).find(r => 
                    (r.role || '').toLowerCase() === assignedRole.toLowerCase()
                ) || job.staffRequirements?.[0];

                const rawRate = Number(matchingReq?.ratePerDay) || Number(matchingReq?.rate) || 0;
                const rate = rawRate > 0 ? Math.round(rawRate * 0.75) : 0;
                const days = Number(matchingReq?.days) || Number(matchingReq?.noOfDays) || 1;

                if (rate > 0) {
                    amount = rate * days;
                } else if (job.pricing?.perDayPrice) {
                    amount = Math.round(Number(job.pricing.perDayPrice) * 0.75) * Number(job.pricing.numberOfDays || 1);
                } else {
                    const parsed = parseInt((job.salaryRange || job.salary || '0').replace(/[^0-9]/g, ''), 10);
                    amount = isNaN(parsed) || parsed === 0 ? 600 * days : Math.round(parsed * 0.75);
                }

                title = `Daily Staff: ${assignedRole} (${days} Day${days > 1 ? 's' : ''})`;
            } else if (isParty) {
                categoryLabel = 'Chef for Party';
                const partyDays = job.partyRequirement?.datesCount || (Array.isArray(job.eventDays) && job.eventDays.length > 0 ? job.eventDays.length : 1);
                
                const matchingReq = (job.staffRequirements || []).find(r => 
                    (r.role || '').toLowerCase() === assignedRole.toLowerCase()
                ) || job.staffRequirements?.[0];

                const rate = Number(matchingReq?.ratePerDay) || 0;
                if (rate > 0) {
                    amount = rate * partyDays;
                } else if (job.pricing?.staffCharges) {
                    amount = Number(job.pricing.staffCharges);
                } else {
                    const parsed = parseInt((job.salary || '1999').replace(/[^0-9]/g, ''), 10);
                    amount = isNaN(parsed) || parsed === 0 ? 1999 * partyDays : parsed;
                }

                const eventName = job.event || job.occasion || 'Party Event';
                title = `Chef for Party: ${eventName} (${partyDays} Day${partyDays > 1 ? 's' : ''})`;
            } else {
                categoryLabel = job.jobCategory === 'home' ? 'Domestic Cook' : 'Commercial Chef';
                const parsed = parseInt((job.salary || job.salaryRange || '0').replace(/[^0-9]/g, ''), 10);
                amount = isNaN(parsed) ? 0 : parsed;
                title = job.title || `${categoryLabel} Position`;
            }

            const isDone = staffStatus === 'completed' || staffStatus === 'closed' || staffStatus === 'duty marked completed' || job.jobCompletedAt != null;
            const isStarted = staffStatus === 'started' || staffStatus === 'in_progress';

            if (isDone || isStarted) {
                totalEarnings += amount;
            } else {
                pendingEarnings += amount;
            }

            earningsList.push({
                id: jobIdStr,
                jobId: jobIdStr,
                title,
                category: categoryLabel,
                jobCategory: job.jobCategory || (isParty ? 'party' : (isDaily ? 'daily' : 'domestic')),
                role: assignedRole,
                date: staffEntry?.completedAt || staffEntry?.startedAt || staffEntry?.assignedAt || job.updatedAt || job.createdAt,
                amount: `₹${amount.toLocaleString('en-IN')}`,
                rawAmount: amount,
                status: isDone ? 'Completed' : (isStarted ? 'In Progress' : 'Upcoming')
            });
        }

        // ── 2. Other Hired Applications from Application Model ────────────────────────
        const hiredApps = await Application.find({
            $or: [
                { candidate: { $in: candIds } },
                { user: { $in: candIds } }
            ],
            status: { $in: ['Hired', 'Offer Accepted', 'Joined', 'Completed', 'Assigned', 'Selected', 'Package Paid', 'Package Selected'] }
        }).populate('job').sort({ updatedAt: -1 });

        for (const app of hiredApps) {
            if (!app.job) continue;
            const jobIdStr = app.job._id ? app.job._id.toString() : app.job.toString();
            if (seenJobIds.has(jobIdStr)) continue;
            seenJobIds.add(jobIdStr);

            const j = app.job;
            const isParty = j.jobCategory === 'party' || j.bookingType === 'party';
            const isDaily = j.jobCategory === 'daily' || j.bookingType === 'daily' || (j.staffRequirements && j.staffRequirements.length > 0);

            let amount = 0;
            let title = j.title || 'Hired Job';
            let categoryLabel = isParty ? 'Chef for Party' : (isDaily ? 'Daily Basis Staff' : (j.jobCategory === 'home' ? 'Domestic Cook' : 'Commercial Chef'));

            if (isDaily && j.staffRequirements && j.staffRequirements.length > 0) {
                const reqItem = j.staffRequirements[0];
                const rawRate = Number(reqItem.ratePerDay) || 800;
                const rate = Math.round(rawRate * 0.75);
                const days = Number(reqItem.days) || 1;
                amount = rate * days;
                title = `Daily Staff: ${app.appliedRole || reqItem.role || 'Staff'} (${days} Days)`;
            } else if (isParty) {
                amount = Number(j.pricing?.staffCharges) || parseInt((j.salary || '1999').replace(/[^0-9]/g, ''), 10) || 1999;
                title = `Chef for Party: ${j.event || j.occasion || 'Party Event'}`;
            } else {
                const salaryStr = j.salary || j.expectedSalary || j.salaryRange || '0';
                const parsed = parseInt(salaryStr.replace(/[^0-9]/g, ''), 10);
                amount = isNaN(parsed) ? 0 : parsed;
            }

            const appStatus = (app.status || 'Hired').toLowerCase();
            const isDone = appStatus === 'completed' || appStatus === 'hired' || appStatus === 'joined' || appStatus === 'offer accepted';

            if (isDone) {
                totalEarnings += amount;
            } else {
                pendingEarnings += amount;
            }

            earningsList.push({
                id: app._id,
                jobId: jobIdStr,
                title,
                category: categoryLabel,
                jobCategory: j.jobCategory || (isParty ? 'party' : (isDaily ? 'daily' : 'domestic')),
                role: app.appliedRole || 'Staff',
                date: app.updatedAt || app.createdAt,
                amount: `₹${amount.toLocaleString('en-IN')}`,
                rawAmount: amount,
                status: isDone ? 'Completed' : 'Upcoming'
            });
        }

        res.status(200).json({
            success: true,
            totalEarnings,
            pendingEarnings,
            withdrawnEarnings: 0,
            earningsList,
            count: earningsList.length
        });
    } catch (error) {
        console.error('Error fetching cook earnings:', error);
        res.status(500).json({ success: false, message: error.message, totalEarnings: 0, earningsList: [] });
    }
};

module.exports = {
    getCookEarnings
};
