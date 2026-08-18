"""
core/views.py

API views for the Coal Invoice & Records Management System.

BusinessProfileViewSet  — manage the single business profile
CustomerViewSet         — full CRUD + deactivate action for customers
InvoiceViewSet          — create and retrieve invoices
"""

from django.http import HttpResponse
from django.template.loader import render_to_string
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import xhtml2pdf.pisa as pisa

from .models import BusinessProfile, Customer, Invoice
from .serializers import (
    BusinessProfileSerializer,
    CustomerDetailSerializer,
    CustomerListSerializer,
    InvoiceCreateSerializer,
    InvoiceDetailSerializer,
    InvoiceListSerializer,
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
        return BusinessProfile.objects.first()

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
        if BusinessProfile.objects.exists():
            return Response(
                {"detail": "A business profile already exists. Use PATCH to update it."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
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
        return Customer.objects.all().order_by("name")

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
        serializer = CustomerDetailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="")
    def retrieve_customer(self, request, pk=None):
        customer = self._get_customer_or_404(pk)
        serializer = CustomerDetailSerializer(customer)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="update")
    def update_customer(self, request, pk=None):
        customer = self._get_customer_or_404(pk)
        serializer = CustomerDetailSerializer(customer, data=request.data, partial=True)
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
        return Invoice.objects.select_related("customer", "business").all()

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
        serializer = InvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()

        # Attempt automatic Google Drive upload
        from .services.google_drive_service import upload_invoice_pdf
        try:
            pdf_bytes = self._generate_pdf_bytes(invoice)
            upload_invoice_pdf(invoice, pdf_bytes)
        except Exception as e:
            # We explicitly catch all exceptions here so that a failure in PDF generation
            # or Google Drive upload DOES NOT rollback the successfully saved invoice.
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
        context = {
            "invoice": invoice,
            "business": invoice.business,
            "customer": invoice.customer,
            "items": invoice.items.all(),
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
        """GET /api/invoices/<id>/pdf/ — generate and download a PDF version."""
        invoice = self._get_invoice_or_404(pk)

        try:
            pdf_bytes = self._generate_pdf_bytes(invoice)
        except Exception:
            return Response(
                {"detail": "Error generating PDF."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        filename = f"Invoice-{invoice.invoice_number}.pdf"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        return response

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
