"""Genera los mockups de las pantallas del sistema QA Knowledge.

Cada pantalla se describe una sola vez con controles de Balsamiq Wireframes (BrowserWindow, Button, DataGrid, …).
De esa descripción salen:

  * El proyecto de Balsamiq Wireframes (`QA-Knowledge.bmpr`), editable en Balsamiq Wireframes 4 o Balsamiq Cloud.
  * Una página HTML por pantalla con el mismo estilo boceto, que `render.mjs` convierte en PNG para los documentos.

Uso:
  python3 generar_mockups.py html <carpeta_html> <carpeta_assets>
  python3 generar_mockups.py bmpr <archivo.bmpr> [<carpeta_miniaturas>]
"""

import base64
import html
import json
import os
import sqlite3
import sys
import time
import uuid

W = 1280  # ancho de todas las pantallas
CX = 270  # inicio del área de contenido (a la derecha del menú lateral)
CW = 980  # ancho del área de contenido

PRIMARY = '#3f51b5'
PRIMARY_LIGHT = '#e8eaf6'
MUTED = '#666666'
SURFACE = '#f3f3f6'
BORDER = '#999999'
RED = '#c62828'
RED_LIGHT = '#fdecea'
GREEN = '#2e7d32'
GREEN_LIGHT = '#e8f5e9'
AMBER = '#a15c00'
AMBER_LIGHT = '#fff4e0'
WHITE = '#ffffff'

USER = 'Lucía Ramos'
ROLE = 'Administrador'
PROJECT = 'Tienda Galaxia Online'


# ---------------------------------------------------------------------------------------------------------------------
# Controles
# ---------------------------------------------------------------------------------------------------------------------

def c(kind, x, y, w, h, **props):
    return {'t': kind, 'x': x, 'y': y, 'w': w, 'h': h, 'p': props}


def label(x, y, text, w=300, size=14, h=None, **p):
    return c('Label', x, y, w, h or size + 8, text=text, size=size, **p)


def para(x, y, w, h, text, size=14, **p):
    return c('Paragraph', x, y, w, h, text=text, size=size, **p)


def title(x, y, text, w=700, size=28):
    return c('Title', x, y, w, size + 12, text=text, size=size)


def icon(x, y, name, size=20, **p):
    return c('Icon', x, y, size, size, icon=name, px=size, **p)


def button(x, y, w, text, primary=False, h=36, icon_name=None, **p):
    props = dict(text=text, size=14, **p)
    if primary:
        props.update(color=PRIMARY, textColor=WHITE)
    if icon_name:
        props['icon'] = icon_name
    return c('Button', x, y, w, h, **props)


def box(x, y, w, h, color=WHITE, border=BORDER, **p):
    return c('Canvas', x, y, w, h, color=color, borderColor=border, **p)


def field(x, y, w, caption, value='', kind='TextInput', h=36, hint=None, error=None, suffix=None, **p):
    """Campo de formulario: rótulo pequeño, control y (opcional) ayuda o error debajo."""
    out = [label(x, y, caption, w=w, size=12, color=MUTED)]
    out.append(c(kind, x, y + 18, w, h, text=value, size=14, **p))
    if suffix:
        out.append(icon(x + w - 28, y + 18 + (h - 18) // 2, suffix, size=18, color=MUTED))
    if error:
        out.append(label(x, y + 22 + h, error, w=w, size=12, color=RED))
    elif hint:
        out.append(label(x, y + 22 + h, hint, w=w, size=12, color=MUTED))
    return out


def tag(x, y, text, color, bg, w=None):
    w = w or (len(text) * 8 + 20)
    return [box(x, y, w, 24, color=bg, border=bg, radius=12), label(x, y + 2, text, w=w, size=12, color=color, align='center')]


def grid(x, y, w, rows, widths, row_h=44, **p):
    """Tabla. rows[0] es el encabezado; widths son porcentajes; las celdas no deben llevar comas."""
    text = '\n'.join(','.join(r) for r in rows)
    text += '\n{' + ','.join(str(v) for v in widths) + '}'
    return c('DataGrid', x, y, w, row_h * len(rows), text=text, rowHeight=row_h, size=13, **p)


def column_x(x, w, widths, index):
    return x + int(w * sum(widths[:index]) / 100)


def dialog(x, y, w, h, title_text):
    return [c('TitleWindow', x, y, w, h, text=title_text, size=18)]


def overlay(h):
    return [c('Canvas', 0, 72, W, h - 72, color='#000000', borderColor='#000000', backgroundAlpha=0.35)]


# ---------------------------------------------------------------------------------------------------------------------
# Estructura común: ventana, menú lateral y barra superior
# ---------------------------------------------------------------------------------------------------------------------

NAV = [
    ('item', 'inicio', 'home', 'Inicio'),
    ('header', None, None, 'Base de conocimiento'),
    ('item', 'requirements', 'file-text-o', 'Requerimientos'),
    ('item', 'business-rules', 'gavel', 'Reglas de negocio'),
    ('item', 'test-cases', 'check-square-o', 'Casos de prueba'),
    ('item', 'defects', 'bug', 'Defectos'),
    ('item', 'carga', 'upload', 'Carga masiva'),
    ('header', None, None, 'Generación'),
    ('soon', 'generar', 'magic', 'Generar casos de prueba'),
    ('header', None, None, 'Configuración'),
    ('item', 'catalogos', 'sitemap', 'Proyectos y módulos'),
    ('item', 'usuarios', 'users', 'Usuarios'),
    ('item', 'permisos', 'shield', 'Permisos por rol'),
]


def shell(url, active, h=800, window_title='QA Knowledge'):
    out = [c('BrowserWindow', 0, 0, W, h, text=f'{window_title}\nhttp://localhost:8080/{url}')]
    out.append(box(1, 72, 240, h - 73, color=SURFACE, border=SURFACE))
    out += [
        icon(18, 92, 'flask', size=28, color=PRIMARY),
        label(56, 86, 'QA Knowledge', w=180, size=16, bold=True),
        label(56, 108, 'Generación de casos de prueba', w=180, size=11, color=MUTED),
    ]
    y = 150
    for kind, key, ico, text in NAV:
        if kind == 'header':
            y += 6
            out.append(label(16, y, text, w=210, size=12, color=MUTED, bold=True))
            y += 24
            continue
        if key == active:
            out.append(box(8, y - 2, 224, 34, color=PRIMARY_LIGHT, border=PRIMARY_LIGHT, radius=17))
        disabled = kind == 'soon'
        out.append(icon(22, y + 6, ico, size=18, color='#aaaaaa' if disabled else '#444444'))
        out.append(label(52, y + 4, text, w=180, size=14, color='#aaaaaa' if disabled else '#222222',
                         bold=key == active))
        if disabled:
            out.append(label(52, y + 24, 'Próximamente', w=180, size=11, color='#aaaaaa'))
            y += 14
        y += 36
    # Barra superior con el menú de usuario
    out.append(c('HRule', 242, 128, W - 244, 2))
    out.append(icon(1004, 89, 'user-circle', size=24, color='#444444'))
    out.append(label(1034, 90, USER, w=110, size=14))
    out += tag(1146, 90, ROLE, PRIMARY, PRIMARY_LIGHT, w=110)
    out.append(icon(1260, 94, 'caret-down', size=14, color=MUTED))
    return out


def page_header(title_text, subtitle=None, y=150, back=None):
    out = []
    if back:
        out.append(c('Link', CX, y, 220, 22, text='← ' + back, size=14))
        y += 30
    out.append(title(CX, y, title_text))
    if subtitle:
        out.append(para(CX, y + 46, 700, 44, subtitle, color=MUTED))
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Pantallas
# ---------------------------------------------------------------------------------------------------------------------

def login():
    h = 800
    out = [c('BrowserWindow', 0, 0, W, h, text='QA Knowledge\nhttp://localhost:8080/login')]
    out.append(box(1, 72, W - 2, h - 73, color=SURFACE, border=SURFACE))
    x, y, w = 430, 190, 420
    out.append(box(x, y, w, 430, radius=12))
    out += [
        icon(x + 28, y + 30, 'flask', size=40, color=PRIMARY),
        label(x + 84, y + 28, 'QA Knowledge', w=300, size=22, bold=True),
        para(x + 84, y + 58, 310, 44, 'Sistema de generación de casos de prueba funcionales con LLM', size=13, color=MUTED),
    ]
    out += field(x + 28, y + 130, w - 56, 'Correo', 'analista@qa.local')
    out += field(x + 28, y + 200, w - 56, 'Contraseña', '••••••••••', suffix='eye')
    out.append(box(x + 28, y + 272, w - 56, 50, color=RED_LIGHT, border=RED_LIGHT))
    out.append(para(x + 40, y + 278, w - 80, 40, 'Mensaje de error si el correo o la contraseña no son válidos.', size=13,
                    color=RED))
    out.append(button(x + 28, y + 350, w - 56, 'Iniciar sesión', primary=True, h=42))
    return h, out


def home(active='inicio'):
    h = 800
    out = shell('inicio', active, h)
    out.append(title(CX, 150, f'Hola, {USER}'))
    out.append(para(CX, 196, 900, 44,
                    'Registre la información histórica (requerimientos, reglas de negocio, casos de prueba y defectos) '
                    'que servirá de base para generar casos de prueba funcionales con el LLM.', color=MUTED))
    out.append(label(CX, 262, 'Base de conocimiento', w=300, size=20, bold=True))
    out += field(CX + CW - 260, 246, 260, 'Proyecto', 'Todos los proyectos', kind='ComboBox')
    stats = [('file-text-o', '48', 'Requerimientos'), ('gavel', '31', 'Reglas de negocio'),
             ('check-square-o', '126', 'Casos de prueba'), ('bug', '22', 'Defectos')]
    for i, (ico, value, text) in enumerate(stats):
        x = CX + i * 250
        out.append(box(x, 316, 230, 120, color=SURFACE, border=SURFACE, radius=12))
        out.append(icon(x + 20, 334, ico, size=24, color=PRIMARY))
        out.append(label(x + 20, 362, value, w=190, size=32, bold=True))
        out.append(label(x + 20, 404, text, w=190, size=14, color=MUTED))
    out.append(label(CX, 466, 'Acciones rápidas', w=300, size=20, bold=True))
    cards = [
        ('pencil-square-o', 'Registro individual', 'Complete un formulario por registro',
         [('Requerimiento', 112), ('Regla', 52), ('Caso', 48), ('Defecto', 70)], False),
        ('upload', 'Carga masiva', 'Excel, Word o CSV con el formato de la plantilla', [('Cargar archivos', 150)], True),
        ('download', 'Plantillas', 'Formato requerido para la carga masiva, con ejemplos',
         [('Excel', 70), ('Word', 70), ('CSV', 60)], False),
    ]
    for i, (ico, head, sub, actions, primary) in enumerate(cards):
        x = CX + i * 333
        out.append(box(x, 506, 313, 170, radius=12))
        out.append(icon(x + 20, 526, ico, size=28, color=PRIMARY))
        out.append(label(x + 64, 522, head, w=230, size=16, bold=True))
        out.append(para(x + 64, 546, 230, 40, sub, size=12, color=MUTED))
        bx = x + 16
        for text, bw in actions:
            out.append(button(bx, 620, bw, text, primary=primary) if primary else
                       c('Link', bx + 6, 628, bw, 22, text=text, size=14))
            bx += bw + 6
    return h, out


def user_menu():
    h, out = home()
    x, y = 1040, 124
    out.append(box(x, y, 230, 132, radius=4))
    out += [
        label(x + 16, y + 12, 'analista@qa.local', w=200, size=13, color=MUTED),
        c('HRule', x + 1, y + 40, 228, 2),
        icon(x + 16, y + 56, 'key', size=18),
        label(x + 48, y + 54, 'Cambiar contraseña', w=170, size=14),
        icon(x + 16, y + 98, 'sign-out', size=18),
        label(x + 48, y + 96, 'Cerrar sesión', w=170, size=14),
    ]
    return h, out


def change_password():
    h, out = home()
    out += overlay(h)
    x, y, w = 440, 250, 420
    out += dialog(x, y, w, 290, 'Cambiar contraseña')
    out += field(x + 24, y + 56, w - 48, 'Contraseña actual', '••••••••')
    out += field(x + 24, y + 128, w - 48, 'Nueva contraseña', '', hint='Mínimo 8 caracteres.')
    out.append(button(x + w - 236, y + 234, 100, 'Cancelar'))
    out.append(button(x + w - 124, y + 234, 100, 'Guardar', primary=True))
    return h, out


REQ_ROWS = [
    ['REQ-001', 'Compra de paquete de monedas', 'Alta', 'Compra de monedas virtuales', 'Carga masiva', '08/10/2026 10:15'],
    ['REQ-002', 'Selección de método de pago', 'Alta', 'Pasarela de pago', 'Carga masiva', '08/10/2026 10:15'],
    ['REQ-003', 'Validación de saldo de la tarjeta', 'Media', 'Pasarela de pago', 'Individual', '09/10/2026 16:42'],
    ['REQ-004', 'Acreditación de monedas al jugador', 'Alta', 'Compra de monedas virtuales', 'Individual', '09/10/2026 17:05'],
    ['REQ-005', 'Límite diario de compras', 'Media', 'Compra de monedas virtuales', 'Carga masiva', '10/10/2026 09:30'],
    ['REQ-006', 'Comprobante de compra por correo', 'Baja', 'Historial de compras', 'Individual', '10/10/2026 11:12'],
    ['REQ-007', 'Reintento ante pago rechazado', 'Media', 'Pasarela de pago', 'Individual', '10/10/2026 15:48'],
]


def knowledge_list():
    h = 800
    out = shell('conocimiento/requirements', 'requirements', h)
    out += page_header('Base de conocimiento',
                       'Información histórica registrada de forma individual o por carga masiva. '
                       'Seleccione un registro para revisarlo o corregirlo.')
    out.append(button(CX + CW - 412, 150, 160, 'Carga masiva', icon_name='upload'))
    out.append(button(CX + CW - 240, 150, 240, 'Registrar requerimiento', primary=True, icon_name='plus'))
    out.append(c('TabBar', CX, 248, CW, 40, text='Requerimientos, Reglas de negocio, Casos de prueba, Defectos',
                 selectedIndex=0, size=14))
    out.append(c('SearchBox', CX, 316, 300, 36, text='Buscar: código, título, descripción…', size=14))
    out += field(CX + 316, 298, 220, 'Proyecto', PROJECT, kind='ComboBox')
    out += field(CX + 552, 298, 210, 'Módulo / flujo', 'Todos', kind='ComboBox')
    out += field(CX + 778, 298, 202, 'Origen', 'Todos', kind='ComboBox')
    widths = [10, 27, 9, 22, 11, 14, 7]
    rows = [['Código', 'Título', 'Prioridad', 'Proyecto / módulo', 'Origen', 'Actualizado', '']]
    rows += [r[:3] + [r[3]] + [r[4], r[5], ''] for r in REQ_ROWS]
    out.append(grid(CX, 368, CW, rows, widths))
    ax = column_x(CX, CW, widths, 6)
    for i in range(len(REQ_ROWS)):
        out.append(icon(ax + 12, 368 + 44 * (i + 1) + 13, 'pencil', size=18, color=MUTED))
        out.append(icon(ax + 42, 368 + 44 * (i + 1) + 13, 'trash', size=18, color=MUTED))
    out.append(label(CX + CW - 470, 368 + 44 * 8 + 14, 'Filas por página: 20 ▾      1 – 7 de 48      |‹   ‹   ›   ›|',
                     w=470, size=13, color=MUTED, align='right'))
    return h, out


def confirm_delete():
    h, out = knowledge_list()
    out += overlay(h)
    x, y, w = 420, 290, 440
    out += dialog(x, y, w, 200, 'Eliminar requerimiento')
    out.append(para(x + 24, y + 56, w - 48, 60,
                    '¿Eliminar REQ-003 - Validación de saldo de la tarjeta? Esta acción no se puede deshacer.'))
    out.append(button(x + w - 236, y + 144, 100, 'Cancelar'))
    out.append(button(x + w - 124, y + 144, 100, 'Eliminar', color=RED, textColor=WHITE))
    return h, out


def form_frame(url, active, h, back, heading, meta=None):
    out = shell(url, active, h)
    out += page_header(heading, back=back)
    top = 236
    if meta:
        out.append(para(CX, 226, CW, 24, meta, size=13, color=MUTED))
        top = 262
    out.append(box(CX, top, CW, h - top - 24, radius=12))
    return out, top


def scope_section(x, y, project=PROJECT, module='Compra de monedas virtuales', locked=False, hint=True):
    out = [label(x, y, 'Clasificación', w=300, size=16, bold=True)]
    out += field(x, y + 34, 450, 'Proyecto *', project, kind='ComboBox', state='disabled' if locked else None,
                 hint=None if locked or not hint else 'Elija el proyecto para obtener el código y los registros relacionables.')
    out += field(x + 474, y + 34, 450, 'Módulo / flujo *', module, kind='ComboBox')
    return out


def requirement_form(edit=False):
    h = 1040
    if edit:
        out, top = form_frame('conocimiento/requirements/6705…', 'requirements', h, 'Requerimientos',
                              'REQ-001 · Compra de paquete de monedas',
                              meta='Origen: carga masiva (historico-tienda.xlsx) · Creado por Lucía Ramos el 08/10/2026 10:15 · '
                                   'Última modificación: Carlos Díaz, 10/10/2026 09:02')
    else:
        out, top = form_frame('conocimiento/requirements/nuevo', 'requirements', h, 'Requerimientos',
                              'Registrar requerimiento')
    x, y = CX + 28, top + 24
    out += scope_section(x, y, locked=edit, hint=not edit)
    y += 128
    out.append(label(x, y, 'Datos del registro', w=300, size=16, bold=True))
    y += 34
    code = 'REQ-001' if edit else 'REQ-049 (se asigna al guardar)'
    out += field(x, y, 450, 'Código', code, suffix='lock', state='disabled')
    out += field(x + 474, y, 450, 'Título *', 'Compra de paquete de monedas' if edit else '')
    y += 80
    desc = ('Como jugador quiero comprar un paquete de monedas virtuales desde la tienda del juego para '
            'obtener ítems premium.') if edit else ''
    out += field(x, y, 924, 'Descripción *', desc, kind='TextArea', h=70,
                 hint='Qué debe hacer el sistema. Puede usar el formato "Como… quiero… para…".')
    y += 116
    out += field(x, y, 450, 'Prioridad', 'Alta' if edit else '— Sin especificar —', kind='ComboBox')
    y += 80
    crit = ('El saldo de monedas se actualiza al confirmar el pago\nSe muestra el comprobante de la compra'
            if edit else '')
    out += field(x, y, 924, 'Criterios de aceptación', crit, kind='TextArea', h=70, hint='Un elemento por línea.')
    y += 116
    out += field(x, y, 450, 'Versión', '1.2' if edit else '')
    out += field(x + 474, y, 450, 'Fecha', '15/09/2026' if edit else 'dd/mm/aaaa', suffix='calendar')
    y += 80
    out += field(x, y, 450, 'Fuente', 'HU-114 Tienda de monedas' if edit else '',
                 hint='Documento, historia de usuario o ticket de origen.')
    out.append(button(CX + CW - 260, h - 84, 110, 'Cancelar'))
    out.append(button(CX + CW - 138, h - 84, 110, 'Guardar', primary=True, icon_name='floppy-o'))
    return h, out


def test_case_form():
    h = 1680
    out, top = form_frame('conocimiento/test-cases/nuevo', 'test-cases', h, 'Casos de prueba', 'Registrar caso de prueba')
    x, y = CX + 28, top + 24
    out += scope_section(x, y)
    y += 128
    out.append(label(x, y, 'Datos del registro', w=300, size=16, bold=True))
    y += 34
    out += field(x, y, 450, 'Código', 'CP-127 (se asigna al guardar)', suffix='lock', state='disabled')
    out += field(x + 474, y, 450, 'Título *', 'Compra de monedas con tarjeta sin saldo')
    y += 80
    out += field(x, y, 450, 'Requerimientos', 'REQ-001, REQ-003', kind='ComboBox')
    out += field(x + 474, y, 450, 'Reglas de negocio', 'RN-004', kind='ComboBox')
    y += 80
    out += field(x, y, 450, 'Tipo de escenario', 'Negativo', kind='ComboBox')
    out += field(x + 474, y, 450, 'Técnica de diseño', 'Partición de equivalencia', kind='ComboBox')
    y += 80
    out += field(x, y, 450, 'Prioridad', 'Alta', kind='ComboBox')
    y += 80
    out += field(x, y, 924, 'Precondiciones', 'Jugador con sesión iniciada y tarjeta registrada sin saldo suficiente.',
                 kind='TextArea', h=56)
    y += 96
    out += field(x, y, 924, 'Datos de prueba', 'Paquete: 1 000 monedas (S/ 19.90) · Tarjeta: 4111 1111 1111 1111',
                 kind='TextArea', h=56)
    y += 100
    # Pasos
    steps = [('Ingresar a la tienda y elegir el paquete de 1 000 monedas', 'Se muestra el resumen de la compra'),
             ('Seleccionar la tarjeta registrada y confirmar', 'Se envía el pago a la pasarela'),
             ('Esperar la respuesta de la pasarela', 'Se muestra "Saldo insuficiente" y no se acreditan monedas')]
    out.append(box(x, y, 924, 70 + 52 * len(steps) + 50, color=WHITE, border=BORDER, radius=6))
    out.append(label(x + 14, y + 10, 'Pasos *', w=200, size=14, bold=True))
    sy = y + 44
    for i, (action, expected) in enumerate(steps):
        out.append(c('Canvas', x + 14, sy + 8, 28, 28, color=PRIMARY_LIGHT, borderColor=PRIMARY_LIGHT, radius=14))
        out.append(label(x + 14, sy + 12, str(i + 1), w=28, size=13, bold=True, align='center', color=PRIMARY))
        out.append(c('TextInput', x + 54, sy + 4, 360, 36, text=action, size=13))
        out.append(c('TextInput', x + 424, sy + 4, 360, 36, text=expected, size=13))
        for j, ico in enumerate(['arrow-up', 'arrow-down', 'trash']):
            out.append(icon(x + 800 + j * 36, sy + 13, ico, size=18, color='#bbbbbb' if (i == 0 and j == 0) or (
                i == len(steps) - 1 and j == 1) else MUTED))
        sy += 52
    out.append(label(x + 54, y + 30, 'Acción', w=100, size=11, color=MUTED))
    out.append(label(x + 424, y + 30, 'Resultado esperado', w=200, size=11, color=MUTED))
    out.append(button(x + 14, sy + 8, 150, 'Agregar paso', icon_name='plus'))
    y = sy + 100
    out += field(x, y, 924, 'Resultado esperado *', 'La compra se rechaza con el mensaje "Saldo insuficiente" y el saldo de '
                 'monedas del jugador no cambia.', kind='TextArea', h=56)
    y += 96
    out += field(x, y, 924, 'Resultado obtenido', '', kind='TextArea', h=56)
    y += 96
    out += field(x, y, 450, 'Estado de ejecución', 'Exitoso', kind='ComboBox')
    out += field(x + 474, y, 450, 'Fecha de ejecución', '09/10/2026', suffix='calendar')
    y += 80
    out += field(x, y, 450, 'Ejecutado por', 'Lucía Ramos')
    out += field(x + 474, y, 450, 'Defectos asociados', 'Seleccione', kind='ComboBox')
    out.append(button(CX + CW - 260, h - 84, 110, 'Cancelar'))
    out.append(button(CX + CW - 138, h - 84, 110, 'Guardar', primary=True, icon_name='floppy-o'))
    return h, out


def related_select():
    _, full = test_case_form()
    h = 870
    # Misma pantalla recortada a 870 px: la ventana y los fondos se acortan; el resto que no entra se omite.
    out = []
    for ctrl in full:
        if ctrl['t'] in ('BrowserWindow', 'Canvas') and ctrl['y'] < h - 30:
            out.append(dict(ctrl, h=min(ctrl['h'], h - ctrl['y'] - (0 if ctrl['t'] == 'BrowserWindow' else 1))))
        elif ctrl['y'] + ctrl['h'] <= h - 2:
            out.append(ctrl)
    # Lista desplegable abierta bajo el campo "Requerimientos"
    x, y, w = CX + 28, 560, 450
    out.append(box(x, y, w, 300, radius=4))
    out.append(c('SearchBox', x + 8, y + 8, w - 16, 34, text='Buscar por código o título', size=13))
    options = [('REQ-001', 'Compra de paquete de monedas', True), ('REQ-002', 'Selección de método de pago', False),
               ('REQ-003', 'Validación de saldo de la tarjeta', True), ('REQ-004', 'Acreditación de monedas al jugador', False),
               ('REQ-005', 'Límite diario de compras', False), ('REQ-006', 'Comprobante de compra por correo', False)]
    oy = y + 52
    for code, text, checked in options:
        if checked:
            out.append(box(x + 1, oy - 4, w - 2, 40, color=PRIMARY_LIGHT, border=PRIMARY_LIGHT))
        out.append(c('CheckBox', x + 14, oy + 4, w - 28, 24, text=f'{code} · {text}', size=14,
                     state='selected' if checked else 'up'))
        oy += 40
    return h, out


def import_upload():
    h = 1080
    out = shell('carga-masiva', 'carga', h)
    out += page_header('Carga masiva',
                       'Cargue uno o más archivos Excel (.xlsx), Word (.docx) o CSV con el formato de la plantilla. La '
                       'información queda en revisión: podrá corregirla antes de guardarla en la base de conocimiento.')
    x, y, w = CX, 252, 620
    out.append(box(x, y, w, 540, radius=12))
    out.append(label(x + 24, y + 20, '1. Seleccione el destino', w=400, size=16, bold=True))
    out += field(x + 24, y + 54, w - 48, 'Proyecto *', PROJECT, kind='ComboBox')
    out += field(x + 24, y + 124, w - 48, 'Módulo / flujo predeterminado *', 'Compra de monedas virtuales',
                 kind='ComboBox', hint='Se usa en las filas que no indiquen la columna "Módulo".')
    out.append(label(x + 24, y + 214, '2. Adjunte los archivos', w=400, size=16, bold=True))
    out.append(box(x + 24, y + 248, w - 48, 120, color='#fafafa', border=BORDER, dashed=True, radius=10))
    out.append(icon(x + w / 2 - 18, y + 262, 'cloud-upload', size=36, color=PRIMARY))
    out.append(label(x + 24, y + 304, 'Arrastre los archivos aquí o haga clic para seleccionarlos', w=w - 48, size=14,
                     align='center'))
    out.append(label(x + 24, y + 330, '.xlsx, .docx o .csv · hasta 10 archivos de 10 MB', w=w - 48, size=12,
                     color=MUTED, align='center'))
    files = [('table', 'historico-tienda.xlsx', '84 KB'), ('file-word-o', 'casos-pasarela.docx', '41 KB')]
    fy = y + 384
    for ico, name, size in files:
        out.append(icon(x + 30, fy + 6, ico, size=18, color=MUTED))
        out.append(label(x + 60, fy + 4, name, w=300, size=14))
        out.append(label(x + w - 150, fy + 6, size, w=70, size=12, color=MUTED, align='right'))
        out.append(icon(x + w - 60, fy + 6, 'times', size=18, color=MUTED))
        fy += 36
    out.append(button(x + w - 184, y + 484, 160, 'Leer y revisar', primary=True, icon_name='check-square-o'))
    # Plantillas
    tx, tw = CX + 640, 340
    out.append(box(tx, y, tw, 540, radius=12))
    out.append(icon(tx + 20, y + 22, 'download', size=24, color=PRIMARY))
    out.append(label(tx + 56, y + 18, 'Plantillas', w=200, size=16, bold=True))
    out.append(label(tx + 56, y + 40, 'Incluyen instrucciones y ejemplos', w=260, size=12, color=MUTED))
    for i, (ico, text) in enumerate([('table', 'Excel (todas las hojas)'), ('file-word-o', 'Word (tablas por registro)'),
                                     ('list', 'CSV (un archivo por tipo) ▾')]):
        out.append(button(tx + 20, y + 80 + i * 46, tw - 40, text, icon_name=ico))
    ay = y + 230
    out.append(box(tx + 20, ay, tw - 40, 290, color=SURFACE, border=SURFACE, radius=6))
    out.append(label(tx + 34, ay + 10, 'Reglas del formato', w=220, size=14, bold=True))
    out.append(icon(tx + tw - 50, ay + 12, 'chevron-up', size=14, color=MUTED))
    out.append(para(tx + 34, ay + 40, tw - 68, 240,
                    '• No cambie los nombres de hojas, archivos CSV ni encabezados.\n'
                    '• Los campos con * son obligatorios.\n'
                    '• "Referencia" es temporal (p. ej. REQ1); el sistema asigna los códigos al confirmar.\n'
                    '• Varios valores se separan con ";".\n'
                    '• Fechas en formato AAAA-MM-DD o DD/MM/AAAA.\n'
                    '• CSV con ";" o "," como separador, en UTF-8.', size=12))
    out.append(label(CX, 818, 'Cargas recientes', w=300, size=20, bold=True))
    rows = [['Fecha', 'Archivos', 'Proyecto', 'Registros', 'Estado', 'Usuario'],
            ['11/10/2026 09:40', 'historico-tienda.xlsx', PROJECT, '36  (2 con error)', 'En revisión', 'Lucía Ramos'],
            ['08/10/2026 10:15', 'requerimientos.csv', PROJECT, '18  (18 creados)', 'Confirmado', 'Lucía Ramos'],
            ['07/10/2026 18:02', 'defectos-2025.docx', PROJECT, '9', 'Cancelado', 'Carlos Díaz']]
    out.append(grid(CX, 856, CW, rows, [16, 22, 20, 16, 12, 14]))
    return h, out


REVIEW_ROWS = [
    ['1', 'Requerimiento', 'REQ1', 'Compra de paquete de monedas', 'Compra de monedas virtuales', 'Requerimientos · fila 2', 'Válida', ''],
    ['2', 'Requerimiento', 'REQ2', 'Selección de método de pago', 'Pasarela de pago', 'Requerimientos · fila 3', 'Válida', ''],
    ['3', 'Regla de negocio', 'RN1', 'Monto máximo por transacción', 'Pasarela de pago', 'ReglasNegocio · fila 2', 'Advertencia', '• Criticidad vacía'],
    ['4', 'Caso de prueba', 'CP1', 'Compra con tarjeta válida', 'Compra de monedas virtuales', 'CasosPrueba · fila 2', 'Válida', ''],
    ['5', 'Caso de prueba', 'CP2', 'Compra con tarjeta vencida', 'Pagos (no existe)', 'CasosPrueba · fila 3', 'Error', '• Módulo no registrado'],
    ['6', 'Caso de prueba', 'CP3', '—', 'Compra de monedas virtuales', 'CasosPrueba · fila 4', 'Error', '• Título obligatorio'],
    ['7', 'Defecto', 'DEF1', 'Monedas no acreditadas tras pago', 'Compra de monedas virtuales', 'Defectos · fila 2', 'Válida', ''],
]


def import_review():
    h = 960
    out = shell('carga-masiva/6709…', 'carga', h)
    out += page_header('Revisión de carga', back='Carga masiva')
    out.append(para(CX, 226, CW, 24, f'historico-tienda.xlsx · Proyecto {PROJECT} · Módulo predeterminado Compra de monedas '
                                      'virtuales · Lucía Ramos, 11/10/2026 09:40', size=13, color=MUTED))
    out += tag(CX + CW - 120, 186, 'En revisión', AMBER, AMBER_LIGHT, w=120)
    chips = [('36  Todas', SURFACE, '#222222', True), ('30  Válidas', GREEN_LIGHT, GREEN, False),
             ('3  Con advertencias', AMBER_LIGHT, AMBER, False), ('2  Con errores', RED_LIGHT, RED, False),
             ('1  Excluidas', SURFACE, MUTED, False)]
    cx = CX
    for text, bg, fg, selected in chips:
        w = len(text) * 8 + 34
        out.append(c('Button', cx, 266, w, 34, text=text, size=14, color=bg, textColor=fg,
                     state='selected' if selected else None, borderColor=fg if selected else bg))
        cx += w + 10
    out.append(box(CX, 318, CW, 40, color=SURFACE, border=SURFACE, radius=6))
    out.append(icon(CX + 14, 329, 'info-circle', size=18, color=AMBER))
    out.append(label(CX + 42, 327, 'Observaciones de lectura de archivos (1)', w=500, size=14))
    out.append(icon(CX + CW - 34, 331, 'chevron-down', size=14, color=MUTED))
    out += field(CX, 372, 260, 'Tipo', 'Todos', kind='ComboBox')
    widths = [4, 12, 8, 18, 15, 13, 9, 15, 6]
    rows = [['#', 'Tipo', 'Referencia', 'Título / nombre', 'Módulo', 'Ubicación', 'Estado', 'Observaciones', '']]
    rows += [r[:7] + [r[7], ''] for r in REVIEW_ROWS]
    out.append(grid(CX, 444, CW, rows, widths, row_h=46))
    sx = column_x(CX, CW, widths, 6)
    for i, r in enumerate(REVIEW_ROWS):
        ry = 444 + 46 * (i + 1)
        colors = {'Válida': (GREEN, GREEN_LIGHT), 'Advertencia': (AMBER, AMBER_LIGHT), 'Error': (RED, RED_LIGHT)}[r[6]]
        out += tag(sx + 4, ry + 11, r[6], colors[0], colors[1], w=82)
        ax = column_x(CX, CW, widths, 8)
        out.append(icon(ax + 2, ry + 14, 'pencil', size=16, color=MUTED))
        out.append(icon(ax + 26, ry + 14, 'ban', size=16, color=MUTED))
    out.append(label(CX + CW - 420, 444 + 46 * 8 + 10, 'Filas por página: 25 ▾      1 – 7 de 36      ‹   ›', w=420,
                     size=13, color=MUTED, align='right'))
    fy = h - 80
    out.append(box(242, fy - 12, W - 244, 80, color=WHITE, border='#dddddd'))
    out.append(label(CX, fy + 8, 'Corrija o excluya las 2 fila(s) con errores para poder confirmar.', w=560, size=14,
                     color=MUTED))
    out.append(button(CX + CW - 360, fy, 140, 'Cancelar lote'))
    out.append(button(CX + CW - 208, fy, 208, 'Confirmar y guardar', primary=True, icon_name='floppy-o',
                      state='disabled'))
    return h, out


def row_edit():
    h, out = import_review()
    out += overlay(h)
    x, y, w = 300, 96, 700
    out += dialog(x, y, w, 800, 'Corregir caso de prueba · fila 5')
    out.append(icon(x + 24, y + 54, 'file-text-o', size=16, color=MUTED))
    out.append(label(x + 46, y + 52, 'historico-tienda.xlsx — CasosPrueba · fila 3', w=500, size=13, color=MUTED))
    out.append(box(x + 24, y + 82, w - 48, 40, color=RED_LIGHT, border=RED_LIGHT))
    out.append(label(x + 40, y + 90, '• Módulo: "Pagos" no existe en el proyecto.', w=w - 80, size=13, color=RED))
    out += field(x + 24, y + 136, 330, 'Módulo / flujo *', 'Seleccione', kind='ComboBox',
                 error='En el archivo: "Pagos" (no existe en el catálogo)')
    fx = x + 24
    fy = y + 216
    out += field(fx, fy, 314, 'Referencia en el archivo', 'CP2',
                 hint='Temporal; el sistema asigna el código al confirmar.')
    out += field(fx + 338, fy, 314, 'Título *', 'Compra con tarjeta vencida')
    fy += 92
    out += field(fx, fy, 314, 'Requerimientos', 'REQ1; REQ-003', hint='Referencias o códigos separados por ";".')
    out += field(fx + 338, fy, 314, 'Reglas de negocio', 'RN1')
    fy += 92
    out += field(fx, fy, 314, 'Tipo de escenario', 'Negativo', kind='ComboBox')
    out += field(fx + 338, fy, 314, 'Técnica de diseño', 'Partición de equivalencia', kind='ComboBox')
    fy += 92
    out += field(fx, fy, 652, 'Resultado esperado *', 'Se rechaza el pago con el mensaje "Tarjeta vencida".',
                 kind='TextArea', h=56)
    fy += 96
    out.append(label(fx, fy, 'Pasos *', w=200, size=13, bold=True))
    out.append(label(fx, fy + 24, '1   Elegir paquete de 500 monedas                →   Se muestra el resumen', w=640,
                     size=13, color=MUTED))
    out.append(label(fx, fy + 48, '2   Pagar con tarjeta vencida                          →   Mensaje "Tarjeta vencida"',
                     w=640, size=13, color=MUTED))
    out.append(c('HRule', x + 1, y + 736, w - 2, 2))
    out.append(button(x + w - 316, y + 752, 110, 'Cerrar'))
    out.append(button(x + w - 194, y + 752, 170, 'Aplicar corrección', primary=True))
    return h, out


def catalogs():
    h = 800
    out = shell('catalogos', 'catalogos', h)
    out += page_header('Proyectos y módulos',
                       'Catálogos para clasificar la información histórica. Un proyecto es el sistema bajo prueba (p. ej. '
                       'la tienda de un videojuego) y un módulo es un flujo funcional dentro de él.')
    y, w = 256, 470
    out.append(box(CX, y, w, 450, radius=12))
    out.append(label(CX + 20, y + 22, 'Proyectos', w=200, size=18, bold=True))
    out.append(button(CX + w - 120, y + 16, 100, 'Nuevo', primary=True, icon_name='plus'))
    projects = [(PROJECT, 'Tienda del videojuego Galaxia (web y móvil)', True, True),
                ('Arena Legends Store', 'Compra de gemas en Arena Legends', False, True),
                ('Portal de recargas 2024', 'Proyecto anterior', False, False)]
    py = y + 66
    for name, desc, selected, active in projects:
        if selected:
            out.append(box(CX + 1, py, w - 2, 62, color=PRIMARY_LIGHT, border=PRIMARY_LIGHT))
        color = '#222222' if active else '#aaaaaa'
        out.append(label(CX + 20, py + 10, name + ('' if active else ' (inactivo)'), w=w - 40, size=15, color=color,
                         bold=selected))
        out.append(label(CX + 20, py + 34, desc, w=w - 40, size=12, color=MUTED if active else '#aaaaaa'))
        py += 64
    out.append(c('HRule', CX + 1, y + 386, w - 2, 2))
    for i, (ico, text) in enumerate([('pencil', 'Editar'), ('toggle-off', 'Desactivar'), ('trash', 'Eliminar')]):
        out.append(button(CX + w - 380 + i * 122, y + 398, 116, text, icon_name=ico, borderColor=WHITE))
    mx, mw = CX + w + 20, CW - w - 20
    out.append(box(mx, y, mw, 450, radius=12))
    out.append(label(mx + 20, y + 22, f'Módulos / flujos de {PROJECT}', w=mw - 150, size=18, bold=True))
    out.append(button(mx + mw - 120, y + 16, 100, 'Nuevo', primary=True, icon_name='plus'))
    modules = [('Compra de monedas virtuales', 'Selección de paquete, pago y acreditación', True),
               ('Pasarela de pago', 'Integración con el proveedor de pagos', True),
               ('Historial de compras', 'Consulta de compras y comprobantes', True),
               ('Promociones', '—', False)]
    my = y + 66
    for name, desc, active in modules:
        color = '#222222' if active else '#aaaaaa'
        out.append(label(mx + 20, my + 10, name + ('' if active else ' (inactivo)'), w=mw - 160, size=15, color=color))
        out.append(label(mx + 20, my + 34, desc, w=mw - 160, size=12, color=MUTED if active else '#aaaaaa'))
        for j, ico in enumerate(['pencil', 'toggle-on' if active else 'toggle-off', 'trash']):
            out.append(icon(mx + mw - 120 + j * 36, my + 20, ico, size=18, color=MUTED))
        out.append(c('HRule', mx + 1, my + 62, mw - 2, 2))
        my += 64
    return h, out


def module_dialog():
    h, out = catalogs()
    out += overlay(h)
    x, y, w = 420, 250, 440
    out += dialog(x, y, w, 300, 'Nuevo módulo')
    out += field(x + 24, y + 56, w - 48, 'Nombre *', 'Reembolsos')
    out += field(x + 24, y + 128, w - 48, 'Descripción', 'Solicitud y aprobación de reembolsos de compras', kind='TextArea',
                 h=70)
    out.append(button(x + w - 236, y + 244, 100, 'Cancelar'))
    out.append(button(x + w - 124, y + 244, 100, 'Guardar', primary=True))
    return h, out


def users():
    h = 800
    out = shell('admin/usuarios', 'usuarios', h)
    out += page_header('Usuarios',
                       'Cree usuarios y asígneles un rol. Los permisos de cada rol se configuran en "Permisos por rol".')
    out.append(button(CX + CW - 180, 150, 180, 'Nuevo usuario', primary=True, icon_name='user-plus'))
    widths = [20, 25, 16, 12, 19, 8]
    rows = [['Nombre', 'Correo', 'Rol', 'Estado', 'Último acceso', ''],
            ['Lucía Ramos', 'lucia.ramos@qa.local', '', '', '11/10/2026 09:31', ''],
            ['Carlos Díaz', 'carlos.diaz@qa.local', '', '', '10/10/2026 18:20', ''],
            ['Ana Quispe', 'ana.quispe@qa.local', '', '', '09/10/2026 08:05', ''],
            ['Jorge Salas', 'jorge.salas@qa.local', '', '', '—', ''],
            ['Administrador', 'admin@qa.local', '', '', '11/10/2026 08:58', '']]
    out.append(grid(CX, 256, CW, rows, widths, row_h=48))
    roles = [('Administrador', True), ('Analista QA', True), ('Líder QA', True), ('Analista QA', False),
             ('Administrador', True)]
    rx, sx, ax = (column_x(CX, CW, widths, i) for i in (2, 3, 5))
    for i, (role, active) in enumerate(roles):
        ry = 256 + 48 * (i + 1) + 12
        out += tag(rx + 8, ry, role, PRIMARY, PRIMARY_LIGHT, w=120)
        out += tag(sx + 8, ry, 'Activo' if active else 'Inactivo', GREEN if active else MUTED,
                   GREEN_LIGHT if active else SURFACE, w=80)
        out.append(icon(ax + 40, ry + 3, 'pencil', size=18, color=MUTED))
    return h, out


def user_dialog():
    h, out = users()
    out += overlay(h)
    x, y, w = 410, 160, 460
    out += dialog(x, y, w, 470, 'Editar usuario')
    out += field(x + 24, y + 56, w - 48, 'Nombre completo *', 'Ana Quispe')
    out += field(x + 24, y + 128, w - 48, 'Correo *', 'ana.quispe@qa.local', state='disabled')
    out += field(x + 24, y + 200, w - 48, 'Rol *', 'Líder QA', kind='ComboBox')
    out += field(x + 24, y + 272, w - 48, 'Nueva contraseña (opcional)', '', hint='Mínimo 8 caracteres.')
    out.append(c('Switch', x + 24, y + 362, 44, 24, state='selected', color=PRIMARY))
    out.append(label(x + 80, y + 362, 'Usuario activo', w=200, size=14))
    out.append(button(x + w - 236, y + 414, 100, 'Cancelar'))
    out.append(button(x + w - 124, y + 414, 100, 'Guardar', primary=True))
    return h, out


def permissions():
    h = 840
    out = shell('admin/permisos', 'permisos', h)
    out += page_header('Permisos por rol',
                       'Defina a qué módulos accede cada rol y qué acciones puede realizar. Los cambios aplican de inmediato.')
    out.append(c('TabBar', CX, 248, CW, 40, text='Analista QA •, Líder QA, Administrador', selectedIndex=0, size=14))
    y = 306
    first, colw = 430, 110
    out.append(box(CX, y, CW, 46 + 4 * 76, radius=6))
    out.append(box(CX + 1, y + 1, CW - 2, 44, color=SURFACE, border=SURFACE))
    out.append(label(CX + 16, y + 12, 'Módulo', w=200, size=14, bold=True))
    actions = ['Ver', 'Crear', 'Editar', 'Eliminar', 'Carga masiva']
    for i, a in enumerate(actions):
        out.append(label(CX + first + i * colw, y + 12, a, w=colw, size=14, bold=True, align='center'))
    modules = [
        ('Base de conocimiento', 'Registro individual y masivo de requerimientos, reglas, casos y defectos.', True,
         [True, True, True, False, True]),
        ('Catálogos', 'Proyectos y módulos/flujos usados para clasificar la información.', True,
         [True, False, False, False, None]),
        ('Generación de casos de prueba', 'Generación de casos de prueba funcionales con LLM.', False,
         [False, False, False, False, None]),
        ('Administración', 'Gestión de usuarios y permisos de acceso a los módulos.', True,
         [False, False, False, False, None]),
    ]
    ry = y + 46
    for name, desc, available, checks in modules:
        out.append(c('HRule', CX + 1, ry, CW - 2, 2))
        color = '#222222' if available else '#aaaaaa'
        out.append(label(CX + 16, ry + 12, name, w=260, size=14, bold=True, color=color))
        if not available:
            out += tag(CX + 260, ry + 10, 'Próximamente', AMBER, AMBER_LIGHT, w=110)
        out.append(para(CX + 16, ry + 36, first - 40, 36, desc, size=12, color=MUTED))
        for i, checked in enumerate(checks):
            cx = CX + first + i * colw + colw // 2 - 10
            if checked is None:
                out.append(label(cx - 10, ry + 26, '—', w=40, size=14, color=MUTED, align='center'))
            else:
                out.append(c('CheckBox', cx, ry + 26, 22, 22, text='', state=('selected' if checked else 'up') if available
                             else 'disabled'))
        ry += 76
    out.append(button(CX + CW - 520, ry + 24, 200, 'Descartar cambios'))
    out.append(button(CX + CW - 300, ry + 24, 300, 'Guardar permisos de Analista QA', primary=True, icon_name='floppy-o'))
    return h, out


SCREENS = [
    ('01', 'Inicio de sesión', login),
    ('02', 'Inicio', home),
    ('03', 'Menú de usuario', user_menu),
    ('04', 'Cambiar contraseña', change_password),
    ('05', 'Base de conocimiento - listado', knowledge_list),
    ('06', 'Eliminar registro', confirm_delete),
    ('07', 'Registrar requerimiento', requirement_form),
    ('08', 'Registrar caso de prueba', test_case_form),
    ('09', 'Selección de registros relacionados', related_select),
    ('10', 'Revisar y editar registro', lambda: requirement_form(edit=True)),
    ('11', 'Carga masiva', import_upload),
    ('12', 'Revisión de carga masiva', import_review),
    ('13', 'Corregir fila de la carga', row_edit),
    ('14', 'Proyectos y módulos', catalogs),
    ('15', 'Nuevo módulo', module_dialog),
    ('16', 'Usuarios', users),
    ('17', 'Editar usuario', user_dialog),
    ('18', 'Permisos por rol', permissions),
]


def slug(number, name):
    import unicodedata
    plain = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    return number + '-' + '-'.join(''.join(ch if ch.isalnum() else ' ' for ch in plain).split())


# ---------------------------------------------------------------------------------------------------------------------
# Exportación a Balsamiq (.bmpr)
# ---------------------------------------------------------------------------------------------------------------------

TYPE_IDS = {
    'BrowserWindow', 'Canvas', 'Label', 'Paragraph', 'Title', 'Icon', 'Button', 'TextInput', 'TextArea', 'ComboBox',
    'DataGrid', 'TabBar', 'SearchBox', 'CheckBox', 'Switch', 'HRule', 'Link', 'TitleWindow', 'Tooltip',
}

# Equivalencias de los íconos usados con la biblioteca de íconos de Balsamiq.
ICON_IDS = {'file-text-o': 'file-text', 'check-square-o': 'check-square', 'pencil-square-o': 'pencil-square',
            'floppy-o': 'save', 'file-word-o': 'file-word', 'sign-out': 'sign-out-alt', 'user-circle': 'user-circle',
            'trash': 'trash-alt', 'pencil': 'pencil-alt', 'table': 'table', 'magic': 'magic'}


def color_int(value):
    return int(value.lstrip('#'), 16)


def to_balsamiq(ctrl, index):
    p = dict(ctrl['p'])
    props = {}
    kind = ctrl['t']
    assert kind in TYPE_IDS, kind
    text = p.pop('text', None)
    if text is not None:
        if kind == 'DataGrid':
            props['text'] = text
        else:
            # En Balsamiq, *texto* es negrita y _texto_ cursiva: se escapan los caracteres literales.
            props['text'] = text.replace('*', '\\*').replace('_', '\\_')
    if 'size' in p:
        props['size'] = str(p.pop('size'))
    if p.pop('bold', False):
        props['bold'] = 'true'
    if 'align' in p:
        props['align'] = p.pop('align')
    if kind == 'Icon':
        name = p.pop('icon')
        px = p.pop('px', 20)
        props['icon'] = {'ID': ICON_IDS.get(name, name), 'size': 'small' if px <= 18 else 'medium' if px <= 28 else 'large'}
    elif 'icon' in p:
        name = p.pop('icon')
        props['icon'] = {'ID': ICON_IDS.get(name, name), 'size': 'small'}
    for key in ('color', 'borderColor', 'textColor'):
        if key in p:
            props[key] = str(color_int(p.pop(key)))
    if kind in ('Label', 'Paragraph', 'Icon', 'Link') and 'color' in props:
        pass  # en estos controles "color" es el color del texto o del ícono
    if 'backgroundAlpha' in p:
        props['backgroundAlpha'] = str(p.pop('backgroundAlpha'))
    if p.get('state'):
        props['state'] = p.pop('state')
    if 'selectedIndex' in p:
        props['selectedIndex'] = str(p.pop('selectedIndex'))
    if kind == 'DataGrid':
        props['rowHeight'] = str(p.pop('rowHeight'))
        props['hasHeader'] = 'true'
        props['vLines'] = 'false'
    if p.pop('dashed', False):
        props['borderStyle'] = 'dashed'
    if p.pop('radius', None):
        props['borderStyle'] = props.get('borderStyle', 'roundedSolid')
    w, h = int(ctrl['w']), int(ctrl['h'])
    return {
        'ID': str(index), 'typeID': kind, 'zOrder': str(index), 'x': str(int(ctrl['x'])), 'y': str(int(ctrl['y'])),
        'w': str(w), 'h': str(h), 'measuredW': str(w), 'measuredH': str(h), 'properties': props,
    }


def write_bmpr(path, thumbs_dir=None):
    if os.path.exists(path):
        os.remove(path)
    now = int(time.time() * 1000)
    db = sqlite3.connect(path)
    db.executescript('''
        CREATE TABLE INFO (NAME VARCHAR(255) PRIMARY KEY, VALUE TEXT);
        CREATE TABLE BRANCHES (ID VARCHAR(255) PRIMARY KEY, ATTRIBUTES TEXT);
        CREATE TABLE RESOURCES (ID VARCHAR(255), BRANCHID VARCHAR(255), ATTRIBUTES TEXT, DATA LONGTEXT,
            PRIMARY KEY (ID, BRANCHID), FOREIGN KEY (BRANCHID) REFERENCES BRANCHES(ID) DEFERRABLE INITIALLY DEFERRED);
        CREATE TABLE THUMBNAILS (ID VARCHAR(255) PRIMARY KEY, ATTRIBUTES TEXT);
    ''')
    info = {
        'ArchiveFormat': 'bmpr',
        'SchemaVersion': '1.2',
        'ArchiveRevision': '1',
        'ArchiveRevisionUUID': str(uuid.uuid4()).upper(),
        'ArchiveAttributes': json.dumps({'name': 'QA Knowledge - Mockups', 'creationDate': now}),
    }
    db.executemany('INSERT INTO INFO VALUES (?, ?)', info.items())
    db.execute('INSERT INTO BRANCHES VALUES (?, ?)', ('Master', json.dumps({
        'branchName': 'Master', 'creationDate': now, 'fontFace': 'Balsamiq Sans', 'fontSize': 13, 'skinName': 'sketch',
        'projectDescription': 'Mockups del sistema de generación de casos de prueba funcionales con LLM '
                              '(iteración 1: base de conocimiento).',
    })))
    for order, (number, name, build) in enumerate(SCREENS):
        h, controls = build()
        rid = str(uuid.uuid4()).upper()
        mockup = {
            'mockup': {
                'controls': {'control': [to_balsamiq(ctrl, i) for i, ctrl in enumerate(controls)]},
                'measuredW': str(W), 'measuredH': str(h), 'mockupW': str(W), 'mockupH': str(h), 'version': '1.0',
            }
        }
        attributes = {
            'name': f'{number} {name}', 'kind': 'mockup', 'mimeType': 'text/vnd.balsamiq.bmml', 'trashed': False,
            'creationDate': now, 'modifiedBy': None, 'order': order, 'parentID': None, 'notes': None,
            'importedFrom': '',
        }
        db.execute('INSERT INTO RESOURCES VALUES (?, ?, ?, ?)',
                   (rid, 'Master', json.dumps(attributes, ensure_ascii=False), json.dumps(mockup, ensure_ascii=False)))
        thumb = thumbs_dir and os.path.join(thumbs_dir, slug(number, name) + '.png')
        if thumb and os.path.exists(thumb):
            with open(thumb, 'rb') as f:
                image = base64.b64encode(f.read()).decode()
            db.execute('INSERT INTO THUMBNAILS VALUES (?, ?)', (str(uuid.uuid4()).upper(), json.dumps(
                {'branchID': 'Master', 'resourceID': rid, 'image': image})))
    db.commit()
    db.close()


# ---------------------------------------------------------------------------------------------------------------------
# Vista previa en HTML (estilo boceto) para generar los PNG
# ---------------------------------------------------------------------------------------------------------------------

FA_CODES = None


def fa_codes(assets):
    global FA_CODES
    if FA_CODES is None:
        import re
        css = open(os.path.join(assets, 'fa', 'package', 'css', 'font-awesome.css'), encoding='utf-8').read()
        FA_CODES = {m.group(1): m.group(2) for m in re.finditer(r'\.fa-([a-z0-9-]+):before\s*{\s*content:\s*"\\([0-9a-f]+)"', css)}
    return FA_CODES


def esc(text):
    return html.escape(str(text)).replace('\n', '<br>')


def fa(name, assets, size, color):
    code = fa_codes(assets).get(name)
    if not code:
        raise KeyError(f'Ícono no encontrado: {name}')
    return f'<span class="fa" style="font-size:{size}px;color:{color}">&#x{code};</span>'


def render_control(ctrl, assets):
    t, p = ctrl['t'], ctrl['p']
    x, y, w, h = ctrl['x'], ctrl['y'], ctrl['w'], ctrl['h']
    pos = f'left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
    size = p.get('size', 14)
    font = f'font-size:{size}px;' + ('font-weight:700;' if p.get('bold') else '')
    color = p.get('color')
    disabled = p.get('state') == 'disabled'
    text = p.get('text', '')
    if t == 'BrowserWindow':
        name, url = text.split('\n')
        return (f'<div class="c bw" style="{pos}"><div class="bw-title"><i></i><i></i><i></i><span>{esc(name)}</span></div>'
                f'<div class="bw-bar">{fa("arrow-left", assets, 14, "#555")} {fa("arrow-right", assets, 14, "#555")} '
                f'{fa("refresh", assets, 14, "#555")}<div class="bw-url">{esc(url)}</div></div></div>')
    if t == 'Canvas':
        alpha = p.get('backgroundAlpha', 1)
        border = 'dashed' if p.get('dashed') else 'solid'
        return (f'<div class="c" style="{pos}background:{color or WHITE};opacity:{alpha};'
                f'border:2px {border} {p.get("borderColor", BORDER)};border-radius:{p.get("radius", 0)}px"></div>')
    if t in ('Label', 'Title', 'Link'):
        style = font + f'color:{color or ("#1a4fd6" if t == "Link" else "#222")};text-align:{p.get("align", "left")};'
        if t == 'Link':
            style += 'text-decoration:underline;'
        return f'<div class="c lbl" style="{pos}{style}">{esc(text)}</div>'
    if t == 'Paragraph':
        return f'<div class="c para" style="{pos}{font}color:{color or "#222"}">{esc(text)}</div>'
    if t == 'Icon':
        return f'<div class="c ico" style="{pos}">{fa(p["icon"], assets, p.get("px", 20), color or "#333")}</div>'
    if t == 'Button':
        bg = color or WHITE
        fg = p.get('textColor', '#222')
        if disabled:
            bg, fg = '#e4e4e4', '#999'
        border = p.get('borderColor', '#333' if bg == WHITE else bg)
        if p.get('state') == 'selected':
            border = '#222'
        ico = fa(p['icon'], assets, 15, fg) + '&nbsp; ' if p.get('icon') else ''
        return (f'<div class="c btn" style="{pos}{font}background:{bg};color:{fg};border-color:{border}">'
                f'{ico}{esc(text)}</div>')
    if t in ('TextInput', 'ComboBox', 'SearchBox', 'TextArea'):
        cls = 'ta' if t == 'TextArea' else 'inp'
        bg = '#f0f0f0' if disabled else WHITE
        fg = '#777' if disabled or t == 'SearchBox' or text in ('Seleccione', 'dd/mm/aaaa') else '#222'
        pre = fa('search', assets, 15, '#777') + '&nbsp; ' if t == 'SearchBox' else ''
        caret = f'<span class="caret">{fa("caret-down", assets, 16, "#444")}</span>' if t == 'ComboBox' else ''
        return f'<div class="c {cls}" style="{pos}{font}background:{bg};color:{fg}">{pre}{esc(text)}{caret}</div>'
    if t == 'TitleWindow':
        return (f'<div class="c tw" style="{pos}"><div class="tw-title" style="{font}">{esc(text)}'
                f'<span>{fa("times", assets, 16, "#444")}</span></div></div>')
    if t == 'HRule':
        return f'<div class="c" style="left:{x}px;top:{y}px;width:{w}px;border-top:2px solid #cfcfcf"></div>'
    if t == 'TabBar':
        tabs = [s.strip() for s in text.split(',')]
        sel = p.get('selectedIndex', 0)
        items = ''.join(f'<span class="tab{" sel" if i == sel else ""}">{esc(tb)}</span>' for i, tb in enumerate(tabs))
        return f'<div class="c tabs" style="{pos}{font}">{items}</div>'
    if t == 'CheckBox':
        state = p.get('state', 'up')
        mark = fa('check', assets, 14, WHITE) if state == 'selected' else ''
        bg = PRIMARY if state == 'selected' else ('#eee' if state == 'disabled' else WHITE)
        bc = PRIMARY if state == 'selected' else ('#ccc' if state == 'disabled' else '#444')
        return (f'<div class="c cb" style="{pos}{font}"><span class="box" style="background:{bg};border-color:{bc}">'
                f'{mark}</span>{esc(text)}</div>')
    if t == 'Switch':
        return (f'<div class="c sw" style="{pos}background:{PRIMARY_LIGHT if p.get("state") == "selected" else "#ddd"}">'
                f'<span style="background:{color or "#888"}"></span></div>')
    if t == 'Tooltip':
        return f'<div class="c tip" style="{pos}{font}">{esc(text)}</div>'
    if t == 'DataGrid':
        lines = text.split('\n')
        widths = [int(v) for v in lines[-1].strip('{}').split(',')]
        rows = [ln.split(',') for ln in lines[:-1]]
        rh = p['rowHeight']
        cols = ''.join(f'<col style="width:{v}%">' for v in widths)
        body = ''
        for i, r in enumerate(rows):
            tag_name = 'th' if i == 0 else 'td'
            body += f'<tr style="height:{rh}px">' + ''.join(
                f'<{tag_name}{" class=obs" if cell.startswith("• ") else ""}>{esc(cell)}</{tag_name}>' for cell in r) + '</tr>'
        return f'<table class="c dg" style="{pos}{font}"><colgroup>{cols}</colgroup>{body}</table>'
    raise ValueError(t)


CSS = '''
@font-face { font-family: 'Balsamiq Sans'; font-weight: 400; src: url('{assets}/bs400.woff2'); }
@font-face { font-family: 'Balsamiq Sans'; font-weight: 700; src: url('{assets}/bs700.woff2'); }
@font-face { font-family: 'FontAwesome'; src: url('{assets}/fa/package/fonts/fontawesome-webfont.woff2'); }
* { box-sizing: border-box; }
body { margin: 0; background: #fff; font-family: 'Balsamiq Sans', sans-serif; color: #222; }
.root { position: relative; overflow: hidden; }
.c { position: absolute; }
.fa { font-family: 'FontAwesome'; font-style: normal; line-height: 1; display: inline-block; }
.lbl { white-space: pre; overflow: visible; line-height: 1.35; }
.para { line-height: 1.4; white-space: normal; }
.ico { display: flex; align-items: center; justify-content: center; }
.bw { border: 2px solid #333; border-radius: 8px; background: #fff; }
.bw-title { height: 30px; border-bottom: 2px solid #333; display: flex; align-items: center; gap: 6px; padding: 0 10px; font-size: 14px; }
.bw-title i { width: 11px; height: 11px; border: 2px solid #333; border-radius: 50%; }
.bw-title span { margin-left: 10px; }
.bw-bar { height: 40px; border-bottom: 2px solid #333; display: flex; align-items: center; gap: 12px; padding: 0 12px; }
.bw-url { flex: 1; height: 26px; border: 2px solid #333; border-radius: 13px; padding: 2px 12px; font-size: 13px; }
.btn { border: 2px solid #333; border-radius: 8px; display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.inp, .ta { border: 2px solid #555; border-radius: 4px; padding: 6px 10px; overflow: hidden; }
.inp { display: flex; align-items: center; white-space: nowrap; }
.ta { line-height: 1.35; }
.caret { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); }
.tw { border: 2px solid #333; border-radius: 6px; background: #fff; box-shadow: 4px 4px 0 rgba(0,0,0,.25); }
.tw-title { height: 42px; border-bottom: 2px solid #333; background: #eee; display: flex; align-items: center; padding: 0 16px; font-weight: 700; }
.tw-title span { margin-left: auto; }
.tabs { display: flex; border-bottom: 2px solid #333; align-items: flex-end; }
.tab { padding: 8px 18px; border: 2px solid #999; border-bottom: none; border-radius: 6px 6px 0 0; margin-right: 4px; color: #555; background: #f6f6f6; }
.tab.sel { border-color: #333; color: #222; font-weight: 700; background: #fff; margin-bottom: -2px; padding-bottom: 10px; }
.cb { display: flex; align-items: center; gap: 10px; white-space: nowrap; }
.cb .box { width: 20px; height: 20px; border: 2px solid #444; border-radius: 3px; display: flex; align-items: center; justify-content: center; flex: none; }
.sw { border: 2px solid #555; border-radius: 12px; }
.sw span { position: absolute; right: 2px; top: 2px; width: 16px; height: 16px; border-radius: 50%; }
.tip { background: #fffbe6; border: 2px solid #333; border-radius: 4px; padding: 4px 8px; white-space: nowrap; box-shadow: 3px 3px 0 rgba(0,0,0,.2); }
.dg { border-collapse: collapse; border: 2px solid #333; table-layout: fixed; background: #fff; }
.dg th { background: #eee; text-align: left; border-bottom: 2px solid #333; }
.dg th, .dg td { padding: 0 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dg td { border-bottom: 1px solid #ccc; }
.dg td.obs { color: #c62828; }
'''


def write_html(out_dir, assets):
    os.makedirs(out_dir, exist_ok=True)
    assets = os.path.abspath(assets)
    index = []
    for number, name, build in SCREENS:
        h, controls = build()
        body = ''.join(render_control(ctrl, assets) for ctrl in controls)
        doc = (f'<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{esc(name)}</title>'
               f'<style>{CSS.replace("{assets}", "file://" + assets)}</style></head>'
               f'<body><div class="root" style="width:{W}px;height:{h}px">{body}</div></body></html>')
        file_name = slug(number, name)
        with open(os.path.join(out_dir, file_name + '.html'), 'w', encoding='utf-8') as f:
            f.write(doc)
        index.append({'file': file_name, 'name': f'{number} {name}', 'width': W, 'height': h})
    with open(os.path.join(out_dir, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    if sys.argv[1] == 'html':
        write_html(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'bmpr':
        write_bmpr(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    else:
        raise SystemExit(__doc__)
