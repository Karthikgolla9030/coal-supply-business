from unittest.mock import patch, MagicMock
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User

from .models import BusinessProfile, Customer, Invoice, GoogleDriveStatus

class GoogleDriveAPITest(APITestCase):
    CREATE_URL = "/api/invoices/create/"

    def setUp(self):
        self.user = User.objects.create_user(username="testadmin", password="password")
        self.client.force_authenticate(user=self.user)
        self.business = BusinessProfile.objects.create(
            owner=self.user,
            business_name="Test Business",
            gstin="29ABCDE1234F1Z5",
            phone="9876543210",
            state="Karnataka",
            state_code="29",
            google_drive_folder_id="folder_id_123"
        )
        self.customer = Customer.objects.create(
            business=self.business,
            name="Test Customer",
            gstin="29XYZDE1234F1Z5",
            phone="9123456780",
            state="Karnataka",
            state_code="29"
        )

    def _valid_payload(self):
        return {
            "invoice_number": "INV-100",
            "invoice_date": "2026-08-19",
            "transaction_type": "CASH",
            "customer": self.customer.pk,
            "transport_name": "Test Trans",
            "vehicle_number": "MH-12-1234",
            "gst_rate": "18.00",
            "items": [
                {
                    "product_name": "Coal Type A",
                    "hsn_code": "2701",
                    "quantity": "10.000",
                    "unit": "MT",
                    "rate": "5000.00"
                }
            ]
        }

    @patch("core.services.google_drive_service.get_drive_service")
    def test_automatic_upload_success(self, mock_get_drive_service):
        mock_drive_service = MagicMock()
        mock_get_drive_service.return_value = mock_drive_service
        
        mock_files = MagicMock()
        mock_drive_service.files.return_value = mock_files
        
        mock_create = MagicMock()
        mock_files.create.return_value = mock_create
        
        mock_create.execute.return_value = {
            "id": "file_id_12345",
            "webViewLink": "https://drive.google.com/file/d/file_id_12345/view"
        }

        with self.settings(GOOGLE_DRIVE_ENABLED=True, GOOGLE_DRIVE_FOLDER_ID="folder_id_123"):
            response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invoice = Invoice.objects.get(invoice_number="INV-100")
        self.assertEqual(invoice.google_drive_status, GoogleDriveStatus.UPLOADED)
        self.assertEqual(invoice.google_drive_file_id, "file_id_12345")
        self.assertEqual(invoice.google_drive_file_url, "https://drive.google.com/file/d/file_id_12345/view")
        self.assertIsNotNone(invoice.google_drive_uploaded_at)

    @patch("core.services.google_drive_service.get_drive_service")
    def test_automatic_upload_failure_does_not_rollback(self, mock_get_drive_service):
        from googleapiclient.errors import HttpError
        import httplib2
        
        mock_get_drive_service.side_effect = HttpError(httplib2.Response({'status': 500}), b'Internal Error')

        with self.settings(GOOGLE_DRIVE_ENABLED=True, GOOGLE_DRIVE_FOLDER_ID="folder_id_123"):
            response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invoice = Invoice.objects.get(invoice_number="INV-100")
        self.assertEqual(invoice.google_drive_status, GoogleDriveStatus.FAILED)

    def test_upload_disabled(self):
        with self.settings(GOOGLE_DRIVE_ENABLED=False):
            response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invoice = Invoice.objects.get(invoice_number="INV-100")
        self.assertEqual(invoice.google_drive_status, GoogleDriveStatus.NOT_UPLOADED)
        self.assertIsNone(invoice.google_drive_file_id)

    @patch("core.services.google_drive_service.get_drive_service")
    def test_manual_upload(self, mock_get_drive_service):
        mock_drive_service = MagicMock()
        mock_get_drive_service.return_value = mock_drive_service
        
        mock_files = MagicMock()
        mock_drive_service.files.return_value = mock_files
        
        mock_create = MagicMock()
        mock_files.create.return_value = mock_create
        
        mock_create.execute.return_value = {
            "id": "file_id_manual",
            "webViewLink": "https://drive.google.com/file/d/file_id_manual/view"
        }

        # Create without drive enabled
        with self.settings(GOOGLE_DRIVE_ENABLED=False):
            response = self.client.post(self.CREATE_URL, self._valid_payload(), format="json")
            self.assertEqual(response.status_code, 201, response.data)
        inv_id = response.data["invoice"]["id"]

        # Now manually trigger
        with self.settings(GOOGLE_DRIVE_ENABLED=True, GOOGLE_DRIVE_FOLDER_ID="folder_id_123"):
            upload_url = f"/api/invoices/{inv_id}/upload-to-drive/"
            resp2 = self.client.post(upload_url)
            
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data["file_id"], "file_id_manual")

        invoice = Invoice.objects.get(id=inv_id)
        self.assertEqual(invoice.google_drive_status, GoogleDriveStatus.UPLOADED)

    @patch("core.services.google_drive_service.get_drive_service")
    def test_duplicate_upload_prevention(self, mock_get_drive_service):
        mock_drive_service = MagicMock()
        mock_get_drive_service.return_value = mock_drive_service
        
        # Give it a pre-existing state
        invoice = Invoice.objects.create(
            invoice_number="INV-DUP",
            invoice_date="2026-08-19",
            transaction_type="CASH",
            customer=self.customer,
            business=self.business,
            google_drive_status=GoogleDriveStatus.UPLOADED,
            google_drive_file_id="existing_id_123",
            google_drive_file_url="https://drive.google.com/file/existing_id_123"
        )
        
        with self.settings(GOOGLE_DRIVE_ENABLED=True, GOOGLE_DRIVE_FOLDER_ID="folder_id_123"):
            upload_url = f"/api/invoices/{invoice.id}/upload-to-drive/"
            resp = self.client.post(upload_url)
            
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["file_id"], "existing_id_123")
        
        # Verify get_drive_service was NEVER called
        mock_get_drive_service.assert_not_called()
