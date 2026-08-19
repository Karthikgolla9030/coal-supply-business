"""
Top-level API URL routes.

All paths here are already prefixed with /api/ from config/urls.py.
"""

from django.urls import include, path

from config.views import HealthCheckView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from core.views import CurrentUserView, RegisterView

urlpatterns = [
    # Health check — public, no auth required
    path("health/", HealthCheckView.as_view(), name="health-check"),

    # Auth endpoints
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("auth/register/", RegisterView.as_view(), name="register"),

    # Core business endpoints (business profile, customers)
    path("", include("core.urls")),
]
