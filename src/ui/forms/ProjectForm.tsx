import { useState } from 'react';
import type { Project, ProjectType } from '../../core/types';
import { usePmStore } from '../../store/pmStore';
import { Button, Field, NumberInput, Select, TextInput } from '../components/fields';

const TIPOS: Array<{ value: ProjectType; label: string }> = [
  { value: 'obra_civil', label: 'Obra civil' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'ti', label: 'TI' },
  { value: 'servicios', label: 'Servicios' },
];

const MONEDAS = ['USD', 'ARS', 'EUR', 'BRL'];

export function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const saveProject = usePmStore((s) => s.saveProject);
  const removeProject = usePmStore((s) => s.removeProject);

  const [nombre, setNombre] = useState(project?.nombre ?? '');
  const [tipo, setTipo] = useState<ProjectType>(project?.tipo ?? 'obra_civil');
  const [bac, setBac] = useState(project ? String(project.bac) : '');
  const [fechaInicio, setFechaInicio] = useState(project?.fechaInicio ?? '');
  const [fechaFinPlan, setFechaFinPlan] = useState(project?.fechaFinPlan ?? '');
  const [moneda, setMoneda] = useState(project?.moneda ?? 'USD');

  const valid =
    nombre.trim() !== '' && Number(bac) > 0 && fechaInicio !== '' && fechaFinPlan !== '' && fechaFinPlan >= fechaInicio;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await saveProject({
      ...(project ? { id: project.id } : {}),
      nombre: nombre.trim(),
      tipo,
      bac: Number(bac),
      fechaInicio,
      fechaFinPlan,
      moneda,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre del proyecto">
        <TextInput value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as ProjectType)}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Moneda">
          <Select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
            {MONEDAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Presupuesto total (BAC)" hint="En la moneda del proyecto.">
        <NumberInput value={bac} onChange={(e) => setBac(e.target.value)} placeholder="0" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Inicio">
          <TextInput type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </Field>
        <Field label="Fin planificado">
          <TextInput type="date" value={fechaFinPlan} onChange={(e) => setFechaFinPlan(e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-2">
        {project ? (
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              if (confirm(`¿Borrar el proyecto «${project.nombre}» y todos sus datos?`)) {
                await removeProject(project.id);
                onDone();
              }
            }}
          >
            Borrar proyecto
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            Guardar
          </Button>
        </div>
      </div>
    </form>
  );
}
