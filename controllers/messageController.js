const Message = require('../models/Message');

// @desc    Send a message
// @route   POST /api/chats
// @access  Private
exports.sendMessage = async (req, res) => {
    try {
        const { receiverId, text } = req.body;
        const senderId = req.admin._id;

        if (!receiverId || !text) {
            return res.status(400).json({ success: false, message: 'Receiver and text are required' });
        }

        const message = await Message.create({
            sender: senderId,
            receiver: receiverId,
            text
        });

        res.status(201).json({
            success: true,
            message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get chat history between logged-in user and receiverId
// @route   GET /api/chats/:receiverId
// @access  Private
exports.getMessages = async (req, res) => {
    try {
        const { receiverId } = req.params;
        const senderId = req.admin._id;

        const messages = await Message.find({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        }).sort({ createdAt: 1 });

        res.status(200).json({
            success: true,
            messages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
