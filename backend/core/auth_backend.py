from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Custom authentication backend that allows users to log in using either
    their email address or their username, case-insensitively and with
    leading/trailing whitespace trimmed.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD) or kwargs.get('email')
        
        if not username or not password:
            return None

        clean_identifier = str(username).strip()
        try:
            # Check users matching either username or email case-insensitively
            candidates = list(User.objects.filter(
                Q(username__iexact=clean_identifier) | Q(email__iexact=clean_identifier)
            ).order_by('id'))

            for candidate in candidates:
                if candidate.check_password(password) and self.user_can_authenticate(candidate):
                    return candidate
        except Exception:
            return None
        return None
