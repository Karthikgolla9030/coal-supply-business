"""
core/validators.py

Reusable field validators for the Coal Invoice & Records Management System.

These validators enforce format rules at the application layer.
They do NOT make external API calls or verify legal validity.
"""

import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def validate_gstin(value: str) -> None:
    """
    Validate the basic format of a GST Identification Number (GSTIN).

    GSTIN format: 15 characters
        - Characters 1-2  : 2-digit state code (01–37)
        - Characters 3-12 : 10-character PAN number
        - Character 13    : entity number (1–9, A–Z)
        - Character 14    : 'Z' (reserved)
        - Character 15    : checksum digit/letter

    This validator checks the overall pattern only.
    It does NOT verify that the GSTIN is registered with the GST portal.
    """
    if not value:
        return  # blank is allowed (field is optional)

    pattern = r"^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$"
    if not re.match(pattern, value.upper()):
        raise ValidationError(
            _("%(value)s is not a valid GSTIN format. "
              "Expected: 2-digit state code + 10-char PAN + 3 characters (e.g. 29ABCDE1234F1Z5)."),
            params={"value": value},
        )


def validate_ifsc(value: str) -> None:
    """
    Validate the basic format of an IFSC (Indian Financial System Code).

    IFSC format: 11 characters
        - Characters 1-4  : 4-letter bank code (A-Z)
        - Character 5     : '0' (reserved)
        - Characters 6-11 : 6-character branch code (alphanumeric)

    This validator checks the pattern only.
    It does NOT verify that the IFSC is registered with the RBI.
    """
    if not value:
        return

    pattern = r"^[A-Z]{4}0[A-Z0-9]{6}$"
    if not re.match(pattern, value.upper()):
        raise ValidationError(
            _("%(value)s is not a valid IFSC format. "
              "Expected: 4 letters + '0' + 6 alphanumeric characters (e.g. SBIN0001234)."),
            params={"value": value},
        )


def validate_phone(value: str) -> None:
    """
    Validate a basic phone number format.

    Accepts:
        - 10-digit Indian mobile numbers (e.g. 9876543210)
        - Numbers with country code prefix (e.g. +91 9876543210, +919876543210)
        - Spaces and hyphens between digit groups are permitted

    This validator does NOT verify that the number is active or reachable.
    """
    if not value:
        return

    # Strip whitespace and hyphens for validation
    cleaned = re.sub(r"[\s\-]", "", value)
    pattern = r"^(\+91)?[6-9]\d{9}$"
    if not re.match(pattern, cleaned):
        raise ValidationError(
            _("%(value)s is not a valid phone number. "
              "Please enter a 10-digit Indian mobile number, optionally prefixed with +91."),
            params={"value": value},
        )
