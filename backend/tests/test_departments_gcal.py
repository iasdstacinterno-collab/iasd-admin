"""ChurchFlow iteration 2 backend tests:
- Departments CRUD + monthly schedule
- Google Calendar OAuth endpoints (login URL, status, disconnect)
- assignment confirm flow when user has no Calendar connected
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

def _load_base_url():
    val = os.environ.get('REACT_APP_BACKEND_URL')
    if val:
        return val.rstrip('/')
    # Fallback: read frontend/.env
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', '.env')
    try:
        with open(env_path) as fh:
            for line in fh:
                if line.startswith('REACT_APP_BACKEND_URL'):
                    return line.split('=', 1)[1].strip().strip('"').rstrip('/')
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")

BASE_URL = _load_base_url()
ADMIN_EMAIL = "iasdstacinterno@gmail.com"
ADMIN_PASSWORD = "Admin@2026"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


@pytest.fixture(scope="session")
def seed_church(admin_session):
    rows = admin_session.get(f"{BASE_URL}/api/churches").json()
    if not rows:
        # create a test church if none exists
        r = admin_session.post(
            f"{BASE_URL}/api/churches",
            json={"name": f"TEST_Igreja_{uuid.uuid4().hex[:6]}", "city": "Test"},
        )
        return r.json()
    return rows[0]


@pytest.fixture(scope="session")
def seed_members(admin_session, seed_church):
    cid = seed_church["church_id"]
    members = admin_session.get(f"{BASE_URL}/api/churches/{cid}/members").json()
    # Ensure at least 2 members exist
    while len(members) < 2:
        r = admin_session.post(
            f"{BASE_URL}/api/churches/{cid}/members",
            json={"name": f"TEST_M_{uuid.uuid4().hex[:5]}",
                  "email": f"TEST_{uuid.uuid4().hex[:5]}@ex.com",
                  "phone": "11999",
                  "roles": ["musico"]},
        )
        assert r.status_code == 200, r.text
        members.append(r.json())
    return members


@pytest.fixture(scope="session")
def seed_template(admin_session, seed_church):
    cid = seed_church["church_id"]
    tpls = admin_session.get(f"{BASE_URL}/api/churches/{cid}/templates").json()
    if tpls:
        return tpls[0]
    r = admin_session.post(
        f"{BASE_URL}/api/churches/{cid}/templates",
        json={"name": f"TEST_Tpl_{uuid.uuid4().hex[:5]}",
              "steps": [{"order": 1, "name": "Abertura", "title": "Abertura", "duration_min": 5, "role_required": "pregador"}]},
    )
    assert r.status_code == 200, r.text
    return r.json()


# ================= Departments CRUD =================
class TestDepartments:
    def test_create_list_update_delete_department(self, admin_session, seed_church, seed_members):
        cid = seed_church["church_id"]
        members = seed_members

        # CREATE
        name = f"TEST_Dep_{uuid.uuid4().hex[:6]}"
        r = admin_session.post(
            f"{BASE_URL}/api/churches/{cid}/departments",
            json={"name": name, "description": "Departamento de teste"},
        )
        assert r.status_code == 200, r.text
        dep = r.json()
        assert dep["name"] == name
        assert dep["description"] == "Departamento de teste"
        assert dep["member_ids"] == []
        assert "department_id" in dep
        assert "_id" not in dep
        did = dep["department_id"]

        # LIST and verify persistence
        lr = admin_session.get(f"{BASE_URL}/api/churches/{cid}/departments")
        assert lr.status_code == 200
        rows = lr.json()
        assert any(d["department_id"] == did for d in rows)
        assert all("_id" not in d for d in rows)

        # PATCH name + description
        p = admin_session.patch(
            f"{BASE_URL}/api/departments/{did}",
            json={"name": name + "_upd", "description": "Atualizada"},
        )
        assert p.status_code == 200, p.text

        # PATCH member_ids using seed members
        chosen = [m["member_id"] for m in members[:2]]
        p2 = admin_session.patch(
            f"{BASE_URL}/api/departments/{did}",
            json={"member_ids": chosen},
        )
        assert p2.status_code == 200, p2.text

        # Verify update via list
        rows = admin_session.get(f"{BASE_URL}/api/churches/{cid}/departments").json()
        upd = next(d for d in rows if d["department_id"] == did)
        assert upd["name"].endswith("_upd")
        assert upd["description"] == "Atualizada"
        assert set(upd["member_ids"]) == set(chosen)

        # DELETE
        d = admin_session.delete(f"{BASE_URL}/api/departments/{did}")
        assert d.status_code == 200
        rows = admin_session.get(f"{BASE_URL}/api/churches/{cid}/departments").json()
        assert not any(x["department_id"] == did for x in rows)

    def test_patch_unknown_department_404(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/departments/dep_nonexistent_xyz",
            json={"name": "x"},
        )
        assert r.status_code == 404

    def test_non_admin_cannot_create_department(self, seed_church):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": "pass1234", "name": "P"},
        )
        tok = reg.json()["token"]
        r = requests.post(
            f"{BASE_URL}/api/churches/{seed_church['church_id']}/departments",
            json={"name": "Nope"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 403


# ================= Department Schedule =================
class TestDepartmentSchedule:
    @pytest.fixture
    def dep_with_member(self, admin_session, seed_church, seed_members):
        cid = seed_church["church_id"]
        members = seed_members
        r = admin_session.post(
            f"{BASE_URL}/api/churches/{cid}/departments",
            json={"name": f"TEST_DepSched_{uuid.uuid4().hex[:5]}"},
        )
        dep = r.json()
        # add a member to it
        admin_session.patch(
            f"{BASE_URL}/api/departments/{dep['department_id']}",
            json={"member_ids": [members[0]["member_id"]]},
        )
        yield dep, members[0]
        admin_session.delete(f"{BASE_URL}/api/departments/{dep['department_id']}")

    def test_get_empty_schedule_returns_skeleton(self, admin_session, dep_with_member):
        dep, _ = dep_with_member
        r = admin_session.get(
            f"{BASE_URL}/api/departments/{dep['department_id']}/schedule",
            params={"year": 2099, "month": 6},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["year"] == 2099
        assert data["month"] == 6
        assert data["entries"] == []
        assert "_id" not in data

    def test_set_and_get_schedule_persists(self, admin_session, dep_with_member):
        dep, member = dep_with_member
        payload = {
            "year": 2026,
            "month": 3,
            "entries": [
                {"date": "2026-03-07", "member_id": member["member_id"], "role": "Lider", "notes": "manha"},
                {"date": "2026-03-14", "member_id": member["member_id"], "role": "Auxiliar", "notes": ""},
            ],
        }
        r = admin_session.put(
            f"{BASE_URL}/api/departments/{dep['department_id']}/schedule",
            json=payload,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("count") == 2

        # GET to verify persistence
        g = admin_session.get(
            f"{BASE_URL}/api/departments/{dep['department_id']}/schedule",
            params={"year": 2026, "month": 3},
        )
        assert g.status_code == 200
        data = g.json()
        assert data["year"] == 2026 and data["month"] == 3
        assert len(data["entries"]) == 2
        assert data["entries"][0]["role"] == "Lider"
        assert data["entries"][0]["member_id"] == member["member_id"]
        assert "_id" not in data

        # Update (upsert) - replace entries
        r2 = admin_session.put(
            f"{BASE_URL}/api/departments/{dep['department_id']}/schedule",
            json={"year": 2026, "month": 3, "entries": []},
        )
        assert r2.status_code == 200
        g2 = admin_session.get(
            f"{BASE_URL}/api/departments/{dep['department_id']}/schedule",
            params={"year": 2026, "month": 3},
        ).json()
        assert g2["entries"] == []


# ================= Google Calendar OAuth =================
class TestGoogleCalendarOAuth:
    def test_login_returns_google_authorization_url(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/oauth/calendar/login")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "authorization_url" in data
        url = data["authorization_url"]
        assert "accounts.google.com/o/oauth2" in url
        assert "client_id=" in url
        assert "redirect_uri=" in url
        assert "scope=" in url
        assert "calendar" in url
        assert "state=" in url

    def test_status_unauthenticated_401(self):
        r = requests.get(f"{BASE_URL}/api/oauth/calendar/status")
        assert r.status_code == 401

    def test_disconnect_then_status_disconnected(self, admin_session):
        # ensure clean baseline
        d = admin_session.post(f"{BASE_URL}/api/oauth/calendar/disconnect")
        assert d.status_code == 200
        s = admin_session.get(f"{BASE_URL}/api/oauth/calendar/status")
        assert s.status_code == 200
        body = s.json()
        assert body["connected"] is False

    def test_callback_endpoint_exists(self):
        # Calling without proper params should not 404. We accept 4xx/redirects but NOT 404.
        r = requests.get(
            f"{BASE_URL}/api/oauth/calendar/callback",
            allow_redirects=False,
        )
        assert r.status_code != 404, "OAuth callback route is missing"
        # With invalid state, server redirects to /dashboard?gcal=erro_state when both code and state are provided.
        r2 = requests.get(
            f"{BASE_URL}/api/oauth/calendar/callback",
            params={"code": "x", "state": "invalid_token"},
            allow_redirects=False,
        )
        # Could be 307/302 redirect or 422; key is that endpoint is reachable.
        assert r2.status_code != 404


# ================= Assignment confirm without GCal connected =================
class TestAssignmentConfirmNoGCal:
    def test_patch_assignment_confirm_without_gcal_does_not_fail(self, admin_session, seed_church, seed_members, seed_template):
        cid = seed_church["church_id"]
        members = seed_members
        tpl = seed_template

        # ensure admin is disconnected first
        admin_session.post(f"{BASE_URL}/api/oauth/calendar/disconnect")

        svc_payload = {
            "name": f"TEST_GcalSvc_{uuid.uuid4().hex[:5]}",
            "date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "template_id": tpl["template_id"],
        }
        svc = admin_session.post(
            f"{BASE_URL}/api/churches/{cid}/services", json=svc_payload
        ).json()
        sid = svc["service_id"]
        try:
            step_id = svc["steps"][0]["id"]
            a = admin_session.post(
                f"{BASE_URL}/api/services/{sid}/assignments",
                json={"step_id": step_id, "member_id": members[0]["member_id"]},
            )
            assert a.status_code == 200, a.text
            aid = a.json()["assignment_id"]

            # Confirm: must succeed even without Calendar connected
            p = admin_session.patch(f"{BASE_URL}/api/assignments/{aid}?status=confirmado")
            assert p.status_code == 200, p.text
            body = p.json()
            assert body["status"] == "confirmado"
            # gcal_event_id should be None / null when no token
            assert body.get("gcal_event_id") in (None, "", "null")
        finally:
            admin_session.delete(f"{BASE_URL}/api/services/{sid}")
