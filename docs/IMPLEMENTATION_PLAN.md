# Office Gym Booking System — Implementation Plan & Technical Specification

> **System Purpose**: A lightweight, self-hosted web application for managing bookings for an internal office gym (~20 people).  
> **Core Tenets**: Clean, fast, responsive (mobile & desktop), strictly adhering to YAGNI (You Aren't Gonna Need It) principles, zero unnecessary dependencies, and minimal maintenance overhead.

---

## 1. Executive Summary & Requirements

### Target Audience & Scale
- **Capacity**: ~20 internal office team members.
- **Gym Constraints**: Max **4 spots per 1-hour time slot** (configurable).
- **Operating Hours**: Daily **06:00 to 21:00** (hourly slots).
- **Access**: Online self-hosted on web server/VPS and fully responsive on mobile smartphones.

### Key Functional Requirements
1. **Visual Calendar & Booking Matrix**:
   - Week-view (desktop/tablet) and day-view (mobile) showing all time slots.
   - Real-time slot status: Available spots count (e.g., "3/4 open"), Full indicator, or User's active booking indicator.
   - 1-click booking and 1-click cancellation.
2. **Member Management**:
   - Quick member selector (pick name from dropdown; stored in `localStorage` so phones remember the user).
   - Add new member / remove member modal with instant roster update.
3. **Data Integrity & Business Rules**:
   - Strict capacity limit enforcement (cannot exceed max spots per slot).
   - Double-booking prevention (a member cannot book the same slot twice).
   - Past time slot booking prevention.
4. **Operations & Maintenance**:
   - Zero-external-dependency backend (Python 3 standard library `http.server` + `sqlite3`).
   - Single-file database (`gym.db`) that can be backed up by copying.
   - Zero-build-step frontend (modern Vanilla HTML5, CSS3, and JavaScript ES6+).
   - 1-command startup (`python3 server.py`) or Docker (`docker-compose up -d`).

---

## 2. Architecture & Tech Stack

```
+-------------------------------------------------------------------------+
|                  Frontend (Single Page Application)                     |
|  - Vanilla HTML5 + Modern CSS3 + Vanilla ES6 JavaScript                 |
|  - Fully responsive (CSS Grid + Flexbox + Mobile Day Tabs)              |
|  - LocalStorage persistence for selected member & theme                 |
|  - Toast notification engine & optimistic UI state updates              |
+------------------------------------+------------------------------------+
                                     | HTTP / JSON REST API
+------------------------------------v------------------------------------+
|                  Backend Service (server.py)                            |
|  - Python 3.x Standard Library (ThreadingHTTPServer, SimpleHTTPHandler) |
|  - Zero 3rd-party PIP packages or node_modules required                 |
|  - Static asset file server & REST API controller                       |
+------------------------------------+------------------------------------+
                                     | Embedded Connection (PRAGMA FKs)
+------------------------------------v------------------------------------+
|                  Database Layer (gym.db)                                |
|  - SQLite 3 with WAL mode and foreign key constraints                   |
|  - Tables: members, bookings                                            |
+-------------------------------------------------------------------------+
```

### Why This Stack? (YAGNI Justification)
| Decision | Rationale | Alternatives Rejected & Why |
| :--- | :--- | :--- |
| **Python Standard Library Server** | Built into all modern OS; 0 dependencies to install or break over time; no build errors. | Express/Node (requires npm packages), Django/FastAPI (unnecessary overhead for 20 users). |
| **SQLite3 Database** | Single-file database, atomic transactions, 0 setup, fast, perfect for <1,000,000 queries. | PostgreSQL / MySQL (excessive maintenance, separate daemon, backup complexity). |
| **Vanilla JS & CSS** | Instant page load (<50ms), zero bundler configuration (Webpack/Vite), no npm security alerts. | React / Vue / Next.js (massive dependency trees and build pipelines for a 3-page app). |

---

## 3. Database Schema

### Table: `members`
Stores active gym members.
```sql
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `bookings`
Stores individual gym slot reservations.
```sql
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    date TEXT NOT NULL,         -- Format: YYYY-MM-DD (e.g. "2026-08-18")
    time_slot TEXT NOT NULL,    -- Format: HH:MM (e.g. "08:00")
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
    UNIQUE(member_id, date, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member_id);
```

---

## 4. REST API Specification

### 4.1 System Configuration
- **`GET /api/config`**
  - **Response `200 OK`**:
    ```json
    {
      "gym_name": "Office Gym",
      "max_capacity_per_slot": 4,
      "start_hour": 6,
      "end_hour": 21,
      "slot_duration_mins": 60
    }
    ```

---

### 4.2 Member Endpoints
- **`GET /api/members`**
  - **Response `200 OK`**:
    ```json
    {
      "members": [
        {"id": 1, "name": "Alex Chen", "email": "alex@office.local", "created_at": "2026-08-18 10:00:00"},
        {"id": 2, "name": "Sarah Connor", "email": "sarah@office.local", "created_at": "2026-08-18 10:00:00"}
      ]
    }
    ```

- **`POST /api/members`**
  - **Request Body**:
    ```json
    { "name": "John Doe", "email": "john@office.local" }
    ```
  - **Response `201 Created`**:
    ```json
    {
      "message": "Member added successfully",
      "member": { "id": 8, "name": "John Doe", "email": "john@office.local" }
    }
    ```
  - **Errors**: `400 Bad Request` (missing name), `409 Conflict` (duplicate name).

- **`DELETE /api/members/:id`**
  - **Response `200 OK`**:
    ```json
    { "message": "Member 'John Doe' removed successfully", "deleted_id": 8 }
    ```

---

### 4.3 Calendar & Booking Endpoints
- **`GET /api/calendar?start_date=2026-08-18&end_date=2026-08-24`**
  - **Response `200 OK`**:
    ```json
    {
      "start_date": "2026-08-18",
      "end_date": "2026-08-24",
      "max_capacity": 4,
      "calendar": {
        "2026-08-18": {
          "07:00": [
            {
              "booking_id": 12,
              "member_id": 1,
              "member_name": "Alex Chen",
              "member_email": "alex@office.local",
              "booked_at": "2026-08-18 06:15:00"
            }
          ]
        }
      }
    }
    ```

- **`POST /api/bookings`**
  - **Request Body**:
    ```json
    {
      "member_id": 1,
      "date": "2026-08-19",
      "time_slot": "08:00"
    }
    ```
  - **Validation Steps**:
    1. Verify `member_id` is an active member.
    2. Verify `date` is valid and not in the past (`>= today`).
    3. Verify `time_slot` falls within operating hours (06:00 – 21:00).
    4. Verify existing bookings for slot are `< max_capacity_per_slot`.
    5. Verify unique constraint (member hasn't already booked this slot).
  - **Response `201 Created`**:
    ```json
    {
      "message": "Spot booked successfully!",
      "booking": {
        "id": 45,
        "member_id": 1,
        "member_name": "Alex Chen",
        "date": "2026-08-19",
        "time_slot": "08:00"
      }
    }
    ```
  - **Errors**: `400 Bad Request` (past date / invalid slot), `409 Conflict` (slot full or already booked).

- **`DELETE /api/bookings/:id`**
  - Cancels and removes the booking.
  - **Response `200 OK`**:
    ```json
    { "message": "Booking cancelled successfully", "cancelled_id": 45 }
    ```

- **`GET /api/my-bookings?member_id=1`**
  - Returns all upcoming bookings for the selected member (for quick counts & summary badge).

---

## 5. Frontend & UI Design Specifications

### 5.1 Design Aesthetics & Tokens
- **Typography**: `Inter` (body) + `Plus Jakarta Sans` (headings).
- **Color Palette**:
  - **Brand / Accent**: Indigo `#6366F1` & Electric Violet `#4F46E5`.
  - **Available Slot Badge**: Emerald green `#10B981` / Mint `#ECFDF5`.
  - **Active User Booking**: Indigo `#4F46E5` / Violet with checkmark.
  - **Full Slot Badge**: Neutral muted gray `#9CA3AF`.
  - **Dark Mode**: Deep slate background `#0F172A`, elevated card surface `#1E293B`, subtle borders `#334155`.
- **Layout Adaptability**:
  - **Desktop / Tablet (>768px)**: Full weekly grid matrix (7 days horizontally x 16 time slots vertically).
  - **Mobile Smartphones (<768px)**: Horizontal scrollable date pill bar ("Mon 18", "Tue 19", ...) + full-width vertical time card list for the selected day.

### 5.2 User Interaction Flow
1. **Open App**: App checks `localStorage` for last chosen member name. If found, selects automatically; otherwise prompts selection.
2. **Browse Availability**: User glances at the grid or selects their day. Each slot clearly shows:
   - Time range (e.g. `07:00 – 08:00`).
   - Spots remaining badge (e.g. `3 spots left` or `Full`).
   - Avatars of colleagues booked.
3. **Book a Spot**: 1-click on "+ Book". UI updates immediately with smooth animation, toast confirmation appears, and spot count decrements.
4. **Cancel a Spot**: Slot booked by the active user shows a distinct "✓ Booked (Cancel)" button. Tapping it frees up the spot instantly.
5. **Manage Members**: Click "Members" button -> modal pops up to add a new colleague or remove someone.

---

## 6. Directory Structure

```
office-gym-booking/
├── server.py               # Main Python server (REST API + SQLite + Static files)
├── gym.db                  # Auto-generated SQLite database (git-ignored)
├── public/                 # Client assets served directly
│   ├── index.html          # Semantic HTML5 app structure
│   ├── style.css           # Modern, responsive CSS (dark/light themes, mobile-first)
│   └── app.js              # Vanilla ES6 reactive client application
├── Dockerfile              # Lightweight Python Alpine container
├── docker-compose.yml      # 1-click container stack with persistent volume
├── run.sh                  # Simple local startup script
├── IMPLEMENTATION_PLAN.md  # Detailed specification and plan document
└── README.md               # User guide & self-hosting instructions
```

---

## 7. Self-Hosting & Deployment Instructions

### Option A: Direct Host / VPS (Simplest)
1. Ensure Python 3 is installed:
   ```bash
   python3 --version
   ```
2. Start the server:
   ```bash
   python3 server.py
   ```
3. (Optional) Run with systemd, nohup, or PM2:
   ```bash
   nohup python3 server.py > gym.log 2>&1 &
   # or with PM2:
   pm2 start server.py --name gym-booking --interpreter python3
   ```
4. Access at `http://<your-server-ip>:3000` or put behind NGINX / Caddy reverse proxy with SSL.

### Option B: Docker Container
1. Launch via docker-compose:
   ```bash
   docker-compose up -d
   ```
2. The database `gym.db` is stored on a mounted Docker volume (`./data/gym.db`) to ensure data persists across updates.

---

## 8. Verification & Test Plan

1. **API Functional Tests**:
   - `GET /api/members` returns seeded default team.
   - `POST /api/members` adds a new unique member; rejects duplicate name.
   - `POST /api/bookings` books slot for member; updates slot capacity in `GET /api/calendar`.
   - `POST /api/bookings` rejects duplicate booking by same member for same slot (`409 Conflict`).
   - `POST /api/bookings` fills slot to capacity (4); 5th booking attempt is rejected (`409 Conflict: Slot full`).
   - `DELETE /api/bookings/:id` cancels booking; opens slot back up to 1 available spot.
2. **Mobile & Browser Responsiveness**:
   - Test in Chrome Mobile Emulator (iPhone 14 / Pixel 7 viewports): Ensure day tabs, member dropdown, and booking tap targets are large and accessible.
   - Test Desktop viewport: Ensure weekly grid displays cleanly with full slot details.
   - Test theme toggle (Light / Dark mode) and ensure preference persists across reloads.
