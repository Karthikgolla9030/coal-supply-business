"""
URL configuration for the Coal Invoice & Records Management System.

All API routes are prefixed with /api/.
"""

from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

from config.views import root_view, favicon_view

urlpatterns = [
    path("", root_view, name="root"),
    path("favicon.ico", favicon_view, name="favicon"),
    path("admin/", admin.site.urls),
    path("api/", include("config.api_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
