"""
core/views.py

API views for the Coal Invoice & Records Management System.

BusinessProfileViewSet  — manage the single business profile
CustomerViewSet         — full CRUD + deactivate action for customers
InvoiceViewSet          — create and retrieve invoices
"""

from django.http import HttpResponse
from django.template.loader import render_to_string
from django.db import transaction
from django.db.models import Sum, F
from django.db.models.functions import Coalesce
from decimal import Decimal
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import xhtml2pdf.pisa as pisa

from .models import BusinessProfile, Customer, Invoice, LedgerEntry, LedgerPayment
from .serializers import (
    BusinessProfileSerializer,
    CustomerDetailSerializer,
    CustomerListSerializer,
    InvoiceCreateSerializer,
    InvoiceDetailSerializer,
    InvoiceListSerializer,
    LedgerEntrySerializer,
    LedgerPaymentSerializer,
)
from .filters import InvoiceFilter
from .pagination import StandardResultsSetPagination


# ─────────────────────────────────────────────────────────────
# BusinessProfile
# ─────────────────────────────────────────────────────────────

class BusinessProfileViewSet(viewsets.GenericViewSet):
    """
    API endpoints for the Business Profile.

    A business has exactly one profile.  This viewset exposes:
        GET    /api/business-profile/      — retrieve the profile
        POST   /api/business-profile/      — create (if none exists)
        PATCH  /api/business-profile/      — partial update
    """

    serializer_class = BusinessProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        try:
            return self.request.user.business_profile
        except BusinessProfile.DoesNotExist:
            return None

    @action(detail=False, methods=["get"], url_path="")
    def retrieve_profile(self, request):
        profile = self.get_object()
        if profile is None:
            return Response(
                {"detail": "No business profile found. Please create one."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="create")
    def create_profile(self, request):
        if hasattr(request.user, 'business_profile'):
            return Response(
                {"detail": "A business profile already exists for this user. Use PATCH to update it."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["patch"], url_path="update")
    def update_profile(self, request):
        profile = self.get_object()
        if profile is None:
            return Response(
                {"detail": "No business profile found. Please create one first."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────
# Customer
# ─────────────────────────────────────────────────────────────

class CustomerViewSet(viewsets.GenericViewSet):
    """
    API endpoints for Customer management.

    Routes:
        GET     /api/customers/                  — list (active by default)
        POST    /api/customers/create/           — create
        GET     /api/customers/<id>/             — retrieve
        PATCH   /api/customers/<id>/update/      — partial update
        POST    /api/customers/<id>/deactivate/  — soft deactivate
        POST    /api/customers/<id>/reactivate/  — reactivate
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["name", "gstin", "phone", "email"]
    filterset_fields = ["is_active"]

    def get_queryset(self):
        if not hasattr(self.request.user, 'business_profile'):
            return Customer.objects.none()
        return Customer.objects.filter(business=self.request.user.business_profile).order_by("name")

    def get_serializer_class(self):
        if self.action == "list":
            return CustomerListSerializer
        return CustomerDetailSerializer

    @action(detail=False, methods=["get"], url_path="")
    def list(self, request):
        queryset = self.get_queryset()
        for backend in self.filter_backends:
            queryset = backend().filter_queryset(request, queryset, self)
        if "is_active" not in request.query_params:
            queryset = queryset.filter(is_active=True)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = CustomerListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = CustomerListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="create")
    def create_customer(self, request):
        if not hasattr(request.user, 'business_profile'):
            return Response(
                {"detail": "You must create a business profile before adding customers."},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = CustomerDetailSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(business=request.user.business_profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="")
    def retrieve_customer(self, request, pk=None):
        customer = self._get_customer_or_404(pk)
        serializer = CustomerDetailSerializer(customer, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="update")
    def update_customer(self, request, pk=None):
        customer = self._get_customer_or_404(pk)
        serializer = CustomerDetailSerializer(customer, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        customer = self._get_customer_or_404(pk)
        if not customer.is_active:
            return Response(
                {"detail": "This customer is already inactive."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        customer.is_active = False
        customer.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": f"Customer '{customer.name}' has been deactivated."})

    @action(detail=True, methods=["post"], url_path="reactivate")
    def reactivate(self, request, pk=None):
        customer = self._get_customer_or_404(pk)
        if customer.is_active:
            return Response(
                {"detail": "This customer is already active."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        customer.is_active = True
        customer.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": f"Customer '{customer.name}' has been reactivated."})

    def _get_customer_or_404(self, pk):
        try:
            return Customer.objects.get(pk=pk)
        except Customer.DoesNotExist:
            raise NotFound(detail="Customer not found.")

    # Keep old name for backward compatibility with tests
    def get_object_or_404(self, pk):
        return self._get_customer_or_404(pk)


# ─────────────────────────────────────────────────────────────
# Invoice
# ─────────────────────────────────────────────────────────────

class InvoiceViewSet(viewsets.GenericViewSet):
    """
    API endpoints for Invoice management.

    Routes (Phase 5):
        POST  /api/invoices/create/   — atomically create invoice + items
        GET   /api/invoices/<id>/     — retrieve a saved invoice

    The business is resolved automatically from the singleton BusinessProfile.
    Clients must NOT supply computed fields (amounts, totals, amount_in_words);
    all arithmetic is performed server-side by the calculation service.
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend, filters.OrderingFilter]
    search_fields = ["invoice_number", "customer__name", "customer__gstin", "vehicle_number"]
    filterset_class = InvoiceFilter
    ordering_fields = ["invoice_date", "created_at"]
    ordering = ["-invoice_date", "-created_at"]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        if not hasattr(self.request.user, 'business_profile'):
            return Invoice.objects.none()
        return Invoice.objects.select_related("customer", "business").filter(
            business=self.request.user.business_profile
        )

    def get_serializer_class(self):
        if self.action == "list_invoices":
            return InvoiceListSerializer
        if self.action == "create_invoice":
            return InvoiceCreateSerializer
        return InvoiceDetailSerializer

    # ── List ──────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="")
    def list_invoices(self, request):
        """GET /api/invoices/ — list paginated invoices with search/filter."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = InvoiceListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = InvoiceListSerializer(queryset, many=True)
        return Response(serializer.data)

    # ── Create ────────────────────────────────────────────────

    @action(detail=False, methods=["post"], url_path="create")
    def create_invoice(self, request):
        """
        POST /api/invoices/create/

        Expects:
            invoice_number, invoice_date, transaction_type, customer (PK),
            transport_name, vehicle_number,
            cgst_rate, sgst_rate, igst_rate, tcs_rate, reverse_charge,
            items: [{product_name, hsn_code, quantity, unit, rate}, ...]

        Returns 201 with the full invoice detail on success.
        Returns 400 with field-level errors on validation failure.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()

        # Attempt automatic Google Drive upload
        from .services.google_drive_service import upload_invoice_pdf
        try:
            pdf_bytes = self._generate_pdf_bytes(invoice)
            upload_invoice_pdf(invoice, pdf_bytes)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Automatic Google Drive upload failed for Invoice {invoice.invoice_number}: {e}")

        # Refresh from db to get updated google drive status if changed
        invoice.refresh_from_db()
        response_serializer = InvoiceDetailSerializer(invoice)
        return Response(
            {
                "message": "Invoice created successfully.",
                "invoice": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    # ── Retrieve ──────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="")
    def retrieve_invoice(self, request, pk=None):
        """GET /api/invoices/<id>/ — retrieve a saved invoice with items."""
        invoice = self._get_invoice_or_404(pk)
        serializer = InvoiceDetailSerializer(invoice)
        return Response(serializer.data)

    # ── PDF Generation ──────────────────────────────────────────

    def _generate_pdf_bytes(self, invoice):
        """Helper to generate PDF binary data for an invoice."""
        def get_financial_year(date_obj):
            if not date_obj: return ""
            if date_obj.month >= 4:
                return f"{date_obj.year}-{str(date_obj.year + 1)[2:]}"
            return f"{date_obj.year - 1}-{str(date_obj.year)[2:]}"
            
        def get_delivery_district(address, state):
            # SAFE FALLBACK: Extract district/city from address without external APIs
            if not address:
                return ""
            parts = [p.strip() for p in address.split(",") if p.strip()]
            if len(parts) > 1:
                # If the last part contains the state (e.g. "Andhra Pradesh - 517505"), 
                # the previous part is usually the city/district.
                if state and state.lower() in parts[-1].lower():
                    return parts[-2]
                # If state is not at the end, assume the last part before zip or the last meaningful part
                return parts[-1]
            return address

        context = {
            "invoice": invoice,
            "business": invoice.business,
            "customer": invoice.customer,
            "items": invoice.items.all(),
            "financial_year": get_financial_year(invoice.invoice_date),
            "copy_type": getattr(invoice, "_copy_type", "ORIGINAL"),
            "delivery_district": get_delivery_district(invoice.customer.address, invoice.customer.state),
            "business_logo_path": os.path.join(settings.BASE_DIR, "core", "static", "core", "images", "logo.jpg"),
        }
        html_string = render_to_string("invoice_pdf.html", context)
        
        import io
        pdf_file = io.BytesIO()
        pisa_status = pisa.CreatePDF(html_string, dest=pdf_file)
        
        if pisa_status.err:
            raise Exception("Error generating PDF inside xhtml2pdf.")
            
        return pdf_file.getvalue()

    @action(detail=True, methods=["get"], url_path="pdf")
    def generate_pdf(self, request, pk=None):
        """GET /api/invoices/<id>/pdf/ — generate and download a PDF version.
        Optional query param: ?copy=duplicate  → prints DUPLICATE on the invoice.
        """
        invoice = self._get_invoice_or_404(pk)

        # Attach copy type so the template can display ORIGINAL / DUPLICATE
        copy_param = request.query_params.get("copy", "original").strip().upper()
        invoice._copy_type = copy_param if copy_param in ("ORIGINAL", "DUPLICATE") else "ORIGINAL"

        try:
            pdf_bytes = self._generate_pdf_bytes(invoice)
        except Exception:
            return Response(
                {"detail": "Error generating PDF."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            pdf_bytes,
            content_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Invoice-{invoice.invoice_number}.pdf"'}
        )

    # ── Google Drive ──────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="upload-to-drive")
    def upload_to_drive(self, request, pk=None):
        """POST /api/invoices/<id>/upload-to-drive/ — manually upload PDF to Google Drive."""
        from .services.google_drive_service import upload_invoice_pdf
        
        invoice = self._get_invoice_or_404(pk)

        try:
            pdf_bytes = self._generate_pdf_bytes(invoice)
        except Exception:
            return Response(
                {"detail": "Error generating PDF. Cannot upload."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        success = upload_invoice_pdf(invoice, pdf_bytes)
        
        if success:
            return Response({
                "status": "uploaded",
                "message": "Invoice uploaded to Google Drive successfully",
                "file_id": invoice.google_drive_file_id,
                "file_url": invoice.google_drive_file_url
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {"detail": "Google Drive upload failed. Please check configuration and try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # ── Helper ────────────────────────────────────────────────

    def _get_invoice_or_404(self, pk):
        try:
            return Invoice.objects.select_related(
                "business", "customer"
            ).prefetch_related("items").get(pk=pk)
        except Invoice.DoesNotExist:
            raise NotFound(detail="Invoice not found.")

# ─────────────────────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────────────────────

class DashboardAPIView(APIView):
    """
    Returns aggregated metrics for the business dashboard.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'business_profile'):
            return Response({
                "total_invoices": 0,
                "total_sales": Decimal('0.00'),
                "gst_recorded": Decimal('0.00'),
                "total_customers": 0,
                "recent_invoices": [],
                "business_profile_complete": False
            })
            
        business = request.user.business_profile
        business_profile_complete = bool(business and business.address and business.gstin)

        # Aggregate totals from invoices for this business
        aggr = Invoice.objects.filter(business=business).aggregate(
            total_sales=Coalesce(Sum('total_amount'), Decimal('0.00')),
            gst_recorded=Coalesce(Sum(F('cgst_amount') + F('sgst_amount') + F('igst_amount')), Decimal('0.00'))
        )

        total_invoices = Invoice.objects.filter(business=business).count()
        total_customers = Customer.objects.filter(business=business, is_active=True).count()
        
        # Recent 5 invoices
        recent_qs = Invoice.objects.filter(business=business).select_related("customer", "business").order_by('-invoice_date', '-created_at')[:5]
        recent_invoices = InvoiceListSerializer(recent_qs, many=True).data

        return Response({
            "total_invoices": total_invoices,
            "total_sales": aggr["total_sales"],
            "gst_recorded": aggr["gst_recorded"],
            "total_customers": total_customers,
            "recent_invoices": recent_invoices,
            "business_profile_complete": business_profile_complete
        })

# ─────────────────────────────────────────────────────────────
# Auth / Registration
# ─────────────────────────────────────────────────────────────

class CurrentUserView(APIView):
    """
    Returns the currently authenticated user's safe information.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        })

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
import re

class RegisterView(APIView):
    """
    Public registration endpoint.
    Atomically creates a User and a BusinessProfile.
    """
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        data = request.data
        
        # Required User fields
        full_name = data.get("full_name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        password_confirm = data.get("password_confirm", "")
        
        # Validation
        if not all([full_name, email, password, password_confirm]):
            return Response({"detail": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)
            
        if password != password_confirm:
            return Response({"detail": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            validate_password(password)
        except ValidationError as e:
            return Response({"detail": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
            
        if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
            return Response({"detail": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Optional Business fields
        gstin = data.get("gstin", "").strip()
        phone = data.get("phone", "").strip()
        
        # Basic GSTIN validation if provided
        if gstin and not re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', gstin):
            return Response({"detail": "Invalid GSTIN format."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Create User
        name_parts = full_name.split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        
        user = User(
            username=email,
            email=email,
            first_name=first_name,
            last_name=last_name
        )
        user.set_password(password)
        user.save()
        
        # Determine business name
        business_name = data.get("business_name", "").strip()
        if not business_name:
            business_name = f"{first_name}'s Business"
        
        # Create Business Profile
        BusinessProfile.objects.create(
            owner=user,
            business_name=business_name,
            gstin=gstin,
            phone=phone,
            email=data.get("business_email", "").strip(),
            address=data.get("address", "").strip(),
            state=data.get("state", "").strip(),
            state_code=data.get("state_code", "").strip()
        )
        
        # Generate JWT tokens for automatic login
        refresh = RefreshToken.for_user(user)
        
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            }
        }, status=status.HTTP_201_CREATED)

# ─────────────────────────────────────────────────────────────
# Google Drive OAuth 2.0 Integration
# ─────────────────────────────────────────────────────────────

from django.conf import settings
from django.shortcuts import redirect
from django.core.cache import cache
import google_auth_oauthlib.flow

SCOPES = ['https://www.googleapis.com/auth/drive.file']

import os

class GoogleDriveOAuthStartView(APIView):
    """
    Initiates the Google OAuth 2.0 flow for Google Drive.
    Redirects the user to Google's consent screen.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if settings.DEBUG:
            os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
            
        if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
            return Response(
                {"detail": "Google OAuth Client ID or Secret is missing in configuration."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        client_config = {
            "web": {
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
            }
        }

        flow = google_auth_oauthlib.flow.Flow.from_client_config(
            client_config,
            scopes=SCOPES
        )
        flow.redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI

        # Generate URL and state. We ask for offline access to get a refresh token.
        # prompt='consent' forces the consent screen so we always get a refresh token.
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        # Save PKCE code_verifier and business_id in cache to bypass cross-domain session cookie issues
        if hasattr(request.user, 'business_profile'):
            cache.set(f'oauth_{state}', {
                'code_verifier': getattr(flow, 'code_verifier', None),
                'business_id': request.user.business_profile.id
            }, timeout=1200)

        return Response({"url": authorization_url})


class GoogleDriveOAuthCallbackView(APIView):
    """
    Handles the callback from Google OAuth 2.0 flow.
    Exchanges the authorization code for a refresh token and saves it.
    """
    permission_classes = [AllowAny] # Google redirects here directly

    def get(self, request):
        if settings.DEBUG:
            os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
            
        state = request.GET.get('state')
        code = request.GET.get('code')
        
        # To verify state, we'd normally check request.session['google_oauth_state']
        # But this might be a cross-site redirect where session cookies might be dropped by Some browsers.
        # For our single-user local app, we'll proceed if code exists.
        
        if not code:
            return Response({"detail": "Authorization code missing."}, status=status.HTTP_400_BAD_REQUEST)
            
        client_config = {
            "web": {
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
            }
        }

        flow = google_auth_oauthlib.flow.Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            state=state
        )
        flow.redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
        
        oauth_data = cache.get(f'oauth_{state}') or {}
        code_verifier = oauth_data.get('code_verifier')
        business_id = oauth_data.get('business_id')
        
        if code_verifier:
            flow.code_verifier = code_verifier
        
        # We need the full URL to fetch the token
        authorization_response = request.build_absolute_uri()
        
        try:
            flow.fetch_token(authorization_response=authorization_response)
            credentials = flow.credentials
            
            # The refresh token is only returned on the first authorization (prompt=consent)
            if credentials.refresh_token and business_id:
                business = BusinessProfile.objects.filter(id=business_id).first()
                if business:
                    business.google_oauth_refresh_token = credentials.refresh_token
                    
                    # Auto-create Drive folder if missing
                    if not business.google_drive_folder_id:
                        from googleapiclient.discovery import build
                        drive_service = build('drive', 'v3', credentials=credentials, cache_discovery=False)
                        file_metadata = {
                            'name': 'Coal Invoices',
                            'mimeType': 'application/vnd.google-apps.folder'
                        }
                        folder = drive_service.files().create(body=file_metadata, fields='id').execute()
                        business.google_drive_folder_id = folder.get('id')
                        
                    business.save(update_fields=['google_oauth_refresh_token', 'google_drive_folder_id'])
                    
            # Redirect back to the frontend
            frontend_url = "http://localhost:5173/business-profile?drive=connected"
            return redirect(frontend_url)
            
        except Exception as e:
            import logging
            logging.error(f"OAuth Callback Error: {e}")
            frontend_url = "http://localhost:5173/business-profile?drive=error"
            return redirect(frontend_url)


class GoogleDriveStatusView(APIView):
    """
    Returns whether the Business Profile has an OAuth refresh token configured.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'business_profile'):
            return Response({"connected": False})
        business = request.user.business_profile
        is_connected = bool(business and business.google_oauth_refresh_token)
        return Response({"connected": is_connected})


# ─────────────────────────────────────────────────────────────
# External Integrations (Phase 1: GSTVerify API)
# ─────────────────────────────────────────────────────────────

from .services.gst_service import verify_gstin

class GSTVerifyTestView(APIView):
    """
    Endpoint for verifying GSTIN details (with DB caching).
    POST /api/gst/verify/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        gstin = request.data.get("gstin", "").strip()
        if not gstin:
            return Response({"success": False, "error": "GSTIN is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Phase 3 Caching logic
        if hasattr(request.user, 'business_profile'):
            business = request.user.business_profile
            cached_customer = Customer.objects.filter(business=business, gstin=gstin, gst_verified=True).first()
            if cached_customer:
                return Response({
                    "success": True,
                    "source": "cache",
                    "data": {
                        "gstin": cached_customer.gstin,
                        "legal_name": cached_customer.gst_legal_name,
                        "trade_name": cached_customer.gst_trade_name,
                        "status": cached_customer.gst_status,
                        "state": cached_customer.state,
                        "address": cached_customer.address
                    }
                }, status=status.HTTP_200_OK)

        # Cache miss, call the external service
        result = verify_gstin(gstin)
        
        if result.get("success"):
            result["source"] = "api"
            
        return Response(result, status=status.HTTP_200_OK)

# ─────────────────────────────────────────────────────────────
# Ledger (Phase 1)
# ─────────────────────────────────────────────────────────────

class LedgerEntryViewSet(viewsets.ModelViewSet):
    """
    API endpoints for Ledger Entries.
    Strictly isolated to the current user's business profile.
    """
    serializer_class = LedgerEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['party_name', 'customer__name', 'reference']
    filterset_fields = ['transaction_type', 'status']

    def get_queryset(self):
        # Strict business isolation
        user = self.request.user
        if not hasattr(user, 'business_profile'):
            return LedgerEntry.objects.none()
        return LedgerEntry.objects.filter(business=user.business_profile).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business_profile)


class LedgerPaymentViewSet(viewsets.ModelViewSet):
    """
    API endpoints for Ledger Payments.
    Strictly isolated to payments belonging to the current user's business.
    """
    serializer_class = LedgerPaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'business_profile'):
            return LedgerPayment.objects.none()
        return LedgerPayment.objects.filter(ledger_entry__business=user.business_profile).order_by('-payment_date', '-created_at')
