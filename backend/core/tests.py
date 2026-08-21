"""
core/tests.py

Tests for the Coal Invoice & Records Management System.

Sections:
    Phase 3 — Model-level tests (preserved from Phase 3)
    Phase 4 — API tests for BusinessProfile and Customer endpoints
"""

import datetime
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import BusinessProfile, Customer, Invoice, InvoiceItem, InvoiceStatus, TransactionType, LedgerEntry, LedgerPayment
from .validators import validate_gstin, validate_ifsc, validate_phone


# ═════════════════════════════════════════════════════════════
# PHASE 3 — Model tests (unchanged)
# ═════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────
# Helper factories
# ─────────────────────────────────────────────────────────────

def make_business(**kwargs):
    defaults = {"business_name": "Test Coal Supplier", "state": "Karnataka", "state_code": "29"}
    defaults.update(kwargs)
    return BusinessProfile.objects.create(**defaults)


def make_customer(**kwargs):
    defaults = {"name": "Test Customer", "state": "Karnataka", "state_code": "29"}
    defaults.update(kwargs)
    return Customer.objects.create(**defaults)


def make_invoice(business, customer, invoice_number="001", **kwargs):
    defaults = {
        "invoice_number": invoice_number,
        "invoice_date": datetime.date(2026, 1, 1),
        "transaction_type": TransactionType.CASH,
        "status": InvoiceStatus.DRAFT,
        "taxable_amount": Decimal("10000.00"),
        "total_amount": Decimal("10000.00"),
    }
    defaults.update(kwargs)
    return Invoice.objects.create(business=business, customer=customer, **defaults)


def make_item(invoice, serial_number=1, **kwargs):
    defaults = {
        "product_name": "Coal",
        "quantity": Decimal("10.000"),
        "rate": Decimal("1000.00"),
        "amount": Decimal("10000.00"),
    }
    defaults.update(kwargs)
    return InvoiceItem.objects.create(invoice=invoice, serial_number=serial_number, **defaults)


class BusinessProfileModelTest(TestCase):

    def test_create_business_profile(self):
        bp = make_business(business_name="Sunrise Coal Traders")
        self.assertEqual(bp.pk is not None, True)
        self.assertEqual(bp.business_name, "Sunrise Coal Traders")

    def test_str_returns_business_name(self):
        bp = make_business(business_name="Alpha Fuels")
        self.assertEqual(str(bp), "Alpha Fuels")

    def test_optional_fields_default_to_blank(self):
        bp = make_business()
        self.assertEqual(bp.gstin, "")
        self.assertEqual(bp.phone, "")
        self.assertEqual(bp.bank_ifsc, "")


class CustomerModelTest(TestCase):

    def test_create_customer(self):
        customer = make_customer(name="Sharma Enterprises")
        self.assertIsNotNone(customer.pk)
        self.assertEqual(customer.name, "Sharma Enterprises")

    def test_str_returns_name(self):
        customer = make_customer(name="Patel & Sons")
        self.assertEqual(str(customer), "Patel & Sons")

    def test_two_customers_can_share_same_name(self):
        make_customer(name="General Trader")
        make_customer(name="General Trader")
        self.assertEqual(Customer.objects.filter(name="General Trader").count(), 2)

    def test_customer_gstin_optional(self):
        customer = make_customer()
        self.assertEqual(customer.gstin, "")

    def test_customer_with_gstin(self):
        customer = make_customer(gstin="29ABCDE1234F1Z5")
        self.assertEqual(customer.gstin, "29ABCDE1234F1Z5")

    def test_customer_is_active_default_true(self):
        customer = make_customer()
        self.assertTrue(customer.is_active)

    def test_customer_can_be_deactivated(self):
        customer = make_customer()
        customer.is_active = False
        customer.save()
        customer.refresh_from_db()
        self.assertFalse(customer.is_active)


class InvoiceModelTest(TestCase):

    def setUp(self):
        self.business = make_business()
        self.customer = make_customer()

    def test_create_invoice(self):
        invoice = make_invoice(self.business, self.customer, invoice_number="INV-001")
        self.assertIsNotNone(invoice.pk)
        self.assertEqual(invoice.invoice_number, "INV-001")

    def test_invoice_references_business(self):
        invoice = make_invoice(self.business, self.customer)
        self.assertEqual(invoice.business, self.business)

    def test_invoice_references_customer(self):
        invoice = make_invoice(self.business, self.customer)
        self.assertEqual(invoice.customer, self.customer)

    def test_invoice_str(self):
        invoice = make_invoice(self.business, self.customer, invoice_number="99")
        self.assertIn("99", str(invoice))

    def test_default_status_is_draft(self):
        invoice = make_invoice(self.business, self.customer)
        self.assertEqual(invoice.status, InvoiceStatus.DRAFT)

    def test_default_reverse_charge_is_false(self):
        invoice = make_invoice(self.business, self.customer)
        self.assertFalse(invoice.reverse_charge)

    def test_transaction_type_choices(self):
        invoice = make_invoice(self.business, self.customer, transaction_type=TransactionType.CREDIT)
        self.assertEqual(invoice.transaction_type, "CREDIT")

    def test_decimal_fields_store_correctly(self):
        invoice = make_invoice(
            self.business, self.customer,
            taxable_amount=Decimal("50000.00"),
            cgst_rate=Decimal("9.00"),
            cgst_amount=Decimal("4500.00"),
            total_amount=Decimal("54500.00"),
        )
        invoice.refresh_from_db()
        self.assertEqual(invoice.taxable_amount, Decimal("50000.00"))
        self.assertEqual(invoice.cgst_rate, Decimal("9.00"))
        self.assertEqual(invoice.cgst_amount, Decimal("4500.00"))
        self.assertEqual(invoice.total_amount, Decimal("54500.00"))

    def test_invoice_number_unique_within_business(self):
        make_invoice(self.business, self.customer, invoice_number="DUP-01")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                make_invoice(self.business, self.customer, invoice_number="DUP-01")

    def test_same_invoice_number_allowed_across_different_businesses(self):
        business2 = make_business(business_name="Second Business")
        make_invoice(self.business, self.customer, invoice_number="SAME-01")
        invoice2 = make_invoice(business2, self.customer, invoice_number="SAME-01")
        self.assertIsNotNone(invoice2.pk)

    def test_negative_taxable_amount_rejected_by_validator(self):
        invoice = Invoice(
            invoice_number="NEG-01",
            invoice_date=datetime.date(2026, 1, 1),
            business=self.business,
            customer=self.customer,
            taxable_amount=Decimal("-1.00"),
            total_amount=Decimal("0.00"),
        )
        with self.assertRaises(ValidationError):
            invoice.full_clean()

    def test_negative_total_amount_rejected_by_validator(self):
        invoice = Invoice(
            invoice_number="NEG-02",
            invoice_date=datetime.date(2026, 1, 1),
            business=self.business,
            customer=self.customer,
            taxable_amount=Decimal("0.00"),
            total_amount=Decimal("-500.00"),
        )
        with self.assertRaises(ValidationError):
            invoice.full_clean()


class InvoiceItemModelTest(TestCase):

    def setUp(self):
        self.business = make_business()
        self.customer = make_customer()
        self.invoice = make_invoice(self.business, self.customer)

    def test_create_invoice_item(self):
        item = make_item(self.invoice, serial_number=1)
        self.assertIsNotNone(item.pk)
        self.assertEqual(item.product_name, "Coal")

    def test_item_references_invoice(self):
        item = make_item(self.invoice)
        self.assertEqual(item.invoice, self.invoice)

    def test_related_name_items(self):
        make_item(self.invoice, serial_number=1)
        make_item(self.invoice, serial_number=2)
        self.assertEqual(self.invoice.items.count(), 2)

    def test_item_str(self):
        item = make_item(self.invoice, serial_number=1)
        self.assertIn("Coal", str(item))

    def test_decimal_quantity_precision(self):
        item = make_item(self.invoice, quantity=Decimal("12.500"))
        item.refresh_from_db()
        self.assertEqual(item.quantity, Decimal("12.500"))

    def test_decimal_rate_precision(self):
        item = make_item(self.invoice, rate=Decimal("1234.56"))
        item.refresh_from_db()
        self.assertEqual(item.rate, Decimal("1234.56"))

    def test_duplicate_serial_number_per_invoice_rejected(self):
        make_item(self.invoice, serial_number=1)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                make_item(self.invoice, serial_number=1)

    def test_negative_quantity_rejected_by_validator(self):
        item = InvoiceItem(
            invoice=self.invoice,
            serial_number=99,
            product_name="Coal",
            quantity=Decimal("-1.000"),
            rate=Decimal("1000.00"),
            amount=Decimal("0.00"),
        )
        with self.assertRaises(ValidationError):
            item.full_clean()

    def test_negative_rate_rejected_by_validator(self):
        item = InvoiceItem(
            invoice=self.invoice,
            serial_number=99,
            product_name="Coal",
            quantity=Decimal("1.000"),
            rate=Decimal("-100.00"),
            amount=Decimal("0.00"),
        )
        with self.assertRaises(ValidationError):
            item.full_clean()

    def test_hsn_stored_as_string(self):
        item = make_item(self.invoice, hsn_code="0401")
        item.refresh_from_db()
        self.assertEqual(item.hsn_code, "0401")

    def test_cascade_delete_items_when_invoice_deleted(self):
        make_item(self.invoice, serial_number=1)
        make_item(self.invoice, serial_number=2)
        invoice_pk = self.invoice.pk
        self.invoice.delete()
        self.assertEqual(InvoiceItem.objects.filter(invoice_id=invoice_pk).count(), 0)


# ═════════════════════════════════════════════════════════════
# PHASE 4 — Validator tests
# ═════════════════════════════════════════════════════════════

class ValidatorTest(TestCase):

    # GSTIN
    def test_valid_gstin_passes(self):
        validate_gstin("29ABCDE1234F1Z5")  # must not raise

    def test_invalid_gstin_raises(self):
        with self.assertRaises(ValidationError):
            validate_gstin("INVALID")

    def test_blank_gstin_passes(self):
        validate_gstin("")  # blank is allowed

    # IFSC
    def test_valid_ifsc_passes(self):
        validate_ifsc("SBIN0001234")

    def test_invalid_ifsc_raises(self):
        with self.assertRaises(ValidationError):
            validate_ifsc("INVALID")

    def test_blank_ifsc_passes(self):
        validate_ifsc("")

    # Phone
    def test_valid_phone_passes(self):
        validate_phone("9876543210")

    def test_valid_phone_with_country_code_passes(self):
        validate_phone("+919876543210")

    def test_invalid_phone_raises(self):
        with self.assertRaises(ValidationError):
            validate_phone("12345")

    def test_blank_phone_passes(self):
        validate_phone("")


# ═════════════════════════════════════════════════════════════
# PHASE 4 — API tests
# ═════════════════════════════════════════════════════════════

class AuthenticatedAPITestCase(APITestCase):
    """Base class that creates and authenticates a test user."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import django.test.client
        cls._original_store = django.test.client.store_rendered_templates
        django.test.client.store_rendered_templates = lambda *args, **kwargs: None

    @classmethod
    def tearDownClass(cls):
        import django.test.client
        django.test.client.store_rendered_templates = cls._original_store
        super().tearDownClass()

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="testpassword123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def unauthenticated_client(self):
        return APIClient()


# ─────────────────────────────────────────────────────────────
# BusinessProfile API Tests
# ─────────────────────────────────────────────────────────────

class BusinessProfileAPITest(AuthenticatedAPITestCase):

    RETRIEVE_URL = "/api/business-profile/"
    CREATE_URL = "/api/business-profile/create/"
    UPDATE_URL = "/api/business-profile/update/"

    def _valid_payload(self, **overrides):
        data = {
            "business_name": "Test Coal Co.",
            "gstin": "29ABCDE1234F1Z5",
            "phone": "9876543210",
            "email": "test@coalco.com",
            "address": "123 Coal Street",
            "state": "Karnataka",
            "state_code": "29",
            "bank_name": "SBI",
            "bank_branch": "MG Road",
            "bank_account_number": "12345678901",
            "bank_ifsc": "SBIN0001234",
            "terms_and_conditions": "Payment within 30 days.",
        }
        data.update(overrides)
        return data

    def test_retrieve_profile_when_none_returns_404(self):
        response = self.client.get(self.RETRIEVE_URL)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_profile(self):
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["business_name"], "Test Coal Co.")
        self.assertEqual(BusinessProfile.objects.count(), 1)

    def test_retrieve_profile_after_create(self):
        BusinessProfile.objects.create(business_name="Coal Co.", owner=self.user)
        response = self.client.get(self.RETRIEVE_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["business_name"], "Coal Co.")

    def test_create_second_profile_is_rejected(self):
        BusinessProfile.objects.create(business_name="First", owner=self.user)
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_profile(self):
        BusinessProfile.objects.create(business_name="Old Name", owner=self.user)
        response = self.client.patch(self.UPDATE_URL, {"business_name": "New Name"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["business_name"], "New Name")

    def test_update_nonexistent_profile_returns_404(self):
        response = self.client.patch(self.UPDATE_URL, {"business_name": "X"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_gstin_returns_400(self):
        response = self.client.post(
            self.CREATE_URL,
            self._valid_payload(gstin="BADGSTIN"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("gstin", response.data)

    def test_invalid_ifsc_returns_400(self):
        response = self.client.post(
            self.CREATE_URL,
            self._valid_payload(bank_ifsc="BADINPUT"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("bank_ifsc", response.data)

    def test_invalid_email_returns_400(self):
        response = self.client.post(
            self.CREATE_URL,
            self._valid_payload(email="not-an-email"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_business_name_returns_400(self):
        payload = self._valid_payload()
        del payload["business_name"]
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_access_returns_403_or_401(self):
        anon = self.unauthenticated_client()
        response = anon.get(self.RETRIEVE_URL)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_gstin_is_uppercased_on_save(self):
        response = self.client.post(
            self.CREATE_URL,
            self._valid_payload(gstin="29abcde1234f1z5"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["gstin"], "29ABCDE1234F1Z5")


# ─────────────────────────────────────────────────────────────
# Customer API Tests
# ─────────────────────────────────────────────────────────────

class CustomerAPITest(AuthenticatedAPITestCase):

    LIST_URL = "/api/customers/"
    CREATE_URL = "/api/customers/create/"

    def detail_url(self, pk):
        return f"/api/customers/{pk}/"

    def update_url(self, pk):
        return f"/api/customers/{pk}/update/"

    def deactivate_url(self, pk):
        return f"/api/customers/{pk}/deactivate/"

    def reactivate_url(self, pk):
        return f"/api/customers/{pk}/reactivate/"

    def setUp(self):
        super().setUp()
        self.business = BusinessProfile.objects.create(business_name="Test Coal Co.", state="Karnataka", state_code="29", owner=self.user)

    def _valid_payload(self, **overrides):
        data = {
            "name": "ABC Traders",
            "address": "456 Market Road, Bangalore",
            "gst_registered": True,
            "gstin": "29ABCDE1234F1Z5",
            "state": "Karnataka",
            "state_code": "29",
            "phone": "9876543210",
            "email": "abc@traders.com",
        }
        data.update(overrides)
        return data

    def _create_customer(self, **kwargs):
        return Customer.objects.create(**{"business": self.business, "name": "Test Customer", **kwargs})

    # ── List ─────────────────────────────────────────────────

    def test_list_customers_empty(self):
        response = self.client.get(self.LIST_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_shows_only_active_by_default(self):
        self._create_customer(name="Active One", is_active=True)
        self._create_customer(name="Inactive One", is_active=False)
        response = self.client.get(self.LIST_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [c["name"] for c in response.data["results"]]
        self.assertIn("Active One", names)
        self.assertNotIn("Inactive One", names)

    def test_list_with_is_active_false_shows_inactive(self):
        self._create_customer(name="Inactive One", is_active=False)
        response = self.client.get(self.LIST_URL + "?is_active=false")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [c["name"] for c in response.data["results"]]
        self.assertIn("Inactive One", names)

    # ── Create ────────────────────────────────────────────────

    def test_create_customer(self):
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "ABC Traders")
        self.assertEqual(Customer.objects.count(), 1)

    def test_create_customer_unregistered_clears_gstin(self):
        payload = self._valid_payload(gst_registered=False, gstin="29ABCDE1234F1Z5")
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["gstin"], "")
        self.assertFalse(response.data["gst_registered"])

    def test_create_customer_registered_requires_gstin(self):
        payload = self._valid_payload(gst_registered=True, gstin="")
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("gstin", response.data)

    def test_create_customer_registered_requires_matching_state_code(self):
        payload = self._valid_payload(gst_registered=True, gstin="29ABCDE1234F1Z5", state="Maharashtra", state_code="27")
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_create_two_customers_with_same_name_allowed(self):
        self.client.post(self.CREATE_URL, self._valid_payload(gst_registered=False, gstin=""), format="json")
        response = self.client.post(self.CREATE_URL, self._valid_payload(gst_registered=False, gstin=""), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Customer.objects.count(), 2)

    def test_create_customer_invalid_gstin(self):
        response = self.client.post(
            self.CREATE_URL,
            self._valid_payload(gstin="BADGSTIN"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("gstin", response.data)

    def test_create_customer_missing_name(self):
        payload = self._valid_payload()
        del payload["name"]
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Retrieve ──────────────────────────────────────────────

    def test_retrieve_customer(self):
        customer = self._create_customer()
        response = self.client.get(self.detail_url(customer.pk))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], customer.name)

    def test_retrieve_nonexistent_customer_returns_404(self):
        response = self.client.get(self.detail_url(99999))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── Update ────────────────────────────────────────────────

    def test_update_customer(self):
        customer = self._create_customer()
        response = self.client.patch(
            self.update_url(customer.pk),
            {"name": "Updated Name"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Updated Name")

    def test_update_customer_with_invalid_phone(self):
        customer = self._create_customer()
        response = self.client.patch(
            self.update_url(customer.pk),
            {"phone": "123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Deactivate / Reactivate ───────────────────────────────

    def test_deactivate_customer(self):
        customer = self._create_customer(is_active=True)
        response = self.client.post(self.deactivate_url(customer.pk))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertFalse(customer.is_active)

    def test_deactivate_already_inactive_returns_400(self):
        customer = self._create_customer(is_active=False)
        response = self.client.post(self.deactivate_url(customer.pk))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reactivate_customer(self):
        customer = self._create_customer(is_active=False)
        response = self.client.post(self.reactivate_url(customer.pk))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertTrue(customer.is_active)

    def test_reactivate_already_active_returns_400(self):
        customer = self._create_customer(is_active=True)
        response = self.client.post(self.reactivate_url(customer.pk))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Search ────────────────────────────────────────────────

    def test_search_by_name(self):
        self._create_customer(name="ABC Traders")
        self._create_customer(name="XYZ Industries")
        response = self.client.get(self.LIST_URL + "?search=ABC")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [c["name"] for c in response.data["results"]]
        self.assertIn("ABC Traders", names)
        self.assertNotIn("XYZ Industries", names)

    def test_search_by_gstin(self):
        self._create_customer(name="Alpha", gstin="29ABCDE1234F1Z5")
        self._create_customer(name="Beta", gstin="27XYZAB5678G2Z3")
        response = self.client.get(self.LIST_URL + "?search=29ABCDE")
        names = [c["name"] for c in response.data["results"]]
        self.assertIn("Alpha", names)
        self.assertNotIn("Beta", names)

    # ── Auth ──────────────────────────────────────────────────

    def test_unauthenticated_list_returns_401_or_403(self):
        anon = self.unauthenticated_client()
        response = anon.get(self.LIST_URL)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_unauthenticated_create_returns_401_or_403(self):
        anon = self.unauthenticated_client()
        response = anon.post(self.CREATE_URL, self._valid_payload(), format="json")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


# ═════════════════════════════════════════════════════════════
# PHASE 5 — Calculation service unit tests
# ═════════════════════════════════════════════════════════════

class CalculationServiceTest(TestCase):
    """Pure unit tests for core/services/calculation.py."""

    from core.services.calculation import (  # noqa: E402 – imported inside class for clarity
        calculate_item_amount,
        calculate_invoice_totals,
        amount_to_words,
    )

    def _calc_item(self, qty, rate):
        from core.services.calculation import calculate_item_amount
        return calculate_item_amount(qty, rate)

    def _calc_totals(self, items, cgst=0, sgst=0, igst=0, tcs=0):
        from core.services.calculation import calculate_invoice_totals
        return calculate_invoice_totals(items, cgst, sgst, igst, tcs)

    def test_item_amount_basic(self):
        result = self._calc_item("10.000", "4000.00")
        self.assertEqual(result, Decimal("40000.00"))

    def test_item_amount_decimal_precision(self):
        result = self._calc_item("10.500", "1234.56")
        self.assertEqual(result, Decimal("12962.88"))

    def test_item_amount_zero_quantity_raises(self):
        from core.services.calculation import calculate_item_amount
        # zero qty is allowed (min_value=0.001 enforced in serializer not service)
        result = calculate_item_amount("0", "100")
        self.assertEqual(result, Decimal("0.00"))

    def test_item_amount_negative_quantity_raises(self):
        from core.services.calculation import calculate_item_amount
        with self.assertRaises(ValueError):
            calculate_item_amount("-1", "100")

    def test_item_amount_negative_rate_raises(self):
        from core.services.calculation import calculate_item_amount
        with self.assertRaises(ValueError):
            calculate_item_amount("1", "-100")

    def test_taxable_amount_is_sum_of_items(self):
        items = [
            {"quantity": "10.000", "rate": "4000.00"},
            {"quantity": "5.000",  "rate": "2000.00"},
        ]
        totals = self._calc_totals(items)
        self.assertEqual(totals.taxable_amount, Decimal("50000.00"))

    def test_cgst_amount_calculated_correctly(self):
        items = [{"quantity": "10", "rate": "4000"}]
        totals = self._calc_totals(items, cgst="9.00")
        self.assertEqual(totals.cgst_amount, Decimal("3600.00"))

    def test_igst_zero_when_rate_zero(self):
        items = [{"quantity": "10", "rate": "4000"}]
        totals = self._calc_totals(items, igst="0.00")
        self.assertEqual(totals.igst_amount, Decimal("0.00"))

    def test_total_amount_sums_all_components(self):
        items = [{"quantity": "10", "rate": "4000"}]
        totals = self._calc_totals(items, cgst="9.00", sgst="9.00")
        # taxable=40000, cgst=3600, sgst=3600, igst=0, tcs=0
        self.assertEqual(totals.total_amount, Decimal("47200.00"))

    def test_amount_to_words_returns_string(self):
        from core.services.calculation import amount_to_words
        result = amount_to_words(Decimal("40000.00"))
        self.assertEqual(result, "Forty Thousand Rupees Only")

    def test_amount_to_words_paise(self):
        from core.services.calculation import amount_to_words
        result = amount_to_words(Decimal("100000.50"))
        self.assertEqual(result, "One Lakh Rupees and Fifty Paise Only")


# ═════════════════════════════════════════════════════════════
# PHASE 5 — Invoice API tests
# ═════════════════════════════════════════════════════════════

class InvoiceAPITest(AuthenticatedAPITestCase):
    """
    API tests for POST /api/invoices/create/ and GET /api/invoices/<id>/.
    """

    CREATE_URL = "/api/invoices/create/"

    def detail_url(self, pk):
        return f"/api/invoices/{pk}/"

    def setUp(self):
        super().setUp()
        # Every test needs a business profile and a customer
        self.business = BusinessProfile.objects.create(business_name="Test Coal Co.", state="Karnataka", state_code="29", owner=self.user)
        self.customer = Customer.objects.create(business=self.business, name="Test Buyer", is_active=True, state="Karnataka", state_code="29")
        
        # Patch PDF generation to avoid xhtml2pdf crashing Django test context
        from unittest.mock import patch
        patcher = patch("core.views.InvoiceViewSet._generate_pdf_bytes")
        self.mock_pdf = patcher.start()
        self.mock_pdf.return_value = b"%PDF-mock"
        self.addCleanup(patcher.stop)

        # Disconnect template_rendered to prevent xhtml2pdf context copy crash
        from django.test.signals import template_rendered
        from django.test.client import store_rendered_templates
        template_rendered.disconnect(store_rendered_templates)
        self.addCleanup(lambda: template_rendered.connect(store_rendered_templates))

    def _valid_payload(self, **overrides):
        data = {
            "invoice_number":   "INV-001",
            "invoice_date":     "2026-08-18",
            "transaction_type": "CASH",
            "customer":         self.customer.pk,
            "transport_name":   "Fast Transport",
            "vehicle_number":   "AP39TEST",
            "gst_rate":         "18.00",
            "tcs_rate":         "0.00",
            "reverse_charge":   False,
            "items": [
                {
                    "product_name": "Coal",
                    "hsn_code":     "2701",
                    "quantity":     "10.000",
                    "unit":         "MT",
                    "rate":         "4000.00",
                }
            ],
        }
        data.update(overrides)
        return data

    # 1. Create invoice with one item
    def test_create_invoice_single_item(self):
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("invoice", response.data)
        self.assertEqual(response.data["invoice"]["invoice_number"], "INV-001")

    # 2. Create invoice with multiple items
    def test_create_invoice_multiple_items(self):
        payload = self._valid_payload(
            items=[
                {"product_name": "Coal A", "hsn_code": "2701", "quantity": "10.000", "unit": "MT", "rate": "4000.00"},
                {"product_name": "Coal B", "hsn_code": "2701", "quantity": "5.000",  "unit": "MT", "rate": "4500.00"},
            ]
        )
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["invoice"]["items"]), 2)

    # 3. Correct item amount calculation
    def test_item_amount_is_calculated_server_side(self):
        payload = self._valid_payload()
        # Even if client sends a wrong amount it must be ignored
        payload["items"][0]["amount"] = "999999.00"
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = response.data["invoice"]["items"][0]
        self.assertEqual(Decimal(item["amount"]), Decimal("40000.00"))  # 10 × 4000

    # 4. Correct taxable amount
    def test_taxable_amount_equals_sum_of_items(self):
        payload = self._valid_payload(
            items=[
                {"product_name": "Coal", "hsn_code": "2701", "quantity": "10.000", "unit": "MT", "rate": "4000.00"},
                {"product_name": "Coal", "hsn_code": "2701", "quantity": "5.000",  "unit": "MT", "rate": "2000.00"},
            ]
        )
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(response.data["invoice"]["taxable_amount"]), Decimal("50000.00"))

    # 5. Correct tax calculations
    def test_cgst_sgst_amounts_calculated_from_rates(self):
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        inv = response.data["invoice"]
        # taxable = 10 × 4000 = 40000; cgst = 9% = 3600; sgst = 9% = 3600
        self.assertEqual(Decimal(inv["taxable_amount"]), Decimal("40000.00"))
        self.assertEqual(Decimal(inv["cgst_amount"]),    Decimal("3600.00"))
        self.assertEqual(Decimal(inv["sgst_amount"]),    Decimal("3600.00"))
        self.assertEqual(Decimal(inv["total_amount"]),   Decimal("47200.00"))

    # 6. Invoice number duplication rejected
    def test_duplicate_invoice_number_rejected(self):
        self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invoice_number", response.data)

    # 7. Missing customer rejected
    def test_missing_customer_rejected(self):
        payload = self._valid_payload()
        del payload["customer"]
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 8. Missing items rejected
    def test_empty_items_list_rejected(self):
        payload = self._valid_payload(items=[])
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 9. Negative quantity rejected
    def test_negative_quantity_rejected(self):
        payload = self._valid_payload()
        payload["items"][0]["quantity"] = "-5.000"
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 10. Negative rate rejected
    def test_negative_rate_rejected(self):
        payload = self._valid_payload()
        payload["items"][0]["rate"] = "-100.00"
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 11. Retrieve saved invoice
    def test_retrieve_saved_invoice(self):
        create_resp = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        invoice_id = create_resp.data["invoice"]["id"]
        get_resp = self.client.get(self.detail_url(invoice_id))
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(get_resp.data["invoice_number"], "INV-001")
        self.assertEqual(len(get_resp.data["items"]), 1)

    # 12. Invoice and items persisted in DB
    def test_invoice_and_items_stored_in_db(self):
        self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        self.assertEqual(Invoice.objects.count(), 1)
        self.assertEqual(InvoiceItem.objects.count(), 1)
        item = InvoiceItem.objects.first()
        self.assertEqual(item.amount, Decimal("40000.00"))

    # 13. Unauthenticated access rejected
    def test_unauthenticated_create_rejected(self):
        anon = self.unauthenticated_client()
        response = anon.post(self.CREATE_URL, self._valid_payload(), format="json")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    # 14. Inactive customer cannot be used
    def test_inactive_customer_rejected(self):
        inactive = Customer.objects.create(name="Old Buyer", is_active=False)
        payload = self._valid_payload(customer=inactive.pk)
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 15. Tax Consistency is now auto-resolved by states, so we test missing states
    def test_missing_business_state_rejected(self):
        self.business.state = ""
        self.business.save()
        payload = self._valid_payload()
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    # 16. Tax Rate Boundary Error
    def test_max_tax_rate_rejected(self):
        payload = self._valid_payload(gst_rate="150.00")
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("gst_rate", response.data)

    # 17. Security: Client total spoofing
    def test_client_totals_ignored_and_recalculated(self):
        payload = self._valid_payload()
        payload["items"][0]["amount"] = "1.00"
        payload["taxable_amount"] = "1.00"
        payload["total_amount"] = "1.00"
        response = self.client.post(self.CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Server must ignore the "1.00" and compute 40000.00
        inv = response.data["invoice"]
        self.assertEqual(Decimal(inv["taxable_amount"]), Decimal("40000.00"))
        self.assertEqual(Decimal(inv["total_amount"]), Decimal("47200.00"))

    # 18. Retrieve invoice with full nested business and customer
    def test_retrieve_invoice(self):
        # Create it first
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        inv_id = response.data["invoice"]["id"]

        # Retrieve it
        detail_resp = self.client.get(self.detail_url(inv_id))
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        
        # Verify nested business
        self.assertIn("business", detail_resp.data)
        self.assertEqual(detail_resp.data["business"]["business_name"], "Test Coal Co.")
        
        # Verify nested customer
        self.assertIn("customer", detail_resp.data)
        self.assertEqual(detail_resp.data["customer"]["name"], "Test Buyer")
        
        # Verify items exist
        self.assertEqual(len(detail_resp.data["items"]), 1)

    # 19. Retrieve non-existent invoice returns 404
    def test_retrieve_non_existent_invoice(self):
        detail_resp = self.client.get(self.detail_url(99999))
        self.assertEqual(detail_resp.status_code, status.HTTP_404_NOT_FOUND)

    # 20. Unauthenticated access rejected for retrieve
    def test_unauthenticated_retrieve_rejected(self):
        # Create it first
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        inv_id = response.data["invoice"]["id"]

        anon = self.unauthenticated_client()
        detail_resp = anon.get(self.detail_url(inv_id))
        self.assertIn(detail_resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    # 21. PDF generation succeeds
    def test_generate_pdf(self):
        # Create it first
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        inv_id = response.data["invoice"]["id"]
        inv_number = response.data["invoice"]["invoice_number"]

        pdf_url = f"{self.detail_url(inv_id)}pdf/"
        pdf_resp = self.client.get(pdf_url)

        self.assertEqual(pdf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf_resp["Content-Type"], "application/pdf")
        self.assertIn(f'filename="Invoice-{inv_number}.pdf"', pdf_resp["Content-Disposition"])
        self.assertTrue(len(pdf_resp.content) > 0)
        self.assertTrue(pdf_resp.content.startswith(b"%PDF-"))

    # 22. PDF unauthorized access
    def test_unauthorized_pdf_access(self):
        # Create it first
        response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
        inv_id = response.data["invoice"]["id"]

        anon = self.unauthenticated_client()
        pdf_url = f"{self.detail_url(inv_id)}pdf/"
        pdf_resp = anon.get(pdf_url)
        self.assertIn(pdf_resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    # 23. List invoices
    def test_list_invoices_success(self):
        self.client.post(self.CREATE_URL, self._valid_payload(invoice_number="LST-01"), format="json")
        self.client.post(self.CREATE_URL, self._valid_payload(invoice_number="LST-02"), format="json")
        
        resp = self.client.get("/api/invoices/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("results", resp.data)
        self.assertEqual(len(resp.data["results"]), 2)
        # Check no items in list
        self.assertNotIn("items", resp.data["results"][0])

    # 24. List invoices pagination
    def test_list_invoices_pagination(self):
        for i in range(25):
            self.client.post(self.CREATE_URL, self._valid_payload(invoice_number=f"PG-{i}"), format="json")
        
        resp = self.client.get("/api/invoices/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 25)
        self.assertEqual(len(resp.data["results"]), 20)

    # 25. Filter by customer
    def test_filter_by_customer(self):
        customer2 = Customer.objects.create(business=self.business, name="Customer 2", is_active=True, state="Karnataka", state_code="29")
        resp1 = self.client.post(self.CREATE_URL, self._valid_payload(invoice_number="F-1"), format="json")
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED, resp1.data)
        resp2 = self.client.post(self.CREATE_URL, self._valid_payload(invoice_number="F-2", customer=customer2.pk), format="json")
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED, resp2.data)

        resp = self.client.get(f"/api/invoices/?customer={customer2.pk}")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["invoice_number"], "F-2")

    # 26. Filter by transaction type
    def test_filter_by_transaction_type(self):
        self.client.post(self.CREATE_URL, self._valid_payload(invoice_number="F-CASH", transaction_type="CASH"), format="json")
        self.client.post(self.CREATE_URL, self._valid_payload(invoice_number="F-CRED", transaction_type="CREDIT"), format="json")

        resp = self.client.get("/api/invoices/?transaction_type=CREDIT")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["invoice_number"], "F-CRED")

    # 27. Search invoices
    def test_search_invoices(self):
        self.client.post(self.CREATE_URL, self._valid_payload(invoice_number="SRC-001", vehicle_number="AP-1234"), format="json")
        self.client.post(self.CREATE_URL, self._valid_payload(invoice_number="SRC-002", vehicle_number="TS-9876"), format="json")

        resp = self.client.get("/api/invoices/?search=1234")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["invoice_number"], "SRC-001")


class DashboardAPITest(AuthenticatedAPITestCase):

    DASHBOARD_URL = "/api/dashboard/"

    def test_dashboard_aggregation(self):
        # Create some data
        business = BusinessProfile.objects.create(business_name="ABC", owner=self.user, address="123", gstin="29ABC")
        customer = Customer.objects.create(business=business, name="Customer 1", state="Karnataka", state_code="29")

        Invoice.objects.create(
            business=business,
            customer=customer,
            invoice_number="INV-1",
            invoice_date="2026-08-01",
            transaction_type="CASH",
            total_amount=Decimal("1180.00"),
            cgst_amount=Decimal("90.00"),
            sgst_amount=Decimal("90.00"),
            igst_amount=Decimal("0.00"),
            taxable_amount=Decimal("1000.00"),
            amount_in_words="One Thousand One Hundred Eighty"
        )

        Invoice.objects.create(
            business=business,
            customer=customer,
            invoice_number="INV-2",
            invoice_date="2026-08-02",
            transaction_type="CREDIT",
            total_amount=Decimal("590.00"),
            cgst_amount=Decimal("0.00"),
            sgst_amount=Decimal("0.00"),
            igst_amount=Decimal("90.00"),
            taxable_amount=Decimal("500.00"),
            amount_in_words="Five Hundred Ninety"
        )

        resp = self.client.get(self.DASHBOARD_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        
        data = resp.data
        self.assertEqual(data["total_invoices"], 2)
        self.assertEqual(data["total_sales"], Decimal("1770.00"))
        self.assertEqual(data["gst_recorded"], Decimal("270.00"))
        self.assertEqual(data["total_customers"], 1)
        self.assertEqual(len(data["recent_invoices"]), 2)
        self.assertTrue(data["business_profile_complete"])


# ─────────────────────────────────────────────────────────────
# GST Verification Service Tests (Phase 1)
# ─────────────────────────────────────────────────────────────

from unittest.mock import patch, Mock
from core.services.gst_service import verify_gstin
import requests

class GSTServiceTests(TestCase):
    
    @patch("core.services.gst_service.requests.get")
    @patch("core.services.gst_service.getattr")
    def test_verify_gstin_success(self, mock_getattr, mock_get):
        # Setup mock api key
        mock_getattr.return_value = "TEST_API_KEY"
        
        # Setup mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "data": {
                "gstin": "36AAAAA1234A1Z5",
                "legal_name": "TEST LEGAL NAME",
                "trade_name": "TEST TRADE NAME",
                "status": "Active",
                "address": "123 Test St"
            }
        }
        mock_get.return_value = mock_response

        # Execute
        result = verify_gstin(" 36AAAAA1234A1Z5 ")
        
        # Assertions
        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["legal_name"], "TEST LEGAL NAME")
        self.assertEqual(result["data"]["address"], "123 Test St")
        self.assertEqual(result["data"]["gstin"], "36AAAAA1234A1Z5")
        
        # Verify request parameters
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        self.assertIn("36AAAAA1234A1Z5", args[0])
        self.assertEqual(kwargs["headers"]["X-API-Key"], "TEST_API_KEY")

    def test_verify_gstin_invalid_format(self):
        result = verify_gstin("SHORTGSTIN")
        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "Invalid GSTIN format")
        
    @patch("core.services.gst_service.requests.get")
    @patch("core.services.gst_service.getattr")
    def test_verify_gstin_auth_failure(self, mock_getattr, mock_get):
        mock_getattr.return_value = "BAD_KEY"
        mock_response = Mock()
        mock_response.status_code = 401
        mock_get.return_value = mock_response

        result = verify_gstin("36AAAAA1234A1Z5")
        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "GST verification service authentication failed.")

    @patch("core.services.gst_service.requests.get")
    @patch("core.services.gst_service.getattr")
    def test_verify_gstin_timeout(self, mock_getattr, mock_get):
        mock_getattr.return_value = "TEST_API_KEY"
        mock_get.side_effect = requests.exceptions.Timeout("Connection timed out")

        result = verify_gstin("36AAAAA1234A1Z5")
        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "GST verification service timed out. Please try again.")

# ─────────────────────────────────────────────────────────────
# GST Verification API Tests (Phase 3)
# ─────────────────────────────────────────────────────────────
class GSTVerificationAPITest(AuthenticatedAPITestCase):

    VERIFY_URL = "/api/gst/verify/"
    CREATE_CUSTOMER_URL = "/api/customers/create/"

    def setUp(self):
        super().setUp()
        self.business = BusinessProfile.objects.create(business_name="Test Coal Co.", state="Karnataka", state_code="29", owner=self.user)

    @patch("core.views.verify_gstin")
    def test_verify_gstin_api_call(self, mock_verify):
        mock_verify.return_value = {"success": True, "data": {"legal_name": "Test", "trade_name": "Test", "status": "Active", "address": "", "state": ""}}
        response = self.client.post(self.VERIFY_URL, {"gstin": "36AAAAA1234A1Z5"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["source"], "api")
        mock_verify.assert_called_once_with("36AAAAA1234A1Z5")

    @patch("core.views.verify_gstin")
    def test_verify_gstin_cache_hit(self, mock_verify):
        Customer.objects.create(
            business=self.business,
            name="Existing",
            gstin="36AAAAA1234A1Z5",
            gst_verified=True,
            gst_legal_name="Cached Name",
            is_active=True
        )
        response = self.client.post(self.VERIFY_URL, {"gstin": "36AAAAA1234A1Z5"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["source"], "cache")
        self.assertEqual(response.data["data"]["legal_name"], "Cached Name")
        mock_verify.assert_not_called()

    def test_gstin_change_invalidates_verification(self):
        customer = Customer.objects.create(
            business=self.business,
            name="Test",
            gst_registered=True,
            gstin="36AAAAA1234A1Z5",
            gst_verified=True,
            gst_status="Active"
        )
        url = f"/api/customers/{customer.id}/update/"
        # Change GSTIN
        response = self.client.patch(url, {"gstin": "36AAAAA1234A1Z6"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertFalse(customer.gst_verified)
        self.assertEqual(customer.gst_status, "")

    def test_duplicate_gstin_rejected(self):
        Customer.objects.create(
            business=self.business,
            name="Existing",
            gst_registered=True,
            gstin="36AAAAA1234A1Z5"
        )
        payload = {
            "name": "New Guy",
            "gst_registered": True,
            "gstin": "36AAAAA1234A1Z5",
            "state": "Telangana",
            "state_code": "36"
        }
        response = self.client.post(self.CREATE_CUSTOMER_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("gstin", response.data)

# ═════════════════════════════════════════════════════════════
# PHASE 1 — Ledger Foundation Tests
# ═════════════════════════════════════════════════════════════

class LedgerTests(TestCase):
    def setUp(self):
        # Create Business A
        self.user_a = User.objects.create_user(username="usera", password="password")
        self.business_a = BusinessProfile.objects.create(
            owner=self.user_a,
            business_name="Business A"
        )
        self.customer_a = Customer.objects.create(
            business=self.business_a,
            name="ABC Traders"
        )
        
        # Create Business B
        self.user_b = User.objects.create_user(username="userb", password="password")
        self.business_b = BusinessProfile.objects.create(
            owner=self.user_b,
            business_name="Business B"
        )

    def test_receivable_creation(self):
        """TEST 1 — RECEIVABLE: Status = PENDING, Paid = ₹0, Remaining = ₹1,00,000"""
        entry = LedgerEntry.objects.create(
            business=self.business_a,
            customer=self.customer_a,
            transaction_type="RECEIVABLE",
            amount=Decimal("100000.00")
        )
        self.assertEqual(entry.status, "PENDING")
        self.assertEqual(entry.get_paid_amount(), Decimal("0.00"))
        self.assertEqual(entry.get_remaining_amount(), Decimal("100000.00"))

    def test_partial_payment(self):
        """TEST 2 — PARTIAL PAYMENT: Record ₹30,000"""
        entry = LedgerEntry.objects.create(
            business=self.business_a,
            customer=self.customer_a,
            transaction_type="RECEIVABLE",
            amount=Decimal("100000.00")
        )
        
        LedgerPayment.objects.create(
            ledger_entry=entry,
            amount=Decimal("30000.00"),
            payment_date=datetime.date.today()
        )
        
        entry.refresh_from_db()
        self.assertEqual(entry.get_paid_amount(), Decimal("30000.00"))
        self.assertEqual(entry.get_remaining_amount(), Decimal("70000.00"))
        self.assertEqual(entry.status, "PARTIALLY_PAID")

    def test_final_payment(self):
        """TEST 3 — FINAL PAYMENT: Record ₹70,000 to fully pay"""
        entry = LedgerEntry.objects.create(
            business=self.business_a,
            customer=self.customer_a,
            transaction_type="RECEIVABLE",
            amount=Decimal("100000.00")
        )
        LedgerPayment.objects.create(
            ledger_entry=entry,
            amount=Decimal("30000.00"),
            payment_date=datetime.date.today()
        )
        
        LedgerPayment.objects.create(
            ledger_entry=entry,
            amount=Decimal("70000.00"),
            payment_date=datetime.date.today()
        )
        
        entry.refresh_from_db()
        self.assertEqual(entry.get_paid_amount(), Decimal("100000.00"))
        self.assertEqual(entry.get_remaining_amount(), Decimal("0.00"))
        self.assertEqual(entry.status, "PAID")

    def test_overpayment_rejected(self):
        """TEST 4 — OVERPAYMENT: Attempt to pay ₹15,000 when only ₹10,000 remains"""
        entry = LedgerEntry.objects.create(
            business=self.business_a,
            customer=self.customer_a,
            transaction_type="RECEIVABLE",
            amount=Decimal("50000.00")
        )
        LedgerPayment.objects.create(
            ledger_entry=entry,
            amount=Decimal("40000.00"),
            payment_date=datetime.date.today()
        )
        
        with self.assertRaisesMessage(ValidationError, "Payment amount exceeds the remaining ledger balance."):
            LedgerPayment.objects.create(
                ledger_entry=entry,
                amount=Decimal("15000.00"),
                payment_date=datetime.date.today()
            )
            
        entry.refresh_from_db()
        self.assertEqual(entry.get_paid_amount(), Decimal("40000.00"))
        self.assertEqual(entry.get_remaining_amount(), Decimal("10000.00"))

    def test_payable_creation(self):
        """TEST 5 — PAYABLE: Create for a Supplier"""
        entry = LedgerEntry.objects.create(
            business=self.business_a,
            party_name="ABC Coal Suppliers",
            transaction_type="PAYABLE",
            amount=Decimal("80000.00")
        )
        self.assertEqual(entry.status, "PENDING")
        self.assertEqual(entry.get_paid_amount(), Decimal("0.00"))
        self.assertEqual(entry.get_remaining_amount(), Decimal("80000.00"))

    def test_business_isolation_api(self):
        """TEST 6 — BUSINESS ISOLATION: Verify Business A cannot access Business B's records via API"""
        LedgerEntry.objects.create(
            business=self.business_a,
            party_name="Party A",
            transaction_type="RECEIVABLE",
            amount=Decimal("1000.00")
        )
        LedgerEntry.objects.create(
            business=self.business_b,
            party_name="Party B",
            transaction_type="RECEIVABLE",
            amount=Decimal("2000.00")
        )
        
        client = APIClient()
        client.force_authenticate(user=self.user_a)
        
        # Request entries for Business A
        url = reverse("ledger-entry-list")
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should only see Business A's entry
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['party_name'], "Party A")
