# ZomoCook Banner Management API Documentation

This document details the API endpoints for managing and retrieving promotional banners in the ZomoCook application.

---

## Base URL
`https://zomocook-backend.onrender.com/api/banners`

---

## Endpoints Overview

| HTTP Method | Endpoint | Access | Description |
|---|---|---|---|
| **POST** | `/` | Private (Admin/Staff) | Create/Upload a new banner |
| **GET** | `/` | Public | Retrieve list of banners |
| **GET** | `/:id` | Public | Retrieve details of a single banner |
| **PUT** | `/:id` | Private (Admin/Staff) | Update an existing banner's details/image |
| **DELETE** | `/:id` | Private (Admin/Staff) | Delete banner and remove image file |

---

## 1. Create New Banner
Creates a new banner. The image is uploaded, and the reference link and title are stored.

*   **URL:** `/`
*   **Method:** `POST`
*   **Headers:**
    *   `Authorization: Bearer <token>`
    *   `Content-Type: multipart/form-data`
*   **Request Body (form-data):**
    *   `title` (String, Optional) - Name/Title of the banner (e.g. "50% Discount on First Booking")
    *   `link` (String, Optional) - Redirect URL when clicked (e.g. "https://zomocook.com/promo-details")
    *   `status` (String, Optional) - `"active"` or `"inactive"` (Defaults to `"active"`)
    *   `image` (File Binary, Required) - Banner image file (JPEG, PNG, etc.)
*   **Success Response (201 Created):**
    ```json
    {
      "success": true,
      "message": "Banner created successfully",
      "banner": {
        "_id": "65c3b9b4f74d0a12e3456789",
        "title": "50% Discount on First Booking",
        "image": "uploads/banner-1717582522000.jpg",
        "link": "https://zomocook.com/promo-details",
        "status": "active",
        "createdBy": "65c3b99ef74d0a12e3456711",
        "createdAt": "2026-06-05T07:15:00.000Z",
        "updatedAt": "2026-06-05T07:15:00.000Z"
      }
    }
    ```
*   **Error Responses:**
    *   **Image Missing (400 Bad Request):**
        ```json
        {
          "success": false,
          "message": "Please upload a banner image"
        }
        ```
    *   **Unauthorized (401 Unauthorized):**
        ```json
        {
          "success": false,
          "message": "No token provided" // or "Invalid token"
        }
        ```

---

## 2. Get All Banners List
Retrieves a list of all banner documents. This is a public API used by mobile apps or the website homepage.

*   **URL:** `/`
*   **Method:** `GET`
*   **Access:** Public
*   **Query Parameters:**
    *   `status` (String, Optional) - Filter by status (e.g. `?status=active` or `?status=inactive`).
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "count": 2,
      "banners": [
        {
          "_id": "65c3b9b4f74d0a12e3456789",
          "title": "50% Discount on First Booking",
          "image": "uploads/banner-1717582522000.jpg",
          "link": "https://zomocook.com/promo-details",
          "status": "active",
          "createdBy": "65c3b99ef74d0a12e3456711",
          "createdAt": "2026-06-05T07:15:00.000Z",
          "updatedAt": "2026-06-05T07:15:00.000Z"
        },
        {
          "_id": "65c3b9c8f74d0a12e3456790",
          "title": "Weekend Chef Specials",
          "image": "uploads/banner-1717582680000.png",
          "link": "https://zomocook.com/specials",
          "status": "active",
          "createdBy": "65c3b99ef74d0a12e3456711",
          "createdAt": "2026-06-05T07:20:00.000Z",
          "updatedAt": "2026-06-05T07:20:00.000Z"
        }
      ]
    }
    ```

---

## 3. Get Single Banner
Retrieves details of a single banner by its MongoDB ID.

*   **URL:** `/:id`
*   **Method:** `GET`
*   **Access:** Public
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "banner": {
        "_id": "65c3b9b4f74d0a12e3456789",
        "title": "50% Discount on First Booking",
        "image": "uploads/banner-1717582522000.jpg",
        "link": "https://zomocook.com/promo-details",
        "status": "active",
        "createdBy": "65c3b99ef74d0a12e3456711",
        "createdAt": "2026-06-05T07:15:00.000Z",
        "updatedAt": "2026-06-05T07:15:00.000Z"
      }
    }
    ```
*   **Error Response (404 Not Found):**
    ```json
    {
      "success": false,
      "message": "Banner not found"
    }
    ```

---

## 4. Update Banner
Updates the properties of a banner. If a new image file is sent, the old image is deleted from the server disk and replaced with the new one.

*   **URL:** `/:id`
*   **Method:** `PUT`
*   **Headers:**
    *   `Authorization: Bearer <token>`
    *   `Content-Type: multipart/form-data`
*   **Request Body (form-data):**
    *   `title` (String, Optional)
    *   `link` (String, Optional)
    *   `status` (String, Optional) - `"active"` or `"inactive"`
    *   `image` (File Binary, Optional) - New image file to replace the old one.
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Banner updated successfully",
      "banner": {
        "_id": "65c3b9b4f74d0a12e3456789",
        "title": "Updated Banner Title",
        "image": "uploads/banner-1717582999000.jpg", // New updated image path
        "link": "https://zomocook.com/new-destination",
        "status": "inactive",
        "createdBy": "65c3b99ef74d0a12e3456711",
        "createdAt": "2026-06-05T07:15:00.000Z",
        "updatedAt": "2026-06-05T07:22:00.000Z"
      }
    }
    ```

---

## 5. Delete Banner
Deletes the banner record from the database and deletes the physical image file from the server uploads directory.

*   **URL:** `/:id`
*   **Method:** `DELETE`
*   **Headers:**
    *   `Authorization: Bearer <token>`
*   **Success Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Banner deleted successfully"
    }
    ```
