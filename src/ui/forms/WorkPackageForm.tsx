import { useState } from 'react';
import type { WorkPackage } from '../../core/types';
import { usePmStore } from '../../store/pmStore';
import { Button, Field, NumberInput, TextInput } from '../components/fields';

export function WorkPackageForm({
  projectId,
  wp,
  onDone,
}: {
  projectId: string;
  wp?: WorkPackage;
  onDone: () => void;
}) {
  const saveWorkPackage = usePmStore((s) => s.saveWorkPackage);

  const [nombre, setNombre] = useState(wp?.nombre ?? '');
  const [presupuesto, setPresupuesto] = useState(wp ? String(wp.presupuesto) : '');
  const [peso, setPeso] = useState(wp ? String(wp.peso) : '');
  const [fechaInicioPlan, setFechaInicioPlan] = useState(wp?.fechaInicioPlan ?? '');
  const [fechaFinPlan, setFechaFinPlan] = useState(wp?.fechaFinPlan ?? '');
  const [responsable, setResponsable] = useState(wp?.responsable ?? '');

  const valid =
    nombre.trim() !== '' &&
    Number(presupuesto) > 0 &&
    fechaInicioPlan !== '' &&
    fechaFinPlan !== '' &&
    fechaFinPlan >= fechaInicioPlan;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await saveWorkPackage({
      ...(wp ? { id: wp.id } : {}),
      projectId,
      nombre: nombre.trim(),
      presupuesto: Number(presupuesto),
      peso: Number(peso) || Number(presupuesto),
      fechaInicioPlan,
      fechaFinPlan,
      responsable: responsable.trim(),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre del paquete">
        <TextInput value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Presupuesto">
          <NumberInput value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Peso" hint="Si se deja vacío, usa el presupuesto.">
          <NumberInput value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="opcional" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Inicio plan">
          <TextInput type="date" value={fechaInicioPlan} onChange={(e) => setFechaInicioPlan(e.target.value)} />
        </Field>
        <Field label="Fin plan">
          <TextInput type="date" value={fechaFinPlan} onChange={(e) => setFechaFinPlan(e.target.value)} />
        </Field>
      </div>
      <Field label="Responsable">
        <TextInput value={responsable} onChange={(e) => setResponsable(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!valid}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
