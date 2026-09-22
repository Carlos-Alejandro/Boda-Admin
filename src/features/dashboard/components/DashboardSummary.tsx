import { ButtonLink } from '../../../shared/components/Button/Button';
import type { DashboardMetrics } from '../model/calculateDashboardMetrics';
import type { DashboardDetails } from '../model/buildDashboardDetails';
import { DashboardPanels } from './DashboardPanels';
import { DashboardIcon } from './DashboardIcon';

const number = (value: number) => value.toLocaleString('es-MX');

export function DashboardSummary({ metrics: m, details }: { metrics: DashboardMetrics; details: DashboardDetails }) {
 const rate = m.responseRate === null ? null : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(m.responseRate);
 return <div className="dashboard-content">
  {m.registeredInvitations === 0 && <div className="dashboard-empty">
   <p role="status">Todavía no hay invitaciones. Crea la primera o importa tu archivo Excel para comenzar.</p>
   <div className="dashboard-inline-actions"><ButtonLink variant="primary" to="/invitaciones/nueva">Nueva invitación</ButtonLink><ButtonLink variant="secondary" to="/invitaciones/importar">Importar Excel</ButtonLink></div>
  </div>}
  {m.registeredInvitations > 0 && m.activeInvitations === 0 && <p role="status">Todas las invitaciones están archivadas. No hay invitaciones activas para este resumen.</p>}
  <div className="dashboard-stats" role="group" aria-label="Resumen en cuatro tarjetas" aria-describedby="dashboard-metrics-scope">
   <section className="dashboard-stat" aria-labelledby="stat-invitations">
    <div className="dashboard-stat-top"><DashboardIcon kind="invitation" /><div><h2 id="stat-invitations">Invitaciones activas</h2><p className="dashboard-value">{number(m.activeInvitations)}</p></div></div>
    <p className="dashboard-stat-foot">{number(m.archivedInvitations)} archivadas</p>
   </section>
   <section className="dashboard-stat" aria-labelledby="stat-slots">
    <div className="dashboard-stat-top"><DashboardIcon kind="people" /><div><h2 id="stat-slots">Cupos actuales</h2><p className="dashboard-value">{number(m.currentSlots)}</p></div></div>
    <div className="dashboard-stat-foot"><p>{number(m.identifiedPeople)} personas identificadas</p><p>{number(m.unassignedSpaces)} espacios sin asignar</p></div>
   </section>
   <section className="dashboard-stat" aria-labelledby="stat-attending">
    <div className="dashboard-stat-top"><DashboardIcon kind="check" /><div><h2 id="stat-attending">Personas que asisten</h2><p className="dashboard-value">{number(m.attending)}</p></div></div>
    <div className="dashboard-stat-foot"><p>{number(m.notAttending)} no asisten</p><p>{number(m.unanswered)} sin respuesta</p></div>
   </section>
   <section className="dashboard-stat" aria-labelledby="stat-response">
    <div className="dashboard-stat-top"><DashboardIcon kind="progress" /><div><h2 id="stat-response">Respuesta RSVP</h2><p className={rate === null ? 'dashboard-no-rate' : 'dashboard-value'}>{rate === null ? 'Sin personas identificadas' : rate + '%'}</p></div></div>
    {m.responseRate !== null && <progress className="dashboard-progress" aria-label="Respuesta RSVP de personas identificadas" max={m.identifiedPeople} value={m.responded} />}
    <p className="dashboard-stat-foot">{number(m.responded)} de {number(m.identifiedPeople)} personas identificadas han respondido</p>
   </section>
  </div>
  <p id="dashboard-metrics-scope" className="dashboard-scope">Personas, cupos y RSVP: solo invitaciones activas.</p>
  <DashboardPanels metrics={m} details={details} />
  <div className="dashboard-bottom">
   <section className="dashboard-panel" aria-labelledby="quick-title"><h2 id="quick-title">Acciones rápidas</h2>
    <div className="dashboard-quick">
     <ButtonLink variant="secondary" to="/invitaciones/nueva"><DashboardIcon kind="invitation" /><strong>Nueva invitación</strong><span>Crear y configurar</span></ButtonLink>
     <ButtonLink variant="secondary" to="/invitaciones/importar"><DashboardIcon kind="upload" /><strong>Importar Excel</strong><span>Desde tu archivo</span></ButtonLink>
     <ButtonLink variant="secondary" to="/invitaciones"><DashboardIcon kind="list" /><strong>Ver invitaciones</strong><span>Consultar y gestionar</span></ButtonLink>
    </div>
   </section>
   <section className="dashboard-panel" aria-labelledby="follow-title"><h2 id="follow-title">Necesitan seguimiento</h2>
    <dl className="dashboard-follow"><div><dt>Personas identificadas sin respuesta</dt><dd>{number(m.unanswered)}</dd></div><div><dt>Invitaciones con personas sin respuesta</dt><dd>{number(m.invitationsWithUnanswered)}</dd></div></dl>
    {m.unanswered === 0 && <p className="dashboard-note">No hay personas identificadas pendientes de respuesta.</p>}
    <ButtonLink variant="text" to="/invitaciones">Revisar invitaciones</ButtonLink>
   </section>
  </div>
 </div>;
}
