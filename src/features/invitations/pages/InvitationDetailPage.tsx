import { type ReactNode, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../../../services/http/apiClient';
import { Button, ButtonLink } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { getInvitationById } from '../api/invitationService';
import { InvitationStatusBadge } from '../components/InvitationStatusBadge';
import { InvitationEditForm } from '../components/InvitationEditForm';
import { InvitationCapacityForm } from '../components/InvitationCapacityForm';
import { RemoveInvitationGuest } from '../components/RemoveInvitationGuest';
import { InvitationArchiveConfirmation } from '../components/InvitationArchiveConfirmation';
import type { GuestType, Invitation } from '../model/invitation.types';

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
	timeZone: 'America/Cancun',
	day: '2-digit', month: '2-digit', year: 'numeric',
	hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function formatDate(value: string | null, fallback = 'Fecha no disponible') {
	if (value === null) return fallback;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? fallback : dateFormatter.format(date);
}

const guestLabels: Record<GuestType, string> = {
	known: 'Invitado', open: 'Espacio abierto', replacement: 'Reemplazo',
};

type DetailState =
	| { status: 'loading' | 'not-found' | 'error' }
	| { status: 'success'; invitation: Invitation };

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="min-w-0 rounded-xl border border-admin-border bg-surface p-4 sm:p-5">
			<h2 className="mt-0 mb-4 font-admin-serif text-[1.1rem] font-medium">{title}</h2>
			{children}
		</section>
	);
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="min-w-0">
			<dt className="mb-1 text-xs text-admin-muted">{label}</dt>
			<dd className="m-0 leading-relaxed [overflow-wrap:anywhere]">{children}</dd>
		</div>
	);
}

export function InvitationDetailPage() {
	const { id } = useParams<{ id: string }>();
	// Remount the request state when navigating directly between invitation IDs.
	return <InvitationDetail key={id} id={id} />;
}

function InvitationDetail({ id }: { id: string | undefined }) {
	const [state, setState] = useState<DetailState>({ status: id ? 'loading' : 'not-found' });
	const [attempt, setAttempt] = useState(0);
	const [editing, setEditing] = useState(false);
	const [changingCapacity, setChangingCapacity] = useState(false);
	const [removingIndex, setRemovingIndex] = useState<number | null>(null);
	const [changingArchive, setChangingArchive] = useState(false);
	const [notice, setNotice] = useState('');

	useEffect(() => {
		const controller = new AbortController();
		if (!id) {
			return () => controller.abort();
		}

		void getInvitationById(id, controller.signal).then(
			(invitation) => {
				if (!controller.signal.aborted) setState({ status: 'success', invitation });
			},
			(error: unknown) => {
				if (!controller.signal.aborted) {
					setState({ status: error instanceof ApiError && error.status === 404 ? 'not-found' : 'error' });
				}
			},
		);
		return () => controller.abort();
	}, [id, attempt]);

	const invitation = state.status === 'success' ? state.invitation : null;
	const idle = !editing && !changingCapacity && removingIndex === null && !changingArchive;

	return (
		<section className="w-full text-[0.9rem]" aria-labelledby="invitation-detail-title">
			<div className="mb-3">
				<ButtonLink variant="text" to="/invitaciones">← Volver a invitaciones</ButtonLink>
			</div>
			<PageHeader
				eyebrow="Detalle de invitación"
				title={invitation?.displayName ?? 'Invitación'}
				titleId="invitation-detail-title"
				description={invitation ? `ID de invitación: ${invitation.id}` : 'Consulta la información y las respuestas de tus invitados.'}
				className="[overflow-wrap:anywhere]"
			/>
			{notice && state.status !== 'not-found' && <p role="status" className="mt-3 text-sm text-admin-green-700">{notice}</p>}

			{state.status === 'loading' && (
				<p role="status" className="mt-5 rounded-xl border border-dashed border-admin-border bg-surface px-4 py-10 text-center text-admin-muted">Cargando invitación...</p>
			)}
			{(state.status === 'not-found' || state.status === 'error') && (
				<div role="alert" className="mt-5 rounded-xl border border-admin-border bg-surface p-5">
					<h2 className="mt-0 mb-2 font-admin-serif text-lg font-medium">
						{state.status === 'not-found' ? (notice || 'Invitación no encontrada') : 'No pudimos cargar la invitación.'}
					</h2>
					<p className="mt-0 text-admin-muted">
						{state.status === 'not-found' ? 'No encontramos una invitación con este ID. Puedes volver al listado para buscarla.' : 'Inténtalo de nuevo o vuelve al listado de invitaciones.'}
					</p>
					{state.status === 'error' && (
						<Button variant="secondary" type="button" onClick={() => {
							setState({ status: 'loading' });
							setAttempt((current) => current + 1);
						}}>Reintentar</Button>
					)}
				</div>
			)}

			{invitation && (
				<>
					{idle && <div className="mt-3"><Button variant="secondary" type="button" onClick={() => { setNotice(''); setEditing(true); }}>Editar invitación</Button></div>}
					{editing && <InvitationEditForm
						invitation={invitation}
						onCancel={() => setEditing(false)}
						onSaved={(updated) => { setState({ status: 'success', invitation: updated }); setEditing(false); setNotice('Invitación actualizada correctamente.'); }}
						onUnavailable={() => { setEditing(false); setNotice('Esta invitación ya no está disponible.'); setState({ status: 'not-found' }); }}
						onReload={() => { setEditing(false); setNotice(''); setState({ status: 'loading' }); setAttempt((current) => current + 1); }}
					/>}
					<div className="mt-3 flex flex-wrap gap-2">
						<InvitationStatusBadge status={invitation.rsvpStatus} />
						{invitation.isArchived && <InvitationStatusBadge status="archived" />}
					</div>
					<dl className="my-5 grid grid-cols-2 gap-3 rounded-xl border border-admin-border bg-surface-soft p-4 min-[75rem]:grid-cols-4">
						<DetailField label="Estado RSVP"><InvitationStatusBadge status={invitation.rsvpStatus} /></DetailField>
						<DetailField label="Asisten"><strong>{invitation.guests.filter((guest) => guest.attending === true).length} de {invitation.maxGuests}</strong></DetailField>
						<DetailField label="Capacidad">{invitation.maxGuests} {invitation.maxGuests === 1 ? 'invitado' : 'invitados'}
							{idle && <Button className="mt-2 block text-xs" variant="secondary" type="button" onClick={() => { setNotice(''); setChangingCapacity(true); }}>Cambiar capacidad</Button>}
						</DetailField>
						<DetailField label="Reemplazos">{invitation.replacementsAllowed ? 'Permitidos' : 'No permitidos'}</DetailField>
					</dl>
					{changingCapacity && <InvitationCapacityForm
						invitation={invitation}
						onCancel={() => setChangingCapacity(false)}
						onSaved={(updated) => { setState({ status: 'success', invitation: updated }); setChangingCapacity(false); setNotice('Capacidad actualizada correctamente.'); }}
						onUnavailable={() => { setChangingCapacity(false); setNotice('Esta invitación ya no está disponible.'); setState({ status: 'not-found' }); }}
						onReload={() => { setChangingCapacity(false); setNotice(''); setState({ status: 'loading' }); setAttempt((current) => current + 1); }}
					/>}
					<div className="grid items-start gap-4 min-[75rem]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
						<div className="grid min-w-0 gap-4">
							<DetailCard title="Invitados">
								<ol className="m-0 grid list-none gap-3 p-0">
									{invitation.guests.map((guest, index) => (
										<li key={index} className="min-w-0 rounded-lg border border-admin-border p-3 [overflow-wrap:anywhere]">
											<div className="flex flex-wrap items-start justify-between gap-2">
												<h3 className="m-0 min-w-0 font-semibold">{index + 1}. {guest.shortName}</h3>
												<span className={`rounded-full px-2 py-1 text-xs font-semibold ${guest.attending === true ? 'bg-admin-green-100 text-admin-green-700' : guest.attending === false ? 'bg-[#f3e8e5] text-admin-danger' : 'bg-surface-soft text-admin-muted'}`}>
													{guest.attending === true ? 'Asiste' : guest.attending === false ? 'No asiste' : 'Sin respuesta'}
												</span>
											</div>
											<p className="mt-1 mb-2 text-admin-muted">{guest.name.trim() ? guest.name : 'Sin nombre asignado'}</p>
											<p className="m-0 text-xs font-semibold text-admin-green-700">{guestLabels[guest.type]}</p>
											{guest.type === 'replacement' && guest.originalName && <p className="mt-2 mb-0 text-xs text-admin-muted">Reemplaza a: {guest.originalName}</p>}
											{idle && (guest.type === 'known' || guest.type === 'open') && (
												<div className="mt-3">
													<Button variant="secondary" type="button" disabled={invitation.maxGuests <= 1} onClick={() => { setNotice(''); setRemovingIndex(index); }}>Eliminar invitado</Button>
													{invitation.maxGuests <= 1 && <p className="mt-2 mb-0 text-xs text-admin-muted">No se puede eliminar el último invitado.</p>}
												</div>
											)}
											{removingIndex === index && <RemoveInvitationGuest
												invitation={invitation}
												guestIndex={index}
												onCancel={() => setRemovingIndex(null)}
												onRemoved={(updated) => { setState({ status: 'success', invitation: updated }); setRemovingIndex(null); setNotice('Invitado eliminado correctamente.'); }}
												onUnavailable={() => { setRemovingIndex(null); setNotice('Esta invitación ya no está disponible.'); setState({ status: 'not-found' }); }}
												onRefresh={(message) => { setRemovingIndex(null); setNotice(message); setState({ status: 'loading' }); setAttempt((current) => current + 1); }}
											/>}
										</li>
									))}
								</ol>
							</DetailCard>
							<DetailCard title="Información general">
								<dl className="m-0 grid gap-4 sm:grid-cols-2">
									<DetailField label="Nombre">{invitation.displayName}</DetailField>
									<DetailField label="ID">{invitation.id}</DetailField>
									<DetailField label="Capacidad">{invitation.maxGuests}</DetailField>
									<DetailField label="Reemplazos">{invitation.replacementsAllowed ? 'Permitidos' : 'No permitidos'}</DetailField>
									<DetailField label="Mensaje"><span className="whitespace-pre-wrap">{invitation.message || 'Sin mensaje'}</span></DetailField>
								</dl>
							</DetailCard>
						</div>
						<div className="grid min-w-0 gap-4">
							<DetailCard title="Configuración RSVP">
								<dl className="m-0 grid gap-4">
									<DetailField label="Reemplazos permitidos">{invitation.replacementsAllowed ? 'Sí' : 'No'}</DetailField>
									<DetailField label="Edición extraordinaria hasta">{formatDate(invitation.editOverrideUntil, 'Sin permiso extraordinario')}</DetailField>
								</dl>
							</DetailCard>
							<DetailCard title="Archivo">
								<dl className="m-0 grid gap-4">
									<DetailField label="Estado"><InvitationStatusBadge status={invitation.isArchived ? 'archived' : 'active'} /></DetailField>
									{invitation.isArchived && <DetailField label="Fecha de archivo">{formatDate(invitation.archivedAt, 'Archivada — fecha no disponible')}</DetailField>}
								</dl>
								{idle && <Button className="mt-4" variant="secondary" type="button" onClick={() => { setNotice(''); setChangingArchive(true); }}>{invitation.isArchived ? 'Restaurar invitación' : 'Archivar invitación'}</Button>}
								{changingArchive && <InvitationArchiveConfirmation
									invitation={invitation}
									onCancel={() => setChangingArchive(false)}
									onSaved={(updated) => { setState({ status: 'success', invitation: updated }); setChangingArchive(false); setNotice(invitation.isArchived ? 'Invitación restaurada correctamente.' : 'Invitación archivada correctamente.'); }}
									onUnavailable={() => { setChangingArchive(false); setNotice('Esta invitación ya no está disponible.'); setState({ status: 'not-found' }); }}
									onRefresh={(message) => { setChangingArchive(false); setNotice(message); setState({ status: 'loading' }); setAttempt((current) => current + 1); }}
								/>}
							</DetailCard>
							<DetailCard title="Fechas">
								<dl className="m-0 grid gap-4">
									<DetailField label="Última actualización">{formatDate(invitation.updatedAt)}</DetailField>
								</dl>
								<p className="mt-4 mb-0 text-xs text-admin-muted">Todas las fechas se muestran en horario de Cancún (America/Cancun).</p>
							</DetailCard>
						</div>
					</div>
				</>
			)}
		</section>
	);
}
