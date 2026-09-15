import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../services/http/apiClient';
import { Button } from '../../../shared/components/Button/Button';
import { updateInvitationEditOverride } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';
import { cancunInputToIso, formatCancunDate, toCancunInput } from '../model/cancunDate';

export type OverrideAction = 'edit' | 'revoke';
interface Props {
	invitation: Invitation;
	action: OverrideAction | null;
	idle: boolean;
	onSelect: (action: OverrideAction) => void;
	onCancel: () => void;
	onSaved: (invitation: Invitation) => void;
	onUnavailable: () => void;
	onRefresh: (message: string) => void;
}

export function EditInvitationOverride({ invitation, action, idle, onSelect, onCancel, onSaved, onUnavailable, onRefresh }: Props) {
	const [value, setValue] = useState(toCancunInput(invitation.editOverrideUntil));
	const [now, setNow] = useState(Date.now);
	const [saving, setSaving] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState('');
	const attempted = useRef(false);
	const submitting = useRef(false);
	const mounted = useRef(false);
	const input = useRef<HTMLInputElement>(null);
	const title = useRef<HTMLHeadingElement>(null);
	const existing = invitation.editOverrideUntil;
	const expired = existing !== null && new Date(existing).getTime() <= now;
	const iso = cancunInputToIso(value);
	// Native input precision is seconds; opening a timestamp with milliseconds is not an edit.
	const unchanged = existing !== null && (value === toCancunInput(existing) || (iso !== null && new Date(iso).getTime() === new Date(existing).getTime()));
	const validation = !value ? 'Selecciona fecha y hora.' : !iso ? 'Selecciona una fecha y hora válidas.' : new Date(iso).getTime() <= now ? 'La fecha y hora deben ser futuras.' : '';
	const revoking = action === 'revoke';
	const allowed = revoking ? existing !== null : !invitation.isArchived;

	useEffect(() => {
		mounted.current = true;
		if (action === 'edit') input.current?.focus();
		if (action === 'revoke') title.current?.focus();
		// Local clock only: no HTTP polling and no automatic revocation.
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		const preventUnload = (event: BeforeUnloadEvent) => {
			if (submitting.current) { event.preventDefault(); event.returnValue = ''; }
		};
		const preventNavigation = (event: MouseEvent) => {
			if (submitting.current && event.target instanceof Element && event.target.closest('a[href]')) {
				event.preventDefault(); event.stopPropagation();
			}
		};
		window.addEventListener('beforeunload', preventUnload);
		document.addEventListener('click', preventNavigation, true);
		return () => {
			mounted.current = false;
			window.clearInterval(timer);
			window.removeEventListener('beforeunload', preventUnload);
			document.removeEventListener('click', preventNavigation, true);
		};
	}, [action]);

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!action || attempted.current || !allowed) return;
		if (!revoking && (!iso || unchanged || new Date(iso).getTime() <= Date.now())) {
			setNow(Date.now());
			return;
		}
		attempted.current = true;
		setSubmitted(true);
		if (!invitation.version) {
			onRefresh('Necesitamos actualizar la invitación. Revisa el permiso y vuelve a seleccionar la acción.');
			return;
		}
		submitting.current = true;
		setSaving(true);
		try {
			const updated = await updateInvitationEditOverride(invitation.id, revoking ? null : iso, invitation.version);
			if (mounted.current) onSaved(updated);
		} catch (saveError) {
			if (!mounted.current) return;
			if (saveError instanceof ApiError && saveError.status === 412) {
				onRefresh('La invitación cambió. Recargaremos los datos; revisa el permiso y vuelve a seleccionar la acción.');
			} else if (saveError instanceof ApiError && saveError.status === 404) {
				onUnavailable();
			} else if (saveError instanceof ApiError && saveError.status === 400) {
				setError(saveError.validationMessage || 'No se pudo actualizar el permiso con los datos actuales.');
			} else if (saveError instanceof ApiError && (saveError.status === 401 || saveError.status === 403)) {
				setError('No pudimos autorizar el guardado. Comprueba tu sesión y tus permisos.');
			} else {
				onRefresh('No pudimos confirmar si el permiso se actualizó. Recargaremos la invitación; revisa su estado antes de intentar otra acción.');
			}
		} finally {
			submitting.current = false;
			if (mounted.current) setSaving(false);
		}
	};

	return <section className="mt-4 border-t border-admin-border pt-4" aria-labelledby="override-title">
		<h3 id="override-title" className="mt-0 mb-2 text-sm font-semibold">Edición extraordinaria</h3>
		<p className="m-0 text-sm text-admin-muted">{!existing ? 'Sin permiso extraordinario' : expired ? 'Permiso expirado' : invitation.isArchived ? 'Permiso sin efecto mientras está archivada' : 'Permiso vigente'}</p>
		{existing && <p className="mt-1 mb-0 text-sm">{expired ? 'Expiró: ' : 'Hasta: '}{formatCancunDate(existing)}</p>}
		<p className="mt-1 mb-0 text-xs text-admin-muted">Horario de Cancún (America/Cancun).</p>
		{invitation.isArchived && <p className="mt-2 mb-0 text-xs text-admin-muted">Restaura la invitación antes de conceder o modificar el permiso.</p>}
		{idle && <div className="mt-3 flex flex-wrap gap-2">
			{!invitation.isArchived && <Button variant="secondary" type="button" onClick={() => onSelect('edit')}>{!existing ? 'Conceder permiso' : expired ? 'Conceder nuevo permiso' : 'Modificar'}</Button>}
			{existing !== null && <Button variant="secondary" type="button" onClick={() => onSelect('revoke')}>Revocar</Button>}
		</div>}
		{action && <form onSubmit={submit} noValidate aria-busy={saving} className="mt-3 rounded-lg border border-admin-border bg-surface-soft p-3">
			{revoking ? <>
				<h4 ref={title} tabIndex={-1} className="mt-0 mb-2 font-admin-serif text-base">Revocar permiso extraordinario</h4>
				<p className="m-0 text-sm">La invitación perderá el permiso extraordinario de edición RSVP. Se aplicará el plazo general de confirmación. ¿Deseas revocarlo?</p>
			</> : <>
				<label htmlFor="override-until" className="grid min-w-0 gap-1.5 text-sm font-semibold">Fecha y hora de Cancún
					<input ref={input} id="override-until" type="datetime-local" step="1" required value={value} disabled={saving || submitted} onChange={(event) => { setValue(event.target.value); setNow(Date.now()); }} aria-invalid={Boolean(validation)} aria-describedby={validation ? 'override-validation' : undefined} className="min-h-10 min-w-0 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-base font-normal sm:text-sm" />
				</label>
				{validation && <p id="override-validation" className="mt-2 mb-0 text-sm text-admin-danger">{validation}</p>}
			</>}
			{error && <p role="alert" className="mt-3 mb-0 text-sm text-admin-danger">{error} Cancela y revisa los datos antes de volver a intentarlo.</p>}
			{saving && <p role="status" className="mt-3 mb-0 text-sm">Guardando permiso...</p>}
			<div className="mt-3 flex flex-wrap justify-end gap-2">
				<Button variant="secondary" type="button" disabled={saving} onClick={() => { if (!submitting.current) onCancel(); }}>Cancelar</Button>
				<Button variant="primary" type="submit" disabled={saving || submitted || !allowed || (!revoking && (Boolean(validation) || unchanged))}>{revoking ? 'Confirmar revocación' : 'Guardar'}</Button>
			</div>
		</form>}
	</section>;
}
