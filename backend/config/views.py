"""
Project-level views.

Currently contains only the health-check endpoint used to verify that the
Django application is running correctly.
"""

from django.http import HttpResponse, JsonResponse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


def root_view(request):
    """
    GET / or HEAD /
    Public root endpoint so Render health checks and browser visits return 200 OK.
    """
    if request.method == "HEAD":
        return HttpResponse(content_type="application/json")
    return JsonResponse(
        {
            "status": "ok",
            "service": "coal-invoice-backend",
            "message": "Coal Supply Business API is operational",
            "endpoints": {
                "health": "/api/health/",
                "admin": "/admin/",
                "api": "/api/",
            },
        }
    )


def favicon_view(request):
    """
    GET /favicon.ico
    Returns 204 No Content to avoid browser 404 logs.
    """
    return HttpResponse(status=204)


class HealthCheckView(APIView):
    """
    GET /api/health/

    Returns a JSON payload confirming the service is up and checking database connectivity.
    Explicitly public — no authentication required.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        db_status = "unknown"
        db_error = None
        user_count = 0
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user_count = User.objects.count()
            db_status = "connected"
        except Exception as e:
            db_status = "error"
            db_error = str(e)

        return Response(
            {
                "status": "ok" if db_status == "connected" else "degraded",
                "service": "coal-invoice-backend",
                "database": db_status,
                "db_error": db_error,
                "user_count": user_count,
            }
        )
