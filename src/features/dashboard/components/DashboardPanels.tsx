import { Link } from 'react-router-dom';
import { ButtonLink } from '../../../shared/components/Button/Button';
import { InvitationStatusBadge } from '../../invitations/components/InvitationStatusBadge';
import { formatCancunDate } from '../../invitations/model/cancunDate';
import type { DashboardMetrics } from '../model/calculateDashboardMetrics';
import type { DashboardDetails } from '../model/buildDashboardDetails';

const statuses = [
 { key: 'confirmed', label: 'Confirmadas', color: '#537b57' },
 { key: 'partial', label: 'Parciales', color: '#95845c' },
 { key: 'pending', label: 'Pendientes', color: '#c8c8bf' },
 { key: 'declined', label: 'Declinadas', color: '#b96560' },
] as const;
const detailPath = (id: string) => `/invitaciones/${encodeURIComponent(id)}`;

function RsvpDistribution({ metrics: m }: { metrics: DashboardMetrics }) {
 const segments = statuses.map((status, index) => {
  const length = m.activeInvitations ? m.rsvp[status.key] / m.activeInvitations * 100 : 0;
  const preceding = statuses.slice(0, index).reduce((total, previous) => total + m.rsvp[previous.key], 0);
  return { ...status, count: m.rsvp[status.key], length, offset: m.activeInvitations ? preceding / m.activeInvitations * 100 : 0 };
 });
 return <section className="dashboard-panel" aria-labelledby="rsvp-title">
  <h2 id="rsvp-title">Estado RSVP</h2><p className="dashboard-note">Distribución de invitaciones activas</p>
  <div className="dashboard-distribution">
   <div className="dashboard-ring">
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" fill="none" stroke="#ece9e1" strokeWidth="15" />
     {segments.filter(segment => segment.count > 0).map(segment => <circle key={segment.key} cx="60" cy="60" r="48" fill="none" stroke={segment.color} strokeWidth="15" pathLength="100" strokeDasharray={`${segment.length} ${100 - segment.length}`} strokeDashoffset={-segment.offset} transform="rotate(-90 60 60)" />)}
    </svg>
    <p><strong>{m.activeInvitations.toLocaleString('es-MX')}</strong><span>invitaciones activas</span></p>
   </div>
   <dl className="dashboard-legend">{segments.map(segment => <div key={segment.key}><dt><span aria-hidden="true" style={{ background: segment.color }} />{segment.label}</dt><dd>{segment.count.toLocaleString('es-MX')}</dd></div>)}</dl>
  </div>
  <p className="dashboard-help">Un estado parcial no implica una respuesta incompleta.</p>
 </section>;
}

export function DashboardPanels({ metrics: m, details }: { metrics: DashboardMetrics; details: DashboardDetails }) {
 const largestCapacity = details.capacity[0]?.maxGuests ?? 1;
 return <>
  <div className="dashboard-middle">
   <RsvpDistribution metrics={m} />
   <section className="dashboard-panel" aria-labelledby="capacity-title">
    <div className="dashboard-panel-heading"><h2 id="capacity-title">Cupos por invitación</h2><ButtonLink variant="text" to="/invitaciones">Ver todas</ButtonLink></div>
    <p className="dashboard-note">{details.capacity.length} {details.capacity.length === 1 ? 'invitación con mayor capacidad' : 'invitaciones con mayor capacidad'}</p>
    {details.capacity.length === 0 ? <p className="dashboard-placeholder">No hay invitaciones activas para mostrar.</p> : <ul className="dashboard-bars">
     {details.capacity.map(invitation => <li key={invitation.id}>
      <Link to={detailPath(invitation.id)}>{invitation.displayName}</Link>
      <div className="dashboard-bar-track" aria-hidden="true"><span style={{ width: `${largestCapacity > 0 ? invitation.maxGuests / largestCapacity * 100 : 0}%` }} /></div>
      <span className="dashboard-bar-value">{invitation.maxGuests.toLocaleString('es-MX')} <span>cupos</span></span>
     </li>)}
    </ul>}
   </section>
  </div>
  <div className="dashboard-lists">
   <section className="dashboard-panel" aria-labelledby="unanswered-title">
    <div className="dashboard-panel-heading"><h2 id="unanswered-title">Personas sin respuesta</h2><ButtonLink variant="text" to="/invitaciones">Revisar invitaciones</ButtonLink></div>
    <p className="dashboard-note">{details.unanswered.length} de {m.unanswered} personas pendientes</p>
    {details.unanswered.length === 0 ? <p className="dashboard-placeholder">No hay personas identificadas sin respuesta.</p> : <ul className="dashboard-person-list">
     {details.unanswered.map(person => <li key={`${person.invitationId}:${person.index}`}><div><strong>{person.name}</strong><Link to={detailPath(person.invitationId)}>{person.invitationName}</Link></div><span className="dashboard-pending">Pendiente</span></li>)}
    </ul>}
   </section>
   <section className="dashboard-panel" aria-labelledby="recent-title">
    <h2 id="recent-title">Invitaciones actualizadas recientemente</h2>
    <p className="dashboard-note">{details.recent.length === 1 ? 'Última actualización' : `Últimas ${details.recent.length} actualizaciones`} · Incluye cambios administrativos y RSVP.</p>
    {details.recent.length === 0 ? <p className="dashboard-placeholder">No hay fechas de actualización disponibles para invitaciones activas.</p> : <ul className="dashboard-recent-list">
     {details.recent.map(invitation => <li key={invitation.id}><div><Link to={detailPath(invitation.id)}>{invitation.displayName}</Link><time dateTime={invitation.updatedAt!} title="Hora de Cancún">{formatCancunDate(invitation.updatedAt!)}<span className="visually-hidden"> · Hora de Cancún</span></time></div><InvitationStatusBadge status={invitation.rsvpStatus} /></li>)}
    </ul>}
   </section>
  </div>
 </>;
}
