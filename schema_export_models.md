# ProIOS Database Schema

## App: whitenoise.runserver_nostatic

## App: guardian

### Model: UserObjectPermission
| Field | Type | Attributes |
|---|---|---|
| id | AutoField |  |
| permission | ForeignKey |  |
| content_type | ForeignKey |  |
| object_pk | CharField |  |
| user | ForeignKey |  |
| content_object | GenericForeignKey |  |

### Model: GroupObjectPermission
| Field | Type | Attributes |
|---|---|---|
| id | AutoField |  |
| permission | ForeignKey |  |
| content_type | ForeignKey |  |
| object_pk | CharField |  |
| group | ForeignKey |  |
| content_object | GenericForeignKey |  |

## App: apps.usuarios

### Model: User
| Field | Type | Attributes |
|---|---|---|
| logentry | ManyToOneRel |  |
| outstandingtoken | ManyToOneRel |  |
| userobjectpermission | ManyToOneRel |  |
| feedbacks | ManyToOneRel |  |
| operaciones_creadas | ManyToOneRel |  |
| operaciones_asignadas | ManyToManyRel |  |
| operaciones_contables | ManyToManyRel |  |
| operaciones_como_operario | ManyToManyRel |  |
| created_events | ManyToOneRel |  |
| assigned_events | ManyToOneRel |  |
| id | BigAutoField |  |
| password | CharField |  |
| last_login | DateTimeField |  |
| is_superuser | BooleanField | Indica que este usuario tiene todos los permisos sin asignárselos explícitamente. |
| username | CharField | Requerido. 150 carácteres como máximo. Únicamente letras, dígitos y @/./+/-/_  |
| first_name | CharField |  |
| last_name | CharField |  |
| email | EmailField |  |
| is_staff | BooleanField | Indica si el usuario puede entrar en este sitio de administración. |
| is_active | BooleanField | Indica si el usuario debe ser tratado como activo. Desmarque esta opción en lugar de borrar la cuenta. |
| date_joined | DateTimeField |  |
| role | CharField |  |
| requires_owner_review | BooleanField |  |
| groups | ManyToManyField | Los grupos a los que pertenece este usuario. Un usuario tendrá todos los permisos asignados a cada uno de sus grupos. |
| user_permissions | ManyToManyField | Permisos específicos para este usuario. |

### Model: FeedbackItem
| Field | Type | Attributes |
|---|---|---|
| id | BigAutoField |  |
| titulo | CharField |  |
| descripcion | TextField |  |
| estado | CharField |  |
| creado_por | ForeignKey |  |
| fecha_creacion | DateTimeField |  |

### Model: PersonalPlantel
| Field | Type | Attributes |
|---|---|---|
| operaciones_asociadas | ManyToManyRel |  |
| id | BigAutoField |  |
| nombres | CharField |  |
| apellidos | CharField |  |
| dni | CharField |  |
| rol | CharField | Ej: Operario, Capataz, Especialista |
| activo | BooleanField |  |
| fecha_registro | DateTimeField |  |

## App: apps.operaciones

### Model: Client
| Field | Type | Attributes |
|---|---|---|
| operaciones | ManyToOneRel |  |
| id | BigAutoField |  |
| name | CharField |  |
| contact_person | CharField |  |
| email | EmailField |  |
| phone | CharField |  |
| price_list | JSONField |  |
| created_at | DateTimeField |  |
| updated_at | DateTimeField |  |

### Model: Ship
| Field | Type | Attributes |
|---|---|---|
| operacion | ManyToOneRel |  |
| id | BigAutoField |  |
| name | CharField |  |
| imo | CharField |  |
| flag | CharField |  |
| call_sign | CharField |  |
| gross_tonnage | IntegerField |  |

### Model: Port
| Field | Type | Attributes |
|---|---|---|
| operacion | ManyToOneRel |  |
| id | BigAutoField |  |
| name | CharField |  |
| country | CharField |  |
| code | CharField |  |

### Model: Agency
| Field | Type | Attributes |
|---|---|---|
| operacion | ManyToOneRel |  |
| id | BigAutoField |  |
| name | CharField |  |
| contact_name | CharField |  |
| phone | CharField |  |
| email | EmailField |  |

### Model: Operacion
| Field | Type | Attributes |
|---|---|---|
| detalles | ManyToOneRel |  |
| correos_adjuntos | ManyToOneRel |  |
| id | BigAutoField |  |
| cliente | ForeignKey |  |
| ship | ForeignKey |  |
| port | ForeignKey |  |
| agency | ForeignKey |  |
| eta | DateTimeField |  |
| delivery_method | CharField |  |
| notas | TextField |  |
| texto_pedido | TextField | Contenido original del e-mail o pedido del cliente. |
| nombre | CharField | Nombre identificatorio de la operación |
| order_received_date | DateTimeField |  |
| client_confirmed_date | DateTimeField |  |
| delivery_date | DateTimeField |  |
| closed_date | DateTimeField |  |
| tipo_operacion | CharField |  |
| aprobacion_requerida_owner | BooleanField |  |
| detalle_servicio | TextField | Descripción detallada para operaciones de tipo Servicio. |
| subtipo_servicio | CharField | Categoría específica del servicio (Mecanica, Electricidad, etc.) |
| forma_cotizacion_servicio | CharField |  |
| packing_list_file | FileField |  |
| remito_file | FileField |  |
| rancho_file | FileField |  |
| stock_consumido | BooleanField |  |
| fecha_creacion | DateTimeField |  |
| fecha_actualizacion | DateTimeField |  |
| estado_revision | CharField |  |
| mensaje_revision | TextField | Comentarios del operador (al solicitar) o del owner (al aprobar/rechazar). |
| estado | FSMField |  |
| creado_por | ForeignKey |  |
| operadores_asignados | ManyToManyField |  |
| contables_asignados | ManyToManyField |  |
| operarios_asignados | ManyToManyField |  |
| operarios_usuarios_asignados | ManyToManyField |  |

### Model: OperacionDetalle
| Field | Type | Attributes |
|---|---|---|
| id | BigAutoField |  |
| operacion | ForeignKey |  |
| articulo_id | IntegerField |  |
| cantidad | IntegerField |  |
| precio_unitario | DecimalField |  |

### Model: AgendaEvent
| Field | Type | Attributes |
|---|---|---|
| id | BigAutoField |  |
| title | CharField |  |
| description | TextField |  |
| start_date | DateTimeField |  |
| end_date | DateTimeField |  |
| created_by | ForeignKey |  |
| assigned_to | ForeignKey |  |
| created_at | DateTimeField |  |
| updated_at | DateTimeField |  |

## App: apps.inventario

### Model: Proveedor
| Field | Type | Attributes |
|---|---|---|
| articulos | ManyToOneRel |  |
| id | BigAutoField |  |
| nombre | CharField |  |
| contacto | CharField |  |
| telefono | CharField |  |
| email | EmailField |  |
| direccion | TextField |  |
| rubro | CharField |  |
| condicion_pago | CharField |  |
| created_at | DateTimeField |  |
| updated_at | DateTimeField |  |

### Model: Articulo
| Field | Type | Attributes |
|---|---|---|
| movimientos | ManyToOneRel |  |
| id | BigAutoField |  |
| nombre | CharField |  |
| descripcion | TextField |  |
| presentacion | CharField |  |
| peso_kg | DecimalField |  |
| stock_actual | DecimalField |  |
| stock_minimo | DecimalField | Stock mínimo para alerta (amarillo) |
| categoria | CharField |  |
| proveedor | ForeignKey |  |

### Model: MovimientoStock
| Field | Type | Attributes |
|---|---|---|
| id | BigAutoField |  |
| articulo | ForeignKey |  |
| tipo | CharField |  |
| cantidad | DecimalField |  |
| stock_resultante | DecimalField |  |
| operacion_id | IntegerField |  |
| razon | CharField |  |
| fecha | DateTimeField |  |

## App: apps.produccion

### Model: FormulaBOM
| Field | Type | Attributes |
|---|---|---|
| componentes | ManyToOneRel |  |
| ordenfabricacion | ManyToOneRel |  |
| id | BigAutoField |  |
| nombre | CharField |  |
| articulo_final_id | IntegerField |  |
| activa | BooleanField |  |

### Model: ComponenteBOM
| Field | Type | Attributes |
|---|---|---|
| id | BigAutoField |  |
| formula | ForeignKey |  |
| insumo_id | IntegerField |  |
| cantidad_requerida | DecimalField |  |

### Model: OrdenFabricacion
| Field | Type | Attributes |
|---|---|---|
| id | BigAutoField |  |
| operacion_id | IntegerField |  |
| formula | ForeignKey |  |
| cantidad_a_producir | DecimalField |  |
| completada | BooleanField |  |
| fecha_solicitud | DateTimeField |  |

## App: apps.documentos

## App: apps.correos

### Model: EmailMessage
| Field | Type | Attributes |
|---|---|---|
| adjuntos | ManyToOneRel |  |
| id | BigAutoField |  |
| message_id | CharField | ID del encabezado original del correo |
| subject | CharField |  |
| sender_address | EmailField |  |
| sender_name | CharField |  |
| recipient_address | TextField | Separados por coma si hay varios |
| cc_address | TextField |  |
| date_received | DateTimeField |  |
| body_text | TextField |  |
| body_html | TextField |  |
| direction | CharField |  |
| is_read | BooleanField |  |
| operacion | ForeignKey |  |
| creado_en | DateTimeField |  |

### Model: EmailAttachment
| Field | Type | Attributes |
|---|---|---|
| id | BigAutoField |  |
| email | ForeignKey |  |
| file | FileField |  |
| filename | CharField |  |
| content_type | CharField |  |
| size | PositiveIntegerField | Tamaño en bytes |

