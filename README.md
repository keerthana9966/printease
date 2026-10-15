# 🖨️ PrintEase — VNR VJIET Online Stationery Management

> No queues. No waiting. Upload your document, pay via UPI, and pick up on your schedule.

A full-stack web application built for VNR VJIET campus that lets students order printouts online and vendors manage the print queue — all in real-time.

---

## ✨ Features

### For Students (Customers)
- 📤 **Upload files** — PDF, DOCX, PPTX (up to 50 MB)
- 📄 **Auto page count** — detects exact number of pages from PDF
- 💰 **Instant cost calculator** — B&W (₹2.50/pg) or Colour (₹12/pg), binding, double-sided
- 🕐 **Pick a time slot** — 9 AM to 5:30 PM in 30-min intervals
- 💳 **UPI payment** — Google Pay, PhonePe, Paytm, BHIM
- 📦 **Live order tracking** — pending → printing → ready → collected

### For Vendors (Staff)
- 📊 **Live dashboard** — today's orders, pending, ready, revenue
- 🖨️ **Print queue** — see all active orders with student name, file, pages, slot
- ✅ **Status management** — Start → Mark Ready → Collected with one click
- 📈 **Hourly chart** — orders per hour for the day
- 🔔 **Activity feed** — real-time notifications panel

### Security
- 🔐 **Role-based auth** — customer and vendor login are **completely separate endpoints**
- 🔑 **Vendor invite code** — vendors need a secret code to register
- 🎫 **JWT tokens** — 7-day sessions, stored in localStorage
- 🛡️ **Route guards** — vendor pages are 100% inaccessible to customers

---

## 🚀 Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/keerthana9966/printease.git
cd printease
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your MongoDB Atlas URI, Cloudinary credentials, etc.
```

### 4. Run the server
```bash
node server.js
```

Open **http://localhost:5000** in your browser. ✅

> **Note:** If MongoDB Atlas is unreachable, the server automatically falls back to an in-memory database for development. Data resets on restart.

---

## 🗄️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (single file, no framework) |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| File Storage | Cloudinary (raw uploads) |
| PDF Parsing | pdf-parse (page counting) |
| File Upload | Multer (memory storage) |
| Dev DB Fallback | mongodb-memory-server |

---

## 📋 API Reference

### Authentication (Role-Separated)

```
POST /api/auth/register/customer    Register student
POST /api/auth/register/vendor      Register vendor (requires invite code)
POST /api/auth/login/customer       Student login
POST /api/auth/login/vendor         Vendor login (SEPARATE endpoint)
GET  /api/auth/me                   Get current user
```

### Orders (Customer)

```
POST /api/orders/upload             Upload file → returns page count + Cloudinary URL
POST /api/orders/calculate          Calculate cost (no auth required)
POST /api/orders/place              Place confirmed order
GET  /api/orders/my                 My order history
GET  /api/orders/track/:orderId     Track any order (public)
```

### Vendor Dashboard

```
GET   /api/vendor/dashboard         Metrics + queue + hourly chart
GET   /api/vendor/orders            All orders (filter: ?status=pending&date=today)
GET   /api/vendor/orders/:orderId   Full order details + file URL
PATCH /api/vendor/orders/:id/status Update status: pending|printing|ready|collected
GET   /api/vendor/stats             Weekly/monthly revenue stats
GET   /api/health                   Server health check
```

---

## 💰 Pricing

| Type | Price |
|---|---|
| Black & White | ₹2.50 / page |
| Colour | ₹12.00 / page |
| Spiral binding | +₹15 |
| Staple | +₹10 |
| Comb binding | +₹25 |
| Double-sided | 0.5× multiplier |

---

## 🔐 Environment Variables

See [`.env.example`](.env.example) for all required variables.

Key variables:
- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — Secret for signing JWT tokens
- `CLOUDINARY_*` — Cloudinary credentials for file storage
- `VENDOR_INVITE_CODE` — Code vendors need to register (default: `VENDOR2024`)

---

## 📁 Project Structure

```
printease/
├── server.js               Main Express server
├── index.html              Frontend (served statically)
├── .env.example            Environment variables template
├── models/
│   ├── User.js             User schema (customer + vendor)
│   └── Order.js            Order schema (auto-ID: PE-YYYY-XXXX)
├── routes/
│   ├── auth.js             Auth routes
│   ├── orders.js           Order routes
│   └── vendor.js           Vendor-only routes
├── middleware/
│   └── auth.js             JWT auth + role guards
└── config/
    └── cloudinary.js       Cloudinary config
```

---

## 🌐 Deploying to Vercel

```bash
npm install -g vercel
vercel --prod
```

Add all `.env` variables in the Vercel dashboard under **Settings → Environment Variables**.

---

Built with ❤️ for **VNR VJIET** · PrintEase © 2024
