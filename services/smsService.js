/**
 * Muzztech SMS Service
 * Handles SMS and OTP sending using Muzztech API and DLT templates.
 */

const MUZZTECH_BASE_URL = process.env.MUZZTECH_BASE_URL || 'https://connect.muzztech.com';
const DEFAULT_SENDER_NAME = process.env.MUZZTECH_SENDER_NAME || 'ZOMOC';
const DEFAULT_OTP_TEMPLATE_ID = process.env.MUZZTECH_OTP_TEMPLATE_ID || '1777178758492846293';

/**
 * Normalize phone number to standard 10-digit format for Indian numbers
 * @param {string} phone
 * @returns {string}
 */
const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    // Strip non-digit characters
    let cleaned = phone.toString().replace(/[^0-9]/g, '');

    // If phone starts with country code 91 and has 12 digits, strip 91
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        cleaned = cleaned.substring(2);
    }
    // If phone starts with leading 0 and has 11 digits, strip 0
    else if (cleaned.length === 11 && cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    return cleaned;
};

/**
 * Send an OTP SMS via Muzztech API
 * DLT Template: "Your Zomocook verification OTP is {#num#}. This OTP is valid for 10 minutes. Do not share this OTP with anyone."
 * Template ID: 1777178758492846293
 * Sender ID: ZOMOC
 * 
 * @param {string} phone - Recipient phone number
 * @param {string} otp - 6 digit OTP
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
const sendOtpSms = async (phone, otp) => {
    const apiKey = process.env.MUZZTECH_API_KEY;
    const formattedPhone = formatPhoneNumber(phone);

    if (!formattedPhone) {
        return {
            success: false,
            message: 'Invalid phone number provided'
        };
    }

    const senderName = process.env.MUZZTECH_SENDER_NAME || DEFAULT_SENDER_NAME;
    const templateId = process.env.MUZZTECH_OTP_TEMPLATE_ID || DEFAULT_OTP_TEMPLATE_ID;
    const message = `Your Zomocook verification OTP is ${otp}. This OTP is valid for 10 minutes. Do not share this OTP with anyone.`;

    if (!apiKey || apiKey === 'YOUR_MUZZTECH_API_KEY') {
        console.warn(`[SMS Service] Warning: MUZZTECH_API_KEY is not configured in .env. SMS not sent to ${formattedPhone}. (Simulated in development: OTP is ${otp})`);
        return {
            success: true,
            simulated: true,
            message: 'SMS simulated (API key not configured in .env)',
            data: { phone: formattedPhone, otp }
        };
    }

    try {
        const payload = {
            api_key: apiKey,
            phone_number: formattedPhone,
            sender_name: senderName,
            message: message,
            template_id: templateId
        };

        const response = await fetch(`${MUZZTECH_BASE_URL}/api/sms/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log(`[SMS Service] ✅ OTP SMS sent successfully to ${formattedPhone}. Message ID: ${data.data?.messageid || 'N/A'}`);
            return {
                success: true,
                message: data.message || 'OTP SMS sent successfully',
                data: data.data
            };
        } else {
            console.error(`[SMS Service] ❌ Muzztech SMS API Error:`, data);
            return {
                success: false,
                message: data.message || 'Failed to send SMS via Muzztech API',
                error: data
            };
        }
    } catch (error) {
        console.error(`[SMS Service] ❌ Network/Request error while sending SMS:`, error.message);
        return {
            success: false,
            message: error.message || 'Internal error sending SMS'
        };
    }
};

/**
 * Send a general SMS via Muzztech
 * @param {Object} options
 * @param {string} options.phoneNumber - Recipient mobile number
 * @param {string} options.message - Message content matching DLT template
 * @param {string} [options.senderName] - Sender ID (defaults to ZOMOC)
 * @param {string} [options.templateId] - DLT template ID
 * @param {number} [options.unicode] - 2 for Unicode characters
 * @param {string} [options.time] - Scheduled time (YYYY-MM-DD HH:MM:SS)
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
const sendSms = async ({ phoneNumber, message, senderName, templateId, unicode, time }) => {
    const apiKey = process.env.MUZZTECH_API_KEY;
    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (!formattedPhone) {
        return { success: false, message: 'Invalid phone number provided' };
    }

    if (!apiKey || apiKey === 'YOUR_MUZZTECH_API_KEY') {
        console.warn(`[SMS Service] Warning: MUZZTECH_API_KEY not configured. Simulated SMS to ${formattedPhone}`);
        return {
            success: true,
            simulated: true,
            message: 'SMS simulated (API key not configured)'
        };
    }

    try {
        const payload = {
            api_key: apiKey,
            phone_number: formattedPhone,
            sender_name: senderName || DEFAULT_SENDER_NAME,
            message: message,
            ...(templateId && { template_id: templateId }),
            ...(unicode && { unicode }),
            ...(time && { time })
        };

        const response = await fetch(`${MUZZTECH_BASE_URL}/api/sms/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`[SMS Service] ❌ Error in sendSms:`, error.message);
        return { success: false, message: error.message };
    }
};

/**
 * Check SMS Balance from Muzztech
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
const checkSmsBalance = async () => {
    const apiKey = process.env.MUZZTECH_API_KEY;
    if (!apiKey) {
        return { success: false, message: 'MUZZTECH_API_KEY not set in .env' };
    }

    try {
        const response = await fetch(`${MUZZTECH_BASE_URL}/api/sms/balance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ api_key: apiKey })
        });

        return await response.json();
    } catch (error) {
        return { success: false, message: error.message };
    }
};

/**
 * Check Delivery Report (DLR) status for a message
 * @param {string} msgid - Message ID from send SMS response
 * @returns {Promise<{success: boolean, data?: any}>}
 */
const checkDlrStatus = async (msgid) => {
    const apiKey = process.env.MUZZTECH_API_KEY;
    if (!apiKey) {
        return { success: false, message: 'MUZZTECH_API_KEY not set in .env' };
    }

    try {
        const response = await fetch(`${MUZZTECH_BASE_URL}/api/sms/dlrStatus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ api_key: apiKey, msgid })
        });

        return await response.json();
    } catch (error) {
        return { success: false, message: error.message };
    }
};

module.exports = {
    formatPhoneNumber,
    sendOtpSms,
    sendSms,
    checkSmsBalance,
    checkDlrStatus,
    DEFAULT_SENDER_NAME,
    DEFAULT_OTP_TEMPLATE_ID
};
