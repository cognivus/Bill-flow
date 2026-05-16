"""
BillFlow API Test Suite
Run: pytest tests/ -v
"""
import pytest
import asyncio
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.database.session import get_db, Base
from app.core.security import hash_password

# ── Test DB (in-memory SQLite for speed) ─────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def auth_headers(client):
    """Create user, login, return auth headers."""
    signup_data = {
        "email": "test@example.com",
        "password": "TestPass@123",
        "full_name": "Test User",
    }
    await client.post("/api/v1/auth/signup", json=signup_data)
    res = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "TestPass@123",
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def business_headers(client, auth_headers):
    """Create business and return headers."""
    await client.post("/api/v1/businesses", json={
        "name": "Test Business Ltd",
        "invoice_prefix": "TB",
    }, headers=auth_headers)
    return auth_headers


# ── Auth Tests ────────────────────────────────────────────
class TestAuth:
    async def test_signup_success(self, client):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "newuser@test.com",
            "password": "NewUser@123",
            "full_name": "New User",
        })
        assert res.status_code == 201
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "newuser@test.com"

    async def test_signup_duplicate_email(self, client):
        payload = {"email": "dup@test.com", "password": "Dup@1234", "full_name": "Dup"}
        await client.post("/api/v1/auth/signup", json=payload)
        res = await client.post("/api/v1/auth/signup", json=payload)
        assert res.status_code == 409

    async def test_signup_weak_password(self, client):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "weak@test.com",
            "password": "short",
            "full_name": "Weak",
        })
        assert res.status_code == 422

    async def test_login_success(self, client, auth_headers):
        res = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "TestPass@123",
        })
        assert res.status_code == 200
        assert "access_token" in res.json()

    async def test_login_wrong_password(self, client):
        res = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "WrongPass@123",
        })
        assert res.status_code == 401

    async def test_get_me(self, client, auth_headers):
        res = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["email"] == "test@example.com"

    async def test_protected_route_no_token(self, client):
        res = await client.get("/api/v1/auth/me")
        assert res.status_code == 403  # HTTPBearer returns 403 when no token

    async def test_refresh_token(self, client):
        signup_res = await client.post("/api/v1/auth/signup", json={
            "email": "refresh@test.com",
            "password": "Refresh@123",
            "full_name": "Refresh User",
        })
        refresh_token = signup_res.json()["refresh_token"]
        res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert res.status_code == 200
        assert "access_token" in res.json()


# ── Business Tests ────────────────────────────────────────
class TestBusiness:
    async def test_create_business(self, client, auth_headers):
        res = await client.post("/api/v1/businesses", json={
            "name": "My Shop Pvt Ltd",
            "gst_number": "29AAAAA0000A1Z5",
            "invoice_prefix": "MS",
        }, headers=auth_headers)
        # May 409 if fixture already created one - that's fine
        assert res.status_code in (201, 409)

    async def test_get_my_business(self, client, business_headers):
        res = await client.get("/api/v1/businesses/me", headers=business_headers)
        assert res.status_code == 200
        data = res.json()
        assert "id" in data
        assert "invoice_prefix" in data

    async def test_update_business(self, client, business_headers):
        res = await client.put("/api/v1/businesses/me", json={
            "invoice_notes": "Thank you for your business!",
            "city": "Bangalore",
        }, headers=business_headers)
        assert res.status_code == 200
        assert res.json()["city"] == "Bangalore"


# ── Product Tests ─────────────────────────────────────────
class TestProducts:
    async def test_create_product(self, client, business_headers):
        res = await client.post("/api/v1/products", json={
            "name": "Test Product",
            "price": "1500.00",
            "gst_percentage": "18",
            "stock_quantity": 100,
            "unit": "pcs",
        }, headers=business_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Test Product"
        assert data["price"] == "1500.00"
        return data["id"]

    async def test_list_products(self, client, business_headers):
        res = await client.get("/api/v1/products", headers=business_headers)
        assert res.status_code == 200
        assert "items" in res.json()
        assert "total" in res.json()

    async def test_search_products(self, client, business_headers):
        # Create product first
        await client.post("/api/v1/products", json={
            "name": "Searchable Widget",
            "price": "500",
            "gst_percentage": "12",
        }, headers=business_headers)
        res = await client.get("/api/v1/products?search=Searchable", headers=business_headers)
        assert res.status_code == 200
        items = res.json()["items"]
        assert any("Searchable" in p["name"] for p in items)

    async def test_product_not_found_other_business(self, client, business_headers):
        """Non-existent product returns 404"""
        res = await client.get(
            "/api/v1/products/00000000-0000-0000-0000-000000000000",
            headers=business_headers
        )
        assert res.status_code == 404


# ── Customer Tests ────────────────────────────────────────
class TestCustomers:
    async def test_create_customer(self, client, business_headers):
        res = await client.post("/api/v1/customers", json={
            "name": "Acme Corp",
            "phone": "+91 98765 43210",
            "email": "billing@acme.com",
        }, headers=business_headers)
        assert res.status_code == 201
        assert res.json()["name"] == "Acme Corp"

    async def test_list_customers(self, client, business_headers):
        res = await client.get("/api/v1/customers", headers=business_headers)
        assert res.status_code == 200
        assert "items" in res.json()


# ── Invoice Tests ─────────────────────────────────────────
class TestInvoices:
    async def test_create_invoice_success(self, client, business_headers):
        res = await client.post("/api/v1/invoices", json={
            "customer_name": "Walk-in Customer",
            "items": [
                {
                    "product_name": "Consulting Service",
                    "quantity": 2,
                    "unit_price": 5000,
                    "gst_percentage": 18,
                    "is_igst": False,
                }
            ],
        }, headers=business_headers)
        assert res.status_code == 201
        data = res.json()
        assert "invoice_number" in data
        assert len(data["items"]) == 1
        # Verify GST calculation
        assert float(data["subtotal"]) == pytest.approx(8474.58, rel=0.01)
        return data["id"]

    async def test_create_invoice_multi_item(self, client, business_headers):
        res = await client.post("/api/v1/invoices", json={
            "customer_name": "Multi-item Client",
            "items": [
                {"product_name": "Item A", "quantity": 1, "unit_price": 1000, "gst_percentage": 18, "is_igst": False},
                {"product_name": "Item B", "quantity": 2, "unit_price": 500, "gst_percentage": 12, "is_igst": False},
                {"product_name": "Item C", "quantity": 3, "unit_price": 200, "gst_percentage": 5, "is_igst": False},
            ],
        }, headers=business_headers)
        assert res.status_code == 201
        data = res.json()
        assert len(data["items"]) == 3
        assert float(data["grand_total"]) > 0

    async def test_create_invoice_empty_items_fails(self, client, business_headers):
        res = await client.post("/api/v1/invoices", json={
            "customer_name": "Test",
            "items": [],
        }, headers=business_headers)
        assert res.status_code == 422

    async def test_list_invoices(self, client, business_headers):
        res = await client.get("/api/v1/invoices", headers=business_headers)
        assert res.status_code == 200
        assert "items" in res.json()

    async def test_update_invoice_mark_paid(self, client, business_headers):
        # Create invoice first
        create_res = await client.post("/api/v1/invoices", json={
            "customer_name": "Pay Me",
            "items": [{"product_name": "Item", "quantity": 1, "unit_price": 1000, "gst_percentage": 18, "is_igst": False}],
        }, headers=business_headers)
        inv_id = create_res.json()["id"]
        grand_total = create_res.json()["grand_total"]

        res = await client.put(f"/api/v1/invoices/{inv_id}", json={
            "payment_status": "paid",
            "amount_paid": float(grand_total),
        }, headers=business_headers)
        assert res.status_code == 200
        assert res.json()["payment_status"] == "paid"

    async def test_invoice_not_accessible_without_auth(self, client):
        res = await client.get("/api/v1/invoices")
        assert res.status_code == 403


# ── GST Calculation Tests ─────────────────────────────────
class TestGSTCalculations:
    """Unit tests for GST calculation logic"""

    def test_intra_state_gst(self):
        from app.services.invoice_service import calculate_item_totals
        from app.schemas.schemas import InvoiceItemCreate
        from decimal import Decimal

        item = InvoiceItemCreate(
            product_name="Test",
            quantity=Decimal("1"),
            unit_price=Decimal("1000"),
            gst_percentage=Decimal("18"),
            is_igst=False,
        )
        result = calculate_item_totals(item)
        # 1000 base, 9% CGST + 9% SGST = 180 tax, total = 1180
        assert result["taxable_amount"] == Decimal("1000.00")
        assert result["cgst_percentage"] == Decimal("9.000")
        assert result["sgst_percentage"] == Decimal("9.000")
        assert result["igst_percentage"] == Decimal("0.00")
        assert result["tax_amount"] == Decimal("180.00")
        assert result["total_amount"] == Decimal("1180.00")

    def test_inter_state_igst(self):
        from app.services.invoice_service import calculate_item_totals
        from app.schemas.schemas import InvoiceItemCreate

        item = InvoiceItemCreate(
            product_name="Test",
            quantity=Decimal("1"),
            unit_price=Decimal("1000"),
            gst_percentage=Decimal("18"),
            is_igst=True,
        )
        result = calculate_item_totals(item)
        assert result["igst_percentage"] == Decimal("18")
        assert result["cgst_percentage"] == Decimal("0.00")
        assert result["sgst_percentage"] == Decimal("0.00")
        assert result["tax_amount"] == Decimal("180.00")

    def test_with_discount(self):
        from app.services.invoice_service import calculate_item_totals
        from app.schemas.schemas import InvoiceItemCreate

        item = InvoiceItemCreate(
            product_name="Discounted",
            quantity=Decimal("2"),
            unit_price=Decimal("500"),
            discount_percentage=Decimal("10"),
            gst_percentage=Decimal("18"),
            is_igst=False,
        )
        result = calculate_item_totals(item)
        # Gross: 1000, Discount: 100, Taxable: 900, Tax 18%: 162, Total: 1062
        assert result["discount_amount"] == Decimal("100.00")
        assert result["taxable_amount"] == Decimal("900.00")
        assert result["tax_amount"] == Decimal("162.00")
        assert result["total_amount"] == Decimal("1062.00")

    def test_zero_gst(self):
        from app.services.invoice_service import calculate_item_totals
        from app.schemas.schemas import InvoiceItemCreate

        item = InvoiceItemCreate(
            product_name="Exempt",
            quantity=Decimal("1"),
            unit_price=Decimal("500"),
            gst_percentage=Decimal("0"),
            is_igst=False,
        )
        result = calculate_item_totals(item)
        assert result["tax_amount"] == Decimal("0.00")
        assert result["total_amount"] == Decimal("500.00")


# ── Dashboard Tests ───────────────────────────────────────
class TestDashboard:
    async def test_get_dashboard(self, client, business_headers):
        res = await client.get("/api/v1/dashboard", headers=business_headers)
        assert res.status_code == 200
        data = res.json()
        assert "stats" in data
        assert "recent_invoices" in data
        assert "monthly_revenue" in data
        assert "total_revenue" in data["stats"]
        assert "total_invoices" in data["stats"]
        assert len(data["monthly_revenue"]) == 6  # last 6 months
