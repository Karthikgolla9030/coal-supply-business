from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from core.models import Customer, BusinessProfile

class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            username="owner",
            password="testpassword",
            email="owner@example.com"
        )
        self.business = BusinessProfile.objects.create(
            business_name="Test Coal Business",
            address="123 Test St",
            gstin="22AAAAA0000A1Z5",
            owner=self.user
        )

    def test_login_success(self):
        """Test successful login returns access and refresh tokens."""
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "owner",
            "password": "testpassword"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_email(self):
        """Test login using email address instead of username."""
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "owner@example.com",
            "password": "testpassword"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_login_with_case_and_whitespace_insensitivity(self):
        """Test login works with uppercase letters and whitespace."""
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "  OWNER@EXAMPLE.COM  ",
            "password": "testpassword"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_login_failure(self):
        """Test login with incorrect password fails."""
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "owner",
            "password": "wrongpassword"
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)

    def test_current_user_unauthenticated(self):
        """Test /api/auth/me/ without token fails."""
        url = reverse("current_user")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_authenticated(self):
        """Test /api/auth/me/ with token returns user info."""
        # Get token
        token_response = self.client.post(reverse("token_obtain_pair"), {
            "username": "owner",
            "password": "testpassword"
        })
        access_token = token_response.data["access"]

        # Request me
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.get(reverse("current_user"))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "owner")
        self.assertEqual(response.data["email"], "owner@example.com")

    def test_protected_route_unauthenticated(self):
        """Test core API route without token fails."""
        url = reverse("customer-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_route_authenticated(self):
        """Test core API route with token succeeds."""
        token_response = self.client.post(reverse("token_obtain_pair"), {
            "username": "owner",
            "password": "testpassword"
        })
        access_token = token_response.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        url = reverse("customer-list")
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_registration_success(self):
        """Test successful registration atomically creates User and BusinessProfile."""
        url = reverse("register")
        response = self.client.post(url, {
            "full_name": "New Owner",
            "email": "newowner@example.com",
            "password": "strongpassword123",
            "password_confirm": "strongpassword123",
            "business_name": "New Coal Co"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertTrue(User.objects.filter(username="newowner@example.com").exists())
        user = User.objects.get(username="newowner@example.com")
        self.assertTrue(BusinessProfile.objects.filter(owner=user, business_name="New Coal Co").exists())

    def test_registration_missing_fields(self):
        url = reverse("register")
        response = self.client.post(url, {
            "full_name": "New Owner",
            "email": "newowner@example.com",
            # missing password
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="newowner@example.com").exists())

    def test_registration_password_mismatch(self):
        url = reverse("register")
        response = self.client.post(url, {
            "full_name": "New Owner",
            "email": "newowner@example.com",
            "password": "strongpassword123",
            "password_confirm": "differentpassword",
            "business_name": "New Coal Co"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_weak_password(self):
        url = reverse("register")
        response = self.client.post(url, {
            "full_name": "New Owner",
            "email": "newowner@example.com",
            "password": "123",
            "password_confirm": "123",
            "business_name": "New Coal Co"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_duplicate_email(self):
        url = reverse("register")
        response = self.client.post(url, {
            "full_name": "Owner Duplicate",
            "email": "owner@example.com", # already exists from setUp
            "password": "strongpassword123",
            "password_confirm": "strongpassword123",
            "business_name": "Duplicate Co"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ─────────────────────────────────────────────────────────
    # Password Reset Tests
    # ─────────────────────────────────────────────────────────

    def test_password_reset_request_existing_user(self):
        """Test password reset request for existing user sends email with reset link."""
        from django.core import mail
        mail.outbox = []

        url = reverse("password_reset_request")
        response = self.client.post(url, {"email": "owner@example.com"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.data)
        self.assertEqual(
            response.data["detail"],
            "If an account exists with this email, a password reset link has been sent."
        )
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("Reset your Coal Invoice password", email.subject)
        self.assertIn("owner@example.com", email.to)
        self.assertIn("/reset-password/", email.body)

    def test_password_reset_request_nonexistent_user(self):
        """Test password reset request for non-existing user returns same generic 200 without email."""
        from django.core import mail
        mail.outbox = []

        url = reverse("password_reset_request")
        response = self.client.post(url, {"email": "nobody@example.com"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["detail"],
            "If an account exists with this email, a password reset link has been sent."
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_password_reset_request_invalid_email(self):
        """Test invalid email format returns 400."""
        url = reverse("password_reset_request")
        response = self.client.post(url, {"email": "invalid-email"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_reset_validate_token(self):
        """Test token validation endpoint."""
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        valid_token = default_token_generator.make_token(self.user)

        url = reverse("password_reset_validate")
        # 1. Valid token
        res_valid = self.client.get(url, {"uid": uid, "token": valid_token})
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)
        self.assertTrue(res_valid.data["valid"])
        self.assertEqual(res_valid.data["email"], "owner@example.com")

        # 2. Tampered token
        res_invalid = self.client.get(url, {"uid": uid, "token": "invalid-token"})
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res_invalid.data["valid"])

    def test_password_reset_confirm_flow(self):
        """Test complete password reset confirmation, password validation, and token invalidation."""
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        url = reverse("password_reset_confirm")

        # 1. Passwords do not match
        res_mismatch = self.client.post(url, {
            "uid": uid,
            "token": token,
            "password": "NewSecretPassword123!",
            "password_confirm": "DifferentPassword123!"
        })
        self.assertEqual(res_mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Passwords do not match", res_mismatch.data["detail"])

        # 2. Password too short / weak
        res_weak = self.client.post(url, {
            "uid": uid,
            "token": token,
            "password": "123",
            "password_confirm": "123"
        })
        self.assertEqual(res_weak.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Successful password reset
        new_password = "NewSecretPassword123!"
        res_success = self.client.post(url, {
            "uid": uid,
            "token": token,
            "password": new_password,
            "password_confirm": new_password
        })
        self.assertEqual(res_success.status_code, status.HTTP_200_OK)
        self.assertIn("Your password has been reset successfully", res_success.data["detail"])

        # 4. Old password no longer works
        login_url = reverse("token_obtain_pair")
        old_login = self.client.post(login_url, {
            "username": "owner",
            "password": "testpassword"
        })
        self.assertEqual(old_login.status_code, status.HTTP_401_UNAUTHORIZED)

        # 5. New password successfully logs in
        new_login = self.client.post(login_url, {
            "username": "owner",
            "password": new_password
        })
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)
        self.assertIn("access", new_login.data)

        # 6. Re-using the same reset token is prevented
        res_reuse = self.client.post(url, {
            "uid": uid,
            "token": token,
            "password": "AnotherNewPassword123!",
            "password_confirm": "AnotherNewPassword123!"
        })
        self.assertEqual(res_reuse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invalid or has expired", res_reuse.data["detail"])
