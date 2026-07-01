# Shrivastavas Elevate — Interior Design Studio

A full-stack business website for a luxury interior design studio based in Satna, India. Three-app monorepo: public marketing site, admin dashboard, and a shared REST API backend.

---

## Repository Structure

```
interior-site-project/
├── Frontend/    # Public-facing customer website (Next.js 16, App Router, port 3000)
├── Admin/       # Owner dashboard (Vite + React, port 5174)
└── Backend/     # REST API + WebSocket server (Node/Express, port 3000)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, JS), ISR + SSG |
| Admin | React 18, Vite, React Router v6 |
| HTTP client | Axios |
| Notifications | React Toastify |
| Icons | Custom inline SVG library (`Frontend/src/components/Icons.jsx`) — Heroicons outline style, strokeWidth 1.5 |
| Fonts | Cormorant Garamond, Playfair Display, Inter — loaded via CSS `@import` in `globals.css` |
| Backend | Node.js, Express 5 (ESM modules) |
| Database | MongoDB Atlas via Mongoose 8 |
| Auth | JWT (signed on backend), bcrypt, email verification codes |
| Image storage | Cloudinary (multer handles temp upload, then deleted) |
| Email | Nodemailer + Mailtrap (verification, welcome, password reset) |
| Real-time | WebSocket (`ws` library) — broadcasts design/product/project changes and new leads |
| Styling | Per-component plain CSS files; global design tokens in `Frontend/src/app/globals.css` |

---

## Frontend (`/Frontend`) — Next.js 16

Migrated from Vite + React SPA to Next.js 16 App Router. All pages are server-rendered or ISR; no empty HTML shells.

### Rendering Strategy
| Route | Strategy | Revalidate |
|---|---|---|
| `/` | ISR | 60 s |
| `/about`, `/services`, `/contact` | Static (SSG) | — |
| `/projects`, `/products` | ISR | 60 s |
| `/design/[category]` | ISR + `generateStaticParams` | 60 s |
| `/sitemap.xml`, `/robots.txt` | Static | — |

### Pages
| File | Route | Purpose |
|---|---|---|
| [HomePage.jsx](Frontend/src/components/pages/HomePage.jsx) | `/` | Hero, stats, design category cards, process, testimonials, brand logos, CTA |
| [AboutPage.jsx](Frontend/src/components/pages/AboutPage.jsx) | `/about` | Studio story and founders |
| [ServicesPage.jsx](Frontend/src/components/pages/ServicesPage.jsx) | `/services` | Service offerings |
| [ProjectsPage.jsx](Frontend/src/components/pages/ProjectsPage.jsx) | `/projects` | Portfolio gallery, real-time via WebSocket |
| [ContactPage.jsx](Frontend/src/components/pages/ContactPage.jsx) | `/contact` | Contact form |
| [DesignDisplayPage.jsx](Frontend/src/components/pages/DesignDisplayPage.jsx) | `/design/[category]` | Design gallery with ISR + on-mount fresh fetch + real-time WebSocket |
| [ProductsPage.jsx](Frontend/src/components/pages/ProductsPage.jsx) | `/products` | Architectural products catalogue |

### Key Components
- **`LayoutShell.jsx`** — client shell: navbar, bottom nav, modals, WhatsApp FAB, ToastContainer
- **`ModalContext.jsx`** — context replacing prop-drilled modal state; any component calls `useModal()` to open consultation/quote modals
- **`MainNavbar.jsx`** — top-level nav with logo, scroll-aware bg, hamburger menu
- **`BottomNavbar.jsx`** — mobile-only bottom tab bar with dot-indicator active state
- **`Consult.jsx`** — free consultation modal; posts to `/api/appointment/add`
- **`QuotePopup.jsx`** — design-specific quote modal; posts to `/api/appointment/quote`
- **`Design.jsx`** — design card with lightbox + modal; used in `DesignDisplayPage`
- **`Footer.jsx`** — site footer with contact info and social links
- **`Icons.jsx`** — central SVG icon library (~50 icons, Heroicons outline style)

### Global Features
- Floating WhatsApp FAB (`wa.me/918962053372`) in `LayoutShell.jsx`
- Scroll-reveal animations via `IntersectionObserver` (CSS class `sr-visible`)
- Animated `CountUp` component on stats sections
- Real-time design/product/project updates via `hooks/useWebSocket.js` with exponential backoff reconnect

### Design Categories (used in `/design/[category]`)
Kitchen Designs, Bedroom Designs, Bathroom Designs, Lounge area Designs, Kids Room Designs, TV Unit Designs, Commercial Designs, Mandir Designs, Garden Designs, House Exterior

### Environment
`Frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Admin (`/Admin`) — Vite + React

Role-gated: only users with `role === "ADMIN"` in MongoDB can access protected routes. Auth state is stored in `localStorage` (`token`, `user`).

### Pages
| File | Route | Purpose |
|---|---|---|
| [Welcome.jsx](Admin/src/pages/Welcome.jsx) | `/welcome` | Dashboard landing after login |
| [AddDesign.jsx](Admin/src/pages/AddDesign.jsx) | Upload designs → Cloudinary, with name, description, bullet points, category + subcategories (multi-select, DB-driven with inline add/delete), "Feature on Homepage" toggle |
| [ListDesigns.jsx](Admin/src/pages/ListDesigns.jsx) | `/list` | View/edit/delete designs; newest first |
| [ListProjects.jsx](Admin/src/pages/ListProjects.jsx) | `/projects` | View/edit/delete projects; newest first |
| [ListProducts.jsx](Admin/src/pages/ListProducts.jsx) | `/products` | View/edit/delete products; newest first |
| [Appointments.jsx](Admin/src/pages/Appointments.jsx) | `/appointments` | Consultation requests; newest first; real-time via WebSocket |
| [Quotes.jsx](Admin/src/pages/Quotes.jsx) | `/quotes` | Quote requests; newest first; real-time via WebSocket |
| [Email_verification.jsx](Admin/src/pages/Email_verification.jsx) | `/verify-email` | 6-digit code entry after registration |
| [ResetPassword.jsx](Admin/src/pages/ResetPassword.jsx) | `/reset-password/:token` | Password reset form |

### Auth Store
[Admin/src/store/authStore.js](Admin/src/store/authStore.js) — manages login/logout state, persists to `localStorage`.

### WebSocket
`Admin/src/hooks/useWebSocket.js` — exponential backoff reconnect (same implementation as frontend). Listens for `newOrder`, `newQuote`, `designsChanged`, `projectsChanged`, `productsChanged`.

---

## Backend (`/Backend`)

Entry point: [server.js](Backend/server.js) — Express app wrapped in an `http.Server` to support WebSocket upgrades.

### API Routes

| Prefix | Router file | Key endpoints |
|---|---|---|
| `/api/design` | [routes/design.js](Backend/routes/design.js) | `POST /add`, `GET /list?category=&page=&limit=`, `POST /remove`, `POST /update` |
| `/api/design-subcategory` | [routes/designSubcategory.js](Backend/routes/designSubcategory.js) | `GET /list`, `POST /add`, `POST /remove`, `POST /reorder` — DB-driven design subcategories, scoped to parent design categories, mirrors `/api/product-subcategory` — WebSocket fires `designSubcategoriesChanged` |
| `/api/project` | [routes/project.js](Backend/routes/project.js) | `GET /list`, `POST /add`, `POST /remove`, `POST /update` — WebSocket fires `projectsChanged` |
| `/api/product` | [routes/product.js](Backend/routes/product.js) | `GET /list`, `POST /add`, `POST /remove`, `POST /update` — WebSocket fires `productsChanged` |
| `/api/appointment` | [routes/appointments.js](Backend/routes/appointments.js) | `POST /add`, `GET /list`, `POST /quote`, `GET /listquotes`, `POST /status` |
| `/api/admin` | [routes/admin.js](Backend/routes/admin.js) | `POST /register`, `POST /login` |
| `/api/user` | [routes/user.js](Backend/routes/user.js) | `POST /verify-email`, `POST /forgot-password`, `POST /reset-password/:token`, `GET /check-auth`, `GET /verify-reset-token/:token` |
| `/images` | static | Serves `uploads/` directory |

### WebSocket Broadcasts
| Event | Triggered by | Listeners |
|---|---|---|
| `designsChanged` | design add/update/remove | `DesignDisplayPage` |
| `designSubcategoriesChanged` | design subcategory add/remove/reorder | `AddDesign.jsx`, `ListDesigns.jsx`, Recovery Bin |
| `projectsChanged` | project add/update/remove | `ProjectsPage` |
| `productsChanged` | product add/update/remove | `ProductsPage` |
| `newOrder` | consultation form submit | Admin `Appointments` |
| `newQuote` | quote form submit | Admin `Quotes` |

### Data Models

**`design`** ([models/design.js](Backend/models/design.js))
```js
{ name, description, images: [String], category, subcategories: [String], points: [String], isFeatured: Boolean }
```

**`designSubcategory`** ([models/designSubcategory.js](Backend/models/designSubcategory.js))
Second-level taxonomy under `category`, managed inline from `AddDesign.jsx` (icon + colour, parented to one or more design categories). Soft-deletable, feeds the Recovery Bin.
```js
{ name, icon, color, categories: [String], order, deleted: Boolean }
```

**`appointment`** ([models/appointments.js](Backend/models/appointments.js))
Dual-purpose — consultations vs. quotes distinguished by whether `images[]` is populated.
```js
{ name, email, phoneNumber, message, address, status, date, images: [String], designName, category, measurements }
```

**`user`** ([models/user.js](Backend/models/user.js))
```js
{ name, email, password (bcrypt), role, isVerified, verificationToken, verificationTokenExpiresAt, resetPasswordToken, resetPasswordTokenExpiresAt }
```

### Middleware
- [middlewares/auth.js](Backend/middlewares/auth.js) — JWT verification for protected routes
- [middlewares/webSocket.js](Backend/middlewares/webSocket.js) — WebSocket server + `broadcast()` helper
- [middlewares/emails.js](Backend/middlewares/emails.js) — sends verification, welcome, and password-reset emails
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

# Frontend (Next.js)
cd Frontend && npm run dev      # Next.js dev server (defaults to port 3001 if 3000 is taken)

# Admin
cd Admin && npm run dev         # Vite dev server on port 5174
```

`Frontend` reads `NEXT_PUBLIC_API_URL` from `.env.local` — defaults to `http://localhost:3000`.  
The Admin app hardcodes the backend URL as `http://localhost:3000`.

---

## Business Context

- Brand name: **Shrivastavas Elevate**
- Location: Satna, India
- WhatsApp: +91 89620 53372
- Services: residential & commercial interior design, 3D visualization, turnkey execution
- Consultation model: fee is refundable/adjusted against project cost
- Trusted material partners featured on site: Kajaria, Saint-Gobain, Asian Paints, CenturyPly
