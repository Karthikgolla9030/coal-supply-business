"""
Top-level API URL routes.

All paths here are already prefixed with /api/ from config/urls.py.
"""

from django.urls import include, path

from config.views import HealthCheckView

urlpatterns = [
    # Health check — public, no auth required
    path("health/", HealthCheckView.as_view(), name="health-check"),

    # Core business endpoints (business profile, customers)
    path("", include("core.urls")),
]
