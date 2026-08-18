#!/usr/bin/env python3
"""
Office Gym Booking System - Backend Server
Zero external dependencies (Python Standard Library + SQLite3)
"""

import os
import json
import sqlite3
import datetime
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Configuration & Environment Defaults
PORT = int(os.environ.get("PORT", 3000))
DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "gym.db"))
STATIC_DIR = os.path.join(os.path.dirname(__file__), "public")

DEFAULT_SETTINGS = {
    "max_capacity_per_slot": int(os.environ.get("GYM_CAPACITY", 3)),
    "start_hour": int(os.environ.get("START_HOUR", 6)),   # 06:00
    "end_hour": int(os.environ.get("END_HOUR", 21)),       # 21:00
    "slot_duration_mins": 60,
    "gym_name": os.environ.get("GYM_NAME", "Wild Island Gym")
}


def get_db_connection():
    """Returns a SQLite connection with row factory enabled and WAL mode."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db():
    """Initializes the database tables and default sample data."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Members table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                email TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Bookings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL,
                date TEXT NOT NULL,         -- YYYY-MM-DD
                time_slot TEXT NOT NULL,    -- HH:MM (e.g. 07:00)
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
                UNIQUE(member_id, date, time_slot)
            )
        """)
        
        # Indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member_id)")

        # Rules table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                subtitle TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0
            )
        """)

        # Seed initial sample members if table is empty
        cursor.execute("SELECT COUNT(*) as count FROM members")
        if cursor.fetchone()["count"] == 0:
            sample_members = [
                ("Alex Chen", "alex@office.local"),
                ("Sarah Connor", "sarah@office.local"),
                ("David Miller", "david@office.local"),
                ("Elena Rostova", "elena@office.local"),
                ("Marcus Vance", "marcus@office.local"),
                ("Priya Sharma", "priya@office.local"),
                ("Lucas Dupont", "lucas@office.local")
            ]
            cursor.executemany(
                "INSERT INTO members (name, email) VALUES (?, ?)",
                sample_members
            )

        # Hour types table (MALE / FEMALE / MIXED)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hour_types (
                time_slot TEXT PRIMARY KEY,
                slot_type TEXT NOT NULL DEFAULT 'MIXED'
            )
        """)

        # Initialize all operating hours with default 'MIXED' if empty
        cursor.execute("SELECT COUNT(*) as count FROM hour_types")
        if cursor.fetchone()["count"] == 0:
            default_hours = []
            for h in range(DEFAULT_SETTINGS["start_hour"], DEFAULT_SETTINGS["end_hour"] + 1):
                slot_str = f"{h:02d}:00"
                default_hours.append((slot_str, "MIXED"))
            cursor.executemany("INSERT INTO hour_types (time_slot, slot_type) VALUES (?, ?)", default_hours)

        conn.commit()


class GymBookingHandler(SimpleHTTPRequestHandler):
    """HTTP Request Handler for API endpoints and static assets."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        """Inject appropriate PWA and caching headers for static assets."""
        if hasattr(self, 'path'):
            if self.path.startswith("/sw.js"):
                self.send_header("Service-Worker-Allowed", "/")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            elif self.path.startswith("/manifest.json") or self.path.endswith(".webmanifest"):
                self.send_header("Content-Type", "application/manifest+json; charset=utf-8")
                self.send_header("Cache-Control", "no-cache, must-revalidate")
            elif self.path.endswith(".html") or self.path in ("/", ""):
                self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def _send_json(self, data, status=HTTPStatus.OK):
        """Helper to send JSON response with standard CORS headers."""
        response_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(response_bytes)

    def _send_error(self, message, status=HTTPStatus.BAD_REQUEST):
        """Helper to send error JSON response."""
        self._send_json({"error": message, "status": status.value}, status=status)

    def _read_json_body(self):
        """Reads and parses JSON body from incoming request."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                return {}
            raw_body = self.rfile.read(content_length)
            return json.loads(raw_body.decode("utf-8"))
        except Exception:
            return None

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        """Handle GET requests for API endpoints or static files."""
        parsed_url = urlparse(self.path)
        path = parsed_url.path.rstrip("/")
        query_params = parse_qs(parsed_url.query)

        # API: Get gym config
        if path == "/api/config":
            return self._send_json(DEFAULT_SETTINGS)

        # API: Get rules
        if path == "/api/rules":
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, category, title, subtitle, sort_order FROM rules ORDER BY sort_order ASC, id ASC")
                rules = [dict(row) for row in cursor.fetchall()]
                return self._send_json({"rules": rules})

        # API: Get hour types
        if path == "/api/hour-types":
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT time_slot, slot_type FROM hour_types ORDER BY time_slot ASC")
                hour_types = {row["time_slot"]: row["slot_type"] for row in cursor.fetchall()}
                for h in range(DEFAULT_SETTINGS["start_hour"], DEFAULT_SETTINGS["end_hour"] + 1):
                    slot_str = f"{h:02d}:00"
                    if slot_str not in hour_types:
                        hour_types[slot_str] = "MIXED"
                return self._send_json({"hour_types": hour_types})

        # API: List members
        if path == "/api/members":
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, name, email, created_at FROM members WHERE active = 1 ORDER BY name ASC"
                )
                members = [dict(row) for row in cursor.fetchall()]
                return self._send_json({"members": members})

        # API: Get calendar bookings for a date range
        if path == "/api/calendar":
            today_str = datetime.date.today().isoformat()
            start_date = query_params.get("start_date", [today_str])[0]
            end_date = query_params.get("end_date", [start_date])[0]

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT 
                        b.id AS booking_id,
                        b.date,
                        b.time_slot,
                        b.created_at AS booked_at,
                        m.id AS member_id,
                        m.name AS member_name,
                        m.email AS member_email
                    FROM bookings b
                    JOIN members m ON b.member_id = m.id
                    WHERE b.date >= ? AND b.date <= ? AND m.active = 1
                    ORDER BY b.date ASC, b.time_slot ASC, b.created_at ASC
                """, (start_date, end_date))
                
                rows = cursor.fetchall()
                
                # Group bookings by date and time_slot
                calendar = {}
                for row in rows:
                    date_key = row["date"]
                    slot_key = row["time_slot"]
                    if date_key not in calendar:
                        calendar[date_key] = {}
                    if slot_key not in calendar[date_key]:
                        calendar[date_key][slot_key] = []
                    
                    calendar[date_key][slot_key].append({
                        "booking_id": row["booking_id"],
                        "member_id": row["member_id"],
                        "member_name": row["member_name"],
                        "member_email": row["member_email"],
                        "booked_at": row["booked_at"]
                    })

                # Fetch hour types
                cursor.execute("SELECT time_slot, slot_type FROM hour_types")
                hour_types = {row["time_slot"]: row["slot_type"] for row in cursor.fetchall()}
                for h in range(DEFAULT_SETTINGS["start_hour"], DEFAULT_SETTINGS["end_hour"] + 1):
                    slot_str = f"{h:02d}:00"
                    if slot_str not in hour_types:
                        hour_types[slot_str] = "MIXED"

                return self._send_json({
                    "start_date": start_date,
                    "end_date": end_date,
                    "max_capacity": DEFAULT_SETTINGS["max_capacity_per_slot"],
                    "calendar": calendar,
                    "hour_types": hour_types
                })

        # API: Get upcoming bookings for a specific member
        if path == "/api/my-bookings":
            member_id = query_params.get("member_id", [None])[0]
            if not member_id:
                return self._send_error("member_id parameter is required", HTTPStatus.BAD_REQUEST)

            today_str = datetime.date.today().isoformat()
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id AS booking_id, date, time_slot, created_at
                    FROM bookings
                    WHERE member_id = ? AND date >= ?
                    ORDER BY date ASC, time_slot ASC
                """, (member_id, today_str))
                bookings = [dict(row) for row in cursor.fetchall()]
                return self._send_json({"bookings": bookings})

        # Fallback to static file server (public/)
        return super().do_GET()

    def do_PUT(self):
        """Handle PUT requests for updating rules."""
        parsed_url = urlparse(self.path)
        path = parsed_url.path.rstrip("/")
        data = self._read_json_body()

        if data is None:
            return self._send_error("Invalid JSON payload", HTTPStatus.BAD_REQUEST)

        # API: Save/replace all rules
        if path == "/api/rules":
            rules = data.get("rules", [])
            if not isinstance(rules, list):
                return self._send_error("Expected rules list", HTTPStatus.BAD_REQUEST)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM rules")
                for i, r in enumerate(rules):
                    cat = (r.get("category") or "Rule").strip()
                    title = (r.get("title") or "").strip()
                    sub = (r.get("subtitle") or "").strip()
                    if title:
                        cursor.execute(
                            "INSERT INTO rules (category, title, subtitle, sort_order) VALUES (?, ?, ?, ?)",
                            (cat, title, sub, i)
                        )
                conn.commit()
                cursor.execute("SELECT id, category, title, subtitle, sort_order FROM rules ORDER BY sort_order ASC, id ASC")
                updated_rules = [dict(row) for row in cursor.fetchall()]
                return self._send_json({"message": "Rules updated successfully", "rules": updated_rules})

        # API: Update hour type (PUT)
        if path == "/api/hour-types":
            time_slot = (data.get("time_slot") or "").strip()
            slot_type = (data.get("slot_type") or "").strip().upper()
            if slot_type not in ("MALE", "FEMALE", "MIXED"):
                return self._send_error("slot_type must be MALE, FEMALE, or MIXED", HTTPStatus.BAD_REQUEST)
            if not time_slot:
                return self._send_error("time_slot is required", HTTPStatus.BAD_REQUEST)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO hour_types (time_slot, slot_type) VALUES (?, ?) ON CONFLICT(time_slot) DO UPDATE SET slot_type = excluded.slot_type",
                    (time_slot, slot_type)
                )
                conn.commit()
                return self._send_json({"message": "Hour type updated", "time_slot": time_slot, "slot_type": slot_type})

        return self._send_error("Endpoint not found", HTTPStatus.NOT_FOUND)

    def do_POST(self):
        """Handle POST requests for creating bookings, members, rules, and hour types."""
        parsed_url = urlparse(self.path)
        path = parsed_url.path.rstrip("/")
        data = self._read_json_body()

        if data is None:
            return self._send_error("Invalid JSON payload", HTTPStatus.BAD_REQUEST)

        # API: Update hour type (POST)
        if path == "/api/hour-types":
            time_slot = (data.get("time_slot") or "").strip()
            slot_type = (data.get("slot_type") or "").strip().upper()
            if slot_type not in ("MALE", "FEMALE", "MIXED"):
                return self._send_error("slot_type must be MALE, FEMALE, or MIXED", HTTPStatus.BAD_REQUEST)
            if not time_slot:
                return self._send_error("time_slot is required", HTTPStatus.BAD_REQUEST)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO hour_types (time_slot, slot_type) VALUES (?, ?) ON CONFLICT(time_slot) DO UPDATE SET slot_type = excluded.slot_type",
                    (time_slot, slot_type)
                )
                conn.commit()
                return self._send_json({"message": "Hour type updated", "time_slot": time_slot, "slot_type": slot_type})

        # API: Add rule
        if path == "/api/rules":
            category = (data.get("category") or "Rule").strip()
            title = (data.get("title") or "").strip()
            subtitle = (data.get("subtitle") or "").strip()

            if not title:
                return self._send_error("Rule title is required", HTTPStatus.BAD_REQUEST)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) as count FROM rules")
                next_order = cursor.fetchone()["count"]
                cursor.execute(
                    "INSERT INTO rules (category, title, subtitle, sort_order) VALUES (?, ?, ?, ?)",
                    (category, title, subtitle, next_order)
                )
                conn.commit()
                new_id = cursor.lastrowid
                return self._send_json({
                    "message": "Rule added successfully",
                    "rule": {"id": new_id, "category": category, "title": title, "subtitle": subtitle, "sort_order": next_order}
                }, HTTPStatus.CREATED)

        # API: Add member
        if path == "/api/members":
            name = (data.get("name") or "").strip()
            email = (data.get("email") or "").strip()

            if not name:
                return self._send_error("Member name is required", HTTPStatus.BAD_REQUEST)
            
            if len(name) > 60:
                return self._send_error("Member name is too long", HTTPStatus.BAD_REQUEST)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                try:
                    cursor.execute(
                        "INSERT INTO members (name, email) VALUES (?, ?)",
                        (name, email if email else None)
                    )
                    conn.commit()
                    new_id = cursor.lastrowid
                    return self._send_json({
                        "message": "Member added successfully",
                        "member": {"id": new_id, "name": name, "email": email}
                    }, HTTPStatus.CREATED)
                except sqlite3.IntegrityError:
                    return self._send_error(f"A member with name '{name}' already exists", HTTPStatus.CONFLICT)

        # API: Create booking
        if path == "/api/bookings":
            member_id = data.get("member_id")
            date_str = (data.get("date") or "").strip()
            time_slot = (data.get("time_slot") or "").strip()

            if not member_id or not date_str or not time_slot:
                return self._send_error("member_id, date, and time_slot are required", HTTPStatus.BAD_REQUEST)

            # Validate date format (YYYY-MM-DD)
            try:
                booking_date = datetime.date.fromisoformat(date_str)
                today = datetime.date.today()
                if booking_date < today:
                    return self._send_error("Cannot book slots in the past", HTTPStatus.BAD_REQUEST)
            except ValueError:
                return self._send_error("Invalid date format. Expected YYYY-MM-DD", HTTPStatus.BAD_REQUEST)

            # Validate time_slot format (HH:MM)
            try:
                hour = int(time_slot.split(":")[0])
                if hour < DEFAULT_SETTINGS["start_hour"] or hour > DEFAULT_SETTINGS["end_hour"]:
                    return self._send_error(
                        f"Time slot out of gym operating hours ({DEFAULT_SETTINGS['start_hour']:02d}:00 - {DEFAULT_SETTINGS['end_hour']:02d}:00)",
                        HTTPStatus.BAD_REQUEST
                    )
                # Check same-day past hour
                now = datetime.datetime.now()
                if booking_date == today and hour < now.hour:
                    return self._send_error("Cannot book past time slots for today", HTTPStatus.BAD_REQUEST)
            except Exception:
                return self._send_error("Invalid time_slot format. Expected HH:MM (e.g. 08:00)", HTTPStatus.BAD_REQUEST)

            with get_db_connection() as conn:
                cursor = conn.cursor()

                # Check member validity
                cursor.execute("SELECT id, name FROM members WHERE id = ? AND active = 1", (member_id,))
                member = cursor.fetchone()
                if not member:
                    return self._send_error("Active member not found", HTTPStatus.NOT_FOUND)

                # Check current slot capacity
                cursor.execute(
                    "SELECT COUNT(*) AS booked_count FROM bookings WHERE date = ? AND time_slot = ?",
                    (date_str, time_slot)
                )
                booked_count = cursor.fetchone()["booked_count"]
                max_capacity = DEFAULT_SETTINGS["max_capacity_per_slot"]

                if booked_count >= max_capacity:
                    return self._send_error(
                        f"Slot is fully booked ({booked_count}/{max_capacity} spots taken)",
                        HTTPStatus.CONFLICT
                    )

                # Insert booking
                try:
                    cursor.execute(
                        "INSERT INTO bookings (member_id, date, time_slot) VALUES (?, ?, ?)",
                        (member_id, date_str, time_slot)
                    )
                    conn.commit()
                    booking_id = cursor.lastrowid
                    return self._send_json({
                        "message": "Spot booked successfully!",
                        "booking": {
                            "id": booking_id,
                            "member_id": member_id,
                            "member_name": member["name"],
                            "date": date_str,
                            "time_slot": time_slot
                        }
                    }, HTTPStatus.CREATED)
                except sqlite3.IntegrityError:
                    return self._send_error("You have already booked this slot", HTTPStatus.CONFLICT)

        return self._send_error("Endpoint not found", HTTPStatus.NOT_FOUND)

    def do_DELETE(self):
        """Handle DELETE requests for removing members, bookings, and rules."""
        parsed_url = urlparse(self.path)
        path = parsed_url.path.rstrip("/")

        # API: Delete rule by ID -> /api/rules/<id>
        if path.startswith("/api/rules/"):
            try:
                rule_id = int(path.split("/")[-1])
            except ValueError:
                return self._send_error("Invalid rule ID", HTTPStatus.BAD_REQUEST)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM rules WHERE id = ?", (rule_id,))
                conn.commit()
                return self._send_json({
                    "message": "Rule deleted successfully",
                    "deleted_id": rule_id
                })

        # API: Cancel booking by ID -> /api/bookings/<id>
        if path.startswith("/api/bookings/"):
            try:
                booking_id = int(path.split("/")[-1])
            except ValueError:
                return self._send_error("Invalid booking ID", HTTPStatus.BAD_REQUEST)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, member_id, date, time_slot FROM bookings WHERE id = ?", (booking_id,))
                booking = cursor.fetchone()
                if not booking:
                    return self._send_error("Booking not found", HTTPStatus.NOT_FOUND)

                cursor.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
                conn.commit()
                return self._send_json({
                    "message": "Booking cancelled successfully",
                    "cancelled_id": booking_id
                })

        # API: Remove member by ID -> /api/members/<id>
        if path.startswith("/api/members/"):
            try:
                member_id = int(path.split("/")[-1])
            except ValueError:
                return self._send_error("Invalid member ID", HTTPStatus.BAD_REQUEST)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, name FROM members WHERE id = ?", (member_id,))
                member = cursor.fetchone()
                if not member:
                    return self._send_error("Member not found", HTTPStatus.NOT_FOUND)

                cursor.execute("DELETE FROM members WHERE id = ?", (member_id,))
                conn.commit()
                return self._send_json({
                    "message": f"Member '{member['name']}' removed successfully",
                    "deleted_id": member_id
                })

        return self._send_error("Endpoint not found", HTTPStatus.NOT_FOUND)


def run_server():
    """Initializes DB and launches the multi-threaded HTTP server."""
    os.makedirs(STATIC_DIR, exist_ok=True)
    init_db()
    
    server_address = ("0.0.0.0", PORT)
    httpd = ThreadingHTTPServer(server_address, GymBookingHandler)
    print(f"🏋️  Office Gym Booking Server is running at http://localhost:{PORT}")
    print(f"📁 Static directory: {STATIC_DIR}")
    print(f"💾 SQLite database: {DB_PATH}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server gracefully...")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
