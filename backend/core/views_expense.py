from decimal import Decimal
import datetime
from django.db.models import Sum, Q
from rest_framework import permissions, status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .pagination import StandardResultsSetPagination

from .models import Expense
from .serializers import ExpenseListSerializer, ExpenseDetailSerializer

class ExpenseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Business Expenses.
    Isolated to the authenticated user's business profile.
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    filterset_fields = ["category", "is_active", "supplier", "customer", "purchase", "sale"]
    search_fields = ["description", "paid_to", "reference_no"]
    ordering_fields = ["expense_date", "amount", "category", "created_at"]
    ordering = ["-expense_date", "-created_at"]

    def get_queryset(self):
        if not hasattr(self.request.user, "business_profile"):
            return Expense.objects.none()
        biz = self.request.user.business_profile
        qs = Expense.objects.filter(business=biz).select_related(
            "supplier", "customer", "purchase", "sale"
        )
        
        # Filter by Date Range (using query params start_date and end_date)
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        if start_date:
            qs = qs.filter(expense_date__gte=start_date)
        if end_date:
            qs = qs.filter(expense_date__lte=end_date)
            
        return qs

    def get_serializer_class(self):
        if self.action in ["list"]:
            return ExpenseListSerializer
        return ExpenseDetailSerializer

    def perform_create(self, serializer):
        biz = self.request.user.business_profile
        serializer.save(business=biz)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        expense = self.get_object()
        expense.is_active = False
        expense.save()
        return Response({"detail": "Expense archived."})

    @action(detail=False, methods=["get"])
    def summary(self, request):
        if not hasattr(request.user, "business_profile"):
            return Response({"detail": "Business profile required."}, status=status.HTTP_400_BAD_REQUEST)
            
        biz = request.user.business_profile
        qs = Expense.objects.filter(business=biz, is_active=True)

        # Base Totals
        total_expenses = qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # This Month
        today = datetime.date.today()
        this_month_qs = qs.filter(expense_date__year=today.year, expense_date__month=today.month)
        this_month_total = this_month_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Category Breakdown
        category_breakdown = {}
        # We can just fetch all amounts per category. Since it's SME data, doing it dynamically is fine.
        # Group by category
        cat_aggregates = qs.values('category').annotate(total=Sum('amount')).order_by('-total')
        for cat in cat_aggregates:
            category_breakdown[cat['category']] = cat['total']

        # Monthly Summary (last 6 months or simple breakdown)
        monthly_summary = {}
        for m in range(1, 13):
            # A simple loop over current year months for demo. 
            # Realistically, we'd do a TruncMonth, but this works well enough for now.
            m_qs = qs.filter(expense_date__year=today.year, expense_date__month=m)
            m_total = m_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            if m_total > 0:
                monthly_summary[f"{today.year}-{m:02d}"] = m_total

        return Response({
            "total_expenses": total_expenses,
            "this_month": this_month_total,
            "category_breakdown": category_breakdown,
            "monthly_summary": monthly_summary
        })
