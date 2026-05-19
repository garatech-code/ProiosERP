from rest_framework import serializers
from apps.correos.models import EmailMessage, EmailAttachment, EmailTemplate

class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = '__all__'
        read_only_fields = ['creado_en']

class EmailAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAttachment
        fields = ['id', 'file', 'filename', 'content_type', 'size']

class EmailMessageSerializer(serializers.ModelSerializer):
    adjuntos = EmailAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = EmailMessage
        fields = [
            'id', 'message_id', 'subject', 'sender_address', 'sender_name',
            'recipient_address', 'cc_address', 'date_received', 
            'body_text', 'body_html', 'direction', 'is_read', 
            'operacion', 'adjuntos', 'creado_en'
        ]
        read_only_fields = ['message_id', 'date_received', 'creado_en']
