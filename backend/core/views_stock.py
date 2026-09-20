from decimal import Decimal
from django.db.models import Sum
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet
from rest_framework.pagination import PageNumberPagination

from .models import Purchase, Sale

class StockPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100

class StockAPIView(ViewSet):
    """
    Derived stock calculations based solely on active Purchases and Sales.
    Does not write to database.
    """
    permission_classes = [permissions.IsAuthenticated]

    def _get_base_querysets(self, user):
        biz = user.business_profile
        purchases = Purchase.objects.filter(business=biz, is_active=True).select_related('supplier')
        sales = Sale.objects.filter(business=biz, is_active=True).select_related('customer')
        return purchases, sales

    @action(detail=False, methods=['get'])
    def summary(self, request):
        if not hasattr(request.user, 'business_profile'):
            return Response({"detail": "Business profile required."}, status=status.HTTP_400_BAD_REQUEST)
            
        purchases, sales = self._get_base_querysets(request.user)
        
        as_of_date = request.query_params.get('as_of_date')
        if as_of_date:
            purchases = purchases.filter(purchase_date__lte=as_of_date)
            sales = sales.filter(sale_date__lte=as_of_date)

        p_agg = purchases.aggregate(
            total_tons=Sum('quantity_tons'),
            total_val=Sum('purchase_amount')
        )
        s_agg = sales.aggregate(
            total_tons=Sum('quantity_tons'),
            total_val=Sum('sale_amount')
        )

        p_tons = p_agg['total_tons'] or Decimal('0.000')
        s_tons = s_agg['total_tons'] or Decimal('0.000')
        p_val = p_agg['total_val'] or Decimal('0.00')
        s_val = s_agg['total_val'] or Decimal('0.00')

        return Response({
            "total_purchased": p_tons,
            "total_sold": s_tons,
            "current_stock": p_tons - s_tons,
            "purchase_value": p_val,
            "sales_value": s_val,
            "as_of_date": as_of_date
        })

    @action(detail=False, methods=['get'])
    def movements(self, request):
        if not hasattr(request.user, 'business_profile'):
            return Response({"detail": "Business profile required."}, status=status.HTTP_400_BAD_REQUEST)
            
        purchases, sales = self._get_base_querysets(request.user)
        
        # Apply date filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            purchases = purchases.filter(purchase_date__gte=start_date)
            sales = sales.filter(sale_date__gte=start_date)
        if end_date:
            purchases = purchases.filter(purchase_date__lte=end_date)
            sales = sales.filter(sale_date__lte=end_date)
            
        # Compile movements
        movements = []
        
        # Include purchases
        for p in purchases:
            movements.append({
                'id': p.id,
                'type': 'PURCHASE',
                'date': p.purchase_date,
                'created_at': p.created_at,
                'party_name': p.supplier.name if p.supplier else None,
                'party_id': p.supplier.id if p.supplier else None,
                'order_no': p.purchase_order_no,
                'truck_no': p.truck_no,
                'quantity': p.quantity_tons,
                'amount': p.purchase_amount,
                'is_active': p.is_active,
            })
            
        # Include sales
        for s in sales:
            movements.append({
                'id': s.id,
                'type': 'SALE',
                'date': s.sale_date,
                'created_at': s.created_at,
                'party_name': s.customer.name if s.customer else None,
                'party_id': s.customer.id if s.customer else None,
                'order_no': s.sale_order_no,
                'truck_no': s.truck_no,
                'quantity': -s.quantity_tons,
                'amount': s.sale_amount,
                'is_active': s.is_active,
            })

        # Sort chronologically to calculate running balance accurately
        movements.sort(key=lambda x: (x['date'], x['created_at']))
        
        # Calculate running balance
        balance = Decimal('0.000')
        for m in movements:
            balance += m['quantity']
            m['balance'] = balance
            
        # Apply filters that shouldn't affect running balance 
        # (Actually, the user expects 'Running Balance' to reflect actual stock at that time. 
        # If we filter by 'search' or 'type', should we show the global balance or the filtered balance?
        # The prompt says: "The balance must be calculated from the actual transaction sequence."
        # Therefore, we calculate balance FIRST across ALL data matching the date range, 
        # THEN apply search/type filters so the balance column remains accurate to reality.)
        
        # 1. Search Filter
        search = request.query_params.get('search', '').lower()
        if search:
            movements = [m for m in movements if (
                (m['party_name'] and search in m['party_name'].lower()) or
                (m['order_no'] and search in m['order_no'].lower()) or
                (m['truck_no'] and search in m['truck_no'].lower())
            )]
            
        # 2. Type Filter
        m_type = request.query_params.get('type')
        if m_type and m_type.upper() in ['PURCHASE', 'SALE']:
            movements = [m for m in movements if m['type'] == m_type.upper()]

        # Sort newest first for display
        movements.reverse()
        
        # Paginate
        paginator = StockPagination()
        page = paginator.paginate_queryset(movements, request, view=self)
        if page is not None:
            return paginator.get_paginated_response(page)
            
        return Response(movements)
