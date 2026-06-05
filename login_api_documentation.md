# ZomoCook Role-Based OTP Authentication API

This document details the public API endpoints for the role-based OTP (One-Time Password) Login and Registration flow in the ZomoCook application. Both **Users** (customers/clients) and **Cooks** (candidates) use these endpoints to log in and sign up.

---

## Base URL
`http://localhost:5000/api/admin/users`

---

## 1. Send OTP
Generates and sends a 6-digit verification code to the user's mobile number.

*   **URL:** `/send-otp`
*   **Method:** `POST`
*   **Access:** Public
*   **Request Body:**
    ```json
    {
      "phone": "9876543210"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "OTP sent successfully",
      "otp": "654321" // Note: Returned in response for ease of testing/development
    }
    ```
*   **Error Response (400 Bad Request):**
    ```json
    {
      "success": false,
      "message": "Please provide a phone number"
    }
    ```

---

## 2. Verify OTP & Login/Register (Role-Based)
Verifies the OTP sent to the mobile number. Based on whether the user exists and the requested role, it either registers a new account or logs in an existing one.

*   **URL:** `/verify-otp`
*   **Method:** `POST`
*   **Access:** Public
*   **Request Body:**
    ```json
    {
      "phone": "9876543210",
      "otp": "654321",
      "role": "Cook", // "User" or "Cook". Defaults to "User" if not sent.
      "fcmToken": "fcm_token_here" // Optional
    }
    ```

### Behavior Matrix:
1.  **New User (Phone doesn't exist in DB):**
    *   Creates a new user with the requested `role` (e.g. "User" or "Cook").
    *   Generates default name dynamically: `Cook_<last4digits>` for the `"Cook"` role, and `User_<last4digits>` for the `"User"` role.
    *   Returns status `200 OK` with `isNewUser: true`.
2.  **Existing User (Phone exists, has NO role assigned in DB):**
    *   Assigns the requested role to the user profile.
    *   Saves the FCM token if provided.
    *   Returns status `200 OK` with `isNewUser: false`.
3.  **Existing User (Phone exists, role MATCHES requested role):**
    *   Logs the user in.
    *   Updates the FCM token if provided.
    *   Returns status `200 OK` with `isNewUser: false`.
4.  **Existing User (Phone exists, role MISMATCHES requested role):**
    *   Returns status `400 Bad Request` indicating the phone number is already registered under a different role.

### Success Response (200 OK):
```json
{
  "success": true,
  "message": "Logged in successfully", // or "User registered successfully"
  "isNewUser": false,
  "token": "JWT_BEARER_TOKEN_HERE",
  "user": {
    "_id": "65c3b9b4f...",
    "name": "Cook_3210",
    "email": null,
    "phone": "9876543210",
    "profilePic": "default-user.png",
    "role": {
      "_id": "65c3b99ef...",
      "name": "Cook",
      "permissions": [],
      "status": "active",
      "createdAt": "2026-06-05T06:12:00.000Z",
      "updatedAt": "2026-06-05T06:12:00.000Z"
    },
    "status": "Active",
    "fcmToken": "fcm_token_here"
  }
}
```

### Error Responses:

*   **Invalid OTP (400 Bad Request):**
    ```json
    {
      "success": false,
      "message": "Invalid or expired OTP"
    }
    ```

*   **Role Mismatch (400 Bad Request):**
    ```json
    {
      "success": false,
      "message": "This phone number is already registered as a User."
    }
    ```

*   **Inactive Account (401 Unauthorized):**
    ```json
    {
      "success": false,
      "message": "Your account is currently inactive. Please contact Admin."
    }
    ```
