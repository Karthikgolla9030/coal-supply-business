"""
core/views.py

API views for the Coal Invoice & Records Management System.

BusinessProfileViewSet  — manage the single business profile
CustomerViewSet         — full CRUD + deactivate action for customers
InvoiceViewSet          — create and retrieve invoices
"""

from django.http import HttpResponse
from django.template.loader import render_to_string
from django.db import transaction, models
from django.db.models import Sum, F, OuterRef, Subquery, DecimalField, Q, Count
from django.db.models.functions import Coalesce
from decimal import Decimal
from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import xhtml2pdf.pisa as pisa

from .models import (
    BusinessProfile, 
    Customer, 
    Supplier, 
    Purchase,
    Sale,
    Invoice, 
    InvoiceItem,
    InvoiceStatus,
    LedgerEntry, 
    LedgerPayment, 
    AuditLog
)
from .serializers import (
    BusinessProfileSerializer,
    CustomerDetailSerializer,
    CustomerListSerializer,
    SupplierListSerializer,
    SupplierDetailSerializer,
    PurchaseListSerializer,
    PurchaseDetailSerializer,
    SaleListSerializer,
    SaleDetailSerializer,
    InvoiceCreateSerializer,
    InvoiceDetailSerializer,
    InvoiceListSerializer,
    LedgerEntrySerializer,
    LedgerPaymentSerializer,
    AuditLogSerializer
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
    filterset_fields = ["is_active", "party_type"]

    def get_queryset(self):
        if not hasattr(self.request.user, 'business_profile'):
            return Customer.objects.none()
        
        business = self.request.user.business_profile
        
        receivable_invoiced_subquery = LedgerEntry.objects.filter(
            customer=OuterRef('pk'),
            transaction_type='RECEIVABLE'
        ).exclude(status='VOIDED').values('customer').annotate(
            total=Sum('amount')
        ).values('total')
        
        receivable_paid_subquery = LedgerPayment.objects.filter(
            ledger_entry__customer=OuterRef('pk'),
            ledger_entry__transaction_type='RECEIVABLE'
        ).exclude(status='VOIDED').values('ledger_entry__customer').annotate(
            total=Sum('amount')
        ).values('total')
        
        payable_invoiced_subquery = LedgerEntry.objects.filter(
            customer=OuterRef('pk'),
            transaction_type='PAYABLE'
        ).exclude(status='VOIDED').values('customer').annotate(
            total=Sum('amount')
        ).values('total')
        
        payable_paid_subquery = LedgerPayment.objects.filter(
            ledger_entry__customer=OuterRef('pk'),
            ledger_entry__transaction_type='PAYABLE'
        ).exclude(status='VOIDED').values('ledger_entry__customer').annotate(
            total=Sum('amount')
        ).values('total')

        return Customer.objects.filter(business=business).annotate(
            total_receivable=Coalesce(Subquery(receivable_invoiced_subquery, output_field=DecimalField()), Decimal('0.00')),
            total_received=Coalesce(Subquery(receivable_paid_subquery, output_field=DecimalField()), Decimal('0.00')),
            total_payable=Coalesce(Subquery(payable_invoiced_subquery, output_field=DecimalField()), Decimal('0.00')),
            total_paid=Coalesce(Subquery(payable_paid_subquery, output_field=DecimalField()), Decimal('0.00'))
        ).order_by("name")

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
        customer.save()
        return Response({"detail": "Customer reactivated successfully."})

    @action(detail=True, methods=["get"], url_path="sale-summary")
    def sale_summary(self, request, pk=None):
        customer = self._get_customer_or_404(pk)
        totals = Sale.objects.filter(customer=customer, is_active=True).aggregate(
            total_sales=models.Count('id'),
            total_tons=models.Sum('quantity_tons'),
            total_sale_value=models.Sum('sale_amount'),
            total_gst=models.Sum('gst_amount'),
            total_including_gst=models.Sum('total_amount')
        )
        return Response({
            "total_sales": totals["total_sales"] or 0,
            "total_tons": totals["total_tons"] or Decimal('0.000'),
            "total_sale_value": totals["total_sale_value"] or Decimal('0.00'),
            "total_gst": totals["total_gst"] or Decimal('0.00'),
            "total_including_gst": totals["total_including_gst"] or Decimal('0.00'),
        })

    @action(detail=True, methods=["get"], url_path="ledger-history")
    def ledger_history(self, request, pk=None):
        customer = self._get_customer_or_404(pk)
        
        # 1. Fetch all ledger entries for this party
        entries = LedgerEntry.objects.filter(
            customer=customer
        ).order_by("created_at")
        
        # 2. Fetch all payments against those entries
        payments = LedgerPayment.objects.filter(
            ledger_entry__in=entries
        ).order_by("payment_date", "created_at")
        
        # We will unify them into a chronological timeline array.
        timeline = []
        
        for e in entries:
            timeline.append({
                "type": "ENTRY",
                "transaction_type": e.transaction_type,
                "id": e.id,
                "invoice_id": e.invoice.id if getattr(e, 'invoice', None) else None,
                "date": e.created_at.date().isoformat(), # approximate for invoice date if invoice is None
                "real_date": getattr(getattr(e, 'invoice', None), 'invoice_date', e.created_at.date()).isoformat(),
                "amount": e.amount,
                "paid_amount": e.get_paid_amount(),
                "remaining_amount": e.get_remaining_amount(),
                "status": e.status,
                "reference": e.reference,
                "created_at": e.created_at.isoformat()
            })
            
        for p in payments:
            timeline.append({
                "type": "PAYMENT",
                "transaction_type": p.ledger_entry.transaction_type,
                "id": p.id,
                "ledger_entry_id": p.ledger_entry.id,
                "date": p.payment_date.isoformat(),
                "real_date": p.payment_date.isoformat(),
                "amount": p.amount,
                "payment_method": p.payment_method,
                "notes": p.notes,
                "created_at": p.created_at.isoformat()
            })
            
        # Sort chronologically by real_date, then created_at to break ties
        timeline.sort(key=lambda x: (x["real_date"], x["created_at"]))
        
        return Response(timeline)

    def _get_customer_or_404(self, pk):
        try:
            return self.get_queryset().get(pk=pk)
        except Customer.DoesNotExist:
            raise NotFound("Customer not found or you don't have permission to view it.")

    # Keep old name for backward compatibility with tests
    def get_object_or_404(self, pk):
        return self._get_customer_or_404(pk)


# ─────────────────────────────────────────────────────────────
# Supplier
# ─────────────────────────────────────────────────────────────

class SupplierViewSet(viewsets.GenericViewSet):
    """
    API endpoints for Supplier management.

    Routes:
        GET     /api/suppliers/                  — list (active by default)
        POST    /api/suppliers/create/           — create
        GET     /api/suppliers/<id>/             — retrieve
        PATCH   /api/suppliers/<id>/update/      — partial update
        POST    /api/suppliers/<id>/deactivate/  — soft deactivate
        POST    /api/suppliers/<id>/reactivate/  — reactivate
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["name", "gstin", "phone", "aadhaar_no"]
    filterset_fields = ["is_active", "state"]

    def get_queryset(self):
        if not hasattr(self.request.user, 'business_profile'):
            return Supplier.objects.none()
        
        business = self.request.user.business_profile
        return Supplier.objects.filter(business=business).order_by("name")

    def get_serializer_class(self):
        if self.action == "list":
            return SupplierListSerializer
        return SupplierDetailSerializer

    @action(detail=False, methods=["get"], url_path="")
    def list(self, request):
        queryset = self.get_queryset()
        for backend in self.filter_backends:
            queryset = backend().filter_queryset(request, queryset, self)
        if "is_active" not in request.query_params:
            queryset = queryset.filter(is_active=True)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = SupplierListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = SupplierListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="create")
    def create_supplier(self, request):
        if not hasattr(request.user, 'business_profile'):
            return Response(
                {"detail": "You must create a business profile before adding suppliers."},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = SupplierDetailSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(business=request.user.business_profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="")
    def retrieve_supplier(self, request, pk=None):
        supplier = self._get_supplier_or_404(pk)
        serializer = SupplierDetailSerializer(supplier, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="update")
    def update_supplier(self, request, pk=None):
        supplier = self._get_supplier_or_404(pk)
        serializer = SupplierDetailSerializer(supplier, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        supplier = self._get_supplier_or_404(pk)
        if not supplier.is_active:
            return Response(
                {"detail": "This supplier is already inactive."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        supplier.is_active = False
        supplier.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": f"Supplier '{supplier.name}' has been deactivated."})

    @action(detail=True, methods=["post"], url_path="reactivate")
    def reactivate(self, request, pk=None):
        supplier = self._get_supplier_or_404(pk)
        if supplier.is_active:
            return Response(
                {"detail": "This supplier is already active."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        supplier.is_active = True
        supplier.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": "Supplier reactivated successfully."})

    @action(detail=True, methods=["get"], url_path="purchase-summary")
    def purchase_summary(self, request, pk=None):
        supplier = self._get_supplier_or_404(pk)
        totals = Purchase.objects.filter(supplier=supplier, is_active=True).aggregate(
            total_purchases=models.Count('id'),
            total_tons=models.Sum('quantity_tons'),
            total_purchase_value=models.Sum('purchase_amount'),
            total_gst=models.Sum('gst_amount'),
            total_including_gst=models.Sum('total_amount')
        )
        return Response({
            "total_purchases": totals["total_purchases"] or 0,
            "total_tons": totals["total_tons"] or Decimal('0.000'),
            "total_purchase_value": totals["total_purchase_value"] or Decimal('0.00'),
            "total_gst": totals["total_gst"] or Decimal('0.00'),
            "total_including_gst": totals["total_including_gst"] or Decimal('0.00'),
        })

    def _get_supplier_or_404(self, pk):
        try:
            return self.get_queryset().get(pk=pk)
        except Supplier.DoesNotExist:
            raise NotFound("Supplier not found or you don't have permission to view it.")


# ─────────────────────────────────────────────────────────────
# Purchase
# ─────────────────────────────────────────────────────────────

class PurchaseViewSet(viewsets.GenericViewSet):
    """
    API endpoints for Purchase management.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend, filters.OrderingFilter]
    search_fields = ["supplier__name", "purchase_order_no", "serial_no", "truck_no"]
    filterset_fields = {
        "supplier": ["exact"],
        "is_active": ["exact"],
        "purchase_date": ["gte", "lte", "exact"]
    }
    ordering_fields = ["purchase_date", "quantity_tons", "purchase_amount", "created_at"]
    ordering = ["-purchase_date", "-created_at"]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        if not hasattr(self.request.user, 'business_profile'):
            return Purchase.objects.none()
        
        business = self.request.user.business_profile
        return Purchase.objects.select_related("supplier").filter(business=business)

    def get_serializer_class(self):
        if self.action in ["list", "summary"]:
            return PurchaseListSerializer
        return PurchaseDetailSerializer

    @action(detail=False, methods=["get"], url_path="")
    def list(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        if "is_active" not in request.query_params:
            queryset = queryset.filter(is_active=True)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = PurchaseListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = PurchaseListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="create")
    def create_purchase(self, request):
        if not hasattr(request.user, 'business_profile'):
            return Response(
                {"detail": "Business profile required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = PurchaseDetailSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        # Verify supplier belongs to this business
        supplier_id = request.data.get('supplier')
        if not Supplier.objects.filter(id=supplier_id, business=request.user.business_profile).exists():
            return Response({"detail": "Invalid supplier selected."}, status=status.HTTP_400_BAD_REQUEST)
            
        serializer.save(business=request.user.business_profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="")
    def retrieve_purchase(self, request, pk=None):
        purchase = self._get_purchase_or_404(pk)
        serializer = PurchaseDetailSerializer(purchase, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="update")
    def update_purchase(self, request, pk=None):
        purchase = self._get_purchase_or_404(pk)
        
        if 'supplier' in request.data:
            supplier_id = request.data.get('supplier')
            if not Supplier.objects.filter(id=supplier_id, business=request.user.business_profile).exists():
                return Response({"detail": "Invalid supplier selected."}, status=status.HTTP_400_BAD_REQUEST)
                
        serializer = PurchaseDetailSerializer(purchase, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        purchase = self._get_purchase_or_404(pk)
        if not purchase.is_active:
            return Response({"detail": "Already archived."}, status=status.HTTP_400_BAD_REQUEST)
        purchase.is_active = False
        purchase.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": "Purchase archived successfully."})

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        if "is_active" not in request.query_params:
            queryset = queryset.filter(is_active=True)
            
        totals = queryset.aggregate(
            total_purchases=Count('id'),
            total_tons=models.Sum('quantity_tons'),
            total_purchase_value=models.Sum('purchase_amount'),
            total_gst=models.Sum('gst_amount'),
            total_including_gst=models.Sum('total_amount')
        )
        
        return Response({
            "total_purchases": totals["total_purchases"] or 0,
            "total_tons": totals["total_tons"] or Decimal('0.000'),
            "total_purchase_value": totals["total_purchase_value"] or Decimal('0.00'),
            "total_gst": totals["total_gst"] or Decimal('0.00'),
            "total_including_gst": totals["total_including_gst"] or Decimal('0.00'),
        })

    def _get_purchase_or_404(self, pk):
        try:
            return self.get_queryset().get(pk=pk)
        except Purchase.DoesNotExist:
            raise NotFound("Purchase not found or access denied.")


# ─────────────────────────────────────────────────────────────
# Sale
# ─────────────────────────────────────────────────────────────

class SaleViewSet(viewsets.GenericViewSet):
    """
    Manage coal sales strictly for the authenticated user's business.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend, filters.OrderingFilter]
    pagination_class = StandardResultsSetPagination
    
    filterset_fields = {
        'customer': ['exact'],
        'is_active': ['exact'],
        'sale_date': ['exact', 'gte', 'lte'],
    }
    search_fields = ['customer__name', 'sale_order_no', 'serial_no', 'truck_no']
    ordering_fields = ['sale_date', 'created_at', 'quantity_tons', 'sale_amount']
    ordering = ['-sale_date', '-created_at']

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'business_profile'):
            return Sale.objects.none()
            
        return Sale.objects.filter(
            business=user.business_profile
        ).select_related('customer')

    @action(detail=False, methods=["get"], url_path="")
    def list_sales(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        
        # Exclude inactive by default unless explicitly requested
        is_active = request.query_params.get('is_active')
        if is_active is None:
            queryset = queryset.filter(is_active=True)
            
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = SaleListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = SaleListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="create")
    def create_sale(self, request):
        if not hasattr(request.user, 'business_profile'):
            return Response(
                {"detail": "You must create a business profile before adding sales."},
                status=status.HTTP_400_BAD_REQUEST
            )
        with transaction.atomic():
            serializer = SaleDetailSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            sale = serializer.save(business=request.user.business_profile)
            
            # Auto-create synced LedgerEntry
            from core.models import LedgerEntry
            LedgerEntry.objects.create(
                business=sale.business,
                transaction_type='RECEIVABLE',
                customer=sale.customer,
                party_name=sale.customer.name if sale.customer else '',
                amount=sale.total_amount,
                tcs_rate=sale.tcs_rate,
                tcs_amount=sale.tcs_amount,
                sale_order_no=sale.sale_order_no,
                serial_no=sale.serial_no,
                truck_no=sale.truck_no,
                entry_date=sale.sale_date,
                tons=sale.quantity_tons,
                sale=sale,
                status='PENDING',
                reference=f"Auto-generated for Sale #{sale.id}"
            )
            
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="")
    def retrieve_sale(self, request, pk=None):
        sale = self._get_sale_or_404(pk)
        serializer = SaleDetailSerializer(sale, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="update")
    def update_sale(self, request, pk=None):
        sale = self._get_sale_or_404(pk)
        if not sale.is_active:
             return Response(
                {"detail": "Cannot edit an archived sale."},
                status=status.HTTP_400_BAD_REQUEST
            )
        with transaction.atomic():
            serializer = SaleDetailSerializer(sale, data=request.data, partial=True, context={'request': request})
            serializer.is_valid(raise_exception=True)
            sale = serializer.save()
            
            # Auto-sync LedgerEntry if it exists
            if hasattr(sale, 'ledger_entry') and sale.ledger_entry:
                ledger = sale.ledger_entry
                if ledger.status != 'VOIDED':
                    ledger.customer = sale.customer
                    ledger.party_name = sale.customer.name if sale.customer else ''
                    ledger.amount = sale.total_amount
                    ledger.sale_order_no = sale.sale_order_no
                    ledger.serial_no = sale.serial_no
                    ledger.truck_no = sale.truck_no
                    ledger.entry_date = sale.sale_date
                    ledger.tons = sale.quantity_tons
                    ledger.save()
                    
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        sale = self._get_sale_or_404(pk)
        if not sale.is_active:
            return Response(
                {"detail": "This sale is already archived."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            sale.is_active = False
            sale.save(update_fields=["is_active", "updated_at"])
            
            # Auto-void LedgerEntry to preserve payment history
            if hasattr(sale, 'ledger_entry') and sale.ledger_entry:
                ledger = sale.ledger_entry
                if ledger.status != 'VOIDED':
                    ledger.status = 'VOIDED'
                    ledger.save(update_fields=["status", "updated_at"])
                    
        return Response({"detail": "Sale archived successfully."})

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Returns aggregate totals for the current filtered queryset."""
        queryset = self.filter_queryset(self.get_queryset())
        
        is_active = request.query_params.get('is_active')
        if is_active is None:
            queryset = queryset.filter(is_active=True)
            
        totals = queryset.aggregate(
            total_sales=Count('id'),
            total_tons=models.Sum('quantity_tons'),
            total_sale_value=models.Sum('sale_amount'),
            total_gst=models.Sum('gst_amount'),
            total_including_gst=models.Sum('total_amount')
        )
        
        return Response({
            "total_sales": totals["total_sales"] or 0,
            "total_tons": totals["total_tons"] or Decimal('0.000'),
            "total_sale_value": totals["total_sale_value"] or Decimal('0.00'),
            "total_gst": totals["total_gst"] or Decimal('0.00'),
            "total_including_gst": totals["total_including_gst"] or Decimal('0.00'),
        })

    def _get_sale_or_404(self, pk):
        try:
            return self.get_queryset().get(pk=pk)
        except Sale.DoesNotExist:
            raise NotFound("Sale not found or you don't have permission to view it.")


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
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"detail": f"Error generating PDF: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return HttpResponse(
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
# Password Reset (Forgot Password / Confirm Reset)
# ─────────────────────────────────────────────────────────────

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from rest_framework.throttling import ScopedRateThrottle

class PasswordResetRequestView(APIView):
    """
    Public endpoint to initiate a password reset.
    Rate-limited to 5 requests per minute to prevent brute-force / email bombing.
    Returns 200 generic message whether the email exists or not to prevent user enumeration.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        
        if not email or "@" not in email:
            return Response(
                {"detail": "Please enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST
            )

        generic_message = (
            "If an account exists with this email, a password reset link has been sent."
        )

        user = User.objects.filter(
            Q(email__iexact=email) | Q(username__iexact=email),
            is_active=True
        ).first()

        if user and user.email:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
            reset_url = f"{frontend_url}/reset-password/{uid}/{token}"
            
            timeout_seconds = getattr(settings, "PASSWORD_RESET_TIMEOUT", 3600)
            expiry_hours = max(1, timeout_seconds // 3600)

            context = {
                "user_name": user.get_full_name() or user.username,
                "user_email": user.email,
                "reset_url": reset_url,
                "expiry_hours": expiry_hours,
            }

            try:
                html_content = render_to_string("emails/password_reset_email.html", context)
                text_content = render_to_string("emails/password_reset_email.txt", context)
                
                msg = EmailMultiAlternatives(
                    subject="Reset your Coal Invoice password",
                    body=text_content,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.email],
                )
                msg.attach_alternative(html_content, "text/html")
                msg.send(fail_silently=False)
            except Exception as e:
                # Log error internally without leaking details to response
                print(f"[PasswordReset] Error sending email to {user.email}: {e}")

        return Response({"detail": generic_message}, status=status.HTTP_200_OK)


class PasswordResetValidateTokenView(APIView):
    """
    Public endpoint to validate a reset token before displaying the reset form.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        uid = request.query_params.get("uid", "").strip()
        token = request.query_params.get("token", "").strip()

        if not uid or not token:
            return Response(
                {"valid": False, "detail": "Reset link is missing required parameters."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            uid_decoded = force_str(urlsafe_base64_decode(uid))
            user = User.objects.filter(pk=uid_decoded, is_active=True).first()
        except (TypeError, ValueError, OverflowError):
            user = None

        if user and default_token_generator.check_token(user, token):
            return Response({
                "valid": True,
                "detail": "Token is valid.",
                "email": user.email
            }, status=status.HTTP_200_OK)

        return Response({
            "valid": False,
            "detail": "This password reset link is invalid or has expired."
        }, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    """
    Public endpoint to confirm password reset with new password.
    Enforces password validation rules and automatically invalidates token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        uid = data.get("uid", "").strip()
        token = data.get("token", "").strip()
        password = data.get("password", "")
        password_confirm = data.get("password_confirm", "")

        if not all([uid, token, password, password_confirm]):
            return Response(
                {"detail": "All fields are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if password != password_confirm:
            return Response(
                {"detail": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            uid_decoded = force_str(urlsafe_base64_decode(uid))
            user = User.objects.filter(pk=uid_decoded, is_active=True).first()
        except (TypeError, ValueError, OverflowError):
            user = None

        if not user or not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "This password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate password using Django's configured password validators
        try:
            validate_password(password, user=user)
        except ValidationError as e:
            return Response(
                {"detail": " ".join(e.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set and save new password
        user.set_password(password)
        user.save()

        return Response(
            {"detail": "Your password has been reset successfully."},
            status=status.HTTP_200_OK
        )

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
    search_fields = ['party_name', 'customer__name', 'reference', 'sale_order_no', 'purchase_order_no']
    filterset_fields = ['transaction_type', 'status', 'customer']

    def get_queryset(self):
        # Strict business isolation
        user = self.request.user
        if not hasattr(user, 'business_profile'):
            return LedgerEntry.objects.none()
        return LedgerEntry.objects.filter(business=user.business_profile).order_by('-created_at')

    def perform_create(self, serializer):
        with transaction.atomic():
            entry = serializer.save(business=self.request.user.business_profile)
            
            # Auto-create synced Sale if it's a Receivable and not already linked
            if entry.transaction_type == 'RECEIVABLE' and not getattr(entry, 'sale', None):
                from core.models import Sale
                from decimal import Decimal
                sale = Sale.objects.create(
                    business=entry.business,
                    customer=entry.customer,
                    sale_date=entry.entry_date,
                    sale_order_no=entry.sale_order_no,
                    serial_no=entry.serial_no,
                    truck_no=entry.truck_no,
                    quantity_tons=entry.tons or Decimal('0.000'),
                    rate_per_ton=Decimal('0.00'),
                    sale_amount=entry.amount - (entry.tcs_amount or Decimal('0.00')),
                    total_amount=entry.amount,
                    gst_amount=Decimal('0.00'),
                    tcs_rate=entry.tcs_rate or Decimal('0.00'),
                    tcs_amount=entry.tcs_amount or Decimal('0.00'),
                    notes=f"Auto-generated for Ledger Entry #{entry.id}"
                )
                entry.sale = sale
                entry.save(update_fields=['sale'])
                
            AuditLog.objects.create(
                business=entry.business,
                user=self.request.user,
                action="Ledger entry created",
                record_type="LedgerEntry",
                record_id=entry.id,
                details={"amount": str(entry.amount), "transaction_type": entry.transaction_type}
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            entry = serializer.save()
            
            # Auto-sync Sale if it exists
            if entry.transaction_type == 'RECEIVABLE' and getattr(entry, 'sale', None):
                from decimal import Decimal
                sale = entry.sale
                if sale.is_active:
                    sale.customer = entry.customer
                    sale.total_amount = entry.amount
                    sale.sale_amount = entry.amount
                    sale.sale_order_no = entry.sale_order_no
                    sale.serial_no = entry.serial_no
                    sale.truck_no = entry.truck_no
                    sale.sale_date = entry.entry_date
                    sale.quantity_tons = entry.tons or Decimal('0.000')
                    sale.save()

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        with transaction.atomic():
            entry = self.get_object()
            if entry.status == 'VOIDED':
                return Response({"detail": "This entry is already voided."}, status=status.HTTP_400_BAD_REQUEST)
            
            entry.status = 'VOIDED'
            entry.save(update_fields=['status', 'updated_at'])
            
            # Auto-void Sale to maintain sync
            if getattr(entry, 'sale', None) and entry.sale.is_active:
                entry.sale.is_active = False
                entry.sale.save(update_fields=['is_active', 'updated_at'])
            
            AuditLog.objects.create(
                business=entry.business,
                user=request.user,
                action="Ledger entry voided",
                record_type="LedgerEntry",
                record_id=entry.id,
            )
            return Response({"status": "Ledger entry voided."})

    @action(detail=True, methods=['get'])
    def audit_history(self, request, pk=None):
        entry = self.get_object()
        # Get logs for the ledger entry and any of its payments
        payment_ids = list(entry.payments.values_list('id', flat=True))
        
        logs = AuditLog.objects.filter(
            Q(record_type='LedgerEntry', record_id=entry.id) |
            Q(record_type='LedgerPayment', record_id__in=payment_ids)
        ).order_by('-timestamp')
        
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)


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
        
        qs = LedgerPayment.objects.filter(ledger_entry__business=user.business_profile).order_by('-payment_date', '-created_at')
        
        ledger_entry_id = self.request.query_params.get('ledger_entry')
        if ledger_entry_id:
            qs = qs.filter(ledger_entry_id=ledger_entry_id)
            
        return qs

    def create(self, request, *args, **kwargs):
        with transaction.atomic():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            ledger_entry_id = request.data.get('ledger_entry')
            # Lock the LedgerEntry
            try:
                ledger_entry = LedgerEntry.objects.select_for_update().get(id=ledger_entry_id, business=request.user.business_profile)
            except LedgerEntry.DoesNotExist:
                return Response({"detail": "Ledger entry not found."}, status=status.HTTP_404_NOT_FOUND)
            
            if ledger_entry.status == 'VOIDED':
                return Response({"detail": "Cannot add payment to a voided ledger entry."}, status=status.HTTP_400_BAD_REQUEST)
            
            payment_amount = Decimal(str(request.data.get('amount', 0)))
            
            if ledger_entry.get_remaining_amount() < payment_amount:
                return Response({"detail": "Payment amount exceeds the remaining ledger balance."}, status=status.HTTP_400_BAD_REQUEST)

            payment = serializer.save()
            
            AuditLog.objects.create(
                business=ledger_entry.business,
                user=request.user,
                action="Payment recorded",
                record_type="LedgerPayment",
                record_id=payment.id,
                details={"amount": str(payment.amount), "method": payment.payment_method}
            )

            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        with transaction.atomic():
            payment = self.get_object()
            if payment.status == 'VOIDED':
                return Response({"detail": "This payment is already voided."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Lock the ledger entry to recalculate safely
            ledger = LedgerEntry.objects.select_for_update().get(id=payment.ledger_entry_id)
            
            payment.status = 'VOIDED'
            payment.save(update_fields=['status'])
            
            # Recalculate ledger entry status
            ledger.update_status()
            
            AuditLog.objects.create(
                business=ledger.business,
                user=request.user,
                action="Payment voided",
                record_type="LedgerPayment",
                record_id=payment.id,
            )
            return Response({"status": "Payment voided."})

class LedgerDashboardAPIView(APIView):
    """
    Returns aggregated metrics for the Financial Dashboard (Phase 5).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'business_profile'):
            return Response({
                "to_receive": 0, "to_pay": 0, "received": 0, "paid": 0, "net_position": 0,
                "outstanding_receivables": [], "outstanding_payables": [],
                "recent_payments": [], "recent_invoices": [],
                "status_distribution": {"PENDING": 0, "PARTIALLY_PAID": 0, "PAID": 0}
            })
            
        business = user.business_profile
        
        # 1. Date Filtering (for Activity: Received, Paid, Recent)
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        start_date = parse_date(start_date_str) if start_date_str else None
        end_date = parse_date(end_date_str) if end_date_str else None
        
        payment_filter = Q(ledger_entry__business=business, status='RECORDED')
        invoice_filter = Q(business=business, status__in=['DRAFT', 'ISSUED'])
        
        if start_date:
            payment_filter &= Q(payment_date__gte=start_date)
            invoice_filter &= Q(invoice_date__gte=start_date)
        if end_date:
            payment_filter &= Q(payment_date__lte=end_date)
            invoice_filter &= Q(invoice_date__lte=end_date)

        # 2. TO RECEIVE & TO PAY (Current Outstanding - independent of date filter)
        # Outstanding is only for active ledger entries
        all_entries = LedgerEntry.objects.filter(business=business).exclude(status='VOIDED')
        to_receive = Decimal('0.00')
        to_pay = Decimal('0.00')
        
        outstanding_receivables = {}
        outstanding_payables = {}

        for e in all_entries:
            rem = e.get_remaining_amount()
            if rem > 0:
                party_name = (e.customer.name if e.customer else e.party_name) or "Unknown Party"
                party_id = e.customer.id if e.customer else None
                
                if e.transaction_type == 'RECEIVABLE':
                    to_receive += rem
                    if party_name not in outstanding_receivables:
                        outstanding_receivables[party_name] = {"party_name": party_name, "customer_id": party_id, "outstanding": Decimal('0.00'), "status": e.status}
                    outstanding_receivables[party_name]["outstanding"] += rem
                    # We just keep the most recent status, or if we want, we could refine this.
                else:
                    to_pay += rem
                    if party_name not in outstanding_payables:
                        outstanding_payables[party_name] = {"party_name": party_name, "customer_id": party_id, "outstanding": Decimal('0.00'), "status": e.status}
                    outstanding_payables[party_name]["outstanding"] += rem

        net_position = to_receive - to_pay

        # Convert dicts to sorted lists
        out_recv_list = sorted(list(outstanding_receivables.values()), key=lambda x: x["outstanding"], reverse=True)
        out_pay_list = sorted(list(outstanding_payables.values()), key=lambda x: x["outstanding"], reverse=True)

        # 3. RECEIVED & PAID (Activity - dependent on date filter)
        payments = LedgerPayment.objects.filter(payment_filter).annotate(
            ttype=F('ledger_entry__transaction_type')
        )
        aggr_payments = payments.values('ttype').annotate(total=Sum('amount'))
        
        received = Decimal('0.00')
        paid = Decimal('0.00')
        for ap in aggr_payments:
            if ap['ttype'] == 'RECEIVABLE':
                received = ap['total'] or Decimal('0.00')
            elif ap['ttype'] == 'PAYABLE':
                paid = ap['total'] or Decimal('0.00')

        # 4. RECENT PAYMENTS
        recent_payments_qs = payments.select_related('ledger_entry', 'ledger_entry__customer').order_by('-payment_date', '-created_at')[:5]
        recent_payments = LedgerPaymentSerializer(recent_payments_qs, many=True).data

        # 5. RECENT INVOICES & STATUS DISTRIBUTION
        invoices = Invoice.objects.filter(invoice_filter)
        recent_invoices_qs = invoices.select_related('customer').order_by('-invoice_date', '-created_at')[:5]
        recent_invoices = InvoiceListSerializer(recent_invoices_qs, many=True).data
        
        status_counts = {"PENDING": 0, "PARTIALLY_PAID": 0, "PAID": 0}
        for inv in invoices:
            # We fetch the ledger status from the annotated property if possible, or just the entry directly.
            # In Phase 3, each invoice creates exactly 1 LedgerEntry.
            try:
                st = inv.ledger_entry.status
                if st in status_counts:
                    status_counts[st] += 1
            except LedgerEntry.DoesNotExist:
                pass # Unlikely but safe

        return Response({
            "to_receive": to_receive,
            "to_pay": to_pay,
            "received": received,
            "paid": paid,
            "net_position": net_position,
            "outstanding_receivables": out_recv_list,
            "outstanding_payables": out_pay_list,
            "recent_payments": recent_payments,
            "recent_invoices": recent_invoices,
            "status_distribution": status_counts
        })

from django.db.models import Value, CharField, DateField
from django.db.models.functions import Coalesce, Cast

class TransactionHistoryAPIView(APIView):
    """
    Returns a paginated, unified history of LedgerEntries and LedgerPayments (Phase 6).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'business_profile'):
            return Response({"results": [], "count": 0})
            
        business = user.business_profile
        
        # Filters
        type_filter = request.query_params.get("type_filter")
        status_filter = request.query_params.get("status_filter")
        party_id = request.query_params.get("party_id")
        search = request.query_params.get("search", "").strip()
        method_filter = request.query_params.get("payment_method")
        
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        start_date = parse_date(start_date_str) if start_date_str else None
        end_date = parse_date(end_date_str) if end_date_str else None

        # Build querysets (no exclusion of VOIDED by default so we can see history)
        entries = LedgerEntry.objects.filter(business=business)
        payments = LedgerPayment.objects.filter(ledger_entry__business=business)
        
        if party_id:
            entries = entries.filter(customer_id=party_id)
            payments = payments.filter(ledger_entry__customer_id=party_id)

        # Apply specific type filters before unifying (for efficiency)
        if type_filter == 'Money to Receive':
            entries = entries.filter(transaction_type='RECEIVABLE')
            payments = LedgerPayment.objects.none()
        elif type_filter == 'Money to Pay':
            entries = entries.filter(transaction_type='PAYABLE')
            payments = LedgerPayment.objects.none()
        elif type_filter == 'Money Received':
            entries = LedgerEntry.objects.none()
            payments = payments.filter(ledger_entry__transaction_type='RECEIVABLE')
        elif type_filter == 'Money Paid':
            entries = LedgerEntry.objects.none()
            payments = payments.filter(ledger_entry__transaction_type='PAYABLE')
            
        if status_filter:
            entries = entries.filter(status=status_filter)
            if status_filter != 'RECORDED':
                payments = LedgerPayment.objects.none()
            else:
                entries = LedgerEntry.objects.none()

        if method_filter:
            entries = LedgerEntry.objects.none() # entries don't have payment method
            payments = payments.filter(payment_method=method_filter)

        # Unify projection
        entries_proj = entries.annotate(
            record_type=Value('ENTRY', output_field=CharField()),
            unified_date=Cast('created_at', output_field=DateField()),
            unified_party_name=Coalesce(F('customer__name'), F('party_name')),
            unified_party_id=F('customer_id'),
            unified_reference=F('reference'),
            unified_amount=F('amount'),
            unified_status=F('status'),
            unified_transaction_type=F('transaction_type'),
            unified_method=Value('', output_field=CharField()),
            unified_invoice_id=F('invoice_id')
        ).values(
            'id', 'record_type', 'unified_date', 'unified_party_name', 'unified_party_id', 
            'unified_reference', 'unified_amount', 'unified_status', 'unified_transaction_type', 
            'unified_method', 'unified_invoice_id'
        )

        payments_proj = payments.annotate(
            record_type=Value('PAYMENT', output_field=CharField()),
            unified_date=F('payment_date'),
            unified_party_name=Coalesce(F('ledger_entry__customer__name'), F('ledger_entry__party_name')),
            unified_party_id=F('ledger_entry__customer_id'),
            unified_reference=F('ledger_entry__reference'),
            unified_amount=F('amount'),
            unified_status=Value('RECORDED', output_field=CharField()),
            unified_transaction_type=F('ledger_entry__transaction_type'),
            unified_method=F('payment_method'),
            unified_invoice_id=F('ledger_entry__invoice_id')
        ).values(
            'id', 'record_type', 'unified_date', 'unified_party_name', 'unified_party_id', 
            'unified_reference', 'unified_amount', 'unified_status', 'unified_transaction_type', 
            'unified_method', 'unified_invoice_id'
        )
        
        # Apply date filter after projection alignment
        union_qs = entries_proj.union(payments_proj)
        
        # We must filter union at the outer level or just apply it to both inner sets before union
        if start_date:
            entries_proj = entries_proj.filter(unified_date__gte=start_date)
            payments_proj = payments_proj.filter(unified_date__gte=start_date)
        if end_date:
            entries_proj = entries_proj.filter(unified_date__lte=end_date)
            payments_proj = payments_proj.filter(unified_date__lte=end_date)
            
        if search:
            entries_proj = entries_proj.filter(Q(unified_party_name__icontains=search) | Q(unified_reference__icontains=search))
            payments_proj = payments_proj.filter(Q(unified_party_name__icontains=search) | Q(unified_reference__icontains=search))
            
        union_qs = entries_proj.union(payments_proj).order_by('-unified_date', '-id')

        # Pagination
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(union_qs, request)
        if page is not None:
            return paginator.get_paginated_response(page)

        return Response(union_qs)

# ─────────────────────────────────────────────────────────────
# Reports & Exports (Phase 7)
# ─────────────────────────────────────────────────────────────
from .services.report_service import get_report_data, generate_pdf_report, generate_excel_report, generate_csv_report

class ReportAPIView(APIView):
    """
    Returns structured JSON data for financial reports.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'business_profile'):
            return Response({"summary": {}, "rows": []})
            
        business = user.business_profile
        report_type = request.query_params.get("report_type", "Financial Summary")
        
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        start_date = parse_date(start_date_str) if start_date_str else None
        end_date = parse_date(end_date_str) if end_date_str else None
        
        party_id = request.query_params.get("party_id")
        payment_method = request.query_params.get("payment_method")
        include_voided = request.query_params.get("include_voided") == "true"

        summary, rows = get_report_data(
            business=business,
            report_type=report_type,
            start_date=start_date,
            end_date=end_date,
            party_id=party_id,
            payment_method=payment_method,
            include_voided=include_voided
        )
        
        # We can implement backend pagination for rows here.
        paginator = StandardResultsSetPagination()
        paginated_rows = paginator.paginate_queryset(rows, request)
        
        if paginated_rows is not None:
            return paginator.get_paginated_response({
                "summary": summary,
                "rows": paginated_rows
            })
            
        return Response({"summary": summary, "rows": rows})


class ReportExportAPIView(APIView):
    """
    Generates and returns PDF, Excel, or CSV exports for financial reports.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        user = request.user
        if not hasattr(user, 'business_profile'):
            return Response({"detail": "No business profile found."}, status=status.HTTP_400_BAD_REQUEST)
            
        business = user.business_profile
        report_type = request.query_params.get("report_type", "Financial Summary")
        
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        start_date = parse_date(start_date_str) if start_date_str else None
        end_date = parse_date(end_date_str) if end_date_str else None
        
        party_id = request.query_params.get("party_id")
        payment_method = request.query_params.get("payment_method")
        include_voided = request.query_params.get("include_voided") == "true"
        
        # A human readable date label
        if start_date and end_date:
            date_range_label = f"{start_date.strftime('%d %b %Y')} - {end_date.strftime('%d %b %Y')}"
        elif start_date:
            date_range_label = f"From {start_date.strftime('%d %b %Y')}"
        elif end_date:
            date_range_label = f"Until {end_date.strftime('%d %b %Y')}"
        else:
            date_range_label = "All Time"

        summary, rows = get_report_data(
            business=business,
            report_type=report_type,
            start_date=start_date,
            end_date=end_date,
            party_id=party_id,
            payment_method=payment_method,
            include_voided=include_voided
        )

        try:
            if format == 'pdf':
                file_bytes = generate_pdf_report(business, report_type, date_range_label, summary, rows)
                content_type = "application/pdf"
                filename = f"{report_type.replace(' ', '_')}_{date_range_label.replace(' ', '')}.pdf"
                
            elif format == 'excel':
                file_bytes = generate_excel_report(business, report_type, date_range_label, summary, rows)
                content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                filename = f"{report_type.replace(' ', '_')}_{date_range_label.replace(' ', '')}.xlsx"
                
            elif format == 'csv':
                file_bytes = generate_csv_report(rows)
                content_type = "text/csv"
                filename = f"{report_type.replace(' ', '_')}_{date_range_label.replace(' ', '')}.csv"
                
            else:
                return Response({"detail": "Invalid export format."}, status=status.HTTP_400_BAD_REQUEST)
                
            return HttpResponse(
                file_bytes,
                content_type=content_type,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )
        except Exception as e:
            return Response({"detail": f"Error generating export: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
