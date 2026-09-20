"""
core/urls.py

URL routing for the core application.

These paths are prefixed with /api/ from config/api_urls.py.
"""

from django.urls import path

from .views import (
    BusinessProfileViewSet, 
    CustomerViewSet, 
    SupplierViewSet,
    PurchaseViewSet,
    SaleViewSet,
    InvoiceViewSet, 
    DashboardAPIView,
    GoogleDriveOAuthStartView,
    GoogleDriveOAuthCallbackView,
    GoogleDriveStatusView,
    GSTVerifyTestView,
    LedgerEntryViewSet,
    LedgerPaymentViewSet,
    LedgerDashboardAPIView,
    TransactionHistoryAPIView,
    ReportAPIView,
    ReportExportAPIView
)
from .views_stock import StockAPIView
from .views_expense import ExpenseViewSet
from .views_business_dashboard import BusinessDashboardAPIView
from .views_business_reports import BusinessReportAPIView

# ── Dashboard ──────────────────────────────────────────────
dashboard_view = DashboardAPIView.as_view()
business_dashboard_view = BusinessDashboardAPIView.as_view()

# ── Business Profile (singleton resource) ──────────────────
business_profile_list = BusinessProfileViewSet.as_view({"get": "retrieve_profile"})
business_profile_create = BusinessProfileViewSet.as_view({"post": "create_profile"})
business_profile_update = BusinessProfileViewSet.as_view({"patch": "update_profile"})

# ── Customers ──────────────────────────────────────────────
customer_list       = CustomerViewSet.as_view({"get": "list"})
customer_create     = CustomerViewSet.as_view({"post": "create_customer"})
customer_detail     = CustomerViewSet.as_view({"get": "retrieve_customer"})
customer_update     = CustomerViewSet.as_view({"patch": "update_customer"})
customer_deactivate = CustomerViewSet.as_view({"post": "deactivate"})
customer_reactivate = CustomerViewSet.as_view({"post": "reactivate"})
customer_ledger_history = CustomerViewSet.as_view({"get": "ledger_history"})
customer_sale_summary = CustomerViewSet.as_view({"get": "sale_summary"})

# ── Suppliers ──────────────────────────────────────────────
supplier_list       = SupplierViewSet.as_view({"get": "list"})
supplier_create     = SupplierViewSet.as_view({"post": "create_supplier"})
supplier_detail     = SupplierViewSet.as_view({"get": "retrieve_supplier"})
supplier_update     = SupplierViewSet.as_view({"patch": "update_supplier"})
supplier_deactivate = SupplierViewSet.as_view({"post": "deactivate"})
supplier_reactivate = SupplierViewSet.as_view({"post": "reactivate"})
supplier_purchase_summary = SupplierViewSet.as_view({"get": "purchase_summary"})

# ── Purchases ──────────────────────────────────────────────
purchase_list       = PurchaseViewSet.as_view({"get": "list"})
purchase_create     = PurchaseViewSet.as_view({"post": "create_purchase"})
purchase_detail     = PurchaseViewSet.as_view({"get": "retrieve_purchase"})
purchase_update     = PurchaseViewSet.as_view({"patch": "update_purchase"})
purchase_archive    = PurchaseViewSet.as_view({"post": "archive"})
purchase_summary    = PurchaseViewSet.as_view({"get": "summary"})

# ── Sales ──────────────────────────────────────────────────
sale_list           = SaleViewSet.as_view({"get": "list_sales"})
sale_create         = SaleViewSet.as_view({"post": "create_sale"})
sale_detail         = SaleViewSet.as_view({"get": "retrieve_sale"})
sale_update         = SaleViewSet.as_view({"patch": "update_sale"})
sale_archive        = SaleViewSet.as_view({"post": "archive"})
sale_summary        = SaleViewSet.as_view({"get": "summary"})

# ── Invoices ───────────────────────────────────────────────
invoice_list    = InvoiceViewSet.as_view({"get": "list_invoices"})
invoice_create  = InvoiceViewSet.as_view({"post": "create_invoice"})
invoice_detail  = InvoiceViewSet.as_view({"get": "retrieve_invoice"})
invoice_pdf     = InvoiceViewSet.as_view({"get": "generate_pdf"})
invoice_upload_drive = InvoiceViewSet.as_view({"post": "upload_to_drive"})

# ── Google Drive OAuth ─────────────────────────────────────
google_drive_oauth_start = GoogleDriveOAuthStartView.as_view()
google_drive_oauth_callback = GoogleDriveOAuthCallbackView.as_view()
google_drive_status = GoogleDriveStatusView.as_view()

# ── Ledger (Phase 1) ───────────────────────────────────────
ledger_entry_list = LedgerEntryViewSet.as_view({"get": "list", "post": "create"})
ledger_entry_detail = LedgerEntryViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy"
})
ledger_entry_void = LedgerEntryViewSet.as_view({"post": "void"})
ledger_entry_audit_history = LedgerEntryViewSet.as_view({"get": "audit_history"})

ledger_payment_list = LedgerPaymentViewSet.as_view({"get": "list", "post": "create"})
ledger_payment_detail = LedgerPaymentViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy"
})
ledger_payment_void = LedgerPaymentViewSet.as_view({"post": "void"})

urlpatterns = [
    # Dashboard
    path("dashboard/", dashboard_view, name="dashboard"),

    # Business Profile
    path("business-profile/",        business_profile_list,   name="business-profile-retrieve"),
    path("business-profile/create/", business_profile_create, name="business-profile-create"),
    path("business-profile/update/", business_profile_update, name="business-profile-update"),

    # Customers
    path("customers/",                      customer_list,       name="customer-list"),
    path("customers/create/",               customer_create,     name="customer-create"),
    path("customers/<int:pk>/",             customer_detail,     name="customer-detail"),
    path("customers/<int:pk>/update/",      customer_update,     name="customer-update"),
    path("customers/<int:pk>/deactivate/",  customer_deactivate, name="customer-deactivate"),
    path("customers/<int:pk>/reactivate/",  customer_reactivate, name="customer-reactivate"),
    path("customers/<int:pk>/ledger-history/", customer_ledger_history, name="customer-ledger-history"),
    path("customers/<int:pk>/sale-summary/", customer_sale_summary, name="customer-sale-summary"),

    # Business Dashboard & Reports
    path("business-dashboard/", business_dashboard_view, name="business-dashboard"),
    path("business-reports/", BusinessReportAPIView.as_view(), name="business-reports"),

    # Suppliers
    path("suppliers/",                      supplier_list,       name="supplier-list"),
    path("suppliers/create/",               supplier_create,     name="supplier-create"),
    path("suppliers/<int:pk>/",             supplier_detail,     name="supplier-detail"),
    path("suppliers/<int:pk>/update/",      supplier_update,     name="supplier-update"),
    path("suppliers/<int:pk>/deactivate/",  supplier_deactivate, name="supplier-deactivate"),
    path("suppliers/<int:pk>/reactivate/",  supplier_reactivate, name="supplier-reactivate"),
    path("suppliers/<int:pk>/purchase-summary/", supplier_purchase_summary, name="supplier-purchase-summary"),

    # Purchases
    path("purchases/",                      purchase_list,       name="purchase-list"),
    path("purchases/create/",               purchase_create,     name="purchase-create"),
    path("purchases/summary/",              purchase_summary,    name="purchase-summary"),
    path("purchases/<int:pk>/",             purchase_detail,     name="purchase-detail"),
    path("purchases/<int:pk>/update/",      purchase_update,     name="purchase-update"),
    path("purchases/<int:pk>/archive/",     purchase_archive,    name="purchase-archive"),

    # Sales
    path("sales/",                          sale_list,           name="sale-list"),
    path("sales/create/",                   sale_create,         name="sale-create"),
    path("sales/summary/",                  sale_summary,        name="sale-summary"),
    path("sales/<int:pk>/",                 sale_detail,         name="sale-detail"),
    path("sales/<int:pk>/update/",          sale_update,         name="sale-update"),
    path("sales/<int:pk>/archive/",         sale_archive,        name="sale-archive"),

    # Expenses
    path("expenses/", ExpenseViewSet.as_view({"get": "list", "post": "create"}), name="expense-list"),
    path("expenses/summary/", ExpenseViewSet.as_view({"get": "summary"}), name="expense-summary"),
    path("expenses/<int:pk>/", ExpenseViewSet.as_view({"get": "retrieve", "patch": "partial_update", "put": "update"}), name="expense-detail"),
    path("expenses/<int:pk>/archive/", ExpenseViewSet.as_view({"post": "archive"}), name="expense-archive"),

    # Stock
    path("stock/summary/", StockAPIView.as_view({"get": "summary"}), name="stock-summary"),
    path("stock/movements/", StockAPIView.as_view({"get": "movements"}), name="stock-movements"),

    # Invoices
    path("invoices/",              invoice_list,   name="invoice-list"),
    path("invoices/create/",       invoice_create, name="invoice-create"),
    path("invoices/<int:pk>/",     invoice_detail, name="invoice-detail"),
    path("invoices/<int:pk>/pdf/", invoice_pdf,    name="invoice-pdf"),
    path("invoices/<int:pk>/upload-to-drive/", invoice_upload_drive, name="invoice-upload-drive"),

    # Google Drive OAuth
    path("google-drive/oauth/start/", google_drive_oauth_start, name="google-drive-oauth-start"),
    path("google-drive/oauth/callback/", google_drive_oauth_callback, name="google-drive-oauth-callback"),
    path("google-drive/status/", google_drive_status, name="google-drive-status"),
    
    # External API Integrations (Phase 1)
    path("gst/verify/", GSTVerifyTestView.as_view(), name="gst-verify-test"),

    # Ledger Entries
    path("ledger/dashboard/", LedgerDashboardAPIView.as_view(), name="ledger-dashboard"),
    path("ledger/history/", TransactionHistoryAPIView.as_view(), name="ledger-history"),
    path("ledger-entries/", ledger_entry_list, name="ledger-entry-list"),
    path("ledger-entries/<int:pk>/", ledger_entry_detail, name="ledger-entry-detail"),
    path("ledger-entries/<int:pk>/void/", ledger_entry_void, name="ledger-entry-void"),
    path("ledger-entries/<int:pk>/audit_history/", ledger_entry_audit_history, name="ledger-entry-audit-history"),

    # Ledger Payments
    path("ledger-payments/", ledger_payment_list, name="ledger-payment-list"),
    path("ledger-payments/<int:pk>/", ledger_payment_detail, name="ledger-payment-detail"),
    path("ledger-payments/<int:pk>/void/", ledger_payment_void, name="ledger-payment-void"),

    # Reports (Phase 7)
    path("reports/", ReportAPIView.as_view(), name="report-list"),
    path("reports/export/<str:format>/", ReportExportAPIView.as_view(), name="report-export"),
]
