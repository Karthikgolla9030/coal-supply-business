"""
Django settings for the Coal Invoice & Records Management System.

Values are loaded from environment variables via a .env file.
See .env.example for the required variables.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# ─────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from the .env file at the project root
load_dotenv(BASE_DIR.parent / ".env")

# ─────────────────────────────────────────────
# Security
# ─────────────────────────────────────────────

SECRET_KEY = os.environ["SECRET_KEY"]

DEBUG = os.getenv("DEBUG", "False").strip().lower() in ("1", "true", "yes")

_allowed_hosts_env = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1")
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_env.split(",") if h.strip()]

# Automatically support Render deployment domains
render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME")
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)
if ".onrender.com" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(".onrender.com")

# ─────────────────────────────────────────────
# Application definition
# ─────────────────────────────────────────────

INSTALLED_APPS = [
    # Django built-ins
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "corsheaders",
    "rest_framework",
    "django_filters",
    # Project apps
    "core",
]

MIDDLEWARE = [
    # CorsMiddleware must be before CommonMiddleware
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ─────────────────────────────────────────────
# Database — PostgreSQL
#
# All values must be supplied via environment variables.
# ─────────────────────────────────────────────

import urllib.parse

_db_url = os.getenv("DATABASE_URL")
if _db_url:
    _parsed = urllib.parse.urlparse(_db_url)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _parsed.path.lstrip("/"),
            "USER": urllib.parse.unquote(_parsed.username or ""),
            "PASSWORD": urllib.parse.unquote(_parsed.password or ""),
            "HOST": _parsed.hostname or "localhost",
            "PORT": str(_parsed.port or 5432),
            "OPTIONS": {"sslmode": "require"},
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", ""),
            "USER": os.getenv("DB_USER", ""),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }
    _pgsslmode = os.getenv("PGSSLMODE")
    if _pgsslmode:
        DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = _pgsslmode
    elif os.getenv("DB_HOST", "localhost") not in ("localhost", "127.0.0.1"):
        DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = "require"

# ─────────────────────────────────────────────
# Password validation
# ─────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = [
    "core.auth_backend.EmailOrUsernameModelBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# ─────────────────────────────────────────────
# Internationalisation
# ─────────────────────────────────────────────

LANGUAGE_CODE = "en-us"

TIME_ZONE = "Asia/Kolkata"

USE_I18N = True

USE_TZ = True

# ─────────────────────────────────────────────
# Static files
# ─────────────────────────────────────────────

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# ─────────────────────────────────────────────
# Default primary key type
# ─────────────────────────────────────────────

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─────────────────────────────────────────────
# Django REST Framework
# ─────────────────────────────────────────────

REST_FRAMEWORK = {
    # Authentication: Use JWT first, fallback to Session for admin/browsable API
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    # Business endpoints require authentication.
    # The health endpoint overrides this with AllowAny explicitly.
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    # Pagination for list endpoints
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    # Filter backend
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
    ],
    # Throttling
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/minute",
        "user": "1000/minute",
        "password_reset": "5/minute",
    },
}

from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ─────────────────────────────────────────────
# CORS — Cross-Origin Resource Sharing
#
# Allows the React development server (Vite on port 5173)
# to make requests to the Django API.
#
# CORS_ALLOW_ALL_ORIGINS must NOT be set to True in production.
# Add production origin to CORS_ALLOWED_ORIGINS via environment variable.
# ─────────────────────────────────────────────

_cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]

# Automatically allow Vercel and Render preview and production domains
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
    r"^https://.*\.onrender\.com$",
]

# CSRF trusted origins for secure form/cookie submission
CSRF_TRUSTED_ORIGINS = [
    "https://*.vercel.app",
    "https://*.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Allow credentials (cookies/session) to be sent cross-origin
CORS_ALLOW_CREDENTIALS = True

# ─────────────────────────────────────────────
# Google Drive Configuration
# ─────────────────────────────────────────────

GOOGLE_DRIVE_ENABLED = os.getenv("GOOGLE_DRIVE_ENABLED", "false").lower() == "true"

# Google OAuth 2.0 Client credentials
GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
GOOGLE_OAUTH_REDIRECT_URI = os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "http://127.0.0.1:8000/api/google-drive/oauth/callback/")

# Legacy Service Account configuration (kept temporarily)
_default_creds = BASE_DIR.parent / "backend" / "credentials" / "google-service-account.json"
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", str(_default_creds))

# ─────────────────────────────────────────────
# External APIs (Phase 1 GSTIN Integration)
# ─────────────────────────────────────────────

GSTIN_API_KEY = os.getenv("GSTIN_API_KEY")

# ─────────────────────────────────────────────
# Email Configuration
# ─────────────────────────────────────────────

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").strip().lower() in ("1", "true", "yes")
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False").strip().lower() in ("1", "true", "yes")
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "").strip()
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "").replace(" ", "").strip()
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Coal Invoice <noreply@example.com>")

# Frontend base URL for password reset links and external redirects
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# Password reset token expiry in seconds (default 3600 = 1 hour)
PASSWORD_RESET_TIMEOUT = int(os.getenv("PASSWORD_RESET_TIMEOUT", 3600))

# ─────────────────────────────────────────────
# Logging — ensure 500 errors and warnings appear in Render console
# ─────────────────────────────────────────────

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)s]: %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": True,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": True,
        },
    },
}
