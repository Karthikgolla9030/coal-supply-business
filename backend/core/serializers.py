"""
core/serializers.py

DRF serializers for the Coal Invoice & Records Management System.

BusinessProfileSerializer    — GET / POST / PATCH on the profile
CustomerListSerializer       — compact representation for list views
CustomerDetailSerializer     — full fields for detail / create / update views
InvoiceItemWriteSerializer   — validates a single invoice line item on write
InvoiceCreateSerializer      — validates and atomically creates an invoice
                               with its items; delegates all arithmetic to the
                               calculation service
InvoiceItemReadSerializer    — read representation of a saved InvoiceItem
InvoiceDetailSerializer      — full read representation of a saved Invoice
"""

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import BusinessProfile, Customer, Invoice, InvoiceItem, InvoiceStatus
from .services.calculation import amount_to_words, calculate_invoice_totals
from .validators import validate_gstin, validate_ifsc, validate_phone


# ─────────────────────────────────────────────────────────────
# BusinessProfile
# ─────────────────────────────────────────────────────────────

class BusinessProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for the BusinessProfile model.

    Used for all operations: read, create, and partial update.
    Applies GSTIN, IFSC, and phone format validation.
    """

    class Meta:
        model = BusinessProfile
        fields = [
            "id",
            "business_name",
            "gstin",
            "phone",
            "email",
            "address",
            "state",
            "state_code",
            "bank_name",
            "bank_branch",
            "bank_account_number",
            "bank_ifsc",
            "terms_and_conditions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_gstin(self, value: str) -> str:
        if value:
            validate_gstin(value)
        return value.upper() if value else value

    def validate_bank_ifsc(self, value: str) -> str:
        if value:
            validate_ifsc(value)
        return value.upper() if value else value

    def validate_phone(self, value: str) -> str:
        if value:
            validate_phone(value)
        return value

    def validate_business_name(self, value: str) -> str:
        if not value or not value.strip():
            raise serializers.ValidationError("Business name is required.")
        return value.strip()


# ─────────────────────────────────────────────────────────────
# Customer — List representation
# ─────────────────────────────────────────────────────────────

class CustomerListSerializer(serializers.ModelSerializer):
    """
    Compact serializer for the customer list view.

    Returns only the fields needed for the table display:
    name, GSTIN, phone, state, status.
    """

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "gstin",
            "phone",
            "state",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ─────────────────────────────────────────────────────────────
# Customer — Detail / Create / Update representation
# ─────────────────────────────────────────────────────────────

class CustomerDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for customer create, retrieve, and partial update.

    Applies GSTIN, phone, and email format validation.
    Does NOT enforce globally unique GSTIN — two customers may share
    the same GSTIN only if it is blank/empty (unregistered buyers).
    Non-blank GSTINs are flagged as potential duplicates via a warning
    in validate_gstin but are not hard-rejected at the serializer layer.
    """

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "address",
            "gstin",
            "state",
            "state_code",
            "phone",
            "email",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value: str) -> str:
        if not value or not value.strip():
            raise serializers.ValidationError("Customer name is required.")
        return value.strip()

    def validate_gstin(self, value: str) -> str:
        if value:
            validate_gstin(value)
        return value.upper() if value else value

    def validate_phone(self, value: str) -> str:
        if value:
            validate_phone(value)
        return value


# ─────────────────────────────────────────────────────────────
# InvoiceItem — Write (input validation only)
# ─────────────────────────────────────────────────────────────

class InvoiceItemWriteSerializer(serializers.Serializer):
    """
    Validates a single invoice line-item submitted by the client.

    The 'amount' field, if provided by the client, is SILENTLY IGNORED.
    The backend always recalculates item amounts via the calculation service.
    """

    product_name = serializers.CharField(max_length=255)
    hsn_code     = serializers.CharField(max_length=20, allow_blank=True, default="")
    quantity     = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )
    unit         = serializers.CharField(max_length=20, allow_blank=True, default="")
    rate         = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
    )

    # Accept but discard any client-supplied amount
    amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        write_only=True,
        allow_null=True,
    )

    def validate_product_name(self, value: str) -> str:
        if not value or not value.strip():
            raise serializers.ValidationError("Product name is required.")
        return value.strip()

    def validate_hsn_code(self, value: str) -> str:
        return value.strip()


# ─────────────────────────────────────────────────────────────
# Invoice — Create (write)
# ─────────────────────────────────────────────────────────────

class InvoiceCreateSerializer(serializers.Serializer):
    """
    Validates the full invoice creation payload and atomically persists
    the Invoice + InvoiceItems in a single database transaction.

    The client MUST NOT supply computed fields:
        amount, taxable_amount, cgst_amount, sgst_amount,
        igst_amount, tcs_amount, total_amount, amount_in_words

    These are always calculated server-side by the calculation service.

    The 'business' is set automatically from the first BusinessProfile.
    """

    # ── Header fields ──────────────────────────────────────────
    invoice_number   = serializers.CharField(max_length=50)
    invoice_date     = serializers.DateField()
    transaction_type = serializers.ChoiceField(choices=["CASH", "CREDIT"])

    # ── Foreign key ───────────────────────────────────────────
    customer = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.filter(is_active=True)
    )

    # ── Transport ─────────────────────────────────────────────
    transport_name = serializers.CharField(max_length=255, allow_blank=True, default="")
    vehicle_number = serializers.CharField(max_length=20, allow_blank=True, default="")

    # ── Tax rates (percentages) ───────────────────────────────
    cgst_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("100.00"), default=Decimal("0.00")
    )
    sgst_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("100.00"), default=Decimal("0.00")
    )
    igst_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("100.00"), default=Decimal("0.00")
    )
    tcs_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("100.00"), default=Decimal("0.00")
    )
    reverse_charge = serializers.BooleanField(default=False)

    # ── Line items ─────────────────────────────────────────────
    items = InvoiceItemWriteSerializer(many=True)

    # ── Validation ─────────────────────────────────────────────

    def validate_invoice_number(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Invoice number is required.")
        return value

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one invoice item is required.")
        return value

    def validate(self, data):
        """
        Cross-field validation: ensure invoice_number is unique per business
        and tax configuration is consistent.
        """
        business = BusinessProfile.objects.first()
        if business is None:
            raise serializers.ValidationError(
                {"non_field_errors": ["No business profile found. Please create one before adding invoices."]}
            )

        invoice_number = data.get("invoice_number", "")
        if invoice_number and Invoice.objects.filter(
            business=business, invoice_number=invoice_number
        ).exists():
            raise serializers.ValidationError(
                {"invoice_number": f"Invoice number '{invoice_number}' already exists for this business."}
            )

        # Tax Consistency: Cannot have CGST/SGST mixed with IGST
        cgst = data.get("cgst_rate", Decimal("0.00"))
        sgst = data.get("sgst_rate", Decimal("0.00"))
        igst = data.get("igst_rate", Decimal("0.00"))

        if (cgst > 0 or sgst > 0) and (igst > 0):
            raise serializers.ValidationError(
                {"non_field_errors": ["Tax consistency error: An invoice cannot apply both CGST/SGST and IGST simultaneously."]}
            )

        return data

    # ── Atomic creation ───────────────────────────────────────

    @transaction.atomic
    def create(self, validated_data):
        """
        Atomically create the Invoice and all InvoiceItems.

        Steps:
            1. Pop nested items from validated data
            2. Retrieve the singleton business profile
            3. Run calculation service (item amounts + totals)
            4. Create the Invoice (status = ISSUED)
            5. Bulk-create InvoiceItems with calculated amounts
            6. Return the saved Invoice instance

        If any step fails the transaction is rolled back.
        """
        items_data = validated_data.pop("items")
        customer   = validated_data.pop("customer")

        business = BusinessProfile.objects.first()

        # ── Calculate all amounts server-side ──────────────────
        totals = calculate_invoice_totals(
            items          = items_data,
            cgst_rate      = validated_data.get("cgst_rate", Decimal("0.00")),
            sgst_rate      = validated_data.get("sgst_rate", Decimal("0.00")),
            igst_rate      = validated_data.get("igst_rate", Decimal("0.00")),
            tcs_rate       = validated_data.get("tcs_rate",  Decimal("0.00")),
        )

        # ── Create Invoice ────────────────────────────────────
        invoice = Invoice.objects.create(
            business         = business,
            customer         = customer,
            status           = InvoiceStatus.ISSUED,
            taxable_amount   = totals.taxable_amount,
            cgst_amount      = totals.cgst_amount,
            sgst_amount      = totals.sgst_amount,
            igst_amount      = totals.igst_amount,
            tcs_amount       = totals.tcs_amount,
            total_amount     = totals.total_amount,
            amount_in_words  = amount_to_words(totals.total_amount),
            **validated_data,
        )

        # ── Bulk-create InvoiceItems ──────────────────────────
        item_objects = [
            InvoiceItem(
                invoice      = invoice,
                serial_number= idx + 1,
                product_name = item["product_name"],
                hsn_code     = item.get("hsn_code", ""),
                quantity     = item["quantity"],
                unit         = item.get("unit", ""),
                rate         = item["rate"],
                amount       = totals.item_amounts[idx],
            )
            for idx, item in enumerate(items_data)
        ]
        InvoiceItem.objects.bulk_create(item_objects)

        return invoice


# ─────────────────────────────────────────────────────────────
# InvoiceItem — Read
# ─────────────────────────────────────────────────────────────

class InvoiceItemReadSerializer(serializers.ModelSerializer):
    """Read-only representation of a saved InvoiceItem."""

    class Meta:
        model = InvoiceItem
        fields = [
            "id",
            "serial_number",
            "product_name",
            "hsn_code",
            "quantity",
            "unit",
            "rate",
            "amount",
        ]


# ─────────────────────────────────────────────────────────────
# Invoice — Detail (read)
# ─────────────────────────────────────────────────────────────

class InvoiceDetailSerializer(serializers.ModelSerializer):
    """
    Full read representation of a saved Invoice, used for:
        - The success response after creation
        - The invoice detail view (Phase 6+)
    """

    items    = InvoiceItemReadSerializer(many=True, read_only=True)
    business = BusinessProfileSerializer(read_only=True)
    customer = CustomerDetailSerializer(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "invoice_date",
            "status",
            "transaction_type",
            "business",
            "customer",
            "transport_name",
            "vehicle_number",
            "taxable_amount",
            "cgst_rate",
            "cgst_amount",
            "sgst_rate",
            "sgst_amount",
            "igst_rate",
            "igst_amount",
            "tcs_rate",
            "tcs_amount",
            "reverse_charge",
            "total_amount",
            "amount_in_words",
            "google_drive_status",
            "google_drive_file_id",
            "google_drive_file_url",
            "google_drive_uploaded_at",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────
# Invoice — List (read)
# ─────────────────────────────────────────────────────────────

class InvoiceListSerializer(serializers.ModelSerializer):
    """
    Compact read representation of an Invoice for the list view.
    Does NOT include items to avoid N+1 and large payloads.
    Customer is nested with a minimal representation.
    """
    customer = CustomerListSerializer(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "invoice_date",
            "status",
            "transaction_type",
            "customer",
            "vehicle_number",
            "total_amount",
            "google_drive_status",
            "google_drive_file_url",
            "created_at",
        ]
        read_only_fields = fields
