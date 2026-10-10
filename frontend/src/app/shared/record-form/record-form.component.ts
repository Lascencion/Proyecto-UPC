import { Component, computed, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TextFieldModule } from '@angular/cdk/text-field';
import { NgTemplateOutlet } from '@angular/common';
import { EntityDefinition, FieldDefinition, FieldIssue, RecordOption, RefOptions, TestStep } from '../../core/models';

type StepGroup = FormGroup<{ action: FormControl<string>; expectedResult: FormControl<string> }>;

/**
 * - `manual`: registro individual. El código lo asigna el sistema (solo lectura) y
 *   los registros relacionados se eligen de listas.
 * - `bulk`: corrección de una fila de carga masiva. El código es la referencia
 *   temporal del archivo y las relaciones se escriben como referencias o códigos.
 */
export type RecordFormMode = 'manual' | 'bulk';

const atLeastOneStep = (control: AbstractControl): ValidationErrors | null =>
  (control as FormArray).length > 0 ? null : { required: true };

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Formulario dinámico generado desde la definición del tipo de información.
 * Lo usan el registro individual y la corrección de filas de la carga masiva.
 */
@Component({
  selector: 'app-record-form',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TextFieldModule,
  ],
  templateUrl: './record-form.component.html',
  styleUrl: './record-form.component.scss',
})
export class RecordFormComponent {
  readonly definition = input.required<EntityDefinition>();
  readonly value = input<Record<string, unknown> | null>(null);
  readonly readonly = input(false);
  readonly mode = input<RecordFormMode>('manual');
  /** Registros existentes del proyecto para las listas de selección. */
  readonly refOptions = input<RefOptions>({});
  /** Código a mostrar en un registro nuevo (el que asignará el sistema). */
  readonly codePreview = input<string | null>(null);

  readonly fields = computed(() => this.definition().fields);

  /** Texto de búsqueda de cada lista de selección. */
  readonly filters = signal<Record<string, string>>({});

  /** El formulario se reconstruye cuando cambia la definición o el valor de entrada. */
  private readonly formState = computed(() => {
    const form = this.build(this.definition(), this.value(), this.mode());
    if (this.readonly()) form.disable();
    return form;
  });

  get form(): FormGroup<Record<string, AbstractControl>> {
    return this.formState();
  }

  isWide(field: FieldDefinition): boolean {
    return ['text', 'list', 'steps'].includes(field.type);
  }

  control(key: string): FormControl {
    return this.form.get(key) as FormControl;
  }

  steps(key: string): FormArray<StepGroup> {
    return this.form.get(key) as FormArray<StepGroup>;
  }

  codeText(): string {
    const code = this.value()?.['code'];
    if (code) return String(code);
    return this.codePreview() ? `${this.codePreview()} (se asigna al guardar)` : 'Se asigna al guardar';
  }

  // ----- Listas de registros relacionados -----

  options(field: FieldDefinition): RecordOption[] {
    const available = this.refOptions()[field.refType!] ?? [];
    // Conserva como opción los valores ya guardados que no están en la lista (p. ej. eliminados).
    const selected = this.selectedCodes(field).filter((c) => !available.some((o) => o.code === c));
    return [...available, ...selected.map((code) => ({ code, title: '(no registrado)' }))];
  }

  private selectedCodes(field: FieldDefinition): string[] {
    const v = this.form.get(field.key)?.value;
    return Array.isArray(v) ? v : v ? [v] : [];
  }

  matches(field: FieldDefinition, option: RecordOption): boolean {
    const text = normalize(this.filters()[field.key] ?? '');
    return !text || normalize(`${option.code} ${option.title}`).includes(text);
  }

  setFilter(key: string, text: string): void {
    this.filters.update((f) => ({ ...f, [key]: text }));
  }

  /** Texto del campo cerrado: los códigos elegidos (o código y título si es uno solo). */
  triggerText(field: FieldDefinition): string {
    const codes = this.selectedCodes(field);
    return codes.length === 1 ? this.optionLabel(field, codes[0]) : codes.join(', ');
  }

  optionLabel(field: FieldDefinition, code: string): string {
    const option = this.options(field).find((o) => o.code === code);
    return option ? `${option.code} · ${option.title}` : code;
  }

  // ----- Construcción y valores -----

  private build(def: EntityDefinition, value: Record<string, unknown> | null, mode: RecordFormMode) {
    const controls: Record<string, AbstractControl> = {};
    for (const field of def.fields) {
      const raw = value?.[field.key];
      if (field.type === 'steps') {
        const steps = Array.isArray(raw) ? (raw as TestStep[]) : [];
        controls[field.key] = new FormArray<StepGroup>(
          steps.map((s) => this.stepGroup(s)),
          field.required ? atLeastOneStep : null,
        );
        continue;
      }
      if (field.type === 'code' && mode === 'manual') continue; // se muestra aparte, no se envía
      controls[field.key] = new FormControl(this.toControlValue(field, raw, mode), field.required ? Validators.required : null);
    }
    return new FormGroup(controls);
  }

  private stepGroup(step?: Partial<TestStep>): StepGroup {
    return new FormGroup({
      action: new FormControl(step?.action ?? '', { nonNullable: true, validators: Validators.required }),
      expectedResult: new FormControl(step?.expectedResult ?? '', { nonNullable: true, validators: Validators.required }),
    });
  }

  private toControlValue(field: FieldDefinition, raw: unknown, mode: RecordFormMode): unknown {
    const list = Array.isArray(raw) ? raw.map(String) : raw ? String(raw).split(/[;\n]+/).map((x) => x.trim()).filter(Boolean) : [];
    switch (field.type) {
      case 'list':
        return list.join('\n');
      case 'refList':
        return mode === 'manual' ? list : list.join('; ');
      case 'ref':
        return mode === 'manual' ? (list[0] ?? null) : (list[0] ?? '');
      case 'date': {
        const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw ?? ''));
        return m ? m[1] : ''; // fechas no válidas quedan vacías para volver a elegirlas
      }
      default:
        return raw === null || raw === undefined ? '' : String(raw);
    }
  }

  addStep(key: string, index?: number): void {
    const arr = this.steps(key);
    arr.insert(index ?? arr.length, this.stepGroup());
    arr.markAsDirty();
  }

  removeStep(key: string, index: number): void {
    this.steps(key).removeAt(index);
    this.steps(key).markAsDirty();
  }

  moveStep(key: string, index: number, delta: number): void {
    const arr = this.steps(key);
    const target = index + delta;
    if (target < 0 || target >= arr.length) return;
    const ctrl = arr.at(index);
    arr.removeAt(index);
    arr.insert(target, ctrl);
    arr.markAsDirty();
  }

  /** Valida el formulario y marca los campos para mostrar errores. */
  validate(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }

  /** Valores listos para enviar a la API. */
  getValue(): Record<string, unknown> {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const field of this.definition().fields) {
      if (!(field.key in raw)) continue;
      const v = raw[field.key];
      if (field.type === 'steps') {
        out[field.key] = ((v as TestStep[]) ?? []).map((s, i) => ({ ...s, number: i + 1 }));
      } else if (field.type === 'list') {
        out[field.key] = String(v ?? '')
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean);
      } else if (Array.isArray(v)) {
        out[field.key] = v;
      } else {
        out[field.key] = typeof v === 'string' ? v.trim() || null : (v ?? null);
      }
    }
    return out;
  }

  /** Muestra en cada campo los errores devueltos por el servidor. */
  applyServerErrors(errors: FieldIssue[]): void {
    for (const e of errors) {
      const ctrl = e.field ? this.form.get(e.field) : null;
      if (ctrl) {
        ctrl.setErrors({ ...(ctrl.errors ?? {}), server: e.message });
        ctrl.markAsTouched();
      }
    }
  }

  errorText(field: FieldDefinition): string {
    const errors = this.form.get(field.key)?.errors;
    if (!errors) return '';
    if (errors['server']) return errors['server'];
    if (errors['required']) return field.type === 'steps' ? 'Agregue al menos un paso.' : 'Campo obligatorio.';
    return 'Valor no válido.';
  }
}
