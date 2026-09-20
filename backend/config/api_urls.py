"""
Top-level API URL routes.

All paths here are already prefixed with /api/ from config/urls.py.
"""

from django.urls import include, path

from config.views import HealthCheckView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from core.views import (
    CurrentUserView, 
    RegisterView,
    PasswordResetRequestView,
    PasswordResetValidateTokenView,
    PasswordResetConfirmView,
)

urlpatterns = [
    # Health check — public, no auth required
    path("health/", HealthCheckView.as_view(), name="health-check"),

    # Auth endpoints
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/forgot-password/", PasswordResetRequestView.as_view(), name="password_reset_request"),
    path("auth/reset-password/validate/", PasswordResetValidateTokenView.as_view(), name="password_reset_validate"),
    path("auth/reset-password/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),

    # Core business endpoints (business profile, customers)
    path("", include("core.urls")),
]
