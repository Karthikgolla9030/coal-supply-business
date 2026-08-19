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
            "password": "strongpassword123",
            "password_confirm": "strongpassword123",
            # missing business_name
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
