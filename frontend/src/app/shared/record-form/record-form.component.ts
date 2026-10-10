import { Component, computed, input } from '@angular/core';
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
import { EntityDefinition, FieldDefinition, FieldIssue, TestStep } from '../../core/models';

type StepGroup = FormGroup<{ action: FormControl<string>; expectedResult: FormControl<string> }>;

const atLeastOneStep = (control: AbstractControl): ValidationErrors | null =>
  (control as FormArray).length > 0 ? null : { required: true };

/**
 * Formulario dinámico generado desde la definición del tipo de información.
 * Lo usan el registro individual y la corrección de filas de la carga masiva.
 */
@Component({
  selector: 'app-record-form',
  imports: [
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

  readonly fields = computed(() => this.definition().fields);

  /** El formulario se reconstruye cuando cambia la definición o el valor de entrada. */
  private readonly formState = computed(() => {
    const form = this.build(this.definition(), this.value());
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

  private build(def: EntityDefinition, value: Record<string, unknown> | null): FormGroup<Record<string, AbstractControl>> {
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
      controls[field.key] = new FormControl(this.toControlValue(field, raw), field.required ? Validators.required : null);
    }
    return new FormGroup(controls);
  }

  private stepGroup(step?: Partial<TestStep>): StepGroup {
    return new FormGroup({
      action: new FormControl(step?.action ?? '', { nonNullable: true, validators: Validators.required }),
      expectedResult: new FormControl(step?.expectedResult ?? '', { nonNullable: true, validators: Validators.required }),
    });
  }

  private toControlValue(field: FieldDefinition, raw: unknown): string {
    if (raw === null || raw === undefined) return '';
    switch (field.type) {
      case 'list':
        return Array.isArray(raw) ? raw.join('\n') : String(raw);
      case 'refList':
        return Array.isArray(raw) ? raw.join('; ') : String(raw);
      case 'date': {
        const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw));
        return m ? m[1] : ''; // fechas no válidas quedan vacías para volver a elegirlas
      }
      default:
        return String(raw);
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
      const v = raw[field.key];
      if (field.type === 'steps') {
        out[field.key] = ((v as TestStep[]) ?? []).map((s, i) => ({ ...s, number: i + 1 }));
      } else if (field.type === 'list') {
        out[field.key] = String(v ?? '')
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean);
      } else {
        out[field.key] = typeof v === 'string' ? v.trim() || null : v;
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
