# ZomoCook Admin API Documentation

This document contains the details of the Admin APIs for the ZomoCook Admin Panel.

## Base URL
`http://localhost:5000/api`

---

## 1. Admin Authentication

### Login
*   **URL:** `/admin/login`
*   **Method:** `POST`
*   **Description:** Authenticates an admin and returns a JWT token (valid for 365 days).
*   **Request Body:**
    ```json
    {
      "email": "admin@zomocook.in",
      "password": "admin@123"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Login successful",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "admin": {
        "id": "admin_id",
        "name": "Zomo Cook",
        "email": "admin@zomocook.in",
        "phone": "8009534847",
        "profilePic": "url_to_pic"
      }
    }
    ```

### Register (Create Admin)
*   **URL:** `/admin/register`
*   **Method:** `POST`
*   **Description:** Creates a new admin account.
*   **Request Body:**
    ```json
    {
      "name": "Zomo Cook",
      "email": "admin@zomocook.in",
      "phone": "8009534847",
      "password": "admin@123"
    }
    ```
*   **Success Response (201 Created):**
    ```json
    {
      "success": true,
      "message": "Admin registered successfully",
      "admin": {
        "id": "admin_id",
        "name": "Zomo Cook",
        "email": "admin@zomocook.in"
      }
    }
    ```

---

## 2. Profile Management

### Get Profile
*   **URL:** `/admin/profile`
*   **Method:** `GET`
*   **Description:** Retrieves the current admin's profile.
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "admin": {
        "name": "Zomo Cook",
        "email": "admin@zomocook.in",
        "phone": "8009534847",
        "profilePic": "url_to_pic"
      }
    }
    ```

### Update Profile
*   **URL:** `/admin/profile`
*   **Method:** `PUT`
*   **Description:** Updates the admin's profile information.
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body (Multipart/Form-Data):**
    *   `name`: "Updated Name"
    *   `email`: "updated@email.com"
    *   `phone`: "9876543210"
    *   `profilePic`: [File Binary] (Optional)
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Profile updated successfully",
      "admin": { ...updated data }
    }
    ```

### Change Password
*   **URL:** `/admin/change-password`
*   **Method:** `PUT`
*   **Description:** Changes the admin's password.
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "currentPassword": "oldpassword123",
      "newPassword": "newpassword456"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Password changed successfully"
    }
    ```

---

## 3. Customer Management

### Create Customer
*   **URL:** `/customers`
*   **Method:** `POST`
*   **Description:** Creates a new customer/client record.
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body (Multipart/Form-Data):**
    *   `name`: "Grand Palace Hotel"
    *   `propertyCategory`: "hotel"
    *   `email`: "client@palace.com"
    *   `password`: "client123"
    *   `contactName`: "John Doe"
    *   `contactPhone`: "9876543210"
    *   `contactAddress`: "123, Main Street, Delhi"
    *   `customerStatus`: "running" (Options: running, closed)
    *   `accountStatus`: "active" (Options: active, inactive)
    *   `profilePic`: [File Binary] (Optional)
*   **Success Response (201 Created):**
    ```json
    {
      "success": true,
      "message": "Customer created successfully",
      "customer": { ...data }
    }
    ```

### Get All Customers
*   **URL:** `/customers`
*   **Method:** `GET`
*   **Description:** Retrieves a list of all customers.
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "count": 10,
      "customers": [ ...array of customers ]
    }
    ```

### Get Single Customer
*   **URL:** `/customers/:id`
*   **Method:** `GET`
*   **Description:** Retrieves details of a specific customer.
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "customer": { ...data }
    }
    ```

### Update Customer
*   **URL:** `/customers/:id`
*   **Method:** `PUT`
*   **Description:** Updates a customer record.
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body (Multipart/Form-Data):**
    *   Same fields as Create (all optional)
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Customer updated successfully"
    }
    ```

### Delete Customer
*   **URL:** `/customers/:id`
*   **Method:** `DELETE`
*   **Description:** Deletes a customer record.
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Customer deleted successfully"
    }
    ```

### Toggle Account Status
*   **URL:** `/customers/:id/status`
*   **Method:** `PATCH`
*   **Description:** Toggles the account status (Active/Inactive).
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Account status updated",
      "accountStatus": "inactive"
    }
    ```
}

## 4. Job Management

### Create Job
*   **URL:** `/api/jobs`
*   **Method:** `POST`
*   **Description:** Creates a new job record.
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body (Multipart/Form-Data):**

#### 1. Common Fields (Required for ALL categories)
| Field | Type | Description |
| :--- | :--- | :--- |
| `jobCategory` | String | "hotel" \| "home" \| "daily" |
| `title` | String | Job Title |
| `customer` | ID | MongoDB ID of the Customer/Client |
| `overview` | String | Job overview/description |
| `responsibilities`| String | Key responsibilities |
| `requirements` | String | Qualification/Skills |
| `status` | String | "new" \| "active" |
| `jobType` | String | "Full Time" \| "Part Time" |
| `jobPosition` | String | Position (e.g. Manager) |
| `image` | File | Job image (Optional) |

#### 2. Hotel Job Fields (`jobCategory: "hotel"`)
| Field | Type | Example |
| :--- | :--- | :--- |
| `propertyCategory`| String | "5 Star Hotel", "Resort" |
| `state` | String | "Maharashtra" |
| `city` | String | "Mumbai" |
| `basicFacility` | String | "Accommodation", "Meals", "Both" |
| `otherFacilities` | String | "Medical", "Transport" |
| `packageOrGuestOrVacancy` | String | "10" (Vacancy count) |
| `allowedLeave` | String | "2 Days/Month" |
| `salaryRange` | String | "₹20,000 - ₹30,000" |
| `experienceRange` | String | "2-5 Years" |
| `joiningType` | String | "Immediate" |
| `benefits` | String | Long text benefits |

#### 3. Home Cook Job Fields (`jobCategory: "home"`)
| Field | Type | Example |
| :--- | :--- | :--- |
| `propertyCategory`| String | "Villa", "Bungalow" |
| `state` | String | "Delhi" |
| `city` | String | "Noida" |
| `foodPreference` | String | "Veg Only", "Non-Veg Allowed" |
| `cookingCategory` | String | "Breakfast", "Lunch", "All Three" |
| `basicFacility` | String | "Accommodation" |
| `packageOrGuestOrVacancy` | String | "8" (No. of Guests) |
| `allowedLeave` | String | "1 Day/Month" |
| `salaryRange` | String | "₹15,000 - ₹25,000" |
| `experienceRange` | String | "5+ Years" |
| `joiningType` | String | "15 Days" |
| `benefits` | String | Long text benefits |

#### 4. Daily Pay Job Fields (`jobCategory: "daily"`)
| Field | Type | Example |
| :--- | :--- | :--- |
| `state` | String | "UP" |
| `city` | String | "Lucknow" |
| `event` | String | "Wedding", "Birthday" |
| `dateOfEvent` | Date | "2024-12-25" |
| `foodPreference` | String | "Multi-Cuisine" |
| `mealPreference` | String | "Buffet" |
| `servingTime` | String | "Evening" |
| `menuDetails` | String | "Starters, Main course..." |
| `package` | String | "₹5,000 / day" |
| `noOfGuests` | String | "250" |
| `benefits` | String | "Travel Allowance" (Short text) |

*   **Success Response (201 Created):**
    ```json
    {
      "success": true,
      "message": "Job created successfully",
      "job": { ...data }
    }
    ```

### Get All Jobs
*   **URL:** `/api/jobs`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "count": 10,
      "jobs": [
        {
          "_id": "...",
          "title": "Head Chef",
          "customer": {
            "_id": "...",
            "name": "Customer Name",
            "email": "...",
            "contactPhone": "..."
          },
          "jobCategory": "hotel",
          "isActive": true,
          ...
        }
      ]
    }
    ```

### Get Single Job
*   **URL:** `/api/jobs/:id`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`

### Update Job
*   **URL:** `/api/jobs/:id`
*   **Method:** `PUT`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:** (Same as Create Job)

### Delete Job
*   **URL:** `/api/jobs/:id`
*   **Method:** `DELETE`
*   **Headers:** `Authorization: Bearer <token>`

### Toggle Job Status
*   **URL:** `/api/jobs/:id/status`
*   **Method:** `PATCH`
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response:**
    ```json
    {
      "success": true,
      "message": "Job status updated to Active",
      "isActive": true
    }
    ```

## 5. Candidate Management

### Create Candidate Profile
*   **URL:** `/api/candidates`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body (Multipart/Form-Data):**
    *   **Files:** `image`, `cv`, `idProof`, `addressProof`, `policeVerification`, `academicCertificate`, `experienceCertificate`, `gallery`
    *   **Fields:** `name`, `email`, `phone`, `altPhone`, `dob`, `gender`, `maritalStatus`, `state`, `city`, `address`, `idProofType`
    *   **Complex Fields (JSON):** `languages`, `jobPreference`, `cookingSkills`, `workExperience`, `careerHighlights`, `socialMedia`

### Update Candidate Profile
*   **URL:** `/api/candidates/:id`
*   **Method:** `PUT`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:** Same as Create (Multipart/Form-Data). Existing files will be replaced; gallery will be appended.

### Get Candidates (List with Filtering)
*   **URL:** `/api/candidates`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Query Parameters:** `search`, `city`, `gender`, `jobCategory`, `kycStatus`, `profileStatus`
*   **Role Isolation:** Staff users will only see candidates they created. Super Admins see all.

### Get Single Candidate
*   **URL:** `/api/candidates/:id`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`

### Get Applications (Status-Based Lists)
*   **URL:** `/api/candidates/applications`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Query Parameters:** `status` ("Applied" | "Shortlisted" | "Demo Scheduled" | etc.), `jobId`, `search`

### KYC & Profile Status Toggle
*   **URL:** `/api/candidates/:id/status`
*   **Method:** `PATCH`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:** `{ "type": "kyc" | "profile", "value": "approved" | "rejected" | "active" | "inactive" }`

### Delete Candidate
*   **URL:** `/api/candidates/:id`
*   **Method:** `DELETE`
*   **Headers:** `Authorization: Bearer <token>`
*   **Description:** Permanently removes candidate record and all associated files.

---

## 6. Notification Management

### Create Notification
*   **URL:** `/api/notifications`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body (Multipart/Form-Data):**
    *   `title`: String (Required) - e.g., "New Job Opportunity"
    *   `message`: String (Required) - Detailed notification message
    *   `target`: String (Required) - "all" | "candidates" | "customers"
    *   `image`: [File Binary] (Optional) - Notification banner/image
    *   `status`: String - "active" | "inactive" (Default: "active")
*   **Description:** Creates a new notification and broadcasts it to the target audience.

### Get Notifications List
*   **URL:** `/api/notifications`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Query Parameters:** `search`, `target`, `status`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "count": 5,
      "notifications": [
        {
          "_id": "...",
          "title": "...",
          "message": "...",
          "image": "uploads/notification-123.jpg",
          "target": "all",
          "status": "active",
          "createdAt": "2026-05-01T10:00:00Z"
        }
      ]
    }
    ```

### Get Single Notification
*   **URL:** `/api/notifications/:id`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`

### Toggle Notification Status
*   **URL:** `/api/notifications/:id/status`
*   **Method:** `PATCH`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:** `{ "status": "active" | "inactive" }`

### Delete Notification
*   **URL:** `/api/notifications/:id`
*   **Method:** `DELETE`
*   **Headers:** `Authorization: Bearer <token>`
*   **Description:** Permanently removes a notification record and its associated image.

---

## 7. Query Management (Inquiries)

### Get Queries List
*   **URL:** `/api/queries`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Query Parameters:** `search`, `page`, `limit`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "count": 10,
      "queries": [
        {
          "_id": "...",
          "name": "Arti Mishra",
          "email": "arti@example.com",
          "phone": "8303941040",
          "message": "Urgently need a job",
          "createdAt": "2026-03-30T18:17:00Z"
        }
      ]
    }
    ```

### Delete Query
*   **URL:** `/api/queries/:id`
*   **Method:** `DELETE`
*   **Headers:** `Authorization: Bearer <token>`
*   **Description:** Removes an inquiry record.

### Submit Query (Public)
*   **URL:** `/api/queries`
*   **Method:** `POST`
*   **Description:** Allows visitors to submit a new inquiry. (Does not require Auth token).
*   **Request Body:** `{ "name": "...", "email": "...", "phone": "...", "message": "..." }`

---

## 8. Role and Permission Management

### Create Role
*   **URL:** `/api/roles`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Manager",
      "permissions": ["Dashboard", "Candidates", "Jobs"],
      "status": "active"
    }
    ```

### Get Roles List
*   **URL:** `/api/roles`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "count": 3,
      "roles": [ { "_id": "...", "name": "Manager", "permissions": [...], "status": "active" } ]
    }
    ```

### Update Role
*   **URL:** `/api/roles/:id`
*   **Method:** `PUT`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:** Same as Create (optional fields)

### Delete Role
*   **URL:** `/api/roles/:id`
*   **Method:** `DELETE`
*   **Headers:** `Authorization: Bearer <token>`
*   **Description:** Removes a role. (Note: Check if any admin is assigned to this role before deletion).

---

## 9. User Management (Staff/Admins)
*Note: Staff users are stored in a dedicated `User` collection, separate from the core `Admin` entity.*

### Create System User
*   **URL:** `/api/admin/users`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body (Multipart/Form-Data):**
    *   `name`: "Staff Name"
    *   `email`: "staff@example.com"
    *   `phone`: "9876543210"
    *   `password`: "securepass123"
    *   `role`: "role_id" (MongoDB ID of the Role)
    *   `status`: "active" | "inactive"
    *   `profilePic`: [File Binary] (Optional)

### Get Users List
*   **URL:** `/api/admin/users`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Query Parameters:** `search`, `role`, `status`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "count": 5,
      "users": [ 
        { 
          "_id": "...", 
          "name": "...", 
          "email": "...", 
          "role": { "_id": "...", "name": "Manager" }, 
          "status": "active" 
        } 
      ]
    }
    ```

### Update User
*   **URL:** `/api/admin/users/:id`
*   **Method:** `PUT`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body (Multipart/Form-Data):** Same as Create (optional fields)

### Delete User
*   **URL:** `/api/admin/users/:id`
*   **Method:** `DELETE`
*   **Headers:** `Authorization: Bearer <token>`
*   **Description:** Removes a system user.

---

## 10. Masters Management (Generic Data)

### Get Master List
*   **URL:** `/api/masters/:category`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Query Parameters:** `search`, `parentId`
*   **Description:** Fetches data for a specific master category (e.g., `job-menu`, `job-positions`, `benefits`, etc.)

### Create Master Record
*   **URL:** `/api/masters/:category`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Value Name",
      "parentId": "optional_id",
      "value": "optional_metadata",
      "status": "active"
    }
    ```

---

## 10.1 Specific Master: Job Menu
This master handles the relationship between Job Positions and their respective Menu items.

### Add Job Menu Item
*   **URL:** `/api/masters/job-menu`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "parentId": "POSITION_ID", // MongoDB ID from job-positions
      "name": "Menu Item Name",  // e.g. "Main Course", "Starter"
      "status": "active"
    }
    ```
*   **Response (201 Created):**
    ```json
    {
      "success": true,
      "message": "Record created successfully",
      "master": {
        "_id": "...",
        "category": "job-menu",
        "name": "...",
        "parentId": "...",
        "status": "active"
      }
    }
    ```

---

## 10.2 Specific Master: Job Positions
This master defines available roles (e.g., Waiter, Chef) and their associated brand colors.

### Add Job Position
*   **URL:** `/api/masters/job-positions`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Waiter",
      "value": "#FF5733", // Hex Color Code for branding
      "status": "active"
    }
    ```

### Get Job Positions List
*   **URL:** `/api/masters/job-positions`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.3 Specific Master: Skill Categories
Groups skills into categories under specific job positions.

### Add Skill Category
*   **URL:** `/api/masters/skill-categories`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "parentId": "POSITION_ID", // Link to Job Position
      "name": "Cooking Skills",
      "status": "active"
    }
    ```

### Get Skill Categories List
*   **URL:** `/api/masters/skill-categories`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Description:** Returns categories with populated `parentId` (Position).

---

## 10.4 Specific Master: Skills
Individual skills within a category.

### Add Skill
*   **URL:** `/api/masters/skills`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "parentId": "CATEGORY_ID", // Link to Skill Category
      "name": "Indian Food",
      "status": "active"
    }
    ```

### Get Skills List
*   **URL:** `/api/masters/skills`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Description:** Returns skills with populated `parentId` (Category).

---

## 10.5 Specific Master: Job Types
Defines employment types (e.g., Full Time, Part Time, Live In).

### Add Job Type
*   **URL:** `/api/masters/job-types`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Full Time",
      "status": "active"
    }
    ```

### Get Job Types List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.6 Specific Master: Experience Ranges
Defines experience brackets (e.g., 0-2 Years).

### Add Experience Range
*   **URL:** `/api/masters/experience-ranges`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Years",           // Type (e.g. "Years")
      "experienceFrom": "0",    // From Value
      "experienceTo": "2",      // To Value
      "status": "active"
    }
    ```

### Get Experience Ranges List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.7 Specific Master: Salary Ranges
Defines salary brackets (e.g., 20k - 30k).

### Add Salary Range
*   **URL:** `/api/masters/salary-ranges`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "INR",           // Currency Type
      "salaryFrom": "20000",   // From Value
      "salaryTo": "30000",     // To Value
      "status": "active"
    }
    ```

### Get Salary Ranges List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.8 Specific Master: Time Ranges
Defines time slots (e.g., 9:00 AM - 6:00 PM).

### Add Time Range
*   **URL:** `/api/masters/time-ranges`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Shift 1",        // Optional Name/Label
      "timeFrom": "09:00 AM",
      "timeTo": "06:00 PM",
      "status": "active"
    }
    ```

### Get Time Ranges List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.9 Specific Master: Cooking Categories
Defines cooking styles/categories (e.g., Veg, Non-Veg, Chinese).

### Add Cooking Category
*   **URL:** `/api/masters/cooking-categories`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Chinese",
      "status": "active"
    }
    ```

### Get Cooking Categories List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.10 Specific Master: Events
Defines event types (e.g., Birthday Party, Wedding).

### Add Event
*   **URL:** `/api/masters/events`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Wedding",
      "status": "active"
    }
    ```

### Get Events List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.11 Specific Master: Cooking Preferences
Defines preferences like "Spicy", "Less Oil" under specific categories.

### Add Cooking Preference
*   **URL:** `/api/masters/cooking-preferences`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "parentId": "CATEGORY_ID", // Meal Type or Cooking Category
      "name": "Less Spicy",
      "status": "active"
    }
    ```

### Get Cooking Preferences List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.12 Specific Master: Facilities
Defines facilities like "AC", "WiFi" under specific property types.

### Add Facility
*   **URL:** `/api/masters/facilities`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "parentId": "CATEGORY_ID", // Property Type/Category
      "name": "Air Conditioning",
      "status": "active"
    }
    ```

### Get Facilities List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.13 Specific Master: Benefits
Defines employee benefits (e.g., Accommodation, Insurance).

### Add Benefit
*   **URL:** `/api/masters/benefits`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Accommodation",
      "status": "active"
    }
    ```

### Get Benefits List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.14 Specific Master: Property Categories
Defines types of properties (e.g., Hotel, Restaurant, Resort).

### Add Property Category
*   **URL:** `/api/masters/property-categories`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Restaurant",
      "status": "active"
    }
    ```

### Get Property Categories List
*   **Headers:** `Authorization: Bearer <token>`

---

## 10.15 Specific Master: Sliders
Defines homepage sliders/banners.

### Add Slider
*   **URL:** `/api/masters/sliders`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
*   **Request Body (form-data):**
    *   `name`: "Main Banner" (Title)
    *   `image`: [File]
    *   `status`: "active"

### Get Sliders List
*   **URL:** `/api/masters/sliders`
*   **Method:** `GET`
*   **Headers:** (None required - Public)

---

## 10.16 Specific Master: Videos
Defines featured videos (e.g., Recipes, Tutorials).

### Add Video
*   **URL:** `/api/masters/videos`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
*   **Request Body (form-data):**
    *   `name`: "Recipe Tutorial" (Title)
    *   `link`: "https://youtube.com/..." (Video Url)
    *   `status`: "active"

### Get Videos List
*   **URL:** `/api/masters/videos`
*   **Method:** `GET`
*   **Headers:** (None required - Public)

---

## 10.17 Specific Master: CMS
Defines static page content (e.g., About Us, Privacy Policy).

### Add CMS Record
*   **URL:** `/api/masters/cms`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
*   **Request Body (form-data):**
    *   `name`: "About Us" (Pagename)
    *   `heading`: "Our Journey" (Heading)
    *   `content`: "<p>Rich text content...</p>" (Description)
    *   `status`: "active"

### Get CMS Records List
*   **URL:** `/api/masters/cms`
*   **Method:** `GET`
*   **Headers:** (None required - Public)

---

## 10.18 Specific Master: States (Location)
Defines geographical states.

### Add State
*   **URL:** `/api/masters/states`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "name": "Maharashtra",
      "status": "active"
    }
    ```

### Get States List
*   **URL:** `/api/masters/states`
*   **Method:** `GET`
*   **Headers:** (None required - Public)

---

## 10.19 Specific Master: Cities (Location)
Defines cities linked to states.

### Add City
*   **URL:** `/api/masters/cities`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:**
    ```json
    {
      "parentId": "STATE_ID",
      "name": "Mumbai",
      "status": "active"
    }
    ```

### Get Cities List
*   **URL:** `/api/masters/cities`
*   **Method:** `GET`
*   **Headers:** (None required - Public)

### Get Job Menu List
*   **URL:** `/api/masters/job-menu`
*   **Method:** `GET`
*   **Response (200 OK):** `masters` array will include `parentId` populated with the Position details.

### Update Master Record
*   **URL:** `/api/masters/:id`
*   **Method:** `PUT`
*   **Headers:** `Authorization: Bearer <token>`

### Delete Master Record
*   **URL:** `/api/masters/:id`
*   **Method:** `DELETE`
*   **Headers:** `Authorization: Bearer <token>`

---

### Supported Master Categories:
`job-menu`, `skill-categories`, `skills`, `job-types`, `job-positions`, `experience-ranges`, `salary-ranges`, `time-ranges`, `cooking-categories`, `events`, `cooking-preferences`, `facilities`, `benefits`, `property-categories`, `sliders`, `videos`, `cms`, `states`, `cities`
---

## 11. Web Settings Management

### Get Web Settings
*   **URL:** `/api/settings`
*   **Method:** `GET`
*   **Description:** Retrieves all website configuration settings.
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "settings": {
        "siteName": "ZomoCook",
        "companyEmail": "info@zomocook.in",
        "contactNumber": "+91 8009534847",
        "logo": "uploads/setting-123.png",
        "favicon": "uploads/setting-456.png",
        "fullAddress": "Duplex Technologies, Lucknow, Uttar Pradesh, India",
        "copyrightText": "© 2026 ZomoCook. All Rights Reserved.",
        "googleMapScript": "<iframe>...</iframe>",
        "facebookUrl": "...",
        "instagramUrl": "...",
        "twitterUrl": "...",
        "linkedinUrl": "...",
        "youtubeUrl": "...",
        "importantInstruction": "...",
        "rescheduleMessage": "..."
      }
    }
    ```

### Update Web Settings
*   **URL:** `/api/settings`
*   **Method:** `PUT`
*   **Description:** Updates website configuration settings.
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body (Multipart/Form-Data):**
    *   **Files:**
        *   `logo`: [File Binary] (Optional)
        *   `favicon`: [File Binary] (Optional)
    *   **Fields:** 
        *   `siteName`, `companyEmail`, `contactNumber`
        *   `fullAddress`, `copyrightText`, `googleMapScript`
        *   `facebookUrl`, `instagramUrl`, `twitterUrl`, `linkedinUrl`, `youtubeUrl`
        *   `importantInstruction`, `rescheduleMessage`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Settings updated successfully",
      "settings": { ...updatedData }
    }
    ```
---

## 12. Dashboard Statistics

### Get Dashboard Data
*   **URL:** `/api/dashboard`
*   **Method:** `GET`
*   **Description:** Retrieves all statistical data for the admin dashboard, including counts, chart data, and position distribution.
*   **Headers:** `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "stats": {
        "totalJobs": 34,
        "totalCandidates": 29,
        "totalCustomers": 5,
        "pendingCandidates": 11,
        "totalApplications": 13,
        "newApplied": 8,
        "shortlisted": 3,
        "demoScheduled": 1,
        "hired": 1,
        "rescheduleRequested": 0,
        "rejected": 0,
        "onHold": 0,
        "notInterested": 0
      },
      "charts": {
        "categoryDistribution": [
          { "_id": "hotel", "count": 20 },
          { "_id": "home", "count": 10 },
          { "_id": "daily", "count": 4 }
        ],
        "applicationGrowth": [
          { "_id": { "month": 4, "year": 2026 }, "count": 5 },
          ...
        ],
        "statusOverview": [
          { "_id": "Applied", "count": 8 },
          ...
        ]
      },
      "tableData": [
        {
          "position": "Chef",
          "jobs": 5,
          "vacancy": 10,
          "applied": 2,
          "assigned": 1,
          "demo": 1,
          "reschedule": 0,
          "rejected": 0,
          "onHold": 0,
          "hired": 1
        },
        ...
      ]
    }
    ```
