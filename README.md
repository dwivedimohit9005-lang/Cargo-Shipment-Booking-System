# CargoBook – Cargo Shipment Booking System

A web-based platform where businesses can book cargo shipments, get an instant freight quotation, and track their shipments. Admins manage bookings and edit the freight rates.

**Course:** CSE326 | **Assessment:** CA1 Project-Based Assessment | **Team:** Team 8

## Problem Statement
Businesses that ship large quantities of goods usually have to call logistics companies to share cargo dimensions, weight, destination and transport type, and then wait for a quotation. This is slow and error-prone. CargoBook digitizes the whole process: booking, pricing, status tracking and management.

## Features
- **Sign up / Login** with email and password (passwords are salted and hashed with SHA-256, not stored as plain text)
- **Login protection:** account lock for 60 seconds after 5 wrong attempts
- **Role-based access:** Customers see only their own bookings; Admin sees everything
- **Cargo booking form** with customer, cargo (type, packages, dimensions, weight) and route details
- **Form validation** for name, email, 10-digit phone, dimensions, cities and pickup date
- **Live quotation** that updates while typing, with a full price breakdown
- **Distance-based pricing** using real city coordinates (Haversine formula)
- **Smart rules:** international routes allow only Air/Sea; Sea is allowed only for international routes
- **Manage bookings:** search, filter by status, admin status updates and deletion; customers can cancel Pending bookings
- **Shipment tracking** by booking ID with a status timeline
- **Admin rate editor:** the admin can change every rate and reset to defaults
- **Responsive design** for desktop and mobile

## How the Quotation Is Calculated
1. Chargeable weight = max(actual weight, volumetric weight)
2. Volumetric weight = (L × W × H × packages) / 5000
3. Distance = Haversine distance between cities × route factor (Road 1.25, Rail 1.2, Air 1.05, Sea 1.15)
4. Freight = chargeable weight × (distance / 100) × mode rate, with a minimum charge
5. Added: pickup fee, handling surcharge (by cargo type), fuel surcharge, peak season (Oct–Dec), express pickup (within 2 days)
6. GST is applied on the subtotal

Default rates: Road ₹0.60, Rail ₹0.35, Air ₹1.80, Sea ₹0.25 per kg per 100 km. The admin can change all values in the **Rates** tab.

## Technologies Used
- HTML5, CSS3 (Grid, Flexbox, media queries)
- JavaScript (ES6+)
- Web Crypto API (SHA-256 hashing)
- Browser `localStorage` and `sessionStorage` for data and sessions
- GitHub and GitHub Pages for hosting

## Project Structure
```
cargo-shipment-booking/
├── index.html   # page structure (login, booking, manage, track, rates)
├── style.css    # styling and responsive layout
├── script.js    # logic: auth, quotation, bookings, tracking, rates
└── README.md
```

## How to Run
1. Download or clone the repository
2. Open `index.html` in a browser (or use the VS Code Live Server extension)

## Demo Login
| Role  | Email | Password |
|-------|-------|----------|
| Admin | admin@cargobook.com | Admin@123 |
| Customer | Create your own using **Sign up** | |

## Limitations
- Data is stored in the browser (`localStorage`), so it is not shared between devices.
- Login is front-end only. A real deployment would need a backend server and database.
- Rates are an admin-managed tariff, not a live feed from a freight company.

## Team Members and Contributions
| Name | Reg. No. | Contribution |
|------|----------|--------------|
| Mohit Dwivedi (Team Leader) | 12612823 | Authentication (sign up, login, hashing, lockout), role-based access, GitHub repository, deployment, README |
| Aditya Pratap Singh | 12615930 | HTML structure, CSS and responsive UI, booking form and validation |
| Aakarsh Srivastava | 12617482 | Quotation engine, distance calculation, admin rate editor, manage bookings, tracking |
