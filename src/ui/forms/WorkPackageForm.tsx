import { useState } from 'react';
import type { WorkPackage } from '../../core/types';
import { childrenOf, parentCandidates } from '../../analytics/wbs';
import { usePmStore } from '../../store/pmStore';
import { Button, Field, NumberInput, Select, TextInput } from '../components/fields';

export function WorkPackageForm({
  projectId,
  workPackages,
  wp,
  onDone,
}: {
  projectId: string;
  workPackages: WorkPackage[];
  wp?: WorkPackage;
  onDone: () => void;
}) {
  const saveWorkPackage = usePmStore((s) => s.saveWorkPackage);

  // Si el paquete ya tiene hijos, es de resumen: su presupuesto/fechas son
  // roll-up y no se editan.
  const esResumen = wp ? childrenOf(wp.id, workPackages).length > 0 : false;
  const candidatos = parentCandidates(workPackages, wp?.id);

  const [nombre, setNombre] = useState(wp?.nombre ?? '');
  const [parentId, setParentId] = useState<string>(wp?.parentId ?? '');
  const [presupuesto, setPresupuesto] = useState(wp ? String(wp.presupuesto) : '');
  const [peso, setPeso] = useState(wp ? String(wp.peso) : '');
  const [fechaInicioPlan, setFechaInicioPlan] = useState(wp?.fechaInicioPlan ?? '');
  const [fechaFinPlan, setFechaFinPlan] = useState(wp?.fechaFinPlan ?? '');
  const [responsable, setResponsable] = useState(wp?.responsable ?? '');

  const valid =
    nombre.trim() !== '' &&
    (esResumen ||
      (Number(presupuesto) > 0 &&
        fechaInicioPlan !== '' &&
        fechaFinPlan !== '' &&
        fechaFinPlan >= fechaInicioPlan));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await saveWorkPackage({
      ...(wp ? { id: wp.id } : {}),
      projectId,
      parentId: parentId || null,
      nombre: nombre.trim(),
      presupuesto: Number(presupuesto) || 0,
      peso: Number(peso) || Number(presupuesto) || 0,
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

      <Field label="Depende de (WBS)" hint="Elegí un paquete padre para anidarlo, o dejalo en la raíz.">
        <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">— Raíz del proyecto —</option>
          {candidatos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </Field>

      {esResumen ? (
        <p className="rounded-md border border-line bg-bg/60 px-4 py-3 text-[13px] text-muted">
          Este paquete es de <b>resumen</b>: tiene sub-paquetes, así que su presupuesto, fechas y
          avance se calculan como roll-up de sus hijos y no se editan acá.
        </p>
      ) : (
        <>
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
        </>
      )}

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
