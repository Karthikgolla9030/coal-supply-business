"""
core/admin.py

Django Admin configuration for core business models.
"""

from django.contrib import admin

from .models import BusinessProfile, Customer, Supplier, Purchase, Sale, Expense, Invoice, InvoiceItem, LedgerEntry, LedgerPayment


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
# Supplier
# ─────────────────────────────────────────────────────────────

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "gstin", "state", "is_active", "created_at")
    search_fields = ("name", "phone", "gstin", "aadhaar_no")
    list_filter = ("state", "is_active")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Supplier Information", {
            "fields": ("business", "name", "address", "state", "pincode", "notes", "is_active"),
        }),
        ("Identifiers & Contact", {
            "fields": ("phone", "gstin", "aadhaar_no"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


# ─────────────────────────────────────────────────────────────
# Purchase
# ─────────────────────────────────────────────────────────────

@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("purchase_date", "supplier", "purchase_order_no", "truck_no", "quantity_tons", "total_amount", "is_active")
    search_fields = ("supplier__name", "purchase_order_no", "serial_no", "truck_no")
    list_filter = ("purchase_date", "is_active", "supplier")
    readonly_fields = ("purchase_amount", "gst_amount", "total_amount", "created_at", "updated_at")
    fieldsets = (
        ("Purchase Information", {
            "fields": ("business", "supplier", "purchase_date", "is_active"),
        }),
        ("Delivery Details", {
            "fields": ("purchase_order_no", "serial_no", "truck_no"),
        }),
        ("Quantities & Rates", {
            "fields": ("quantity_tons", "rate_per_ton", "purchase_amount"),
        }),
        ("Tax & Totals", {
            "fields": ("gst_rate", "gst_amount", "total_amount"),
        }),
        ("Notes & Timestamps", {
            "fields": ("notes", "created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

# ─────────────────────────────────────────────────────────────
# Sale
# ─────────────────────────────────────────────────────────────

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("sale_date", "customer", "sale_order_no", "truck_no", "quantity_tons", "total_amount", "is_active")
    search_fields = ("customer__name", "sale_order_no", "serial_no", "truck_no")
    list_filter = ("sale_date", "is_active", "customer")
    readonly_fields = ("sale_amount", "gst_amount", "total_amount", "created_at", "updated_at")
    fieldsets = (
        ("Sale Information", {
            "fields": ("business", "customer", "sale_date", "is_active"),
        }),
        ("Delivery Details", {
            "fields": ("sale_order_no", "serial_no", "truck_no"),
        }),
        ("Quantities & Rates", {
            "fields": ("quantity_tons", "rate_per_ton", "sale_amount"),
        }),
        ("Tax & Totals", {
            "fields": ("gst_rate", "gst_amount", "total_amount"),
        }),
        ("Notes & Timestamps", {
            "fields": ("notes", "created_at", "updated_at"),
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
# Expense
# ─────────────────────────────────────────────────────────────

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("id", "business", "expense_date", "category", "amount", "paid_to", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("description", "paid_to", "reference_no")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Expense Details", {
            "fields": ("business", "expense_date", "category", "description", "amount", "paid_to", "reference_no"),
        }),
        ("Relationships", {
            "fields": ("supplier", "customer", "purchase", "sale"),
        }),
        ("Additional Information", {
            "fields": ("notes", "is_active"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

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
