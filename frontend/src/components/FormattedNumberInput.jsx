import React, { useState, useEffect } from 'react';

export default function FormattedNumberInput({
  value,
  onChange,
  className,
  placeholder,
  readOnly,
  disabled,
  min,
  max
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState('');

  // Formateador visual (ej. 1.000,50)
  const formatVisual = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const num = parseFloat(String(val));
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Formateador para edición manual (ej. 1000,50 - sin puntos de miles)
  const formatForEditing = (val) => {
    if (val === null || val === undefined || val === '') return '';
    return String(val).replace('.', ',');
  };

  useEffect(() => {
    if (!isFocused) {
      setInternalValue(formatVisual(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setInternalValue(formatForEditing(value));
  };

  const parseStandard = (raw) => {
    if (!raw) return '';
    // Permitir solo números, puntos, comas y signo menos
    let clean = raw.replace(/[^0-9,.-]/g, '');
    
    // Si el usuario pegó un valor con puntos de miles (ej 1.000,50), los limpiamos
    // Para simplificar, si hay más de un punto, o si hay un punto y una coma, 
    // asumimos que el punto es de miles y lo borramos.
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '');
    }
    
    // Si tiene comas múltiples, quedarse con la primera
    const parts = clean.split(',');
    if (parts.length > 2) clean = parts[0] + ',' + parts.slice(1).join('');
    
    // Convertir la coma a punto decimal estándar para que el padre pueda hacer parseFloat
    return clean.replace(',', '.');
  };

  const handleChange = (e) => {
    let raw = e.target.value;
    
    // Evitamos letras y caracteres raros instantáneamente en la UI
    if (/[^0-9,.-]/.test(raw)) {
       raw = raw.replace(/[^0-9,.-]/g, '');
    }

    setInternalValue(raw);
    
    // Pasamos el valor estandarizado al padre (ej. 1000.5)
    const standard = parseStandard(raw);
    onChange(standard);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    const standard = parseStandard(e.target.value);
    
    // Si el valor ingresado es un punto/coma suelto, lo limpiamos
    if (standard === '.' || standard === '-' || standard === '-.') {
      onChange('');
    } else {
      onChange(standard);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={internalValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      readOnly={readOnly}
      disabled={disabled}
      min={min}
      max={max}
    />
  );
}
