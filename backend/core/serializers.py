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

from .models import (
    BusinessProfile,
    Customer,
    Supplier,
    Purchase,
    Sale,
    Expense,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    LedgerEntry,
    LedgerPayment,
    AuditLog,
)
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
            "pincode",
            "bank_name",
            "bank_branch",
            "bank_account_number",
            "bank_ifsc",
            "terms_and_conditions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "created_at", "updated_at"]

    def validate_pincode(self, value: str) -> str:
        """Ensure pincode is either empty or exactly 6 digits."""
        if not value:
            return value
        if len(value) != 6 or not value.isdigit():
            raise serializers.ValidationError("Pincode must be exactly 6 digits.")
        return value

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
    """
    financial_summary = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "party_type",
            "gst_registered",
            "gstin",
            "aadhaar_no",
            "phone",
            "state",
            "is_active",
            "created_at",
            "financial_summary"
        ]
        read_only_fields = ["id", "created_at", "financial_summary"]
        
    def get_financial_summary(self, obj):
        party_type = getattr(obj, 'party_type', 'CUSTOMER')
        
        total_receivable = float(getattr(obj, 'total_receivable', 0) or 0)
        total_received = float(getattr(obj, 'total_received', 0) or 0)
        total_payable = float(getattr(obj, 'total_payable', 0) or 0)
        total_paid = float(getattr(obj, 'total_paid', 0) or 0)
        
        status_label = "PENDING"
        outstanding = 0
        
        if party_type == 'CUSTOMER':
            outstanding = max(0, total_receivable - total_received)
            if total_receivable > 0:
                if outstanding == 0:
                    status_label = "PAID"
                elif total_received > 0:
                    status_label = "PARTIALLY_PAID"
            return {
                "total_invoiced": total_receivable,
                "total_paid": total_received,
                "outstanding": outstanding,
                "status": status_label
            }
        elif party_type in ['SUPPLIER', 'TRANSPORTER']:
            outstanding = max(0, total_payable - total_paid)
            if total_payable > 0:
                if outstanding == 0:
                    status_label = "PAID"
                elif total_paid > 0:
                    status_label = "PARTIALLY_PAID"
            return {
                "total_payable": total_payable,
                "total_paid": total_paid,
                "outstanding": outstanding,
                "status": status_label
            }
        else:
            # OTHER
            outstanding = (total_receivable - total_received) - (total_payable - total_paid)
            return {
                "total_receivable": total_receivable,
                "total_payable": total_payable,
                "outstanding": outstanding,
                "status": "PENDING"
            }


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
    financial_summary = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "party_type",
            "address",
            "gst_registered",
            "gstin",
            "gst_verified",
            "financial_summary",
            "gst_verified_at",
            "gst_status",
            "gst_legal_name",
            "gst_trade_name",
            "aadhaar_no",
            "state",
            "state_code",
            "phone",
            "email",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "gst_verified_at"]

    def get_financial_summary(self, obj):
        party_type = getattr(obj, 'party_type', 'CUSTOMER')
        
        total_receivable = float(getattr(obj, 'total_receivable', 0) or 0)
        total_received = float(getattr(obj, 'total_received', 0) or 0)
        total_payable = float(getattr(obj, 'total_payable', 0) or 0)
        total_paid = float(getattr(obj, 'total_paid', 0) or 0)
        
        status_label = "PENDING"
        outstanding = 0
        
        if party_type == 'CUSTOMER':
            outstanding = max(0, total_receivable - total_received)
            if total_receivable > 0:
                if outstanding == 0:
                    status_label = "PAID"
                elif total_received > 0:
                    status_label = "PARTIALLY_PAID"
            return {
                "total_invoiced": total_receivable,
                "total_paid": total_received,
                "outstanding": outstanding,
                "status": status_label
            }
        elif party_type in ['SUPPLIER', 'TRANSPORTER']:
            outstanding = max(0, total_payable - total_paid)
            if total_payable > 0:
                if outstanding == 0:
                    status_label = "PAID"
                elif total_paid > 0:
                    status_label = "PARTIALLY_PAID"
            return {
                "total_payable": total_payable,
                "total_paid": total_paid,
                "outstanding": outstanding,
                "status": status_label
            }
        else:
            outstanding = (total_receivable - total_received) - (total_payable - total_paid)
            return {
                "total_receivable": total_receivable,
                "total_payable": total_payable,
                "outstanding": outstanding,
                "status": "PENDING"
            }

    def validate_name(self, value: str) -> str:
        if not value or not value.strip():
            raise serializers.ValidationError("Customer name is required.")
        return value.strip()

    def validate_gstin(self, value: str) -> str:
        if value:
            validate_gstin(value)
        return value.upper() if value else value

    def validate_aadhaar_no(self, value: str) -> str:
        if value:
            value = value.replace(" ", "").strip()
            if not value.isdigit() or len(value) != 12:
                raise serializers.ValidationError("Aadhaar Number must be exactly 12 digits.")
        return value

    def validate_phone(self, value: str) -> str:
        if value:
            validate_phone(value)
        return value

    def validate(self, data):
        gst_registered = data.get('gst_registered')
        
        # When doing partial updates, we might not have all fields in `data`.
        # So we merge with `self.instance` values if they exist.
        if self.instance:
            if 'gst_registered' not in data:
                gst_registered = self.instance.gst_registered

        if gst_registered:
            gstin = data.get('gstin', self.instance.gstin if self.instance else '')
            if not gstin:
                raise serializers.ValidationError({"gstin": "GSTIN is required for a GST-registered customer."})
            
            # Phase 3 Duplicate Check & Invalidation
            business = self.context['request'].user.business_profile
            
            # If creating new, or if updating and GSTIN has changed
            instance_gstin = self.instance.gstin if self.instance else ''
            if gstin != instance_gstin:
                # Check duplicate
                if Customer.objects.filter(business=business, gstin=gstin).exists():
                    raise serializers.ValidationError({"gstin": "Customer with this GSTIN already exists."})
                
                # Invalidate if GSTIN changed on an existing record
                if self.instance:
                    data['gst_verified'] = False
                    data['gst_status'] = ""
                    data['gst_legal_name'] = ""
                    data['gst_trade_name'] = ""

            state_code = data.get('state_code', self.instance.state_code if self.instance else '')
            if state_code and gstin[:2] != state_code:
                raise serializers.ValidationError({"non_field_errors": ["GSTIN state code does not match the selected customer state."]})
        else:
            # Force empty GSTIN and unverified if unregistered
            data['gstin'] = ""
            data['gst_verified'] = False
            data['gst_status'] = ""
            data['gst_legal_name'] = ""
            data['gst_trade_name'] = ""
            
        return data

    def update(self, instance, validated_data):
        # Auto-set verified timestamp if verified goes False -> True
        if validated_data.get('gst_verified', False) and not instance.gst_verified:
            from django.utils import timezone
            validated_data['gst_verified_at'] = timezone.now()
        # If verification is cleared
        elif 'gst_verified' in validated_data and not validated_data['gst_verified']:
            validated_data['gst_verified_at'] = None
            
        return super().update(instance, validated_data)

    def create(self, validated_data):
        if validated_data.get('gst_verified', False):
            from django.utils import timezone
            validated_data['gst_verified_at'] = timezone.now()
        return super().create(validated_data)


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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Limit the customer choices to the current user's business profile
        request = self.context.get('request')
        if request and hasattr(request.user, 'business_profile'):
            self.fields['customer'].queryset = Customer.objects.filter(
                is_active=True, 
                business=request.user.business_profile
            )
        else:
            self.fields['customer'].queryset = Customer.objects.none()

    # ── Transport ─────────────────────────────────────────────
    transport_name = serializers.CharField(max_length=255, allow_blank=True, default="")
    vehicle_number = serializers.CharField(max_length=20, allow_blank=True, default="")

    # ── Tax rates (percentages) ───────────────────────────────
    gst_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("100.00"), default=Decimal("0.00"), write_only=True
    )
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
        request = self.context.get('request')
        if not request or not hasattr(request.user, 'business_profile'):
            raise serializers.ValidationError(
                {"non_field_errors": ["No business profile found. Please create one before adding invoices."]}
            )
        business = request.user.business_profile
        
        invoice_number = data.get("invoice_number")
        if invoice_number and Invoice.objects.filter(
            business=business, 
            invoice_number__iexact=invoice_number
        ).exists():
            raise serializers.ValidationError(
                {"invoice_number": f"Invoice number '{invoice_number}' already exists for this business."}
            )

        # Tax Consistency & GST Auto-Detection
        customer = data.get("customer")
        if not business.state:
            raise serializers.ValidationError({"non_field_errors": ["Business state is required to determine GST. Please complete your Business Profile."]})
        if customer and not customer.state:
            raise serializers.ValidationError({"non_field_errors": ["Customer state is required to determine GST."]})
            
        b_state = business.state.strip().lower()
        c_state = customer.state.strip().lower() if customer else ""
        
        cgst = data.get("cgst_rate", Decimal("0.00"))
        sgst = data.get("sgst_rate", Decimal("0.00"))
        igst = data.get("igst_rate", Decimal("0.00"))
        
        # Determine effective gst_rate based on new payload or fallback
        gst_rate = data.get("gst_rate")
        if gst_rate is None or gst_rate == Decimal("0.00"):
            if cgst > 0 or sgst > 0 or igst > 0:
                gst_rate = cgst + sgst + igst
            else:
                gst_rate = Decimal("0.00")
                
        # Authoritative overrides
        if b_state == c_state:
            data["cgst_rate"] = (gst_rate / Decimal("2")).quantize(Decimal("0.01"))
            data["sgst_rate"] = (gst_rate / Decimal("2")).quantize(Decimal("0.01"))
            data["igst_rate"] = Decimal("0.00")
        else:
            data["cgst_rate"] = Decimal("0.00")
            data["sgst_rate"] = Decimal("0.00")
            data["igst_rate"] = gst_rate

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
        validated_data.pop("gst_rate", None)  # write_only field

        request = self.context.get('request')
        business = request.user.business_profile

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
# Supplier
# ─────────────────────────────────────────────────────────────

class SupplierListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "phone",
            "gstin",
            "aadhaar_no",
            "state",
            "is_active",
        ]
        read_only_fields = fields

class SupplierDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for supplier create, retrieve, and partial update.
    Does NOT strictly enforce GSTIN mandatory presence.
    """
    phone = serializers.CharField(max_length=20, allow_blank=True, allow_null=False, required=False, default="")
    gstin = serializers.CharField(max_length=15, allow_blank=True, allow_null=False, required=False, default="")
    aadhaar_no = serializers.CharField(max_length=12, allow_blank=True, allow_null=False, required=False, default="")
    state = serializers.CharField(max_length=100, allow_blank=True, allow_null=False, required=False, default="")
    pincode = serializers.CharField(max_length=10, allow_blank=True, allow_null=False, required=False, default="")
    notes = serializers.CharField(allow_blank=True, allow_null=False, required=False, default="")
    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "phone",
            "gstin",
            "aadhaar_no",
            "address",
            "state",
            "pincode",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_gstin(self, value):
        if value:
            validate_gstin(value)
        return value.upper() if value else ""

    def validate_phone(self, value):
        if value:
            validate_phone(value)
        return value


# ─────────────────────────────────────────────────────────────
# Purchase
# ─────────────────────────────────────────────────────────────

class PurchaseListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id",
            "purchase_date",
            "supplier",
            "supplier_name",
            "purchase_order_no",
            "serial_no",
            "truck_no",
            "quantity_tons",
            "rate_per_ton",
            "total_amount",
            "is_active",
        ]
        read_only_fields = fields

class PurchaseDetailSerializer(serializers.ModelSerializer):
    """
    Serializer for Purchase create/update/retrieve.
    """
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "purchase_date",
            "purchase_order_no",
            "serial_no",
            "truck_no",
            "quantity_tons",
            "rate_per_ton",
            "purchase_amount",
            "gst_rate",
            "gst_amount",
            "total_amount",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "supplier_name",
            "purchase_amount",
            "gst_amount",
            "total_amount",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if data.get('gst_rate') in ('', None):
            data['gst_rate'] = '0.00'
        return super().to_internal_value(data)

    def validate(self, data):
        # We don't need to recalculate here because it happens in model.save(),
        # but we must ensure required fields are present if it's a create.
        return data


# ─────────────────────────────────────────────────────────────
# InvoiceItem — Write
# ─────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────
# Sale
# ─────────────────────────────────────────────────────────────

class SaleListSerializer(serializers.ModelSerializer):
    """
    Summary view of sales for the list/table endpoint.
    """
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    receivable_id = serializers.IntegerField(source="receivable.id", read_only=True)
    receivable_status = serializers.CharField(source="receivable.status", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "sale_date",
            "customer",
            "customer_name",
            "sale_order_no",
            "truck_no",
            "payment_type",
            "quantity_tons",
            "rate_per_ton",
            "sale_amount",
            "gst_rate",
            "gst_amount",
            "tcs_rate",
            "tcs_amount",
            "total_amount",
            "is_active",
            "receivable_id",
            "receivable_status",
        ]
        read_only_fields = fields


class SaleDetailSerializer(serializers.ModelSerializer):
    """
    Full details for creating/updating/viewing a single sale.
    """
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    receivable_id = serializers.IntegerField(source="receivable.id", read_only=True)
    receivable_status = serializers.CharField(source="receivable.status", read_only=True)
    receivable_paid = serializers.DecimalField(source="receivable.get_paid_amount", max_digits=12, decimal_places=2, read_only=True)
    receivable_remaining = serializers.DecimalField(source="receivable.get_remaining_amount", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "business",
            "customer",
            "customer_name",
            "sale_date",
            "sale_order_no",
            "serial_no",
            "truck_no",
            "payment_type",
            "quantity_tons",
            "rate_per_ton",
            "sale_amount",
            "gst_rate",
            "gst_amount",
            "tcs_rate",
            "tcs_amount",
            "total_amount",
            "notes",
            "is_active",
            "receivable_id",
            "receivable_status",
            "receivable_paid",
            "receivable_remaining",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "business",
            "customer_name",
            "sale_amount",
            "gst_amount",
            "tcs_amount",
            "total_amount",
            "receivable_id",
            "receivable_status",
            "receivable_paid",
            "receivable_remaining",
            "created_at",
            "updated_at",
        ]

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if data.get('gst_rate') in ('', None):
            data['gst_rate'] = '0.00'
        if data.get('tcs_rate') in ('', None):
            data['tcs_rate'] = '0.00'
        return super().to_internal_value(data)

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.user.is_authenticated and hasattr(request.user, 'business_profile'):
            business = request.user.business_profile
            # If a customer is provided, ensure it belongs to the same business
            customer = attrs.get('customer')
            if customer and customer.business_id != business.id:
                raise serializers.ValidationError({"customer": "Selected customer does not belong to your business."})
        return super().validate(attrs)


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
# Ledger (Phase 1)
# ─────────────────────────────────────────────────────────────

class LedgerPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerPayment
        fields = [
            'id',
            'ledger_entry',
            'amount',
            'payment_date',
            'payment_method',
            'notes',
            'proof_document',
            'status',
            'created_at',
        ]
        read_only_fields = ['id', 'status', 'created_at']


class LedgerEntrySerializer(serializers.ModelSerializer):
    payments = LedgerPaymentSerializer(many=True, read_only=True)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, source='get_paid_amount')
    remaining_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, source='get_remaining_amount')
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)

    class Meta:
        model = LedgerEntry
        fields = [
            'id',
            'business',
            'customer',
            'customer_name',
            'customer_phone',
            'party_name',
            'transaction_type',
            'amount',
            'tcs_rate',
            'tcs_amount',
            'sale_order_no',
            'purchase_order_no',
            'serial_no',
            'truck_no',
            'entry_date',
            'tons',
            'reference',
            'notes',
            'status',
            'paid_amount',
            'remaining_amount',
            'payments',
            'invoice',
            'sale',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'business', 'status', 'created_at', 'updated_at', 'paid_amount', 'remaining_amount']

# ─────────────────────────────────────────────────────────────
# Audit Log (Phase 8)
# ─────────────────────────────────────────────────────────────

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True, default='System')

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'user_name',
            'action',
            'record_type',
            'record_id',
            'timestamp',
            'details'
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


# ─────────────────────────────────────────────────────────────
# Expense
# ─────────────────────────────────────────────────────────────

class ExpenseListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    purchase_order = serializers.CharField(source="purchase.purchase_order_no", read_only=True)
    sale_order = serializers.CharField(source="sale.sale_order_no", read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "expense_date",
            "category",
            "description",
            "amount",
            "paid_to",
            "reference_no",
            "supplier_name",
            "customer_name",
            "purchase_order",
            "sale_order",
            "is_active",
        ]
        read_only_fields = fields


class ExpenseDetailSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    purchase_order = serializers.CharField(source="purchase.purchase_order_no", read_only=True)
    sale_order = serializers.CharField(source="sale.sale_order_no", read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "expense_date",
            "category",
            "description",
            "amount",
            "paid_to",
            "reference_no",
            "supplier",
            "supplier_name",
            "customer",
            "customer_name",
            "purchase",
            "purchase_order",
            "sale",
            "sale_order",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        if request and hasattr(request.user, "business_profile"):
            biz = request.user.business_profile
            if attrs.get("supplier") and attrs["supplier"].business != biz:
                raise serializers.ValidationError({"supplier": "Supplier does not belong to this business."})
            if attrs.get("customer") and attrs["customer"].business != biz:
                raise serializers.ValidationError({"customer": "Customer does not belong to this business."})
            if attrs.get("purchase") and attrs["purchase"].business != biz:
                raise serializers.ValidationError({"purchase": "Purchase does not belong to this business."})
            if attrs.get("sale") and attrs["sale"].business != biz:
                raise serializers.ValidationError({"sale": "Sale does not belong to this business."})
        return attrs
