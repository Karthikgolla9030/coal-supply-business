import io
import csv
from decimal import Decimal
from django.db.models import Sum, Q, Count, F
from django.utils.timezone import now
from django.template.loader import render_to_string
import xhtml2pdf.pisa as pisa

from core.models import Purchase, Sale, Expense, Customer, Supplier

def get_business_report_data(business, report_type, start_date=None, end_date=None, party_id=None):
    summary = {}
    rows = []

    # ── Base Querysets ──
    purchases = Purchase.objects.filter(business=business, is_active=True)
    sales = Sale.objects.filter(business=business, is_active=True)
    expenses = Expense.objects.filter(business=business, is_active=True)

    if start_date:
        purchases = purchases.filter(purchase_date__gte=start_date)
        sales = sales.filter(sale_date__gte=start_date)
        expenses = expenses.filter(expense_date__gte=start_date)
    if end_date:
        purchases = purchases.filter(purchase_date__lte=end_date)
        sales = sales.filter(sale_date__lte=end_date)
        expenses = expenses.filter(expense_date__lte=end_date)

    if report_type == "Purchase Report":
        if party_id:
            purchases = purchases.filter(supplier_id=party_id)
        
        purchases = purchases.order_by('-purchase_date', '-created_at').select_related('supplier')
        
        aggr = purchases.aggregate(
            qty=Sum('quantity_tons'),
            val=Sum('purchase_amount'),
            gst=Sum('gst_amount')
        )
        qty = aggr['qty'] or Decimal('0.000')
        val = aggr['val'] or Decimal('0.00')
        gst = aggr['gst'] or Decimal('0.00')
        
        summary['Total Purchases'] = str(purchases.count())
        summary['Total Tons Purchased'] = f"{qty} MT"
        summary['Total Purchase Value'] = val
        summary['Total GST'] = gst
        summary['Total Including GST'] = val + gst
        summary['Average Purchase Rate'] = f"₹{val/qty:,.2f}" if qty > 0 else "₹0.00"

        for p in purchases:
            rows.append({
                "Date": p.purchase_date.isoformat(),
                "Supplier": p.supplier.name if p.supplier else "-",
                "Purchase No.": p.purchase_order_no or "-",
                "Serial No.": p.serial_no or "-",
                "Truck No.": p.truck_no or "-",
                "Tons": p.quantity_tons,
                "Rate": p.rate_per_ton,
                "Purchase Value": p.purchase_amount,
                "GST": p.gst_amount,
                "Total": p.total_amount
            })

    elif report_type == "Sales Report":
        if party_id:
            sales = sales.filter(customer_id=party_id)
            
        sales = sales.order_by('-sale_date', '-created_at').select_related('customer')
        
        aggr = sales.aggregate(
            qty=Sum('quantity_tons'),
            val=Sum('sale_amount'),
            gst=Sum('gst_amount')
        )
        qty = aggr['qty'] or Decimal('0.000')
        val = aggr['val'] or Decimal('0.00')
        gst = aggr['gst'] or Decimal('0.00')
        
        summary['Total Sales'] = str(sales.count())
        summary['Total Tons Sold'] = f"{qty} MT"
        summary['Total Sales Value'] = val
        summary['Total GST'] = gst
        summary['Total Including GST'] = val + gst
        summary['Average Selling Rate'] = f"₹{val/qty:,.2f}" if qty > 0 else "₹0.00"

        for s in sales:
            rows.append({
                "Date": s.sale_date.isoformat(),
                "Customer": s.customer.name if s.customer else "-",
                "Sale No.": s.sale_order_no or "-",
                "Serial No.": s.serial_no or "-",
                "Truck No.": s.truck_no or "-",
                "Tons": s.quantity_tons,
                "Rate": s.rate_per_ton,
                "Sale Value": s.sale_amount,
                "GST": s.gst_amount,
                "Total": s.total_amount
            })

    elif report_type == "Stock Report":
        # Current stock logic ignores dates for the global absolute values, but the report
        # itself requires a timeline. The prompt states:
        # "Use the existing Stock calculation as the source of truth."
        
        all_purchases = Purchase.objects.filter(business=business, is_active=True).select_related('supplier')
        all_sales = Sale.objects.filter(business=business, is_active=True).select_related('customer')
        
        tot_purchased = all_purchases.aggregate(t=Sum('quantity_tons'))['t'] or Decimal('0.000')
        tot_sold = all_sales.aggregate(t=Sum('quantity_tons'))['t'] or Decimal('0.000')
        current_stock = tot_purchased - tot_sold
        
        summary['Total Purchased'] = f"{tot_purchased} MT"
        summary['Total Sold'] = f"{tot_sold} MT"
        summary['Current Stock'] = f"{current_stock} MT"
        
        # Build timeline (filtered by date range if provided)
        timeline = []
        
        filt_purchases = all_purchases
        filt_sales = all_sales
        if start_date:
            filt_purchases = filt_purchases.filter(purchase_date__gte=start_date)
            filt_sales = filt_sales.filter(sale_date__gte=start_date)
        if end_date:
            filt_purchases = filt_purchases.filter(purchase_date__lte=end_date)
            filt_sales = filt_sales.filter(sale_date__lte=end_date)
            
        for p in filt_purchases:
            timeline.append({
                "Date": p.purchase_date.isoformat(),
                "Type": "Purchase",
                "Supplier / Customer": p.supplier.name if p.supplier else "-",
                "Reference": p.purchase_order_no or "-",
                "Truck No.": p.truck_no or "-",
                "Quantity": f"+{p.quantity_tons}",
                "_raw_date": p.purchase_date,
                "_qty": p.quantity_tons,
                "_is_add": True,
                "_id": f"P{p.id}"
            })
            
        for s in filt_sales:
            timeline.append({
                "Date": s.sale_date.isoformat(),
                "Type": "Sale",
                "Supplier / Customer": s.customer.name if s.customer else "-",
                "Reference": s.sale_order_no or "-",
                "Truck No.": s.truck_no or "-",
                "Quantity": f"-{s.quantity_tons}",
                "_raw_date": s.sale_date,
                "_qty": s.quantity_tons,
                "_is_add": False,
                "_id": f"S{s.id}"
            })
            
        # Sort ascending by date to calculate running balance correctly FOR THIS PERIOD
        # We need the starting balance before start_date
        starting_balance = Decimal('0.000')
        if start_date:
            prior_p = Purchase.objects.filter(business=business, is_active=True, purchase_date__lt=start_date).aggregate(t=Sum('quantity_tons'))['t'] or Decimal('0.000')
            prior_s = Sale.objects.filter(business=business, is_active=True, sale_date__lt=start_date).aggregate(t=Sum('quantity_tons'))['t'] or Decimal('0.000')
            starting_balance = prior_p - prior_s
            
        timeline.sort(key=lambda x: (x['_raw_date'], x['_id']))
        running_bal = starting_balance
        
        # Insert a starting balance row if start_date exists and timeline exists
        if start_date and timeline:
             rows.append({
                "Date": start_date,
                "Type": "Opening Balance",
                "Supplier / Customer": "-",
                "Reference": "-",
                "Truck No.": "-",
                "Quantity": "-",
                "Running Balance": f"{running_bal} MT"
            })
             
        for t in timeline:
            if t['_is_add']: running_bal += t['_qty']
            else: running_bal -= t['_qty']
            
            rows.append({
                "Date": t["Date"],
                "Type": t["Type"],
                "Supplier / Customer": t["Supplier / Customer"],
                "Reference": t["Reference"],
                "Truck No.": t["Truck No."],
                "Quantity": t["Quantity"],
                "Running Balance": f"{running_bal} MT"
            })
            
        # Reverse to show newest first
        rows.reverse()

    elif report_type == "Expense Report":
        expenses = expenses.order_by('-expense_date', '-created_at')
        
        aggr = expenses.aggregate(tot=Sum('amount'), avg=Avg('amount'))
        tot = aggr['tot'] or Decimal('0.00')
        
        largest = expenses.order_by('-amount').first()
        
        summary['Total Expenses'] = tot
        summary['Average Expense'] = aggr['avg'] or Decimal('0.00')
        summary['Largest Expense'] = largest.amount if largest else Decimal('0.00')
        
        # We also need category breakdown, but for rows we just use the list
        for e in expenses:
            rows.append({
                "Date": e.expense_date.isoformat(),
                "Category": e.category,
                "Description": e.description or "-",
                "Paid To": e.paid_to or "-",
                "Reference": e.reference_no or "-",
                "Amount": e.amount
            })

    elif report_type == "Customer Report":
        # Group sales by customer
        cust_sales = sales.values('customer__id', 'customer__name').annotate(
            tot_sales=Sum('sale_amount'),
            tot_qty=Sum('quantity_tons'),
            num_sales=Count('id')
        ).order_by('-tot_sales')
        
        for c in cust_sales:
            qty = c['tot_qty'] or Decimal('0.000')
            val = c['tot_sales'] or Decimal('0.00')
            avg = (val / qty).quantize(Decimal('0.00')) if qty > 0 else Decimal('0.00')
            rows.append({
                "CUSTOMER": c['customer__name'] or "Unknown",
                "TOTAL SALES": val,
                "TOTAL TONS": qty,
                "AVERAGE RATE": avg,
                "NUMBER OF SALES": c['num_sales']
            })

    elif report_type == "Supplier Report":
        # Group purchases by supplier
        sup_purchases = purchases.values('supplier__id', 'supplier__name').annotate(
            tot_purchases=Sum('purchase_amount'),
            tot_qty=Sum('quantity_tons'),
            num_purchases=Count('id')
        ).order_by('-tot_purchases')
        
        for s in sup_purchases:
            qty = s['tot_qty'] or Decimal('0.000')
            val = s['tot_purchases'] or Decimal('0.00')
            avg = (val / qty).quantize(Decimal('0.00')) if qty > 0 else Decimal('0.00')
            rows.append({
                "SUPPLIER": s['supplier__name'] or "Unknown",
                "TOTAL PURCHASES": val,
                "TOTAL TONS": qty,
                "AVERAGE RATE": avg,
                "NUMBER OF PURCHASES": s['num_purchases']
            })
            
    elif report_type == "Profit & Loss":
        purchases_aggr = purchases.aggregate(qty=Sum('quantity_tons'), val=Sum('purchase_amount'))
        sales_aggr = sales.aggregate(qty=Sum('quantity_tons'), val=Sum('sale_amount'))
        expenses_total = expenses.aggregate(tot=Sum('amount'))['tot'] or Decimal('0.00')
        
        sold_qty = sales_aggr['qty'] or Decimal('0.000')
        sales_val = sales_aggr['val'] or Decimal('0.00')
        
        purchased_qty = purchases_aggr['qty'] or Decimal('0.000')
        purchase_val = purchases_aggr['val'] or Decimal('0.00')
        
        avg_purchase_rate = Decimal('0.00')
        if purchased_qty > 0:
            avg_purchase_rate = purchase_val / purchased_qty
            
        est_cogs = (sold_qty * avg_purchase_rate).quantize(Decimal('0.00'))
        gross_profit = sales_val - est_cogs
        net_profit = gross_profit - expenses_total
        
        summary['Sales Value'] = sales_val
        summary['Estimated Cost of Goods Sold'] = est_cogs
        summary['Estimated Gross Profit'] = gross_profit
        summary['Operating Expenses'] = expenses_total
        summary['Estimated Net Profit'] = net_profit
        
        if sales_val > 0:
            summary['Estimated Gross Margin'] = f"{((gross_profit / sales_val) * 100):.2f}%"
            summary['Estimated Net Margin'] = f"{((net_profit / sales_val) * 100):.2f}%"
        else:
            summary['Estimated Gross Margin'] = "—"
            summary['Estimated Net Margin'] = "—"
            
        rows = [] # P&L doesn't strictly have tabular rows in the exact same format, it relies on summary for the PDF

    return summary, rows


def generate_business_pdf_report(business, report_type, date_range_label, summary, rows):
    context = {
        "business": business,
        "report_type": report_type,
        "date_range_label": date_range_label,
        "summary": summary,
        "rows": rows,
        "generated_date": now().date().isoformat()
    }
    html_string = render_to_string("business_report_pdf.html", context)
    pdf_file = io.BytesIO()
    pisa_status = pisa.CreatePDF(html_string, dest=pdf_file)
    if pisa_status.err:
        raise Exception("Error generating Business PDF report")
    return pdf_file.getvalue()


def generate_business_csv_report(rows):
    out = io.StringIO()
    if rows:
        headers = list(rows[0].keys())
        writer = csv.DictWriter(out, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            formatted_row = {}
            for k, v in row.items():
                if isinstance(v, Decimal):
                    formatted_row[k] = f"{v:.2f}"
                else:
                    formatted_row[k] = v
            writer.writerow(formatted_row)
    else:
        out.write("No records found.\n")
    return out.getvalue()
