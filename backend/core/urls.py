"""
core/urls.py

URL routing for the core application.

These paths are prefixed with /api/ from config/api_urls.py.
"""

from django.urls import path

from .views import (
    BusinessProfileViewSet, 
    CustomerViewSet, 
    InvoiceViewSet, 
    DashboardAPIView,
    GoogleDriveOAuthStartView,
    GoogleDriveOAuthCallbackView,
    GoogleDriveStatusView,
    GSTVerifyTestView
)

# ── Dashboard ──────────────────────────────────────────────
dashboard_view = DashboardAPIView.as_view()

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
]
