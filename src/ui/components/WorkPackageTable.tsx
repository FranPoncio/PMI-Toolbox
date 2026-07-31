import type { WbsNode } from '../../analytics/decisions';
import { STATUS_STYLE } from '../statusColor';
import { index, indexDelta, money, pct } from '../format';
import { Panel, SectionHead, StatusPill } from './primitives';

/** Barra de avance real con una marca de avance planificado a la fecha. */
function ProgressVsPlan({ real, plan }: { real: number; plan: number }) {
  const r = Math.max(0, Math.min(1, real));
  const p = Math.max(0, Math.min(1, plan));
  const behind = r < p - 0.02;
  return (
    <div className="relative h-2 w-28 rounded-full bg-bg ring-1 ring-inset ring-line">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${r * 100}%`, backgroundColor: behind ? '#BC4327' : '#27795A' }}
      />
      <div
        className="absolute inset-y-[-2px] w-[2px] bg-ink"
        style={{ left: `calc(${p * 100}% - 1px)` }}
        title={`Plan: ${pct(plan)}`}
      />
    </div>
  );
}

function IndexCell({ value }: { value: number | null }) {
  const status =
    value === null ? 'sin-dato' : value >= 0.98 ? 'onplan' : value >= 0.9 ? 'atencion' : 'desvio';
  const s = STATUS_STYLE[status];
  return (
    <span className="num inline-flex flex-col items-end leading-tight">
      <span className={`${s.text} font-600`}>{index(value)}</span>
      <span className="text-[11px] text-tech/70">{indexDelta(value)}</span>
    </span>
  );
}

/** Aplana el árbol en orden de WBS (padre antes que hijos), contando nodos. */
function flatten(nodes: WbsNode[]): WbsNode[] {
  const out: WbsNode[] = [];
  const visit = (n: WbsNode) => {
    out.push(n);
    n.children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

function Row({ node, currency }: { node: WbsNode; currency: string }) {
  const { inputs, evm, isLeaf } = node;
  const real = inputs.bac > 0 ? inputs.ev / inputs.bac : 0;
  const plan = inputs.bac > 0 ? inputs.pv / inputs.bac : 0;
  const vac = evm.vac.cpi;
  const nombreCls = isLeaf ? 'font-500 text-ink' : 'font-700 text-ink';

  return (
    <tr className={`align-middle ${isLeaf ? '' : 'bg-bg/40'}`}>
      <td className="px-5 py-2.5">
        <div style={{ paddingLeft: `${node.depth * 16}px` }}>
          <div className="flex items-center gap-1.5">
            {!isLeaf && <span className="text-tech/60" aria-hidden>▾</span>}
            <span className={nombreCls}>{node.wp.nombre}</span>
          </div>
          {isLeaf && node.wp.responsable && (
            <div className="text-[12px] text-tech/80" style={{ marginLeft: '0px' }}>
              {node.wp.responsable}
            </div>
          )}
        </div>
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2">
          <ProgressVsPlan real={real} plan={plan} />
          <span className="num text-[12px] text-tech">
            {pct(real)} <span className="text-tech/60">/ {pct(plan)}</span>
          </span>
        </div>
      </td>
      <td className="py-2.5 pr-4 text-right">
        <IndexCell value={evm.spi} />
      </td>
      <td className="py-2.5 pr-4 text-right">
        <IndexCell value={evm.cpi} />
      </td>
      <td className="num py-2.5 pr-4 text-right">
        {evm.eac.cpi === null ? (
          <span className="text-tech/60">—</span>
        ) : (
          <span className="inline-flex flex-col items-end leading-tight">
            <span className="text-ink">{money(evm.eac.cpi, currency)}</span>
            <span
              className="text-[11px]"
              style={{ color: vac !== null && vac < 0 ? '#BC4327' : '#58696F' }}
            >
              {vac === null ? '' : vac < 0 ? `+${money(-vac, currency)}` : 'en presupuesto'}
            </span>
          </span>
        )}
      </td>
      <td className="py-2.5 pr-5 text-right">
        <StatusPill status={node.status} />
      </td>
    </tr>
  );
}

/**
 * Tabla de la WBS. Muestra la jerarquía indentada: los nodos de resumen (en
 * negrita, con fondo tenue) traen el roll-up de sus hojas; las hojas, su dato
 * propio. Ningún valor va solo — el avance se muestra contra el plan y SPI/CPI
 * contra 1.00.
 */
export function WorkPackageTable({ tree, currency }: { tree: WbsNode[]; currency: string }) {
  const rows = flatten(tree);
  const hojas = rows.filter((n) => n.isLeaf).length;

  return (
    <Panel>
      <SectionHead
        eyebrow="Detalle"
        title="Estructura de trabajo (WBS)"
        aside={`${hojas} paquete(s) · ${rows.length - hojas} resumen`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-tech/70">
              <th className="px-5 py-2 font-500">Paquete</th>
              <th className="py-2 pr-4 font-500">Avance vs plan</th>
              <th className="py-2 pr-4 text-right font-500">SPI</th>
              <th className="py-2 pr-4 text-right font-500">CPI</th>
              <th className="py-2 pr-4 text-right font-500">EAC vs BAC</th>
              <th className="py-2 pr-5 text-right font-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((node) => (
              <Row key={node.wp.id} node={node} currency={currency} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
