const User = require('../models/User');
const Otp = require('../models/Otp');
const Role = require('../models/Role');
const Candidate = require('../models/Candidate');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '365d',
    });
};

/**
 * @desc    Get all staff users
 * @route   GET /api/users
 * @access  Private
 */
exports.getUsers = async (req, res) => {
    try {
        const { search, role, status } = req.query;
        let query = {};
        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') },
                { phone: new RegExp(search, 'i') }
            ];
        }
        if (role) {
            query.role = role;
        }

        if (status) query.status = status;

        if (!role) {
            // Exclude app roles (Cook, User, Customer) from Staff User List
            const rolesToExclude = await Role.find({ 
                name: { $in: [new RegExp('^cook$', 'i'), new RegExp('^user$', 'i'), new RegExp('^customer$', 'i')] } 
            });
            const excludedRoleIds = rolesToExclude.map(r => r._id);
            if (excludedRoleIds.length > 0) {
                query.role = { $nin: excludedRoleIds };
            }
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;

        const total = await User.countDocuments(query);
        const users = await User.find(query).populate('role').sort({ createdAt: -1 }).skip(startIndex).limit(limit);
        
        res.status(200).json({ 
            success: true, 
            count: users.length, 
            total,
            page,
            totalPages: Math.ceil(total / limit),
            users 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get staff user by ID
 * @route   GET /api/users/:id
 * @access  Private
 */
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate('role');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Create new staff user
 * @route   POST /api/users
 * @access  Private
 */
exports.createUser = async (req, res) => {
    try {
        const { name, email, phone, password, role, status, jobActions } = req.body;
        
        if (email) {
            const userExists = await User.findOne({ email });
            if (userExists) return res.status(400).json({ success: false, message: 'User with this email already exists' });
        }

        const userData = { name, email, phone, password, role, status, jobActions };
        if (req.file) userData.profilePic = req.file.path;

        const user = await User.create(userData);
        res.status(201).json({ success: true, message: 'User created successfully', user });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update staff user
 * @route   PUT /api/users/:id
 * @access  Private
 */
exports.updateUser = async (req, res) => {
    try {
        if (req.body.password) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            req.body.password = await bcrypt.hash(req.body.password, salt);
        }

        if (req.file) req.body.profilePic = req.file.path;

        const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: false
        });

        if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found' });

        res.status(200).json({ success: true, message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete staff user
 * @route   DELETE /api/users/:id
 * @access  Private
 */
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Send OTP to mobile number
 * @route   POST /api/admin/users/send-otp
 * @access  Public
 */
exports.sendOtp = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Please provide a phone number' });
        }

        // Generate 6 digit random OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Delete any existing OTP for this phone
        await Otp.deleteMany({ phone });

        // Save OTP to database
        await Otp.create({ phone, otp });

        console.log(`[OTP Verification] Generated OTP for ${phone}: ${otp}`);

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            otp // Returning OTP directly for testing/development convenience
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Verify OTP and Register/Login
 * @route   POST /api/admin/users/verify-otp
 * @access  Public
 */
exports.verifyOtp = async (req, res) => {
    try {
        const { phone, otp, fcmToken, role: requestedRole } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Please provide phone and OTP' });
        }

        // Default role to 'Customer' if not provided or if 'User' is requested (to map app users to customers)
        let roleName = requestedRole || 'Customer';
        if (roleName.toLowerCase() === 'user') {
            roleName = 'Customer';
        }

        // Find or create the Role document
        let roleDoc = await Role.findOne({ name: { $regex: new RegExp(`^${roleName}$`, 'i') } });
        if (!roleDoc) {
            roleDoc = await Role.create({ name: roleName });
        }

        // Find the latest OTP record
        const otpRecord = await Otp.findOne({ phone, otp });
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // OTP verified, delete it
        await Otp.deleteOne({ _id: otpRecord._id });

        // Check if user already exists
        let user = await User.findOne({ phone }).populate('role');
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            // First time user, register
            const defaultName = roleDoc.name.toLowerCase() === 'cook'
                ? `Cook_${phone.slice(-4)}`
                : `User_${phone.slice(-4)}`;

            const userData = {
                phone,
                name: defaultName,
                status: 'Active',
                role: roleDoc._id
            };
            if (fcmToken && fcmToken !== 'optional_fcm_token' && fcmToken.length > 20) {
                userData.fcmToken = fcmToken;
            }
            user = await User.create(userData);
            // Populate role for response consistency
            user = await User.findById(user._id).populate('role');
        } else {
            // Existing user
            // If user has no role assigned, assign the requested role
            if (!user.role) {
                user.role = roleDoc._id;
                if (fcmToken && fcmToken !== 'optional_fcm_token' && fcmToken.length > 20) {
                    user.fcmToken = fcmToken;
                }
                await user.save();
                user = await User.findById(user._id).populate('role');
            } else {
                // Existing user - log in with existing role and update fcmToken if a real token is provided
                if (fcmToken && fcmToken !== 'optional_fcm_token' && fcmToken.length > 20) {
                    user.fcmToken = fcmToken;
                    await user.save();
                }
            }
        }

        // Ensure Customer record exists if the role is Customer (so they appear in CustomerList)
        if (roleDoc.name.toLowerCase() === 'customer') {
            const Customer = require('../models/Customer');
            let customerDoc = await Customer.findOne({ contactPhone: phone });
            if (!customerDoc) {
                await Customer.create({
                    name: user.name || `User_${phone.slice(-4)}`,
                    contactName: user.name || `User_${phone.slice(-4)}`,
                    contactPhone: phone,
                    createdBy: user._id,
                    creatorModel: 'User'
                });
            } else if (!customerDoc.createdBy) {
                customerDoc.createdBy = user._id;
                customerDoc.creatorModel = 'User';
                await customerDoc.save();
            }
        }

        // Check if user is active
        const currentStatus = (user.status || 'Active').toLowerCase();
        if (currentStatus === 'inactive' || currentStatus === 'cancelled' || currentStatus === 'expired') {
            return res.status(401).json({ success: false, message: 'Your account is currently inactive. Please contact Admin.' });
        }

        res.status(200).json({
            success: true,
            message: isNewUser ? 'User registered successfully' : 'Logged in successfully',
            isNewUser,
            token: generateToken(user._id),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                profilePic: user.profilePic,
                role: user.role,
                status: user.status,
                fcmToken: user.fcmToken
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update current logged-in user profile
 * @route   PUT /api/admin/users/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.admin._id;
        const {
            name, email, propertyCategory, address, outletName,
            // Cook specific fields
            dob, gender, languages, maritalStatus, state, city,
            jobCategory, jobType, jobPositions, preferredCities,
            experienceValue, experienceUnit, currentSalary, expectedSalary,
            skills, about
        } = req.body;

        // Helper to parse JSON fields safely
        const parseJsonField = (field) => {
            if (!field) return undefined;
            if (typeof field === 'string') {
                try {
                    return JSON.parse(field);
                } catch (e) {
                    return [field];
                }
            }
            return field;
        };

        // Find user first
        let user = await User.findById(userId).populate('role');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Validate email uniqueness if email is changed
        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email, _id: { $ne: userId } });
            if (emailExists) {
                return res.status(400).json({ success: false, message: 'Email is already in use by another user' });
            }
            user.email = email;
        }

        // Update User fields
        if (name) user.name = name;
        if (propertyCategory) user.propertyCategory = propertyCategory;
        if (address) user.address = address;
        if (outletName) user.outletName = outletName;
        if (about !== undefined) user.about = about;
        if (skills) user.skills = Array.isArray(skills) ? skills : JSON.parse(skills);

        // Handle profile picture file upload
        if (req.file) {
            user.profilePic = req.file.path;
        }

        await user.save();

        // If user has 'Cook' role, create or update Candidate profile
        let candidate = null;
        if (user.role && user.role.name && user.role.name.toLowerCase() === 'cook') {
            candidate = await Candidate.findOne({ phone: user.phone });

            const candidateData = {};
            
            if (user.name) candidateData.name = user.name;
            if (user.email) candidateData.email = user.email;
            if (user.phone) candidateData.phone = user.phone;
            if (req.body.dob) candidateData.dob = new Date(req.body.dob);
            if (req.body.gender) candidateData.gender = req.body.gender;
            if (req.body.languages) candidateData.languages = parseJsonField(req.body.languages);
            if (req.body.maritalStatus) candidateData.maritalStatus = req.body.maritalStatus;
            if (req.body.state) candidateData.state = req.body.state;
            if (req.body.city) candidateData.city = req.body.city;
            if (req.body.address) candidateData.address = req.body.address;
            if (user.profilePic) candidateData.profileImage = user.profilePic;

            // Handle complex fields if passed as JSON strings or arrays directly
            const complexFields = ['cookingSkills', 'workExperience', 'education', 'careerHighlights', 'socialMedia', 'skills', 'documents'];
            complexFields.forEach(field => {
                if (req.body[field]) {
                    if (typeof req.body[field] === 'string') {
                        try {
                            candidateData[field] = JSON.parse(req.body[field]);
                        } catch (e) {
                            console.log(`Field ${field} is not valid JSON`);
                        }
                    } else {
                        candidateData[field] = req.body[field];
                    }
                }
            });

            // Handle jobPreference if passed either as object or flat fields
            if (req.body.jobPreference) {
                candidateData.jobPreference = typeof req.body.jobPreference === 'string' ? JSON.parse(req.body.jobPreference) : req.body.jobPreference;
            } else if (req.body.jobCategory || req.body.jobType || req.body.jobPositions || req.body.preferredCities || req.body.experienceValue) {
                candidateData.jobPreference = candidate && candidate.jobPreference ? { ...candidate.jobPreference } : {};
                if (req.body.jobCategory) candidateData.jobPreference.jobCategory = parseJsonField(req.body.jobCategory);
                if (req.body.jobType) candidateData.jobPreference.jobType = parseJsonField(req.body.jobType);
                if (req.body.jobPositions) candidateData.jobPreference.jobPositions = parseJsonField(req.body.jobPositions);
                if (req.body.preferredCities) candidateData.jobPreference.preferredCities = parseJsonField(req.body.preferredCities);
                if (req.body.currentSalary) candidateData.jobPreference.currentSalary = req.body.currentSalary;
                if (req.body.expectedSalary) candidateData.jobPreference.expectedSalary = req.body.expectedSalary;
                if (req.body.experienceValue || req.body.experienceUnit) {
                    candidateData.jobPreference.experience = {
                        value: req.body.experienceValue || candidateData.jobPreference.experience?.value || '0',
                        unit: req.body.experienceUnit || candidateData.jobPreference.experience?.unit || 'years'
                    };
                }
            }

            candidateData.createdBy = user._id;
            candidateData.creatorModel = 'User';

            if (!candidate) {
                candidate = await Candidate.create(candidateData);
            } else {
                candidate = await Candidate.findByIdAndUpdate(candidate._id, candidateData, { new: true });
            }
        } else if (user.role && user.role.name && user.role.name.toLowerCase() === 'customer') {
            const Customer = require('../models/Customer');
            let customerDoc = await Customer.findOne({ contactPhone: user.phone });
            
            const customerData = {
                createdBy: user._id,
                creatorModel: 'User'
            };
            if (user.name) {
                customerData.name = user.name;
                customerData.contactName = user.name;
            }
            if (user.email) customerData.email = user.email;
            if (user.phone) customerData.contactPhone = user.phone;
            if (user.propertyCategory) customerData.propertyCategory = user.propertyCategory;
            if (user.address) customerData.contactAddress = user.address;
            if (user.profilePic) customerData.profilePic = user.profilePic;

            if (!customerDoc) {
                await Customer.create(customerData);
            } else {
                await Customer.findByIdAndUpdate(customerDoc._id, customerData, { new: true });
            }
        }

        // Get fully updated user object
        const updatedUser = await User.findById(userId).populate('role');

        const responseData = {
            success: true,
            message: 'Profile updated successfully',
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                profilePic: updatedUser.profilePic,
                role: updatedUser.role,
                propertyCategory: updatedUser.propertyCategory,
                address: updatedUser.address,
                outletName: updatedUser.outletName,
                status: updatedUser.status,
                fcmToken: updatedUser.fcmToken
            }
        };

        if (candidate) {
            responseData.candidate = candidate;
        }

        res.status(200).json(responseData);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get current logged-in user profile
 * @route   GET /api/admin/users/profile
 * @access  Private
 */
exports.getProfile = async (req, res) => {
    try {
        const userId = req.admin._id;
        const user = await User.findById(userId).populate('role');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let candidate = null;
        if (user.role && user.role.name && user.role.name.toLowerCase() === 'cook') {
            candidate = await Candidate.findOne({ phone: user.phone });
        }

        // Calculate profile completion %
        const profileFields = ['name', 'email', 'phone', 'profilePic', 'address'];
        const cookFields = ['dob', 'gender', 'state', 'city', 'languages', 'maritalStatus'];
        const cookPrefFields = ['jobCategory', 'jobType', 'jobPositions', 'preferredCities', 'currentSalary', 'expectedSalary'];
        let totalFields = profileFields.length;
        let filledFields = profileFields.filter(f => user[f] && user[f] !== 'default-user.png').length;
        if (user.skills && user.skills.length > 0) { totalFields++; filledFields++; }
        if (user.about) { totalFields++; filledFields++; }

        if (candidate) {
            totalFields += cookFields.length + cookPrefFields.length;
            filledFields += cookFields.filter(f => candidate[f] && (Array.isArray(candidate[f]) ? candidate[f].length > 0 : true)).length;
            const pref = candidate.jobPreference || {};
            filledFields += cookPrefFields.filter(f => pref[f] && (Array.isArray(pref[f]) ? pref[f].length > 0 : pref[f])).length;
        }
        const profileCompletion = Math.round((filledFields / totalFields) * 100);

        const responseData = {
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                profilePic: user.profilePic,
                role: user.role,
                propertyCategory: user.propertyCategory,
                address: user.address,
                outletName: user.outletName,
                status: user.status,
                fcmToken: user.fcmToken,
                skills: user.skills,
                about: user.about,
                activePlan: user.activePlan,
                planExpiryDate: user.planExpiryDate,
                currentJobPostLimit: user.currentJobPostLimit,
                jobsPostedInCurrentPlan: user.jobsPostedInCurrentPlan,
                profileCompletion,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        };

        if (candidate) {
            responseData.candidate = candidate;
        }

        res.status(200).json(responseData);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


