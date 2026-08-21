"""
core/models.py

Database models for the Coal Invoice & Records Management System.

Entities:
    BusinessProfile  — the supplier / coal business
    Customer         — the buyer receiving invoices
    Invoice          — a single tax invoice
    InvoiceItem      — one line item within an invoice

Design notes:
    - All monetary fields use DecimalField (never FloatField) to avoid
      floating-point rounding errors in financial calculations.
    - Tax *rates* and *amounts* are stored on the Invoice so the exact
      tax treatment at the time of invoicing is preserved even if rates
      change later.  The calculation engine is NOT implemented here.
    - Invoice.status supports future cancellation/voiding without hard
      deletion of business records (regulatory requirement in GST context).
    - Invoice numbers are stored as strings to support formats like
      "93", "INV-93", "2026/93".  Uniqueness is enforced per-business.
    - Negative financial values are blocked at the validator layer.
      Database-level constraints (CheckConstraint) are also added for
      defence-in-depth.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum, Q
from django.conf import settings
from django.conf import settings


# ─────────────────────────────────────────────────────────────
# Constants / choices
# ─────────────────────────────────────────────────────────────

class TransactionType(models.TextChoices):
    CASH = "CASH", "Cash"
    CREDIT = "CREDIT", "Credit"


class InvoiceStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    ISSUED = "ISSUED", "Issued"
    CANCELLED = "CANCELLED", "Cancelled"


class GoogleDriveStatus(models.TextChoices):
    NOT_UPLOADED = "NOT_UPLOADED", "Not Uploaded"
    UPLOADING = "UPLOADING", "Uploading"
    UPLOADED = "UPLOADED", "Uploaded"
    FAILED = "FAILED", "Failed"


# ─────────────────────────────────────────────────────────────
# BusinessProfile
# ─────────────────────────────────────────────────────────────

class BusinessProfile(models.Model):
    """
    Stores the supplier / coal-business information that appears on
    every invoice header (name, GSTIN, address, bank details, etc.).

    A single installation typically has one BusinessProfile, but the
    model supports multiple businesses for future multi-tenancy.
    """

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="business_profile",
        null=True,
        blank=True,
        help_text="The user who registered and owns this business profile."
    )
    business_name = models.CharField(max_length=255)
    gstin = models.CharField(
        max_length=15,
        blank=True,
        default="",
        help_text="GST Identification Number (15 characters)",
    )
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    state_code = models.CharField(max_length=10, blank=True, default="")
    pincode = models.CharField(
        max_length=6,
        blank=True,
        null=True,
        help_text="6-digit Indian Pincode",
    )

    # Bank details printed on invoice footer
    bank_name = models.CharField(max_length=100, blank=True, default="")
    bank_branch = models.CharField(max_length=100, blank=True, default="")
    bank_account_number = models.CharField(max_length=30, blank=True, default="")
    bank_ifsc = models.CharField(
        max_length=11,
        blank=True,
        default="",
        help_text="IFSC code (11 characters)",
    )

    terms_and_conditions = models.TextField(blank=True, default="")

    # Google Drive Integration
    google_oauth_refresh_token = models.CharField(
        max_length=255, 
        blank=True, 
        default="",
        help_text="OAuth 2.0 refresh token for uploading to the owner's Google Drive"
    )
    google_drive_folder_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Google Drive Folder ID where invoices are uploaded"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Business Profile"
        verbose_name_plural = "Business Profiles"
        ordering = ["business_name"]

    def __str__(self):
        return self.business_name


# ─────────────────────────────────────────────────────────────
# Customer
# ─────────────────────────────────────────────────────────────

class Customer(models.Model):
    """
    A reusable buyer record.  Many invoices can reference the same
    customer, avoiding data duplication.

    GSTIN uniqueness: a non-blank GSTIN should ideally be unique in the
    real world, but we allow NULL/blank to cover unregistered buyers and
    walk-in cash customers, so the unique constraint uses a partial
    approach — handled at the application layer for now with
    db_index=True for fast lookups.
    """

    business = models.ForeignKey(
        BusinessProfile,
        on_delete=models.CASCADE,
        related_name="customers",
        help_text="The business that owns this customer record.",
        null=True,  # Temporarily allow null for migration
    )
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, default="")
    gst_registered = models.BooleanField(
        default=False,
        help_text="Whether this customer has a valid GST registration",
    )
    gstin = models.CharField(
        max_length=15,
        blank=True,
        default="",
        db_index=True,
        help_text="GST Identification Number — optional for unregistered buyers",
    )
    
    # ── GST Verification Cache ────────────────────────────────
    gst_verified = models.BooleanField(
        default=False,
        help_text="Whether this GSTIN has been successfully verified with the GST API",
    )
    gst_verified_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When the GST verification was performed",
    )
    gst_status = models.CharField(max_length=50, blank=True, default="")
    gst_legal_name = models.CharField(max_length=255, blank=True, default="")
    gst_trade_name = models.CharField(max_length=255, blank=True, default="")

    aadhaar_no = models.CharField(
        max_length=12,
        blank=True,
        default="",
        help_text="Aadhaar Number — alternative identification for unregistered buyers",
    )
    state = models.CharField(max_length=100, blank=True, default="")
    state_code = models.CharField(max_length=10, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive customers are hidden from new-invoice selection but remain in historical records.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Customer"
        verbose_name_plural = "Customers"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="customer_name_idx"),
        ]

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────
# Invoice
# ─────────────────────────────────────────────────────────────

class Invoice(models.Model):
    """
    A single tax invoice issued by the business to a customer.

    Tax rates and amounts are stored at invoice creation time so that
    later changes to applicable rates do not alter historical records.

    The 'status' field is used instead of hard deletion:
        DRAFT     — being prepared, not yet issued
        ISSUED    — finalised and sent to the customer
        CANCELLED — voided; kept in DB for audit/GST compliance

    The calculation engine (taxable_amount, cgst_amount, etc.) will be
    implemented in a later phase as a separate service.  These fields
    are stored here and populated by that service.
    """

    # ── Identifiers ──────────────────────────────────────────
    invoice_number = models.CharField(
        max_length=50,
        help_text="Invoice/bill number — supports formats: 93, INV-93, 2026/93",
    )
    invoice_date = models.DateField(
        help_text="The business/invoice date printed on the document",
    )

    # ── Status ───────────────────────────────────────────────
    status = models.CharField(
        max_length=10,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.DRAFT,
        db_index=True,
    )

    # ── Transaction type ──────────────────────────────────────
    transaction_type = models.CharField(
        max_length=6,
        choices=TransactionType.choices,
        default=TransactionType.CASH,
    )

    # ── Relationships ─────────────────────────────────────────
    business = models.ForeignKey(
        BusinessProfile,
        on_delete=models.PROTECT,
        related_name="invoices",
        help_text="The business that issued this invoice",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="invoices",
        help_text="The buyer receiving this invoice",
    )

    # ── Transport details ─────────────────────────────────────
    transport_name = models.CharField(max_length=255, blank=True, default="")
    vehicle_number = models.CharField(max_length=20, blank=True, default="")

    # ── Financial summary (populated by calculation service) ──
    _non_negative = MinValueValidator(Decimal("0.00"))

    taxable_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    # CGST
    cgst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="CGST rate as a percentage, e.g. 9.00",
    )
    cgst_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    # SGST
    sgst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="SGST rate as a percentage, e.g. 9.00",
    )
    sgst_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    # IGST
    igst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="IGST rate as a percentage, e.g. 18.00",
    )
    igst_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    # TCS (Tax Collected at Source)
    tcs_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="TCS rate as a percentage, e.g. 1.00",
    )
    tcs_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    # Reverse charge flag
    reverse_charge = models.BooleanField(
        default=False,
        help_text="Whether reverse charge mechanism applies to this invoice",
    )

    # Grand total
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    # Amount in words (populated by service)
    amount_in_words = models.TextField(blank=True, default="")

    # ── Google Drive Integration ──────────────────────────────
    google_drive_status = models.CharField(
        max_length=20,
        choices=GoogleDriveStatus.choices,
        default=GoogleDriveStatus.NOT_UPLOADED,
    )
    google_drive_file_id = models.CharField(max_length=255, blank=True, null=True)
    google_drive_file_url = models.URLField(max_length=1000, blank=True, null=True)
    google_drive_uploaded_at = models.DateTimeField(blank=True, null=True)

    # ── Timestamps ────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Invoice"
        verbose_name_plural = "Invoices"
        ordering = ["-invoice_date", "-created_at"]
        indexes = [
            models.Index(fields=["invoice_date"], name="invoice_date_idx"),
            models.Index(fields=["status"], name="invoice_status_idx"),
            models.Index(fields=["business", "invoice_date"], name="invoice_business_date_idx"),
            models.Index(fields=["invoice_number"], name="invoice_number_idx"),
            models.Index(fields=["vehicle_number"], name="vehicle_number_idx"),
            models.Index(fields=["transaction_type"], name="transaction_type_idx"),
        ]
        constraints = [
            # invoice_number must be unique per business (not globally,
            # because multiple businesses might use the same numbering)
            models.UniqueConstraint(
                fields=["business", "invoice_number"],
                name="unique_invoice_number_per_business",
            ),
            # Prevent obviously invalid monetary values at DB level
            models.CheckConstraint(
                condition=models.Q(taxable_amount__gte=0),
                name="invoice_taxable_amount_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(total_amount__gte=0),
                name="invoice_total_amount_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(cgst_rate__gte=0),
                name="invoice_cgst_rate_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(sgst_rate__gte=0),
                name="invoice_sgst_rate_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(igst_rate__gte=0),
                name="invoice_igst_rate_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(tcs_rate__gte=0),
                name="invoice_tcs_rate_non_negative",
            ),
        ]

    def __str__(self):
        return f"Invoice #{self.invoice_number} — {self.customer}"


# ─────────────────────────────────────────────────────────────
# InvoiceItem
# ─────────────────────────────────────────────────────────────

class InvoiceItem(models.Model):
    """
    A single line item (product row) within an Invoice.

    Quantities and monetary values use DecimalField throughout.
    HSN code is stored as a string (not integer) because leading zeros
    are significant in some HSN codes.
    """

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="items",
    )
    serial_number = models.PositiveIntegerField(
        help_text="Row sequence number within the invoice (1, 2, 3, …)",
    )
    product_name = models.CharField(max_length=255)
    hsn_code = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="HSN / SAC code stored as a string to preserve leading zeros",
    )
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.000"))],
        help_text="Quantity (3 decimal places to support MT, KG, etc.)",
    )
    unit = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Unit of measure, e.g. MT, KG, TON",
    )
    rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Rate per unit",
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Line total = quantity × rate (calculated by service layer)",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Invoice Item"
        verbose_name_plural = "Invoice Items"
        ordering = ["invoice", "serial_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["invoice", "serial_number"],
                name="unique_serial_number_per_invoice",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=0),
                name="item_quantity_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(rate__gte=0),
                name="item_rate_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(amount__gte=0),
                name="item_amount_non_negative",
            ),
        ]

    def __str__(self):
        return f"{self.product_name} ({self.quantity} {self.unit})"

    def _calculate_total_tax(self):
        return self.cgst_amount + self.sgst_amount + self.igst_amount

# ─────────────────────────────────────────────────────────────
# Ledger & Payments (Phase 1)
# ─────────────────────────────────────────────────────────────

class LedgerEntry(models.Model):
    """
    Represents a financial obligation (Receivable or Payable).
    Tracks the original amount owed and provides dynamic status
    calculation based on associated payments.
    """
    TRANSACTION_TYPES = [
        ('RECEIVABLE', 'Receivable'),
        ('PAYABLE', 'Payable'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('PAID', 'Paid'),
    ]

    business = models.ForeignKey(
        BusinessProfile, 
        on_delete=models.CASCADE, 
        related_name="ledger_entries",
        help_text="The business profile this ledger entry belongs to (for data isolation)."
    )
    
    # Party resolution
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="ledger_entries",
        help_text="Linked customer (if the party is a registered customer)."
    )
    party_name = models.CharField(
        max_length=255, 
        blank=True, 
        help_text="Name of the party if not a registered customer (e.g., external supplier or transporter)."
    )
    
    invoice = models.OneToOneField(
        'Invoice',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ledger_entry",
        help_text="The invoice that generated this ledger entry (if applicable)."
    )
    
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Original transaction amount"
    )
    
    reference = models.CharField(max_length=255, blank=True, help_text="Invoice number, PO number, or reason")
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Ledger Entries"
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name='ledger_amount_positive')
        ]
        indexes = [
            models.Index(fields=['business', 'status']),
            models.Index(fields=['business', 'transaction_type']),
            models.Index(fields=['business', 'created_at']),
        ]

    def __str__(self):
        party = self.party_name or (self.customer.name if self.customer else "Unknown Party")
        return f"{self.transaction_type} | {party} | ₹{self.amount}"

    def get_paid_amount(self):
        return self.payments.aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

    def get_remaining_amount(self):
        return self.amount - self.get_paid_amount()

    def update_status(self):
        paid = self.get_paid_amount()
        if paid >= self.amount:
            self.status = 'PAID'
        elif paid > 0:
            self.status = 'PARTIALLY_PAID'
        else:
            self.status = 'PENDING'
        self.save(update_fields=['status', 'updated_at'])


class LedgerPayment(models.Model):
    """
    Represents an individual payment against a LedgerEntry.
    """
    PAYMENT_METHODS = [
        ('CASH', 'Cash'),
        ('UPI', 'UPI'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('CHEQUE', 'Cheque'),
        ('OTHER', 'Other'),
    ]

    ledger_entry = models.ForeignKey(
        LedgerEntry, 
        on_delete=models.RESTRICT, 
        related_name="payments",
        help_text="The ledger entry this payment applies to. RESTRICT prevents deleting a ledger if payments exist."
    )
    amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))]
    )
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, blank=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['ledger_entry', 'payment_date']),
        ]

    def __str__(self):
        return f"Payment of ₹{self.amount} on {self.payment_date}"

    def clean(self):
        super().clean()
        if self.ledger_entry_id and self.amount:
            if not self.pk:
                current_paid = self.ledger_entry.get_paid_amount()
                if current_paid + self.amount > self.ledger_entry.amount:
                    raise ValidationError("Payment amount exceeds the remaining ledger balance.")
            else:
                other_paid = self.ledger_entry.payments.exclude(pk=self.pk).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
                if other_paid + self.amount > self.ledger_entry.amount:
                    raise ValidationError("Updated payment amount exceeds the remaining ledger balance.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        self.ledger_entry.update_status()

    def delete(self, *args, **kwargs):
        entry = self.ledger_entry
        super().delete(*args, **kwargs)
        entry.update_status()
