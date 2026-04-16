from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.usuarios.models import FeedbackItem

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'first_name', 'last_name')
        read_only_fields = ('id',)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Agregar claims personalizados
        token['role'] = user.role
        token['username'] = user.username
        return token

class FeedbackItemSerializer(serializers.ModelSerializer):
    creado_por_username = serializers.ReadOnlyField(source='creado_por.username')
    creado_por_role = serializers.ReadOnlyField(source='creado_por.role')

    class Meta:
        model = FeedbackItem
        fields = '__all__'
        read_only_fields = ['creado_por', 'fecha_creacion']

    def create(self, validated_data):
        validated_data['creado_por'] = self.context['request'].user
        return super().create(validated_data)
