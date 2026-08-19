import logging
import io
import re
from datetime import datetime
from django.conf import settings
import google.oauth2.credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from googleapiclient.errors import HttpError

from ..models import Invoice, GoogleDriveStatus, BusinessProfile

logger = logging.getLogger(__name__)

# Scopes required for Drive API to create/upload files
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_drive_service(business):
    """Initializes and returns the Google Drive API client using OAuth 2.0."""
    if not business or not business.google_oauth_refresh_token:
        raise ValueError("Google Drive is not connected. Refresh token missing.")
        
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        raise ValueError("Google OAuth Client ID or Secret is missing in configuration.")
    
    creds = google.oauth2.credentials.Credentials(
        token=None,
        refresh_token=business.google_oauth_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
        client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
        scopes=SCOPES
    )
    return build('drive', 'v3', credentials=creds, cache_discovery=False)

def sanitize_filename(name: str) -> str:
    """Removes unsafe characters from the filename."""
    # Replace unsafe characters with hyphen
    safe_name = re.sub(r'[\\/:*?"<>|]+', '-', name)
    # Remove consecutive hyphens
    safe_name = re.sub(r'-+', '-', safe_name)
    return safe_name.strip(' -')

def upload_invoice_pdf(invoice: Invoice, pdf_content: bytes) -> bool:
    """
    Uploads the provided PDF binary content to Google Drive.
    Updates the invoice instance with the drive metadata.
    Returns True on success, False otherwise.
    Never throws exceptions out to the caller to prevent breaking invoice flows.
    """
    if not settings.GOOGLE_DRIVE_ENABLED:
        logger.info(f"Google Drive upload skipped for Invoice {invoice.invoice_number} (Disabled).")
        return False

    if not invoice.business:
        logger.error(f"Invoice {invoice.invoice_number} has no associated business profile.")
        return False
        
    if not invoice.business.google_drive_folder_id:
        logger.error(f"Google Drive folder ID is missing for business {invoice.business.business_name}.")
        return False

    # Prevent duplicate uploads
    if invoice.google_drive_status == GoogleDriveStatus.UPLOADED and invoice.google_drive_file_id:
        logger.info(f"Invoice {invoice.invoice_number} already uploaded to Drive ({invoice.google_drive_file_id}).")
        return True

    invoice.google_drive_status = GoogleDriveStatus.UPLOADING
    invoice.save(update_fields=["google_drive_status"])

    try:
        drive_service = get_drive_service(invoice.business)

        # Build safe filename
        customer_name = sanitize_filename(invoice.customer.name) if invoice.customer else "Unknown"
        invoice_number = sanitize_filename(invoice.invoice_number)
        filename = f"Invoice-{invoice_number}-{customer_name}.pdf"

        file_metadata = {
            'name': filename,
            'parents': [invoice.business.google_drive_folder_id]
        }

        media = MediaIoBaseUpload(io.BytesIO(pdf_content), mimetype='application/pdf', resumable=True)

        logger.info(f"Uploading {filename} to Google Drive...")
        
        # supportsAllDrives=True is removed because we are uploading to My Drive
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink'
        ).execute()

        invoice.google_drive_file_id = file.get('id')
        invoice.google_drive_file_url = file.get('webViewLink')
        invoice.google_drive_status = GoogleDriveStatus.UPLOADED
        
        from django.utils import timezone
        invoice.google_drive_uploaded_at = timezone.now()
        
        invoice.save(update_fields=[
            "google_drive_file_id", 
            "google_drive_file_url", 
            "google_drive_status", 
            "google_drive_uploaded_at"
        ])
        
        logger.info(f"Successfully uploaded {filename} to Google Drive (ID: {file.get('id')}).")
        return True

    except HttpError as error:
        logger.error(f"Google Drive API error during upload for Invoice {invoice.invoice_number}: {error}")
    except ValueError as error:
        logger.error(f"Google Drive configuration error for Invoice {invoice.invoice_number}: {error}")
    except Exception as e:
        logger.error(f"Unexpected error uploading Invoice {invoice.invoice_number} to Google Drive: {e}")

    # Mark as failed on error
    invoice.google_drive_status = GoogleDriveStatus.FAILED
    invoice.save(update_fields=["google_drive_status"])
    return False
