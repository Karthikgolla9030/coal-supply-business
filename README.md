# Coal Invoice & Records Management System

A production-quality business application to digitise the manual invoice process of a coal-supply business.

## Purpose

This system allows coal suppliers to:
- Create and manage customer records
- Generate and store digital invoices
- Produce PDF invoices matching the existing physical format
- Track payments and outstanding balances

> **Phase 2** — PostgreSQL database connected. Invoice features will be added in later phases.

---

## Technology Stack

| Layer       | Technology                             |
|-------------|----------------------------------------|
| Backend     | Python 3.14, Django 6.1                |
| API         | Django REST Framework 3.18             |
| Database    | PostgreSQL 18                          |
| DB Driver   | psycopg 3.3.4 (binary)                 |
| Config      | python-dotenv                          |

---

## Local Development Setup

### Prerequisites

- Python 3.11 or newer
- PostgreSQL 18 (running locally on port 5432)
- pgAdmin (to create the database)
- Git

---

### 1. Clone the repository

```bash
git clone <repository-url>
cd coal-invoice-system
```

---

### 2. Create and activate the virtual environment

**Windows (PowerShell)**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux**
```bash
python -m venv venv
source venv/bin/activate
```

---

### 3. Install requirements

```bash
pip install -r requirements.txt
```

---

### 4. Create the PostgreSQL database

1. Open **pgAdmin**
2. Connect to your local PostgreSQL server (`localhost:5432`)
3. Right-click **Databases → Create → Database**
4. Set the database name to: `coal_invoice_db`
5. Click **Save**

---

### 5. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=coal_invoice_db
DB_USER=postgres
DB_PASSWORD=your-postgresql-password
DB_HOST=localhost
DB_PORT=5432
```

> **Never commit `.env` to version control.**

---

### 6. Run migrations

```bash
cd backend
python manage.py migrate
```

Django will create all required system tables inside `coal_invoice_db`.

You can verify in pgAdmin:
```
coal_invoice_db → Schemas → public → Tables
```

Expected tables include:
- `django_migrations`
- `django_content_type`
- `auth_user`
- `auth_group`
- `auth_permission`
- `django_session`
- `django_admin_log`

---

### 7. Start the development server

```bash
python manage.py runserver
```

The server starts at: **http://127.0.0.1:8000/**

---

## Health-Check Endpoint

Verify that the backend is running:

```
GET http://127.0.0.1:8000/api/health/
```

Expected response:
```json
{
    "status": "ok",
    "service": "coal-invoice-backend"
}
```

---

## Verify PostgreSQL connection

Run in the project root:

```powershell
.\venv\Scripts\python.exe -c "
import os, sys
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.db import connection
print('vendor:', connection.vendor)
"
```

Expected output:
```
vendor: postgresql
```

---

## Run system checks

```bash
cd backend
python manage.py check
python manage.py showmigrations
```

---

## Project Structure

```
coal-invoice-system/
├── backend/
│   ├── manage.py
│   └── config/
│       ├── __init__.py
│       ├── settings.py      ← all config via environment variables
│       ├── urls.py          ← root URL routing
│       ├── api_urls.py      ← /api/* routing
│       ├── views.py         ← health-check view
│       ├── asgi.py
│       └── wsgi.py
├── venv/                    ← not committed to Git
├── .env                     ← not committed to Git
├── .env.example             ← safe template, no real credentials
├── .gitignore
├── requirements.txt
└── README.md
```

---

## Security Notes

- All secrets and database credentials live only in `.env`
- `.env` is listed in `.gitignore` and is never committed
- `.env.example` contains only safe placeholder values
- No credentials are hard-coded in `settings.py`

---

## Google Drive PDF Storage (Phase 10)

This application can automatically backup generated invoice PDFs to a configured Google Drive folder.

### Setup Instructions

1. **Google Cloud Project & API**: Create a project in Google Cloud Console and enable the "Google Drive API".
2. **Service Account**: Create a Service Account and generate a JSON key.
3. **Save Credential**: Save the JSON key exactly to:
   ```
   backend/credentials/google-service-account.json
   ```
   *Note: This file is securely ignored by `.gitignore` and will never be committed to Git or bundled into the frontend.*
4. **Drive Folder**: Create a folder in Google Drive to store invoices.
5. **Share Folder**: Share the folder with the Service Account email address (give it "Editor" permissions).
6. **Folder ID**: Extract the Folder ID from the Drive URL (e.g., `https://drive.google.com/drive/folders/<FOLDER_ID>`).
7. **Environment Variables**: Add the following to your `.env` file:
   ```env
   GOOGLE_DRIVE_ENABLED=true
   GOOGLE_DRIVE_FOLDER_ID=<FOLDER_ID>
   GOOGLE_SERVICE_ACCOUNT_FILE=backend/credentials/google-service-account.json
   ```
8. **Testing**: Create an invoice in the system and click "Upload to Google Drive" to test the integration.
