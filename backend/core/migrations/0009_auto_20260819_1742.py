from django.db import migrations

def assign_customers_to_business(apps, schema_editor):
    Customer = apps.get_model('core', 'Customer')
    BusinessProfile = apps.get_model('core', 'BusinessProfile')
    User = apps.get_model('auth', 'User')
    
    first_business = BusinessProfile.objects.first()
    
    if not first_business:
        # If there's no business profile but there are customers, we create one
        if Customer.objects.exists():
            first_user = User.objects.first()
            first_business = BusinessProfile.objects.create(
                owner=first_user,
                business_name="Legacy Business"
            )
            
    if first_business:
        # Assign all customers without a business to the first business
        Customer.objects.filter(business__isnull=True).update(business=first_business)

def reverse_assign(apps, schema_editor):
    pass # No reversal needed

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_businessprofile_google_drive_folder_id_and_more'),
    ]

    operations = [
        migrations.RunPython(assign_customers_to_business, reverse_assign),
    ]
