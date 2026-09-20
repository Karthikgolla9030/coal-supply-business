from decimal import Decimal
import datetime
from django.db.models import Sum, Avg, Count, F, Q
from django.db.models.functions import Coalesce, TruncMonth
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils.timezone import now

from .models import Purchase, Sale, Expense, Customer, Supplier

class BusinessDashboardAPIView(APIView):
    """
    Returns aggregated metrics for the Business Dashboard and P&L.
    Enforces strict business isolation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, "business_profile"):
            return Response({"detail": "Business profile required."}, status=status.HTTP_400_BAD_REQUEST)
            
        biz = request.user.business_profile
        
        # ── Date Filtering ──────────────────────────────────────────
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        
        # Base QuerySets isolated to the business
        purchases_qs = Purchase.objects.filter(business=biz, is_active=True)
        sales_qs = Sale.objects.filter(business=biz, is_active=True)
        expenses_qs = Expense.objects.filter(business=biz, is_active=True)
        
        # Current Stock calculation ALWAYS ignores date filter to reflect absolute reality
        total_purchased_all = purchases_qs.aggregate(total=Sum('quantity_tons'))['total'] or Decimal('0.000')
        total_sold_all = sales_qs.aggregate(total=Sum('quantity_tons'))['total'] or Decimal('0.000')
        current_stock = total_purchased_all - total_sold_all
        
        # Apply Date Filters for Period Metrics
        if start_date:
            purchases_qs = purchases_qs.filter(purchase_date__gte=start_date)
            sales_qs = sales_qs.filter(sale_date__gte=start_date)
            expenses_qs = expenses_qs.filter(expense_date__gte=start_date)
        if end_date:
            purchases_qs = purchases_qs.filter(purchase_date__lte=end_date)
            sales_qs = sales_qs.filter(sale_date__lte=end_date)
            expenses_qs = expenses_qs.filter(expense_date__lte=end_date)
            
        # ── Purchases ───────────────────────────────────────────────
        purchases_aggr = purchases_qs.aggregate(
            qty=Sum('quantity_tons'),
            value=Sum('purchase_amount'),
            gst=Sum('gst_amount')
        )
        purchased_qty = purchases_aggr['qty'] or Decimal('0.000')
        purchase_value = purchases_aggr['value'] or Decimal('0.00')
        purchase_gst = purchases_aggr['gst'] or Decimal('0.00')
        
        avg_purchase_rate = Decimal('0.00')
        if purchased_qty > 0:
            avg_purchase_rate = (purchase_value / purchased_qty).quantize(Decimal('0.00'))
            
        # ── Sales ───────────────────────────────────────────────────
        sales_aggr = sales_qs.aggregate(
            qty=Sum('quantity_tons'),
            value=Sum('sale_amount'),
            gst=Sum('gst_amount')
        )
        sold_qty = sales_aggr['qty'] or Decimal('0.000')
        sales_value = sales_aggr['value'] or Decimal('0.00')
        sales_gst = sales_aggr['gst'] or Decimal('0.00')
        
        avg_selling_rate = Decimal('0.00')
        if sold_qty > 0:
            avg_selling_rate = (sales_value / sold_qty).quantize(Decimal('0.00'))
            
        # ── Expenses ────────────────────────────────────────────────
        expenses_total = expenses_qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        # Expense Breakdown
        expense_breakdown = {}
        for cat in expenses_qs.values('category').annotate(total=Sum('amount')).order_by('-total'):
            expense_breakdown[cat['category']] = cat['total']
            
        # ── Profit Calculations ──────────────────────────────────────
        # COGS Estimation: Tons Sold * Average Purchase Rate
        estimated_cogs = (sold_qty * avg_purchase_rate).quantize(Decimal('0.00'))
        
        gross_profit = sales_value - estimated_cogs
        net_profit = gross_profit - expenses_total
        
        gross_margin = Decimal('0.00')
        net_margin = Decimal('0.00')
        if sales_value > 0:
            gross_margin = ((gross_profit / sales_value) * 100).quantize(Decimal('0.00'))
            net_margin = ((net_profit / sales_value) * 100).quantize(Decimal('0.00'))
            
        # ── Summaries & Top Lists ────────────────────────────────────
        # Top Customers (by Sales Value)
        top_customers = list(
            sales_qs.values('customer__name')
            .annotate(total=Sum('sale_amount'))
            .order_by('-total')[:5]
        )
        
        # Top Suppliers (by Purchase Value)
        top_suppliers = list(
            purchases_qs.values('supplier__name')
            .annotate(total=Sum('purchase_amount'))
            .order_by('-total')[:5]
        )
        
        # Recent Activity (Stitch together)
        recent_activity = []
        
        # Fetch up to 5 recent of each, then sort in memory
        recent_purchases = purchases_qs.select_related('supplier').order_by('-purchase_date', '-created_at')[:5]
        for p in recent_purchases:
            recent_activity.append({
                "type": "PURCHASE",
                "date": p.purchase_date,
                "amount": p.purchase_amount,
                "quantity": p.quantity_tons,
                "party": p.supplier.name if p.supplier else "Unknown",
                "id": p.id
            })
            
        recent_sales = sales_qs.select_related('customer').order_by('-sale_date', '-created_at')[:5]
        for s in recent_sales:
            recent_activity.append({
                "type": "SALE",
                "date": s.sale_date,
                "amount": s.sale_amount,
                "quantity": s.quantity_tons,
                "party": s.customer.name if s.customer else "Unknown",
                "id": s.id
            })
            
        recent_expenses = expenses_qs.order_by('-expense_date', '-created_at')[:5]
        for e in recent_expenses:
            recent_activity.append({
                "type": "EXPENSE",
                "date": e.expense_date,
                "amount": e.amount,
                "quantity": None,
                "party": e.category,
                "id": e.id
            })
            
        # Sort descending by date
        recent_activity.sort(key=lambda x: x['date'], reverse=True)
        recent_activity = recent_activity[:10] # Top 10 overall
        
        # ── Monthly Trend (P&L Chart) ────────────────────────────────
        # A simple iteration over the last 6 months based on end_date (or today)
        trend_end_date = datetime.date.today()
        if end_date:
            try:
                trend_end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            except:
                pass
                
        trend_data = []
        for i in range(5, -1, -1):
            target_month = (trend_end_date.month - i - 1) % 12 + 1
            target_year = trend_end_date.year + ((trend_end_date.month - i - 1) // 12)
            
            m_sales = sales_qs.filter(sale_date__year=target_year, sale_date__month=target_month).aggregate(total=Sum('sale_amount'))['total'] or Decimal('0.00')
            m_expenses = expenses_qs.filter(expense_date__year=target_year, expense_date__month=target_month).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            
            trend_data.append({
                "month": datetime.date(target_year, target_month, 1).strftime("%b %Y"),
                "sales": m_sales,
                "expenses": m_expenses
            })

        return Response({
            "financials": {
                "sales_value": sales_value,
                "purchase_cost": purchase_value, # True total purchased in period
                "estimated_cogs": estimated_cogs,
                "operating_expenses": expenses_total,
                "gross_profit": gross_profit,
                "net_profit": net_profit,
                "gross_margin": gross_margin,
                "net_margin": net_margin,
            },
            "quantities": {
                "purchased": purchased_qty,
                "sold": sold_qty,
                "current_stock": current_stock,
            },
            "rates": {
                "avg_purchase_rate": avg_purchase_rate,
                "avg_selling_rate": avg_selling_rate,
                "avg_margin": avg_selling_rate - avg_purchase_rate if avg_purchase_rate > 0 and avg_selling_rate > 0 else Decimal('0.00')
            },
            "gst": {
                "purchase_gst": purchase_gst,
                "sales_gst": sales_gst,
                "difference": sales_gst - purchase_gst
            },
            "summaries": {
                "top_customers": top_customers,
                "top_suppliers": top_suppliers,
                "expense_breakdown": expense_breakdown
            },
            "recent_activity": recent_activity,
            "trend_data": trend_data
        })
