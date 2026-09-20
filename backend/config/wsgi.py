"""
WSGI config for the Coal Invoice & Records Management System.

This module exposes the WSGI callable as a module-level variable named ``application``.
"""

import logging
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()

# Run database migrations on startup so cloud databases (e.g. Neon) always have up-to-date tables
try:
    from django.core.management import call_command
    logger = logging.getLogger("django")
    logger.info("Checking and applying pending database migrations...")
    call_command("migrate", interactive=False)
    logger.info("Database migrations applied successfully.")
except Exception as e:
    logger = logging.getLogger("django")
    logger.error(f"Automatic migration check failed: {e}", exc_info=True)
