# Eventra

Club event registration and QR gate check-in system.

Eventra lets club admins publish events, members register (with optional paid add-ons), pay via Razorpay, receive a QR entry pass by email/PDF, and gate scanners validate entry at the door.

## Features

- **Three roles:** Admin, Member, Scanner
- **Events:** create, edit, publish, cancel; cover images via Cloudinary
- **Registration:** party size with add-ons; capacity counted by people, not rows
- **Payments:** Razorpay Checkout + admin mark-paid fallback; free events supported
- **QR passes:** opaque `EVENTRA.id.secret` credentials, on-screen + PDF + email
- **Check-in:** camera scanner, multi-person party entry, allow/deny audit log
- **Emails:** registration, add-on updates, check-in welcome, cancellation
- **Attendance:** per-event roster + PDF export

## Tech stack

| Layer | Tech |
|--------|------|
| Runtime | Node.js ≥ 18 |
| Web | Express 5, EJS |
| Auth | express-session, bcryptjs |
| DB | MySQL (`mysql2`) |
| Validation | Zod |
| Payments | Razorpay |
| QR | `qrcode`, `html5-qrcode` |
| PDF | PDFKit |
| Email | Nodemailer |
| Images | Cloudinary + Multer |

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/Ridaaa-Khan/iship.git
cd iship
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Required:

- `DB_USER`, `DB_NAME`, `SESSION_SECRET`

Optional (recommended):

- Razorpay keys — member checkout
- SMTP — real email (dev can use Ethereal when SMTP is empty)
- Cloudinary — event cover uploads

### 3. Database

Create a MySQL database, then apply schema and seed:

```bash
mysql -u root -p -e "CREATE DATABASE eventra CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p eventra < sql/schema.sql
mysql -u root -p eventra < sql/seed.sql
```

Optional cover-image seed (if you have local files under `uploads/events/`):

```bash
mysql -u root -p eventra < sql/seed-event-covers.sql
```

### 4. Run

```bash
npm run dev    # development (nodemon)
npm start      # production
```

Open [http://localhost:3000](http://localhost:3000).

## Demo accounts

From `sql/seed.sql` (password for both: `Admin@123`):

| Role | Email |
|------|--------|
| Admin | `admin@eventra.local` |
| Member | `member@eventra.local` |

Create scanner accounts from **Admin → Scanners**.

## Roles at a glance

### Admin
Dashboard, events CRUD + publish/cancel, registrations (mark paid), members, scanners, today’s entries, attendance PDF

### Member
Browse events, register + add-ons, pay, view/download pass, update add-ons, cancel, profile

### Scanner
Live QR scan, today’s entries, correct entry records

## Project structure

```text
src/
  app.js              # Express entry
  config/             # env, db, session, cloudinary
  routes/             # auth, admin, member, scanner
  services/           # business logic
  db/                 # SQL helpers
  middleware/         # auth, validation, uploads
  views/              # EJS templates
  public/             # CSS / JS
sql/
  schema.sql          # tables
  seed.sql            # demo users
scripts/              # one-off migrations
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server |
| `npm run dev` | Start with nodemon |
| `npm run migrate` | Run add-ons migration script |

## Notes

- Money is stored as integer **paise**; UI shows rupees
- Capacity includes pending unpaid registrations until cancelled
- Cancel revokes QR and frees seats; Razorpay refunds are not automated
- New QR tokens use the `EVENTRA.` prefix; older `ISHIP.` tokens still validate

## License

Private project.
