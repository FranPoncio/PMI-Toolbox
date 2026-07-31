import type { AuditAction, Rol } from '../core/types';

export const ROL_LABEL: Record<Rol, string> = {
  analista: 'Analista',
  jefe_proyecto: 'Jefe de proyecto',
  director: 'Director',
  auditor: 'Auditor',
};

export const ACTION_LABEL: Record<AuditAction, string> = {
  crear: 'Alta',
  editar: 'Edición',
  borrar: 'Baja',
  congelar: 'Línea base',
  importar: 'Carga',
};
