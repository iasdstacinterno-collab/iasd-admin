"""ChurchFlow backend API tests - covers auth, churches, members, templates, services,
assignments, elections, notifications, and reports flows."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://worship-connect-29.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "iasdstacinterno@gmail.com"
ADMIN_PASSWORD = "Admin@2026"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "ADMIN_GLOBAL"
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    s.admin_token = data["token"]
    s.admin_user = data["user"]
    return s


@pytest.fixture(scope="session")
def seed_church(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/churches")
    assert r.status_code == 200
    churches = r.json()
    central = next((c for c in churches if c["name"] == "IASD Central"), None)
    assert central is not None, "seed church IASD Central not found"
    return central


# ---------- Auth ----------
class TestAuth:
    def test_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "ADMIN_GLOBAL"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_and_me(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": "pass1234", "name": "Test User"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "PARTICIPANTE"
        token = data["token"]

        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_register_duplicate(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r1 = requests.post(f"{BASE_URL}/api/auth/register",
                           json={"email": email, "password": "pass1234", "name": "A"})
        assert r1.status_code == 200
        r2 = requests.post(f"{BASE_URL}/api/auth/register",
                           json={"email": email, "password": "pass1234", "name": "A"})
        assert r2.status_code == 400

    def test_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ---------- Churches ----------
class TestChurches:
    def test_list_churches(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/churches")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert any(c["name"] == "IASD Central" for c in rows)

    def test_create_and_delete_church(self, admin_session):
        name = f"TEST_Igreja_{uuid.uuid4().hex[:6]}"
        r = admin_session.post(f"{BASE_URL}/api/churches", json={"name": name, "city": "Test City"})
        assert r.status_code == 200, r.text
        ch = r.json()
        assert ch["name"] == name
        assert "church_id" in ch
        # verify via GET list
        lr = admin_session.get(f"{BASE_URL}/api/churches")
        assert any(c["church_id"] == ch["church_id"] for c in lr.json())
        # delete
        d = admin_session.delete(f"{BASE_URL}/api/churches/{ch['church_id']}")
        assert d.status_code == 200

    def test_non_admin_cannot_create(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{BASE_URL}/api/auth/register",
                            json={"email": email, "password": "pass1234", "name": "P"})
        tok = reg.json()["token"]
        r = requests.post(f"{BASE_URL}/api/churches", json={"name": "Nope"},
                          headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403


# ---------- Members ----------
class TestMembers:
    def test_seed_has_6_members(self, admin_session, seed_church):
        r = admin_session.get(f"{BASE_URL}/api/churches/{seed_church['church_id']}/members")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 6

    def test_create_member(self, admin_session, seed_church):
        payload = {"name": "TEST_Member", "email": f"TEST_{uuid.uuid4().hex[:6]}@ex.com",
                   "phone": "11999", "roles": ["musico"]}
        r = admin_session.post(f"{BASE_URL}/api/churches/{seed_church['church_id']}/members", json=payload)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["name"] == "TEST_Member"
        assert "musico" in m["roles"]
        # verify via list
        lr = admin_session.get(f"{BASE_URL}/api/churches/{seed_church['church_id']}/members")
        assert any(x["member_id"] == m["member_id"] for x in lr.json())
        # cleanup
        admin_session.delete(f"{BASE_URL}/api/members/{m['member_id']}")


# ---------- Templates + Services + Assignments ----------
class TestServicesFlow:
    def test_templates_seed(self, admin_session, seed_church):
        r = admin_session.get(f"{BASE_URL}/api/churches/{seed_church['church_id']}/templates")
        assert r.status_code == 200
        rows = r.json()
        assert any(t["name"] == "Culto Divino Padrao" for t in rows)
        assert all(len(t["steps"]) >= 1 for t in rows)

    def test_service_full_flow(self, admin_session, seed_church):
        cid = seed_church["church_id"]
        # pick template
        tpl = admin_session.get(f"{BASE_URL}/api/churches/{cid}/templates").json()[0]
        # create service
        svc_payload = {"name": "TEST_Culto", "date": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
                       "template_id": tpl["template_id"]}
        r = admin_session.post(f"{BASE_URL}/api/churches/{cid}/services", json=svc_payload)
        assert r.status_code == 200, r.text
        svc = r.json()
        assert svc["name"] == "TEST_Culto"
        assert len(svc["steps"]) == len(tpl["steps"])
        sid = svc["service_id"]

        # GET persistence
        g = admin_session.get(f"{BASE_URL}/api/services/{sid}")
        assert g.status_code == 200
        assert g.json()["service_id"] == sid

        # Update steps
        new_steps = svc["steps"][:2]  # keep 2
        u = admin_session.put(f"{BASE_URL}/api/services/{sid}/steps", json=new_steps)
        assert u.status_code == 200
        assert len(u.json()["steps"]) == 2

        # Create assignment
        members = admin_session.get(f"{BASE_URL}/api/churches/{cid}/members").json()
        step_id = u.json()["steps"][0]["id"]
        a = admin_session.post(f"{BASE_URL}/api/services/{sid}/assignments",
                               json={"step_id": step_id, "member_id": members[0]["member_id"]})
        assert a.status_code == 200, a.text
        aid = a.json()["assignment_id"]
        assert a.json()["status"] == "pendente"

        # List assignments
        la = admin_session.get(f"{BASE_URL}/api/services/{sid}/assignments")
        assert la.status_code == 200
        assert any(x["assignment_id"] == aid for x in la.json())

        # PATCH confirm - note: status is query param
        p = admin_session.patch(f"{BASE_URL}/api/assignments/{aid}?status=confirmado")
        assert p.status_code == 200, p.text
        assert p.json()["status"] == "confirmado"

        # Suggest
        s = admin_session.post(f"{BASE_URL}/api/services/{sid}/suggest")
        assert s.status_code == 200
        sug = s.json()
        assert "suggestions" in sug
        assert len(sug["suggestions"]) >= 1

        # cleanup
        admin_session.delete(f"{BASE_URL}/api/services/{sid}")


# ---------- Elections ----------
class TestElections:
    def test_election_flow(self, admin_session, seed_church):
        cid = seed_church["church_id"]
        payload = {
            "title": f"TEST_Eleicao_{uuid.uuid4().hex[:5]}",
            "description": "Test election",
            "candidates": ["Alice", "Bob"],
            "ends_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        }
        r = admin_session.post(f"{BASE_URL}/api/churches/{cid}/elections", json=payload)
        assert r.status_code == 200, r.text
        eid = r.json()["election_id"]
        assert r.json()["status"] == "open"

        # vote
        v = admin_session.post(f"{BASE_URL}/api/elections/{eid}/vote", json={"candidate": "Alice"})
        assert v.status_code == 200

        # Duplicate vote denied
        v2 = admin_session.post(f"{BASE_URL}/api/elections/{eid}/vote", json={"candidate": "Bob"})
        assert v2.status_code == 400

        # Invalid candidate
        v3 = admin_session.post(f"{BASE_URL}/api/elections/{eid}/vote", json={"candidate": "Nobody"})
        assert v3.status_code == 400

        # Results
        lst = admin_session.get(f"{BASE_URL}/api/churches/{cid}/elections")
        assert lst.status_code == 200
        this = next(x for x in lst.json() if x["election_id"] == eid)
        assert this["results"].get("Alice") == 1
        assert this["total_votes"] == 1


# ---------- Notifications ----------
class TestNotifications:
    def test_notifications_endpoint(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Reports ----------
class TestReports:
    def test_reports(self, admin_session, seed_church):
        cid = seed_church["church_id"]
        r = admin_session.get(f"{BASE_URL}/api/churches/{cid}/reports")
        assert r.status_code == 200
        data = r.json()
        for k in ("total_members", "total_services", "total_assignments", "member_stats", "role_counts"):
            assert k in data
        assert data["total_members"] >= 6

    def test_reports_export_csv(self, admin_session, seed_church):
        cid = seed_church["church_id"]
        r = admin_session.get(f"{BASE_URL}/api/churches/{cid}/reports/export")
        assert r.status_code == 200
        ctype = r.headers.get("content-type", "")
        assert "text/csv" in ctype
        body = r.text
        # header row
        assert body.split("\n")[0].strip().startswith("culto")
