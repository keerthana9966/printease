<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Sora&size=32&pause=1000&color=1534A0&center=true&vCenter=true&width=600&lines=PrintEase+%F0%9F%96%A8%EF%B8%8F;Campus+Printing%2C+Reinvented;No+queues.+No+waiting.+Just+print." alt="Typing SVG" />

<br/>

<p>
  <a href="https://printease-smoky.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/🚀%20Live%20Demo-printease--smoky.vercel.app-1534a0?style=for-the-badge&logoColor=white" alt="Live Demo"/>
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
  &nbsp;
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white"/>
  &nbsp;
  <img src="https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white"/>
</p>

<p>
  <img src="https://img.shields.io/badge/JWT-Auth-orange?style=flat-square"/>
  &nbsp;
  <img src="https://img.shields.io/badge/Cloudinary-File%20Storage-3448C5?flat-square&logo=cloudinary"/>
  &nbsp;
  <img src="https://img.shields.io/badge/Role%20Based-Access%20Control-blueviolet?flat-square"/>
  &nbsp;
  <img src="https://img.shields.io/badge/PDF-Page%20Counter-red?flat-square"/>
</p>

---

### 🏛️ Built for VNR VJIET · Campus Stationery, Digitized

*A real-world full-stack project solving a genuine problem faced by thousands of VJIET students every day — the chaos of the campus print shop.*

</div>

---

## 🎯 The Problem I Solved

> Every semester at VNR VJIET, hundreds of students crowd the stationery shop before assignments and exams. Long queues, cash-only payments, no order tracking, and overwhelmed staff made the experience frustrating for everyone.

**PrintEase** replaces that chaos with a sleek, fully digital system:

| Before PrintEase ❌ | After PrintEase ✅ |
|---|---|
| Wait 30+ minutes in queue | Book a slot, walk in at your time |
| Cash-only payments | Instant UPI (GPay, PhonePe, Paytm) |
| No order confirmation | Auto-generated Order ID + live tracking |
| Staff manually managing slips | Smart vendor dashboard with print queue |
| Zero visibility on order status | Real-time: Pending → Printing → Ready → Collected |

---

## 🌐 Live Demo

<div align="center">

### 👉 [https://printease-smoky.vercel.app/](https://printease-smoky.vercel.app/)

| Role | Login Type | Test Credentials |
|---|---|---|
| 🎓 Student | Customer Login | Register with any email |
| 🏪 Vendor/Staff | Vendor Login | Register with invite code `VENDOR2024` |

</div>

---

## ✨ Feature Highlights

### 🎓 Student / Customer Side

```
📤  Upload PDF / DOCX / PPTX  ──▶  Auto page count (pdf-parse)
🎨  Choose B&W or Colour print  ──▶  ₹2.50/pg  or  ₹12.00/pg
📋  Set copies, binding, paper size, single/double-sided
🕐  Pick a 30-min pickup slot  ──▶  9:00 AM to 5:30 PM
💰  Instant cost calculator  ──▶  Total shown before paying
💳  Pay via UPI (GPay · PhonePe · Paytm · BHIM)
📦  Live order tracking  ──▶  PE-2024-XXXX  order ID
```

### 🏪 Vendor / Staff Side

```
📊  Live dashboard  ──▶  Today's orders, pending, revenue
🖨️  Print queue  ──▶  Student name, file link, pages, slot, amount
✅  One-click status  ──▶  Start ▶ → Mark Ready ✓ → Collected 🎓
📈  Hourly bar chart  ──▶  Orders per hour for the day
🔔  Activity feed  ──▶  New orders, awaiting pickup alerts
```

---

## 🏗️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                  │
│         Vanilla HTML · CSS · JavaScript             │
│   Login │ Order Page │ Tracker │ Vendor Dashboard   │
└──────────────────────┬──────────────────────────────┘
                       │ REST API (fetch)
┌──────────────────────▼──────────────────────────────┐
│              EXPRESS.JS SERVER (Node 18)             │
│                                                      │
│  /api/auth   →  JWT Auth (separate customer/vendor)  │
│  /api/orders →  Upload · Calculate · Place · Track   │
│  /api/vendor →  Dashboard · Queue · Status Update    │
└──────┬──────────────────┬───────────────────────────┘
       │                  │
┌──────▼──────┐    ┌──────▼──────┐
│   MongoDB   │    │  Cloudinary │
│  (Mongoose) │    │  (Raw Files)│
│  Users      │    │  PDF/DOCX   │
│  Orders     │    │  Storage    │
└─────────────┘    └─────────────┘
```

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Vanilla HTML/CSS/JS | Zero build step, fast load, single file |
| **Backend** | Node.js + Express | Lightweight, fast REST APIs |
| **Database** | MongoDB + Mongoose | Flexible schema for orders & users |
| **Auth** | JWT + bcryptjs | Stateless, secure, role-separated |
| **File Storage** | Cloudinary | Vendor gets direct file download link |
| **PDF Parsing** | pdf-parse | Accurate page counting from uploaded PDFs |
| **File Upload** | Multer (memory) | Stream directly to Cloudinary, no disk I/O |
| **Deployment** | Vercel | Serverless, zero-config CI/CD |
| **Dev DB** | mongodb-memory-server | Zero-install local development |

---

## 🔐 Security Design

One of the key design decisions was **completely separating customer and vendor login flows**:

```
POST /api/auth/login/customer   ← Students only (blocked if vendor tries)
POST /api/auth/login/vendor     ← Vendors only (blocked if customer tries)
POST /api/auth/register/vendor  ← Requires secret VENDOR_INVITE_CODE
```

- 🔑 **JWT tokens** — 7-day expiry, signed with `JWT_SECRET`
- 🛡️ **Route guards** — `vendorOnly` and `customerOnly` middleware on every protected route
- 🔒 **Passwords** — hashed with `bcryptjs` (12 salt rounds), never stored in plaintext
- 🚫 **Role enforcement** — a customer JWT cannot call a single vendor endpoint

---

## 📋 API Reference

<details>
<summary><b>🔐 Authentication</b></summary>

```http
POST /api/auth/register/customer
Body: { name, email, password }

POST /api/auth/register/vendor
Body: { name, email, password, inviteCode }

POST /api/auth/login/customer
Body: { email, password }

POST /api/auth/login/vendor
Body: { email, password }

GET  /api/auth/me
Headers: Authorization: Bearer <token>
```
</details>

<details>
<summary><b>📦 Orders (Customer)</b></summary>

```http
POST /api/orders/upload
Headers: Authorization: Bearer <token>
Body: multipart/form-data  →  field: document (PDF/DOCX/PPTX)
Response: { fileUrl, filePublicId, fileName, pageCount, fileSizeMB }

POST /api/orders/calculate
Body: { printType, pages, copies, sides, binding }
Response: { pageCost, bindingCost, totalAmount, breakdown }

POST /api/orders/place
Headers: Authorization: Bearer <token>
Body: { fileUrl, fileName, pageCount, printType, copies,
        pageRange, pageSize, binding, sides, pickupSlot }
Response: { orderId, totalAmount, status, pickupSlot }

GET  /api/orders/my
Headers: Authorization: Bearer <token>
Response: [ ...orders ]

GET  /api/orders/track/:orderId
Response: { orderId, status, currentStep, ... }
```
</details>

<details>
<summary><b>🏪 Vendor Dashboard</b></summary>

```http
GET  /api/vendor/dashboard
Response: { metrics, activeQueue, recentOrders, hourlyChart }

GET  /api/vendor/orders?status=pending&date=today
Response: { total, pages, data: [...orders] }

GET  /api/vendor/orders/:orderId
Response: { ...fullOrderDetails, fileUrl }

PATCH /api/vendor/orders/:orderId/status
Body: { status: "pending"|"printing"|"ready"|"collected" }

GET  /api/vendor/stats?period=week
Response: { dailyStats, statusBreakdown, topOrders }

GET  /api/health
Response: { success, mongodb: "connected"|"disconnected" }
```
</details>

---

## 💰 Pricing Engine

```javascript
// Implemented in routes/orders.js
const PRICE    = { bw: 2.50, color: 12.00 }          // per page
const BINDING  = { none: 0, spiral: 15, staple: 10, comb: 25 }

totalAmount = (pricePerPage × pages × copies × sideMultiplier) + bindingCost
//                                              ↑
//                              0.5 for double-sided (saves paper)
```

---

## 🚀 Run Locally

```bash
# 1. Clone
git clone https://github.com/keerthana9966/printease.git
cd printease

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Fill in: MONGODB_URI, JWT_SECRET, CLOUDINARY_*, VENDOR_INVITE_CODE

# 4. Start
node server.js
# → http://localhost:5000
```

> 💡 **No MongoDB?** No problem. The server auto-starts an **in-memory MongoDB** as a dev fallback — zero setup needed.

---

## 📁 Project Structure

```
printease/
│
├── 📄 server.js              Express app + DB connection (3-tier fallback)
├── 📄 index.html             Complete frontend (vanilla, no framework)
├── 📄 vercel.json            Vercel serverless config
├── 📄 .env.example           Environment variable template
│
├── 📁 models/
│   ├── User.js               Schema: customer & vendor, bcrypt hooks
│   └── Order.js              Schema: auto-ID (PE-YYYY-XXXX), lifecycle
│
├── 📁 routes/
│   ├── auth.js               4 separate auth endpoints (2 customer, 2 vendor)
│   ├── orders.js             Upload, calculate, place, my orders, track
│   └── vendor.js             Dashboard, queue, status update, stats
│
├── 📁 middleware/
│   └── auth.js               JWT verify + vendorOnly + customerOnly guards
│
└── 📁 config/
    └── cloudinary.js         Cloudinary SDK setup
```

---

## 📸 Screenshots

| Home Page | Order Page | Vendor Dashboard |
|---|---|---|
| Hero with stats, steps, CTA | File upload + cost calculator | Live queue + metrics |

---

## 🛠️ What I Learned Building This

- Designing **role-based access control** from scratch with JWT middleware
- Streaming file uploads **directly to cloud storage** without touching disk
- Using `pdf-parse` to extract page metadata from uploaded documents
- Building a **3-tier database fallback** (Atlas → Local → In-Memory)
- Structuring a **full-stack Express app** with clean route separation
- Deploying a Node.js server as a **Vercel serverless function**

---

## 👩‍💻 Author

<div align="center">

**Keerthana** · VNR VJIET

[![GitHub](https://img.shields.io/badge/GitHub-keerthana9966-181717?style=for-the-badge&logo=github)](https://github.com/keerthana9966)

*Built with ❤️ for VNR VJIET students · PrintEase © 2024*

</div>
