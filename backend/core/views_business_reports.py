import datetime
from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.business_report_service import (
    get_business_report_data,
    generate_business_pdf_report,
    generate_business_csv_report
)

class BusinessReportAPIView(APIView):
    """
    GET /api/business-reports/
    Query Params:
      - type: Purchase Report, Sales Report, Stock Report, Expense Report, Customer Report, Supplier Report, Profit & Loss
      - start_date (optional)
      - end_date (optional)
      - party_id (optional, customer or supplier id)
      - format: json (default), pdf, csv
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, "business_profile"):
            return Response({"detail": "Business profile required."}, status=status.HTTP_400_BAD_REQUEST)
            
        business = request.user.business_profile
        report_type = request.query_params.get("type")
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        party_id = request.query_params.get("party_id")
        fmt = request.query_params.get("format", "json").lower()
        
        valid_reports = [
            "Purchase Report", "Sales Report", "Stock Report", 
            "Expense Report", "Customer Report", "Supplier Report", 
            "Profit & Loss"
        ]
        
        if report_type not in valid_reports:
            return Response({"detail": "Invalid or missing report type."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Parse Dates
        try:
            if start_date:
                datetime.datetime.strptime(start_date, "%Y-%m-%d")
            if end_date:
                datetime.datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Get Data
        summary, rows = get_business_report_data(business, report_type, start_date, end_date, party_id)
        
        date_range_label = "All Time"
        if start_date and end_date:
            date_range_label = f"{start_date} to {end_date}"
        elif start_date:
            date_range_label = f"From {start_date}"
        elif end_date:
            date_range_label = f"Until {end_date}"
            
        if fmt == "pdf":
            try:
                pdf_bytes = generate_business_pdf_report(business, report_type, date_range_label, summary, rows)
                response = HttpResponse(pdf_bytes, content_type="application/pdf")
                safe_name = report_type.replace(" ", "_")
                response['Content-Disposition'] = f'attachment; filename="{safe_name}_{date_range_label.replace(" ", "")}.pdf"'
                return response
            except Exception as e:
                return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        elif fmt == "csv":
            try:
                csv_bytes = generate_business_csv_report(rows)
                response = HttpResponse(csv_bytes, content_type="text/csv")
                safe_name = report_type.replace(" ", "_")
                response['Content-Disposition'] = f'attachment; filename="{safe_name}_{date_range_label.replace(" ", "")}.csv"'
                return response
            except Exception as e:
                return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        # Default JSON response
        return Response({
            "report_type": report_type,
            "period": date_range_label,
            "summary": summary,
            "rows": rows
        })
