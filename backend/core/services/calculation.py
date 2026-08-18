"""
core/services/calculation.py

Isolated calculation service for the Coal Invoice & Records Management System.

All arithmetic uses Python's Decimal type to avoid floating-point rounding
errors in financial calculations.

Design intent:
    - This module is the single source of truth for invoice arithmetic.
    - Views and serializers MUST call these functions rather than doing
      their own arithmetic.
    - Phase 6 will expand the GST engine here without touching serializers
      or models.

Public API:
    calculate_item_amount(quantity, rate) -> Decimal
    calculate_invoice_totals(items, cgst_rate, sgst_rate, igst_rate, tcs_rate) -> dict
    amount_to_words(amount) -> str
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import List

# Two decimal-place quantiser used throughout
TWO_PLACES = Decimal("0.01")


def _to_decimal(value) -> Decimal:
    """Coerce a value to Decimal safely."""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


@dataclass
class CalculationResult:
    item_amounts: List[Decimal]
    taxable_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    tcs_amount: Decimal
    total_amount: Decimal


def calculate_item_amount(quantity, rate) -> Decimal:
    """
    Calculate the line-item total.

        amount = quantity × rate

    Rounded to 2 decimal places using ROUND_HALF_UP (standard commercial
    rounding).

    Args:
        quantity: The item quantity (Decimal, int, float, or str).
        rate:     The rate per unit (Decimal, int, float, or str).

    Returns:
        Decimal rounded to 2 decimal places.

    Raises:
        ValueError: If quantity or rate is negative.
    """
    q = _to_decimal(quantity)
    r = _to_decimal(rate)

    if q < Decimal("0"):
        raise ValueError("Quantity cannot be negative.")
    if r < Decimal("0"):
        raise ValueError("Rate cannot be negative.")

    return (q * r).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def calculate_invoice_totals(
    items: List[dict],
    cgst_rate,
    sgst_rate,
    igst_rate,
    tcs_rate,
) -> dict:
    """
    Calculate all invoice-level financial totals from line items and tax rates.

    Args:
        items:      List of dicts, each with keys 'quantity' and 'rate'.
                    The 'amount' key, if present, is IGNORED — amounts are
                    always recalculated server-side.
        cgst_rate:  CGST percentage, e.g. Decimal("9.00")
        sgst_rate:  SGST percentage, e.g. Decimal("9.00")
        igst_rate:  IGST percentage, e.g. Decimal("0.00")
        tcs_rate:   TCS percentage,  e.g. Decimal("1.00")

    Returns:
        {
            "item_amounts":    [Decimal, ...],   # per-item calculated amounts
            "taxable_amount":  Decimal,
            "cgst_amount":     Decimal,
            "sgst_amount":     Decimal,
            "igst_amount":     Decimal,
            "tcs_amount":      Decimal,
            "total_amount":    Decimal,
        }

    Tax arithmetic (Phase 5 baseline — Phase 6 will expand):
        cgst_amount = taxable_amount × cgst_rate / 100
        sgst_amount = taxable_amount × sgst_rate / 100
        igst_amount = taxable_amount × igst_rate / 100
        tcs_amount  = taxable_amount × tcs_rate  / 100
        total       = taxable_amount + cgst + sgst + igst + tcs

    Note on TCS:
        Under the Income Tax Act, TCS on coal (Section 206C) is collected
        on the INVOICE VALUE (taxable + GST).  The precise base depends on
        the invoice configuration.  For Phase 5 we use taxable_amount as the
        base; Phase 6 will implement the correct base selection.
    """
    cgst_rate = _to_decimal(cgst_rate)
    sgst_rate = _to_decimal(sgst_rate)
    igst_rate = _to_decimal(igst_rate)
    tcs_rate  = _to_decimal(tcs_rate)

    HUNDRED = Decimal("100")

    # Recalculate every item amount; ignore any client-supplied amount
    item_amounts = [
        calculate_item_amount(item["quantity"], item["rate"])
        for item in items
    ]

    taxable_amount = sum(item_amounts, Decimal("0")).quantize(
        TWO_PLACES, rounding=ROUND_HALF_UP
    )

    cgst_amount = (taxable_amount * cgst_rate / HUNDRED).quantize(
        TWO_PLACES, rounding=ROUND_HALF_UP
    )
    sgst_amount = (taxable_amount * sgst_rate / HUNDRED).quantize(
        TWO_PLACES, rounding=ROUND_HALF_UP
    )
    igst_amount = (taxable_amount * igst_rate / HUNDRED).quantize(
        TWO_PLACES, rounding=ROUND_HALF_UP
    )
    tcs_amount  = (taxable_amount * tcs_rate  / HUNDRED).quantize(
        TWO_PLACES, rounding=ROUND_HALF_UP
    )

    total_amount = (
        taxable_amount + cgst_amount + sgst_amount + igst_amount + tcs_amount
    ).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

    return CalculationResult(
        item_amounts=item_amounts,
        taxable_amount=taxable_amount,
        cgst_amount=cgst_amount,
        sgst_amount=sgst_amount,
        igst_amount=igst_amount,
        tcs_amount=tcs_amount,
        total_amount=total_amount,
    )


def amount_to_words(amount) -> str:
    """
    Convert a Decimal monetary amount to Indian English words.

    Example:
        47200.00  →  "Forty-Seven Thousand Two Hundred Rupees Only"
        100000.50 →  "One Lakh Rupees and Fifty Paise Only"

    Uses the 'num2words' library with lang='en_IN' and to='cardinal'
    to get the number in words. Handles paise explicitly.

    Args:
        amount: Decimal or numeric value.

    Returns:
        str — formatted amount in words, title-cased.
    """
    try:
        from num2words import num2words

        amt = _to_decimal(amount).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        whole_rupees = int(amt)
        paise = int((amt - whole_rupees) * 100)

        rupees_words = num2words(whole_rupees, lang="en_IN", to="cardinal").strip().title()

        if paise > 0:
            paise_words = num2words(paise, lang="en_IN", to="cardinal").strip().title()
            return f"{rupees_words} Rupees and {paise_words} Paise Only"
        else:
            return f"{rupees_words} Rupees Only"

    except Exception:
        # Graceful fallback: return numeric string if num2words fails
        return f"Rupees {amount} Only"

