from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ['username', 'email', 'role', 'requires_owner_review', 'is_staff']
    fieldsets = UserAdmin.fieldsets + (
        ('Configuración ProIOS', {'fields': ('role', 'requires_owner_review')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Configuración ProIOS', {'fields': ('role', 'requires_owner_review')}),
    )
    list_filter = UserAdmin.list_filter + ('role', 'requires_owner_review')

admin.site.register(User, CustomUserAdmin)
