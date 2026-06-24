# Shrivastavas Elevate — Interior Design Studio

A full-stack business website for a luxury interior design studio based in Satna, India. Three-app monorepo: public marketing site, admin dashboard, and a shared REST API backend.

---

## Repository Structure

```
interior-site-project/
├── Frontend/          # Public-facing customer website (Vite + React, port 5173)
├── Admin/             # Owner dashboard (Vite + React, port 5174)
└── Backend/           # REST API + WebSocket server (Node/Express, port 3000)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend & Admin | React 18, Vite, React Router v6 |
| HTTP client | Axios |
| Notifications | React Toastify |
| Icons | FontAwesome (free-solid + free-brands) |
| Backend | Node.js, Express 5 (ESM modules) |
| Database | MongoDB Atlas via Mongoose 8 |
| Auth | JWT (signed on backend), bcrypt, email verification codes |
| Image storage | Cloudinary (multer handles temp upload, then deleted) |
| Email | Nodemailer + Mailtrap (verification, welcome, password reset) |
| Real-time | WebSocket (`ws` library) — broadcasts new leads to admin |
| Styling | Per-component plain CSS files; Tailwind config exists at root but is not actively used |

---

## Frontend (`/Frontend`)

### Pages
| File | Route | Purpose |
|---|---|---|
| [Home.jsx](Frontend/src/pages/Home.jsx) | `/` | Hero, stats, design category cards, process, testimonials marquee, brand logos, CTA |
| [About.jsx](Frontend/src/pages/About.jsx) | `/about` | Studio story and team |
| [Services.jsx](Frontend/src/pages/Services.jsx) | `/services` | Service offerings |
| [Projects.jsx](Frontend/src/pages/Projects.jsx) | `/projects` | Portfolio gallery |
| [Contact.jsx](Frontend/src/pages/Contact.jsx) | `/contact` | Contact form |
| [designDisplay.jsx](Frontend/src/pages/designDisplay.jsx) | `/design/:category` | Design gallery filtered by category |

### Key Components
- **`mainNavbar.jsx`** — top-level nav, triggers consultation modal
- **`consult.jsx`** — free consultation modal; posts to `/api/appointment/add`
- **`quote-popup.jsx`** — design-specific quote modal; posts to `/api/appointment/addquote` with design images/category pre-filled
- **`Design.jsx`** — design card component used inside `designDisplay`
- **`Footer.jsx`** — site footer

### Global Features
- Floating WhatsApp button (links to `wa.me/918962053372`) in `App.jsx`
- Scroll-reveal animations using `IntersectionObserver` (CSS class `sr-visible`)
- Animated count-up component on stats (`CountUp` in `Home.jsx`)
- Two modal types managed via state lifted into `App.jsx`: `showLogin` (consultation) and `showQuotePopup` (quote)

### Design Categories (used in `/design/:category` route)
Kitchen Designs, Bedroom Designs, Bathroom Designs, Lounge area Designs, Kids Room Designs, TV Unit Designs, Commercial Designs, Mandir Designs, Garden Designs, House Exterior Designs, PVC Louvers, WPC Louvers, Charcoal Louvers, Five G Louvers, Marble Sheets, Acrylic Sheets, Flooring, PVC Panels, Projects

---

## Admin (`/Admin`)

Role-gated: only users with `role === "ADMIN"` in MongoDB can access protected routes. Auth state is stored in `localStorage` (`token`, `user`).

### Pages
| File | Route | Purpose |
|---|---|---|
| [Welcome.jsx](Admin/src/pages/Welcome.jsx) | `/welcome` | Dashboard landing after login |
| [Add.jsx](Admin/src/pages/Add.jsx) | `/add` | Upload designs: images → Cloudinary, name, description, bullet points, category, "Feature on Homepage" toggle |
| [List.jsx](Admin/src/pages/List.jsx) | `/list` | View/edit/delete all designs; includes lightbox image viewer |
| [Orders.jsx](Admin/src/pages/Orders.jsx) | `/appointments` | Consultation appointment requests, grouped by date, status dropdown |
| [Quotes.jsx](Admin/src/pages/Quotes.jsx) | `/quotes` | Quote requests linked to specific designs; lightbox, status management |
| [Email_verification.jsx](Admin/src/pages/Email_verification.jsx) | `/verify-email` | 6-digit code entry after registration |
| [ResetPassword.jsx](Admin/src/pages/ResetPassword.jsx) | `/reset-password/:token` | Password reset form |
| [guest.jsx](Admin/src/pages/guest.jsx) | `/` | Shown to non-admin visitors with login prompt |

### Auth Store
[Admin/src/store/authStore.js](Admin/src/store/authStore.js) — manages login/logout state, persists to `localStorage`.

---

## Backend (`/Backend`)

Entry point: [server.js](Backend/server.js) — Express app wrapped in an `http.Server` to support WebSocket upgrades.

### API Routes

| Prefix | Router file | Key endpoints |
|---|---|---|
| `/api/design` | [routes/design.js](Backend/routes/design.js) | `POST /add`, `GET /list?category=`, `POST /remove`, `POST /update` |
| `/api/appointment` | [routes/appointments.js](Backend/routes/appointments.js) | `POST /add`, `GET /list`, `POST /addquote`, `GET /listquotes`, `POST /status` |
| `/api/admin` | [routes/admin.js](Backend/routes/admin.js) | `POST /register`, `POST /login` |
| `/api/user` | [routes/user.js](Backend/routes/user.js) | `POST /verify-email`, `POST /forgot-password`, `POST /reset-password/:token`, `GET /check-auth`, `GET /verify-reset-token/:token` |
| `/images` | static | Serves `uploads/` directory |

### Data Models

**`design`** ([models/design.js](Backend/models/design.js))
```js
{ name, description, images: [String], category, points: [String], isFeatured: Boolean }
```

**`appointment`** ([models/appointments.js](Backend/models/appointments.js))
Dual-purpose model — plain consultations vs. design quotes are distinguished by whether `images[]` is populated.
```js
{ name, email, phoneNumber, message, address, status, date, images: [String], designName, category, measurements }
```

**`user`** ([models/user.js](Backend/models/user.js))
```js
{ name, email, password (bcrypt), role, isVerified, verificationToken, verificationTokenExpiresAt, resetPasswordToken, resetPasswordTokenExpiresAt }
```

### Middleware
- [middlewares/auth.js](Backend/middlewares/auth.js) — JWT verification for protected routes
- [middlewares/webSocket.js](Backend/middlewares/webSocket.js) — WebSocket server + `broadcast()` helper; fires on new appointment or quote
- [middlewares/emails.js](Backend/middlewares/emails.js) — sends verification, welcome, and password reset emails
- [middlewares/emailTemplates.js](Backend/middlewares/emailTemplates.js) — HTML email templates
- [middlewares/mailtrap.js](Backend/middlewares/mailtrap.js) — Nodemailer transport config

### Environment Variables (see [Backend/example.env](Backend/example.env))
```
PORT
MONGO_URI
JWT_SECRET
CLOUD_NAME
CLOUD_API_KEY
CLOUD_API_SECRET
MAILTRAP_TOKEN (or SMTP credentials)
```

---

## Running the Project

```bash
# Backend
cd Backend && npm run server    # nodemon server.js on port 3000

# Frontend
cd Frontend && npm run dev      # Vite dev server on port 5173

# Admin
cd Admin && npm run dev         # Vite dev server on port 5174
```

The Admin app hardcodes the backend URL as `http://localhost:3000` in `App.jsx`.

---

## Business Context

- Brand name: **Shrivastavas Elevate**
- Location: Satna, India
- WhatsApp: +91 89620 53372
- Services: residential & commercial interior design, 3D visualization, turnkey execution
- Consultation model: fee is refundable/adjusted against project cost
- Trusted material partners featured on site: Kajaria, Saint-Gobain, Asian Paints, CenturyPly
