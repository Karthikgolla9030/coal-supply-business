"""
core/services/gst_service.py

Service for verifying GSTINs via the external GSTVerify API (Phase 1).
"""

import logging
from django.conf import settings
import requests

logger = logging.getLogger(__name__)

# GSTVerify API Endpoint
GST_API_URL = "https://gstverify.co.in/api/v1/verify/{gstin}"
TIMEOUT_SECONDS = 10


def verify_gstin(gstin: str) -> dict:
    """
    Verifies a GSTIN string via the external GSTVerify API.

    Returns a standardized dictionary:
    {
        "success": bool,
        "data": dict or None,
        "error": str or None
    }
    """
    if not gstin:
        return {"success": False, "error": "GSTIN is required."}

    # Normalization
    clean_gstin = str(gstin).strip().upper()

    # Basic Validation
    if len(clean_gstin) != 15:
        return {"success": False, "error": "Invalid GSTIN format"}

    api_key = getattr(settings, "GSTIN_API_KEY", None)
    if not api_key:
        logger.error("GSTIN_API_KEY is not configured in settings.")
        return {"success": False, "error": "GST verification service is temporarily unavailable."}

    url = GST_API_URL.format(gstin=clean_gstin)
    headers = {
        "X-API-Key": api_key,
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT_SECONDS)

        if response.status_code == 200:
            provider_data = response.json()
            
            # Defensive check for provider success format if applicable
            # Assuming the API returns the data directly or under a 'data' key.
            if isinstance(provider_data, dict) and "data" in provider_data:
                source = provider_data.get("data", {})
            else:
                source = provider_data

            # Normalize to standard internal structure, safely getting fields
            mapped_data = {
                "gstin": source.get("gstin", clean_gstin),
                "legal_name": source.get("legal_name", ""),
                "trade_name": source.get("trade_name", ""),
                "status": source.get("status", ""),
                "constitution": source.get("constitution", ""),
                "taxpayer_type": source.get("taxpayer_type", ""),
                "registration_date": source.get("registration_date", ""),
                "state": source.get("state", ""),
                "pan": source.get("pan", ""),
                "address": source.get("address", ""),
                "nature_of_business": source.get("nature_of_business", []),
            }
            return {"success": True, "data": mapped_data}

        elif response.status_code == 401 or response.status_code == 403:
            logger.error("GST API Authentication Failed (401/403). Check API key.")
            return {"success": False, "error": "GST verification service authentication failed."}
            
        elif response.status_code == 404:
            return {"success": False, "error": "GSTIN not found or invalid."}
            
        elif response.status_code == 429:
            logger.warning("GST API Rate limited (429).")
            return {"success": False, "error": "GST verification service credits are exhausted or rate limited."}
            
        else:
            logger.error(f"GST API returned unexpected status {response.status_code} for {clean_gstin[:4]}***.")
            return {"success": False, "error": "GST verification service is temporarily unavailable."}

    except requests.exceptions.Timeout:
        logger.error(f"GST API Timeout for {clean_gstin[:4]}***.")
        return {"success": False, "error": "GST verification service timed out. Please try again."}
        
    except requests.exceptions.RequestException as e:
        logger.error(f"GST API RequestException for {clean_gstin[:4]}***: {str(e)}")
        return {"success": False, "error": "GST verification service is temporarily unavailable."}
    except Exception as e:
        logger.error(f"Unexpected error in GST verification for {clean_gstin[:4]}***: {str(e)}")
        return {"success": False, "error": "GST verification service encountered an unexpected error."}
