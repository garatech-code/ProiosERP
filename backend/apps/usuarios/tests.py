from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.usuarios.services import validate_password_rules, has_consecutive_numbers, has_repeating_pattern

User = get_user_model()

class UserPasswordValidationTestCase(TestCase):
    def test_consecutive_numbers(self):
        self.assertTrue(has_consecutive_numbers("abc123xyz"))
        self.assertTrue(has_consecutive_numbers("987abc"))
        self.assertTrue(has_consecutive_numbers("abc890"))
        self.assertFalse(has_consecutive_numbers("abc135xyz"))

    def test_repeating_patterns(self):
        self.assertTrue(has_repeating_pattern("080808"))
        self.assertTrue(has_repeating_pattern("Lalala"))
        self.assertTrue(has_repeating_pattern("123123123"))
        self.assertFalse(has_repeating_pattern("P@ssword"))
        self.assertFalse(has_repeating_pattern("P@ss4926"))

    def test_password_rules(self):
        # Contraseña igual al usuario
        self.assertIsNotNone(validate_password_rules("12345678", username="12345678"))
        # Mínimo de caracteres
        self.assertIsNotNone(validate_password_rules("P@s12", username="12345678"))
        # Validación de mayúscula
        self.assertIsNotNone(validate_password_rules("p@ssword", username="12345678"))
        # Validación de minúscula
        self.assertIsNotNone(validate_password_rules("P@SSWORD", username="12345678"))
        # Validación de carácter especial
        self.assertIsNotNone(validate_password_rules("Password123", username="12345678"))
        # Validación de números consecutivos
        self.assertIsNotNone(validate_password_rules("P@ssword123", username="12345678"))
        # Validación de patrón repetitivo
        self.assertIsNotNone(validate_password_rules("P@ss080808", username="12345678"))
        # Contraseña fuerte válida
        self.assertIsNone(validate_password_rules("P@ss4926", username="12345678"))
