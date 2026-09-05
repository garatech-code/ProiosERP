# Protección de Layout de OperationDetail.jsx

El componente `OperationDetail.jsx` (`frontend/src/components/OperationDetail.jsx`) tiene un layout validado y estructurado explícitamente en base a los requerimientos del usuario.

## Regla de Oro
1. **El orden actual y la funcionalidad existente de este archivo están blindados.**
2. Cualquier nuevo requerimiento para este componente se debe interpretar como **añadir nueva funcionalidad o componentes (aditivos)**, sin modificar el flujo ni el orden de los elementos actuales (en particular todo lo que ocurre desde `Generate Cotizacion` hasta el final del documento).
3. **NO** modifiques el orden ni cambies el funcionamiento previo de `OperationDetail.jsx` **a menos que le pidas al usuario una confirmación explícita** detallando los cambios.

## Orden Blindado (Final del documento)
1. **Cotización y Remito** (Generar Cotización PDF / Generar Remito PDF).
2. **Opciones del Packing List y Documentación** (Proveedor, Factura, Remito Firmado, Rancho, etc.).
3. **Documentos Adicionales** (Módulo `OperationDocuments`).
4. **Archivos Adjuntos de la Cadena de Correos** (Listado de adjuntos extraídos de los emails).
5. **Historial de Mails** (Componente `OperationEmails`).
6. **Controles Operativos** (Botones de estado, Reanudar, Anular, Enviar a Aduanas, etc.).

Al sugerir o implementar adiciones, colócalas en los lugares lógicos sin destruir ni reordenar lo listado arriba.
