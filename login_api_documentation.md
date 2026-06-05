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

---

## 3. Complete / Update Profile (By Token)
Allows a logged-in user to complete or update their profile details. 
- For **User** (Customer/Client) accounts, this updates their basic customer information.
- For **Cook** (Candidate) accounts, this updates their User account and automatically creates/syncs a corresponding **Candidate** profile in the Candidate collection (making them visible to the Admin Panel's Candidates list).

*   **URL:** `/profile`
*   **Method:** `PUT`
*   **Headers:** `Authorization: Bearer <token>`
*   **Access:** Private (Requires valid JWT token)

### Request Body (Multipart/Form-Data):

#### Common Fields (For both User & Cook roles):
*   `name` (String): Full Name of the user (e.g. `"Amit Kumar"`).
*   `email` (String): Email address of the user (e.g. `"amit@example.com"`). Optional.
*   `address` (String): Complete address of the user.
*   `profilePic` (File Binary): Profile picture image file. Optional.

#### User Role Specific Fields:
*   `propertyCategory` (String): Customer Type. Must be `"Individual"` (for Home/Household) or `"Hotel/Restaurant"` (for Outlets/Business).
*   `outletName` (String): Name of the restaurant/hotel outlet (required/submitted if `propertyCategory` is `"Hotel/Restaurant"`).

#### Cook Role Specific Fields (Basic Profile & Job Preferences):
*   `dob` (Date String): Date of birth (e.g., `"1995-10-15"`).
*   `gender` (String): `"male"`, `"female"`, or `"other"`.
*   `languages` (Array of Strings / JSON String): Languages known (e.g., `["Hindi", "English"]` or `"[ \"Hindi\", \"English\" ]"`).
*   `maritalStatus` (String): `"single"` or `"married"`.
*   `state` (String): State of residence (e.g. `"Uttar Pradesh"`).
*   `city` (String): City of residence (e.g. `"Lucknow"`).
*   `jobCategory` (Array of Strings / JSON String): Job category preferences (e.g. `["hotel", "home"]`).
*   `jobType` (Array of Strings / JSON String): Job type preferences (e.g. `["full-time", "live-in"]`).
*   `jobPositions` (Array of Strings / JSON String): Preferred job roles/positions (e.g. `["Head Chef", "Executive Chef"]`).
*   `preferredCities` (Array of Strings / JSON String): Preferred cities to work in (e.g. `["Lucknow", "Delhi"]`).
*   `experienceValue` (String): Numerical value of total experience (e.g. `"3"`).
*   `experienceUnit` (String): Experience type unit (e.g. `"years"` or `"months"`).
*   `currentSalary` (String): Current salary in INR/month (e.g. `"25000"`).
*   `expectedSalary` (String): Expected salary in INR/month (e.g. `"35000"`).

---

### Success Response (200 OK) - User Role:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "_id": "65c3b9b4f...",
    "name": "Amit Kumar",
    "email": "amit@example.com",
    "phone": "9876543210",
    "profilePic": "uploads/user-1717582522000.jpg",
    "role": {
      "_id": "65c3b99ef...",
      "name": "User",
      "status": "active"
    },
    "propertyCategory": "Hotel/Restaurant",
    "outletName": "Grand Palace Hotel",
    "address": "123, Ring Road, Lucknow",
    "status": "Active",
    "fcmToken": "fcm_token_here"
  }
}
```

### Success Response (200 OK) - Cook Role:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "_id": "65c3b9b4f...",
    "name": "Amit Kumar",
    "email": "amit@example.com",
    "phone": "9876543210",
    "profilePic": "uploads/user-1717582522000.jpg",
    "role": {
      "_id": "65c3b99ef...",
      "name": "Cook",
      "status": "active"
    },
    "address": "123, Ring Road, Lucknow",
    "status": "Active",
    "fcmToken": "fcm_token_here"
  },
  "candidate": {
    "_id": "65c3b9c7f...",
    "name": "Amit Kumar",
    "email": "amit@example.com",
    "phone": "9876543210",
    "dob": "1995-10-15T00:00:00.000Z",
    "gender": "male",
    "languages": ["Hindi", "English"],
    "maritalStatus": "single",
    "state": "Uttar Pradesh",
    "city": "Lucknow",
    "address": "123, Ring Road, Lucknow",
    "profileImage": "uploads/user-1717582522000.jpg",
    "kycStatus": "pending",
    "profileStatus": "active",
    "jobPreference": {
      "jobCategory": ["hotel", "home"],
      "jobType": ["full-time", "live-in"],
      "jobPositions": ["Head Chef"],
      "preferredCities": ["Lucknow"],
      "experience": {
        "value": "3",
        "unit": "years"
      },
      "currentSalary": "25000",
      "expectedSalary": "35000"
    },
    "createdBy": "65c3b9b4f...",
    "creatorModel": "User",
    "applications": [],
    "createdAt": "2026-06-05T07:26:00.000Z",
    "updatedAt": "2026-06-05T07:26:00.000Z"
  }
}
```

### Error Responses:

*   **Token Not Provided / Invalid (401 Unauthorized):**
    ```json
    {
      "success": false,
      "message": "No token provided" // or "Invalid token"
    }
    ```

*   **Email Already in Use (400 Bad Request):**
    ```json
    {
      "success": false,
      "message": "Email is already in use by another user"
    }
    ```


