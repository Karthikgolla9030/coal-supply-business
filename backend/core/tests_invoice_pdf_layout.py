import os, sys, django
import unittest
from decimal import Decimal
from datetime import date
from types import SimpleNamespace
import io

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.template.loader import render_to_string
from django.conf import settings
from xhtml2pdf import pisa
import pymupdf

class InvoicePDFLayoutTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.business = SimpleNamespace(
            business_name='Sri Sai Manvith Traders',
            gstin='37ALPPV8537K1Z0',
            phone='9440989996',
            address='Bhagatsingh Road, Bhavanipuram, Vijayawada',
            state='Andhra Pradesh',
            pincode='520012',
            bank_name='Union Bank of India',
            bank_branch='Bhavanipuram',
            bank_account_number='029311100001234',
            bank_ifsc='UBIN0802930'
        )
        cls.customer = SimpleNamespace(
            name='Sri Lakshmi Venkateswara Minerals Private Limited',
            address='Plot No. 12, Industrial Estate, Renigunta Road, Tirupati',
            state='Andhra Pradesh',
            state_code='37',
            gst_registered=True,
            gstin='37ABCDE1234F1Z5',
            aadhaar_no=''
        )
        cls.logo_path = os.path.join(settings.BASE_DIR, 'core', 'static', 'core', 'images', 'logo.jpg')

    def _render_pdf(self, invoice, items, customer=None, copy_type='ORIGINAL'):
        context = {
            'invoice': invoice,
            'business': self.business,
            'customer': customer or self.customer,
            'items': items,
            'financial_year': '2026-27',
            'copy_type': copy_type,
            'delivery_district': 'Chittoor',
            'business_logo_path': self.logo_path
        }
        html_str = render_to_string('invoice_pdf.html', context)
        pdf_io = io.BytesIO()
        status = pisa.CreatePDF(html_str, dest=pdf_io)
        self.assertFalse(status.err, "xhtml2pdf should return 0 errors")
        pdf_bytes = pdf_io.getvalue()
        self.assertTrue(len(pdf_bytes) > 0, "PDF bytes should not be empty")
        doc = pymupdf.open(stream=pdf_bytes, filetype='pdf')
        return doc

    def test_single_item_layout(self):
        invoice = SimpleNamespace(
            invoice_number='SSMT/2026-27/001',
            invoice_date=date(2026, 8, 21),
            transaction_type='credit',
            vehicle_number='AP 16 TX 7899',
            taxable_amount=Decimal('255125.00'),
            sgst_rate=Decimal('2.50'),
            sgst_amount=Decimal('6378.13'),
            cgst_rate=Decimal('2.50'),
            cgst_amount=Decimal('6378.13'),
            igst_rate=Decimal('0.00'),
            igst_amount=Decimal('0.00'),
            tcs_rate=Decimal('0.10'),
            tcs_amount=Decimal('267.88'),
            total_amount=Decimal('268149.00'),
            amount_in_words='Two Lakh Sixty Eight Thousand One Hundred Forty Nine Rupees Only',
            transport_name='Sri Balaji Roadlines'
        )
        items = [
            SimpleNamespace(
                product_name='Steam Coal 0-50mm Grade G-11',
                hsn_code='2701',
                quantity=Decimal('32.500'),
                unit='ton',
                rate=Decimal('7850.00'),
                amount=Decimal('255125.00')
            )
        ]
        doc = self._render_pdf(invoice, items)
        self.assertEqual(len(doc), 1, "Single item invoice should fit on exactly 1 page")
        page = doc[0]
        text = page.get_text()
        self.assertIn("HSN CODE", text)
        self.assertIn("2701", text)
        self.assertIn("SRI SAI MANVITH TRADERS", text)
        self.assertIn("TOTAL AFTER TAX", text)

        # Check HSN CODE words
        words = page.get_text('words')
        hsn_word = [w for w in words if w[4] == 'HSN'][0]
        code_word = [w for w in words if w[4] == 'CODE'][0]
        val_word = [w for w in words if w[4] == '2701'][0]

        # The column left border is at 246.05 and right border at 318.27
        self.assertGreaterEqual(hsn_word[0], 245.0)
        self.assertLessEqual(code_word[2], 319.0)
        self.assertGreaterEqual(val_word[0], 245.0)
        self.assertLessEqual(val_word[2], 319.0)

    def test_8_digit_hsn_and_long_description(self):
        invoice = SimpleNamespace(
            invoice_number='SSMT/2026-27/002',
            invoice_date=date(2026, 8, 22),
            transaction_type='credit',
            vehicle_number='AP 16 TX 9999',
            taxable_amount=Decimal('547587.50'),
            sgst_rate=Decimal('2.50'),
            sgst_amount=Decimal('13689.69'),
            cgst_rate=Decimal('2.50'),
            cgst_amount=Decimal('13689.69'),
            igst_rate=Decimal('0.00'),
            igst_amount=Decimal('0.00'),
            tcs_rate=Decimal('0.10'),
            tcs_amount=Decimal('574.97'),
            total_amount=Decimal('575542.00'),
            amount_in_words='Five Lakh Seventy Five Thousand Five Hundred Forty Two Rupees Only',
            transport_name='Sri Venkateswara Transports'
        )
        items = [
            SimpleNamespace(
                product_name='WASHED STEAM COAL 0-50MM HIGH GCV 5800 KCAL/KG AS PER PURCHASE ORDER #PO-2026-9812 DATED 15-08-2026',
                hsn_code='27011920',
                quantity=Decimal('35.450'),
                unit='ton',
                rate=Decimal('8250.00'),
                amount=Decimal('292462.50')
            ),
            SimpleNamespace(
                product_name='SCREENED RAW COAL 20-40MM MEDIUM ASH CONTENT GRADE G-13',
                hsn_code='27011200',
                quantity=Decimal('39.250'),
                unit='ton',
                rate=Decimal('6500.00'),
                amount=Decimal('255125.00')
            )
        ]
        doc = self._render_pdf(invoice, items)
        self.assertEqual(len(doc), 1, "2 items with multiline descriptions should fit on 1 page")
        page = doc[0]
        text = page.get_text()
        self.assertIn("27011920", text)
        self.assertIn("27011200", text)

        words = page.get_text('words')
        val1 = [w for w in words if w[4] == '27011920'][0]
        val2 = [w for w in words if w[4] == '27011200'][0]
        self.assertGreaterEqual(val1[0], 245.0)
        self.assertLessEqual(val1[2], 319.0)
        self.assertGreaterEqual(val2[0], 245.0)
        self.assertLessEqual(val2[2], 319.0)

    def test_interstate_igst_and_large_amount(self):
        invoice = SimpleNamespace(
            invoice_number='SSMT/2026-27/003',
            invoice_date=date(2026, 8, 23),
            transaction_type='cash',
            vehicle_number='TS 08 UB 4512',
            taxable_amount=Decimal('2540000.00'),
            sgst_rate=Decimal('0.00'),
            sgst_amount=Decimal('0.00'),
            cgst_rate=Decimal('0.00'),
            cgst_amount=Decimal('0.00'),
            igst_rate=Decimal('5.00'),
            igst_amount=Decimal('127000.00'),
            tcs_rate=Decimal('0.00'),
            tcs_amount=Decimal('0.00'),
            total_amount=Decimal('2667000.00'),
            amount_in_words='Twenty Six Lakh Sixty Seven Thousand Rupees Only',
            transport_name='Telangana Road Cargo'
        )
        customer = SimpleNamespace(
            name='Hyderabad Thermal Boiler Systems Pvt Ltd',
            address='Plot 88, Cherlapally Industrial Phase 3, Hyderabad',
            state='Telangana',
            state_code='36',
            gst_registered=False,
            gstin='',
            aadhaar_no='4512 7896 3214'
        )
        items = [
            SimpleNamespace(
                product_name='ANTHRACITE COAL PREMIUM GRADE 0-25MM',
                hsn_code='27011100',
                quantity=Decimal('200.000'),
                unit='ton',
                rate=Decimal('12700.00'),
                amount=Decimal('2540000.00')
            )
        ]
        doc = self._render_pdf(invoice, items, customer=customer, copy_type='DUPLICATE')
        self.assertEqual(len(doc), 1)
        page = doc[0]
        text = page.get_text()
        self.assertIn("DUPLICATE", text)
        self.assertIn("4512 7896 3214", text)
        self.assertIn("2667000.00", text)

    def test_multipage_pagination(self):
        items = [
            SimpleNamespace(
                product_name=f'Grade G-{9+i} Steam Coal Batch #{i+1} 0-50mm High Heat Content',
                hsn_code='27011920',
                quantity=Decimal('25.000'),
                unit='ton',
                rate=Decimal('7000.00'),
                amount=Decimal('175000.00')
            ) for i in range(25)
        ]
        invoice = SimpleNamespace(
            invoice_number='SSMT/2026-27/004',
            invoice_date=date(2026, 8, 24),
            transaction_type='credit',
            vehicle_number='AP 16 TX 1122',
            taxable_amount=Decimal('4375000.00'),
            sgst_rate=Decimal('2.50'),
            sgst_amount=Decimal('109375.00'),
            cgst_rate=Decimal('2.50'),
            cgst_amount=Decimal('109375.00'),
            igst_rate=Decimal('0.00'),
            igst_amount=Decimal('0.00'),
            tcs_rate=Decimal('0.10'),
            tcs_amount=Decimal('4593.75'),
            total_amount=Decimal('4598344.00'),
            amount_in_words='Forty Five Lakh Ninety Eight Thousand Three Hundred Forty Four Rupees Only',
            transport_name='Sri Sai Logistics'
        )
        doc = self._render_pdf(invoice, items)
        self.assertGreater(len(doc), 1, "25 items should paginate across multiple pages")
        # Check repeated header on page 2
        p2_text = doc[1].get_text()
        self.assertIn("HSN CODE", p2_text, "Table header should repeat on page 2")
        self.assertIn("Page 2 of", p2_text, "Footer page number should appear")

if __name__ == '__main__':
    unittest.main()
