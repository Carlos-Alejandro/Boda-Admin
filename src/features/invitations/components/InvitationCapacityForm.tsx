import { type FormEvent, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../services/http/apiClient';
import { Button } from '../../../shared/components/Button/Button';
import { changeInvitationCapacity } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';

interface InvitationCapacityFormProps {
	invitation: Invitation;
	onCancel: () => void;
	onSaved: (invitation: Invitation) => void;
	onUnavailable: () => void;
	onReload: () => void;
}

export function InvitationCapacityForm({ invitation, onCancel, onSaved, onUnavailable, onReload }: InvitationCapacityFormProps) {
	const [value, setValue] = useState(String(invitation.maxGuests));
	const [confirming, setConfirming] = useState(false);
	const [saving, setSaving] = useState(false);
	const [reloadRequired, setReloadRequired] = useState(false);
	const [error, setError] = useState('');
	const submitting = useRef(false);
	const mounted = useRef(false);
	const input = useRef<HTMLInputElement>(null);
	const confirmation = useRef<HTMLDivElement>(null);
	const capacity = Number(value);
	const valid = value.trim() !== '' && Number.isSafeInteger(capacity) && capacity >= 1;
	const removable = invitation.guests.filter((guest) => guest.type === 'open' && guest.name.trim().replace(/\s+/g, ' ') === '' && guest.attending !== true).length;
	const minimum = Math.max(1, invitation.maxGuests - removable);
	const difference = capacity - invitation.maxGuests;
	const impossible = valid && capacity < minimum;
	const canSave = valid && !impossible && difference !== 0 && !saving && !reloadRequired;
	const validation = !valid ? 'Ingresa un número entero válido mayor o igual a 1.' : impossible ? `No es posible reducir la capacidad a ${capacity} porque no hay suficientes espacios abiertos disponibles.` : '';

	useEffect(() => {
		mounted.current = true;
		input.current?.focus();
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
			window.removeEventListener('beforeunload', preventUnload);
			document.removeEventListener('click', preventNavigation, true);
		};
	}, []);

	useEffect(() => {
		if (confirming) confirmation.current?.focus();
	}, [confirming]);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (submitting.current || !canSave) return;
		if (difference < 0 && !confirming) { setConfirming(true); return; }
		submitting.current = true;
		setSaving(true);
		setError('');
		try {
			const updated = await changeInvitationCapacity(invitation.id, { maxGuests: capacity });
			if (mounted.current) onSaved(updated);
		} catch (saveError) {
			if (!mounted.current) return;
			if (saveError instanceof ApiError && saveError.status === 404) {
				onUnavailable();
			} else if (saveError instanceof ApiError && saveError.status === 400) {
				setReloadRequired(true);
				setError(difference < 0 ? 'No fue posible reducir la capacidad con el estado actual de los invitados. Recarga la invitación y vuelve a intentarlo.' : 'No fue posible actualizar la capacidad. Recarga la invitación y revisa el valor antes de volver a intentarlo.');
			} else if (saveError instanceof ApiError && (saveError.status === 401 || saveError.status === 403)) {
				setError('No pudimos autorizar el guardado. Comprueba tu sesión y tus permisos.');
			} else {
				setReloadRequired(true);
				setError('No pudimos confirmar si la capacidad se actualizó. Recarga la invitación antes de volver a intentarlo.');
			}
		} finally {
			submitting.current = false;
			if (mounted.current) setSaving(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} noValidate aria-labelledby="capacity-title" aria-describedby={error ? 'capacity-error' : undefined} aria-busy={saving} className="mb-5 rounded-xl border border-admin-border bg-surface p-4 sm:p-5">
			<h2 id="capacity-title" className="mt-0 mb-3 font-admin-serif text-[1.1rem] font-medium">Cambiar capacidad</h2>
			<p className="mt-0 text-sm text-admin-muted">Capacidad actual: {invitation.maxGuests} {invitation.maxGuests === 1 ? 'invitado' : 'invitados'}</p>
			<label htmlFor="new-capacity" className="grid max-w-xs gap-1.5 text-sm font-semibold">
				Nueva capacidad
				<input ref={input} id="new-capacity" type="number" min="1" step="1" required value={value} disabled={saving || reloadRequired || confirming} onChange={(event) => { setValue(event.target.value); setError(''); }} aria-invalid={Boolean(validation)} aria-describedby={validation ? 'capacity-help capacity-validation' : 'capacity-help'} className="min-h-10 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-base font-normal sm:text-sm" />
			</label>
			<p id="capacity-help" className="mt-2 mb-0 text-xs text-admin-muted">Capacidad mínima disponible actualmente: {minimum}. Previsión según los datos actuales; se validará de nuevo al guardar.</p>
			{validation && <p id="capacity-validation" role="alert" className="mt-3 mb-0 text-sm text-admin-danger">{validation}</p>}
			{valid && !impossible && difference !== 0 && !confirming && <p role="status" className="mt-3 mb-0 text-sm">{difference > 0 ? `Se agregarán ${difference} espacios abiertos a esta invitación.` : `Se retirarán ${-difference} espacios abiertos disponibles.`}</p>}
			{confirming && <div ref={confirmation} tabIndex={-1} className="mt-4 rounded-lg border border-admin-border bg-surface-soft p-3 text-sm">
				<p className="m-0">Vas a reducir la capacidad de {invitation.maxGuests} a {capacity} invitados.</p>
				<p className="mt-2 mb-0">Se eliminarán {-difference} espacios abiertos disponibles. La API elegirá los espacios elegibles con los datos vigentes al guardar.</p>
			</div>}
			{error && <p id="capacity-error" role="alert" className="mt-3 mb-0 text-sm text-admin-danger">{error}</p>}
			{saving && <p role="status" className="mt-3 mb-0 text-xs text-admin-muted">Guardando capacidad. Espera antes de salir de la invitación.</p>}
			<div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
				{reloadRequired ? <Button variant="secondary" type="button" onClick={onReload}>Recargar invitación</Button> : <>
					<Button variant="secondary" type="button" disabled={saving} onClick={() => { if (!submitting.current) onCancel(); }}>Cancelar</Button>
					<Button variant="primary" type="submit" disabled={!canSave}>{saving ? 'Guardando...' : confirming ? 'Confirmar reducción' : 'Guardar capacidad'}</Button>
				</>}
			</div>
		</form>
	);
}
