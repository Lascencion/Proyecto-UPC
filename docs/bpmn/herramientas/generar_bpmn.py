"""Genera los diagramas BPMN 2.0 (AS-IS y TO-BE) importables en Bizagi Modeler.

Uso: python3 generar_bpmn.py <carpeta_salida>
Cada diagrama es una colaboración con un pool y un carril (lane) por rol.
Las coordenadas (BPMNDI) se calculan aquí para que el diagrama se vea ordenado al importarlo.
"""
import sys
from xml.sax.saxutils import escape

COL_W = 165        # ancho de cada columna
TASK_W, TASK_H = 125, 70
EVT, GW = 36, 50
LANE_H = 170
POOL_X, POOL_Y, POOL_LABEL, LANE_LABEL = 40, 40, 30, 30
X0 = POOL_X + POOL_LABEL + LANE_LABEL + 30   # x de la primera columna


class Diagram:
    def __init__(self, key, name, pool, lanes):
        self.key, self.name, self.pool = key, name, pool
        self.lanes = lanes                     # [(id, nombre)]
        self.nodes, self.flows, self.annotations = {}, [], []

    def lane_y(self, lane):
        i = [l[0] for l in self.lanes].index(lane)
        return POOL_Y + i * LANE_H

    def node(self, nid, kind, name, lane, col, doc='', dy=0):
        w, h = {'start': (EVT, EVT), 'end': (EVT, EVT), 'gateway': (GW, GW)}.get(kind, (TASK_W, TASK_H))
        cx = X0 + col * COL_W + TASK_W / 2
        cy = self.lane_y(lane) + LANE_H / 2 + dy
        self.nodes[nid] = dict(id=nid, kind=kind, name=name, lane=lane, doc=doc,
                               x=cx - w / 2, y=cy - h / 2, w=w, h=h, cx=cx, cy=cy)

    # puntos de conexión
    def R(self, n): n = self.nodes[n]; return (n['x'] + n['w'], n['cy'])
    def L(self, n): n = self.nodes[n]; return (n['x'], n['cy'])
    def T(self, n): n = self.nodes[n]; return (n['cx'], n['y'])
    def B(self, n): n = self.nodes[n]; return (n['cx'], n['y'] + n['h'])

    def flow(self, src, dst, name='', points=None, label_at=None, label_w=120):
        if points is None:
            (sx, sy), (tx, ty) = self.R(src), self.L(dst)
            if abs(sy - ty) < 1:
                points = [(sx, sy), (tx, ty)]
            else:  # codo: sale por la derecha, baja/sube a mitad de camino y entra por la izquierda
                mx = sx + (tx - sx) / 2
                points = [(sx, sy), (mx, sy), (mx, ty), (tx, ty)]
        fid = f'Flow_{self.key}_{len(self.flows) + 1}'
        self.flows.append(dict(id=fid, src=src, dst=dst, name=name, points=points, label_at=label_at, label_w=label_w))

    def annotation(self, aid, text, lane, col, width_cols, target):
        x = X0 + col * COL_W
        y = self.lane_y(lane) + 15
        self.annotations.append(dict(id=aid, text=text, x=x, y=y, w=width_cols * COL_W - 40, h=LANE_H - 30, target=target))

    @property
    def width(self):
        right = max(n['x'] + n['w'] for n in self.nodes.values())
        return right - POOL_X + 50

    def xml(self):
        P = f'Process_{self.key}'
        tag = {'start': 'startEvent', 'end': 'endEvent', 'gateway': 'exclusiveGateway',
               'user': 'userTask', 'manual': 'manualTask', 'service': 'serviceTask'}
        out = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" '
               'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" '
               'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" '
               'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" '
               'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
               f'id="Definitions_{self.key}" name="{escape(self.name)}" '
               'targetNamespace="http://upc.edu.pe/qa-knowledge/bpmn" exporter="generar_bpmn.py" exporterVersion="1.0">',
               f'  <collaboration id="Collaboration_{self.key}">',
               f'    <participant id="Participant_{self.key}" name="{escape(self.pool)}" processRef="{P}" />',
               '  </collaboration>',
               f'  <process id="{P}" name="{escape(self.pool)}" isExecutable="false">',
               f'    <laneSet id="LaneSet_{self.key}">']
        for lid, lname in self.lanes:
            out.append(f'      <lane id="{lid}" name="{escape(lname)}">')
            out += [f'        <flowNodeRef>{n["id"]}</flowNodeRef>' for n in self.nodes.values() if n['lane'] == lid]
            out.append('      </lane>')
        out.append('    </laneSet>')
        for n in self.nodes.values():
            t = tag[n['kind']]
            out.append(f'    <{t} id="{n["id"]}" name="{escape(n["name"])}">')
            if n['doc']:
                out.append(f'      <documentation>{escape(n["doc"])}</documentation>')
            out += [f'      <incoming>{f["id"]}</incoming>' for f in self.flows if f['dst'] == n['id']]
            out += [f'      <outgoing>{f["id"]}</outgoing>' for f in self.flows if f['src'] == n['id']]
            out.append(f'    </{t}>')
        for f in self.flows:
            name = f' name="{escape(f["name"])}"' if f['name'] else ''
            out.append(f'    <sequenceFlow id="{f["id"]}"{name} sourceRef="{f["src"]}" targetRef="{f["dst"]}" />')
        for a in self.annotations:
            out.append(f'    <textAnnotation id="{a["id"]}"><text>{escape(a["text"])}</text></textAnnotation>')
            out.append(f'    <association id="Assoc_{a["id"]}" sourceRef="{a["target"]}" targetRef="{a["id"]}" />')
        out.append('  </process>')

        # Diagrama
        fmt = lambda v: f'{v:.0f}'
        bounds = lambda x, y, w, h: f'<dc:Bounds x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" />'
        pool_h = LANE_H * len(self.lanes)
        out += [f'  <bpmndi:BPMNDiagram id="Diagram_{self.key}" name="{escape(self.name)}">',
                f'    <bpmndi:BPMNPlane id="Plane_{self.key}" bpmnElement="Collaboration_{self.key}">',
                f'      <bpmndi:BPMNShape id="Participant_{self.key}_di" bpmnElement="Participant_{self.key}" isHorizontal="true">',
                f'        {bounds(POOL_X, POOL_Y, self.width, pool_h)}',
                '      </bpmndi:BPMNShape>']
        for lid, _ in self.lanes:
            out += [f'      <bpmndi:BPMNShape id="{lid}_di" bpmnElement="{lid}" isHorizontal="true">',
                    f'        {bounds(POOL_X + POOL_LABEL, self.lane_y(lid), self.width - POOL_LABEL, LANE_H)}',
                    '      </bpmndi:BPMNShape>']
        for n in self.nodes.values():
            extra = ' isMarkerVisible="true"' if n['kind'] == 'gateway' else ''
            out += [f'      <bpmndi:BPMNShape id="{n["id"]}_di" bpmnElement="{n["id"]}"{extra}>',
                    f'        {bounds(n["x"], n["y"], n["w"], n["h"])}']
            if n['kind'] in ('start', 'end', 'gateway'):
                ly = n['y'] + n['h'] + 5
                out.append(f'        <bpmndi:BPMNLabel>{bounds(n["cx"] - 55, ly, 110, 30)}</bpmndi:BPMNLabel>')
            out.append('      </bpmndi:BPMNShape>')
        for a in self.annotations:
            out += [f'      <bpmndi:BPMNShape id="{a["id"]}_di" bpmnElement="{a["id"]}">',
                    f'        {bounds(a["x"], a["y"], a["w"], a["h"])}', '      </bpmndi:BPMNShape>']
            t = self.nodes[a['target']]
            out += [f'      <bpmndi:BPMNEdge id="Assoc_{a["id"]}_di" bpmnElement="Assoc_{a["id"]}">',
                    f'        <di:waypoint x="{fmt(t["cx"])}" y="{fmt(t["y"])}" />',
                    f'        <di:waypoint x="{fmt(t["cx"])}" y="{fmt(a["y"] + a["h"])}" />',
                    '      </bpmndi:BPMNEdge>']
        for f in self.flows:
            out.append(f'      <bpmndi:BPMNEdge id="{f["id"]}_di" bpmnElement="{f["id"]}">')
            out += [f'        <di:waypoint x="{fmt(x)}" y="{fmt(y)}" />' for x, y in f['points']]
            if f['name']:
                lx, ly = f['label_at'] or (f['points'][0][0] + 8, f['points'][0][1] - 22)
                out.append(f'        <bpmndi:BPMNLabel>{bounds(lx, ly, f['label_w'], 20)}</bpmndi:BPMNLabel>')
            out.append('      </bpmndi:BPMNEdge>')
        out += ['    </bpmndi:BPMNPlane>', '  </bpmndi:BPMNDiagram>', '</definitions>', '']
        return '\n'.join(out)


def as_is():
    d = Diagram('ASIS', 'Proceso actual (AS-IS)',
                'Proceso actual (AS-IS): generación de casos de prueba funcionales para la compra de monedas virtuales',
                [('Lane_ASIS_Producto', 'Equipo de Producto'), ('Lane_ASIS_Analista', 'Analista QA'), ('Lane_ASIS_Lider', 'Líder QA')])
    P, A, L = (l[0] for l in d.lanes)
    d.node('Start_ASIS', 'start', 'Inicio', P, 0)
    d.node('Task_ASIS_1', 'manual', 'Definir requerimiento funcional', P, 1,
           'Se definen requerimientos, historias de usuario, criterios de aceptación y reglas de negocio.')
    d.node('Task_ASIS_2', 'manual', 'Revisar requerimiento manualmente', A, 2,
           'El analista interpreta la funcionalidad y las condiciones que deben validarse.')
    d.node('Task_ASIS_3', 'manual', 'Identificar variables manualmente', A, 3,
           'Métodos de pago, paquetes de monedas, promociones, monedas de cobro, estados de transacción y restricciones.')
    d.node('Task_ASIS_4', 'manual', 'Identificar escenarios manualmente', A, 4,
           'Se determinan escenarios principales, alternativos, negativos y excepcionales según el criterio del analista.')
    d.node('Task_ASIS_5', 'manual', 'Consultar información adicional', A, 5,
           'Se revisan reglas de negocio, documentación funcional y casos de prueba históricos.')
    d.node('Task_ASIS_6', 'manual', 'Elaborar casos de prueba manualmente', A, 6,
           'Se redactan precondiciones, datos de entrada, pasos de ejecución y resultados esperados.')
    d.node('Task_ASIS_7', 'manual', 'Revisar casos de prueba', L, 7,
           'Se verifica la alineación de los casos con los requerimientos y reglas de negocio.')
    d.node('Gw_ASIS_Obs', 'gateway', '¿Existen observaciones?', L, 8)
    d.node('Task_ASIS_Corregir', 'manual', 'Corregir casos de prueba', A, 8,
           'El Analista QA corrige los casos según las observaciones del Líder QA y los vuelve a enviar a revisión.')
    d.node('Task_ASIS_9', 'manual', 'Aprobar casos de prueba', L, 9,
           'Los casos quedan disponibles para su posterior ejecución y reutilización.')
    d.node('End_ASIS', 'end', 'Casos de prueba aprobados', L, 10)

    d.flow('Start_ASIS', 'Task_ASIS_1')
    for a, b in [(1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7)]:
        d.flow(f'Task_ASIS_{a}', f'Task_ASIS_{b}')
    d.flow('Task_ASIS_7', 'Gw_ASIS_Obs')
    d.flow('Gw_ASIS_Obs', 'Task_ASIS_Corregir', 'Sí', [d.T('Gw_ASIS_Obs'), d.B('Task_ASIS_Corregir')],
           label_at=(d.T('Gw_ASIS_Obs')[0] + 8, d.T('Gw_ASIS_Obs')[1] - 30), label_w=30)
    cx7 = d.nodes['Task_ASIS_7']['cx']
    d.flow('Task_ASIS_Corregir', 'Task_ASIS_7', 'Volver a revisión',
           [d.L('Task_ASIS_Corregir'), (cx7, d.L('Task_ASIS_Corregir')[1]), d.T('Task_ASIS_7')],
           label_at=(cx7 + 6, d.L('Task_ASIS_Corregir')[1] - 22), label_w=90)
    d.flow('Gw_ASIS_Obs', 'Task_ASIS_9', 'No')
    d.flow('Task_ASIS_9', 'End_ASIS')
    d.annotation('Annotation_ASIS_Critico',
                 'Punto crítico del AS-IS: la identificación de variables, escenarios y elaboración de casos de prueba '
                 'depende principalmente del análisis manual y de la experiencia del Analista QA, lo que puede generar '
                 'omisiones frente a una alta variabilidad de condiciones funcionales.', P, 3, 3, 'Task_ASIS_4')
    return d


def to_be():
    d = Diagram('TOBE', 'Proceso propuesto (TO-BE)',
                'Proceso propuesto (TO-BE): generación de casos de prueba funcionales con LLM',
                [('Lane_TOBE_Analista', 'Analista QA'), ('Lane_TOBE_Sistema', 'Sistema (LLM)'), ('Lane_TOBE_Lider', 'Líder QA')])
    A, S, L = (l[0] for l in d.lanes)
    d.node('Start_TOBE', 'start', 'Inicio', A, 0)
    d.node('Task_TOBE_Login', 'user', 'Iniciar sesión', A, 1)
    d.node('Task_TOBE_Validar', 'service', 'Validar credenciales y mostrar el menú según el rol', S, 2)
    d.node('Task_TOBE_Registrar', 'user', 'Registrar información histórica (individual o masiva)', A, 3,
           'Requerimientos, reglas de negocio, casos de prueba y defectos, por formulario o carga masiva (Excel, Word, CSV).')
    d.node('Task_TOBE_Almacenar', 'service', 'Validar y almacenar en la base de conocimiento', S, 4)
    d.node('Task_TOBE_Ingresar', 'user', 'Ingresar el requerimiento a validar', A, 5)
    d.node('Task_TOBE_Recuperar', 'service', 'Recuperar reglas, requerimientos y casos históricos similares', S, 6)
    d.node('Task_TOBE_Generar', 'service', 'Generar los casos de prueba funcionales (LLM)', S, 7)
    d.node('Task_TOBE_Revisar', 'user', 'Revisar los casos generados', A, 8)
    d.node('Gw_TOBE_Correctos', 'gateway', '¿Son correctos?', A, 9)
    d.node('Task_TOBE_Enviar', 'user', 'Enviar los casos a aprobación', A, 10)
    d.node('Task_TOBE_RevisarLider', 'user', 'Revisar los casos de prueba', L, 11)
    d.node('Gw_TOBE_Aprueba', 'gateway', '¿Aprueba?', L, 12)
    d.node('Task_TOBE_Devolver', 'user', 'Devolver con observaciones', L, 13)
    d.node('Task_TOBE_Reportes', 'service', 'Registrar los casos aprobados y generar reportes', S, 13)
    d.node('End_TOBE', 'end', 'Casos de prueba aprobados', S, 14)

    d.flow('Start_TOBE', 'Task_TOBE_Login')
    seq = ['Task_TOBE_Login', 'Task_TOBE_Validar', 'Task_TOBE_Registrar', 'Task_TOBE_Almacenar',
           'Task_TOBE_Ingresar', 'Task_TOBE_Recuperar', 'Task_TOBE_Generar']
    for a, b in zip(seq, seq[1:]):
        d.flow(a, b)
    # Generar (Sistema) -> Revisar (Analista): sale por arriba para no cruzarse con el regreso desde el gateway
    g = d.nodes['Task_TOBE_Generar']
    d.flow('Task_TOBE_Generar', 'Task_TOBE_Revisar', points=[d.T('Task_TOBE_Generar'), (g['cx'], d.L('Task_TOBE_Revisar')[1]), d.L('Task_TOBE_Revisar')])
    d.flow('Task_TOBE_Revisar', 'Gw_TOBE_Correctos')
    gw = d.nodes['Gw_TOBE_Correctos']
    d.flow('Gw_TOBE_Correctos', 'Task_TOBE_Generar', 'No: solicita nueva generación',
           [d.B('Gw_TOBE_Correctos'), (gw['cx'], g['cy']), d.R('Task_TOBE_Generar')],
           label_at=(gw['cx'] + 8, d.B('Gw_TOBE_Correctos')[1] + 40), label_w=170)
    d.flow('Gw_TOBE_Correctos', 'Task_TOBE_Enviar', 'Sí')
    d.flow('Task_TOBE_Enviar', 'Task_TOBE_RevisarLider')
    d.flow('Task_TOBE_RevisarLider', 'Gw_TOBE_Aprueba')
    ga = d.nodes['Gw_TOBE_Aprueba']
    d.flow('Gw_TOBE_Aprueba', 'Task_TOBE_Reportes', 'Sí',
           [d.T('Gw_TOBE_Aprueba'), (ga['cx'], d.L('Task_TOBE_Reportes')[1]), d.L('Task_TOBE_Reportes')],
           label_at=(ga['cx'] + 8, d.T('Gw_TOBE_Aprueba')[1] - 30), label_w=30)
    d.flow('Gw_TOBE_Aprueba', 'Task_TOBE_Devolver', 'No')
    d.flow('Task_TOBE_Reportes', 'End_TOBE')
    # Devolver (Líder) -> Revisar (Analista): por la parte baja del carril del Líder QA
    low = d.lane_y(L) + LANE_H - 15
    dv, rv = d.nodes['Task_TOBE_Devolver'], d.nodes['Task_TOBE_Revisar']
    d.flow('Task_TOBE_Devolver', 'Task_TOBE_Revisar', 'El Analista QA ajusta y vuelve a revisar',
           [d.B('Task_TOBE_Devolver'), (dv['cx'], low), (rv['cx'] - 30, low), (rv['cx'] - 30, rv['y'] + rv['h'])],
           label_at=(rv['cx'] + 40, low - 45), label_w=260)
    return d


if __name__ == '__main__':
    out = sys.argv[1]
    for d, fname in [(as_is(), 'AS-IS_generacion_casos_prueba.bpmn'), (to_be(), 'TO-BE_generacion_casos_prueba_LLM.bpmn')]:
        with open(f'{out}/{fname}', 'w', encoding='utf-8') as fh:
            fh.write(d.xml())
        print(fname, len(d.nodes), 'nodos', len(d.flows), 'flujos')
