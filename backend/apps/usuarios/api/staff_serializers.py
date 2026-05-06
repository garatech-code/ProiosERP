from rest_framework import serializers
from ..models import PersonalPlantel

class PersonalPlantelSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalPlantel
        fields = '__all__'
