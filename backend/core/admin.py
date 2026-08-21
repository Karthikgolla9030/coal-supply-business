"""
core/admin.py

Django Admin configuration for core business models.
"""

from django.contrib import admin

from .models import BusinessProfile, Customer, Invoice, InvoiceItem, LedgerEntry, LedgerPayment


# ─────────────────────────────────────────────────────────────
# BusinessProfile
# ─────────────────────────────────────────────────────────────

@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    list_display = ("business_name", "gstin", "phone", "email", "state", "created_at")
    search_fields = ("business_name", "gstin", "phone", "email")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Business Information", {
            "fields": ("business_name", "gstin", "phone", "email", "address", "state", "state_code"),
        }),
        ("Bank Details", {
            "fields": ("bank_name", "bank_branch", "bank_account_number", "bank_ifsc"),
        }),
        ("Terms", {
            "fields": ("terms_and_conditions",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


# ─────────────────────────────────────────────────────────────
# Customer
# ─────────────────────────────────────────────────────────────

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "gstin", "phone", "email", "state", "created_at")
    search_fields = ("name", "gstin", "phone", "email")
    list_filter = ("state",)
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Customer Information", {
            "fields": ("name", "address", "gstin", "state", "state_code"),
        }),
        ("Contact", {
            "fields": ("phone", "email"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


# ─────────────────────────────────────────────────────────────
# InvoiceItem (inline for Invoice admin)
# ─────────────────────────────────────────────────────────────

class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    fields = ("serial_number", "product_name", "hsn_code", "quantity", "unit", "rate", "amount")
    ordering = ("serial_number",)


# ─────────────────────────────────────────────────────────────
# Invoice
# ─────────────────────────────────────────────────────────────

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number",
        "customer",
        "invoice_date",
        "transaction_type",
        "status",
        "taxable_amount",
        "total_amount",
        "created_at",
    )
    list_filter = ("invoice_date", "transaction_type", "status", "reverse_charge")
    search_fields = ("invoice_number", "customer__name", "customer__gstin")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "invoice_date"
    inlines = [InvoiceItemInline]
    fieldsets = (
        ("Invoice Identification", {
            "fields": ("invoice_number", "invoice_date", "status", "transaction_type"),
        }),
        ("Parties", {
            "fields": ("business", "customer"),
        }),
        ("Transport", {
            "fields": ("transport_name", "vehicle_number"),
        }),
        ("Tax Details", {
            "fields": (
                "taxable_amount",
                "cgst_rate", "cgst_amount",
                "sgst_rate", "sgst_amount",
                "igst_rate", "igst_amount",
                "tcs_rate", "tcs_amount",
                "reverse_charge",
                "total_amount",
                "amount_in_words",
            ),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


# ─────────────────────────────────────────────────────────────
# InvoiceItem (standalone — useful for debugging)
# ─────────────────────────────────────────────────────────────

@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ("invoice", "serial_number", "product_name", "hsn_code", "quantity", "unit", "rate", "amount")
    search_fields = ("product_name", "hsn_code", "invoice__invoice_number")
    list_filter = ("unit",)
    readonly_fields = ("created_at",)
