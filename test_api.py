#!/usr/bin/env python3
"""
Automated verification test script for Office Gym Booking System
"""
import urllib.request
import urllib.error
import json
import datetime
import sys

BASE_URL = "http://127.0.0.1:3000"

def request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"} if data else {}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            content = json.loads(response.read().decode("utf-8"))
            return status, content
    except urllib.error.HTTPError as e:
        content = json.loads(e.read().decode("utf-8"))
        return e.code, content

def run_tests():
    print("🧪 Running API Verification Tests...")
    
    # 1. Config
    status, config = request("/api/config")
    assert status == 200, f"Config failed: {status}"
    assert config["max_capacity_per_slot"] == 4
    print("  ✓ GET /api/config passed")

    # 2. Members
    status, members_data = request("/api/members")
    assert status == 200, f"Members failed: {status}"
    members = members_data["members"]
    assert len(members) >= 7, "Sample members not initialized"
    member1 = members[0]
    member2 = members[1]
    print(f"  ✓ GET /api/members passed (Found {len(members)} members)")

    # 3. Add Member
    test_member_name = f"Test Runner {datetime.datetime.now().strftime('%H%M%S')}"
    status, new_member_res = request("/api/members", method="POST", data={"name": test_member_name, "email": "test@gym.local"})
    assert status == 201, f"Add member failed: {status} {new_member_res}"
    new_member_id = new_member_res["member"]["id"]
    print(f"  ✓ POST /api/members passed (Created ID: {new_member_id})")

    # 4. Duplicate Member check
    status, dup_res = request("/api/members", method="POST", data={"name": test_member_name})
    assert status == 409, f"Duplicate check failed: {status}"
    print("  ✓ POST /api/members duplicate rejection passed (409 Conflict)")

    # 5. Bookings: Book future date slot
    future_date = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()
    test_slot = "08:00"

    status, book_res = request("/api/bookings", method="POST", data={
        "member_id": new_member_id,
        "date": future_date,
        "time_slot": test_slot
    })
    assert status == 201, f"Booking failed: {status} {book_res}"
    booking_id = book_res["booking"]["id"]
    print(f"  ✓ POST /api/bookings passed (Booked ID: {booking_id})")

    # 6. Duplicate Booking prevention
    status, dup_book_res = request("/api/bookings", method="POST", data={
        "member_id": new_member_id,
        "date": future_date,
        "time_slot": test_slot
    })
    assert status == 409, f"Duplicate booking should fail: {status}"
    print("  ✓ Duplicate booking prevention passed (409 Conflict)")

    # 7. Calendar View
    status, cal_data = request(f"/api/calendar?start_date={future_date}&end_date={future_date}")
    assert status == 200, f"Calendar query failed: {status}"
    calendar = cal_data["calendar"]
    assert future_date in calendar, "Date not found in calendar"
    assert test_slot in calendar[future_date], "Slot not found in calendar"
    assert len(calendar[future_date][test_slot]) == 1
    print("  ✓ GET /api/calendar verified booking reflection")

    # 8. Cancel Booking
    status, del_res = request(f"/api/bookings/{booking_id}", method="DELETE")
    assert status == 200, f"Cancel booking failed: {status}"
    print("  ✓ DELETE /api/bookings/:id passed")

    # 9. Clean up test member
    status, del_mem_res = request(f"/api/members/{new_member_id}", method="DELETE")
    assert status == 200, f"Remove member failed: {status}"
    print("  ✓ DELETE /api/members/:id passed")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
