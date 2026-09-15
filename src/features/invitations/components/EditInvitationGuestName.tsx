import { type FormEvent, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../services/http/apiClient';
import { Button } from '../../../shared/components/Button/Button';
import { updateInvitationGuestName } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';

interface EditInvitationGuestNameProps {
	invitation: Invitation;
	guestIndex: number;
	onCancel: () => void;
	onSaved: (invitation: Invitation) => void;
	onUnavailable: () => void;
	onRefresh: (message: string) => void;
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

export function EditInvitationGuestName({ invitation, guestIndex, onCancel, onSaved, onUnavailable, onRefresh }: EditInvitationGuestNameProps) {
	const guest = invitation.guests[guestIndex];
	const [name, setName] = useState(guest?.name ?? '');
	const [saving, setSaving] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState('');
	const submitting = useRef(false);
	const attempted = useRef(false);
	const mounted = useRef(false);
	const input = useRef<HTMLInputElement>(null);
	const normalized = normalizeName(name);
	const allowed = Boolean(guest?.name.trim());
	const changed = normalized !== normalizeName(guest?.name ?? '');

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

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (attempted.current || !allowed || !normalized || !changed) return;
		attempted.current = true;
		setSubmitted(true);
		if (!invitation.version) {
			onRefresh('Necesitamos actualizar la invitación. Revisa los datos y vuelve a seleccionar Editar nombre.');
			return;
		}
		submitting.current = true;
		setSaving(true);
		setError('');
		try {
			const updated = await updateInvitationGuestName(invitation.id, guestIndex, invitation.version, normalized);
			if (mounted.current) onSaved(updated);
		} catch (saveError) {
			if (!mounted.current) return;
			if (saveError instanceof ApiError && saveError.status === 412) {
				onRefresh('La invitación cambió mientras la editabas. Recargaremos los datos; revisa al invitado y vuelve a seleccionar Editar nombre.');
			} else if (saveError instanceof ApiError && saveError.status === 404) {
				onUnavailable();
			} else if (saveError instanceof ApiError && saveError.status === 400) {
				setError(saveError.validationMessage || 'No se pudo actualizar el nombre. Cancela y revisa los datos del invitado.');
			} else if (saveError instanceof ApiError && (saveError.status === 401 || saveError.status === 403)) {
				setError('No pudimos autorizar el guardado. Comprueba tu sesión y tus permisos.');
			} else {
				onRefresh('No pudimos confirmar si el nombre se guardó. Recargaremos la invitación; revisa su estado antes de volver a editar.');
			}
		} finally {
			submitting.current = false;
			// One request per editing session; uncertain outcomes must never be replayed.
			if (mounted.current) setSaving(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} noValidate aria-labelledby="edit-guest-name-title" aria-busy={saving} className="mt-3 rounded-lg border border-admin-border bg-surface-soft p-3">
			<h4 id="edit-guest-name-title" className="mt-0 mb-3 font-admin-serif text-base font-medium">Editar nombre</h4>
			<label htmlFor="guest-full-name" className="grid gap-1.5 text-sm font-semibold">
				Nombre completo
				<input ref={input} id="guest-full-name" type="text" required value={name} disabled={saving || submitted} onChange={(event) => setName(event.target.value)} aria-invalid={!normalized} aria-describedby={!normalized ? 'guest-name-validation' : error ? 'guest-name-error' : undefined} className="min-h-10 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-base font-normal sm:text-sm" />
			</label>
			{!normalized && <p id="guest-name-validation" role="alert" className="mt-2 mb-0 text-sm text-admin-danger">Ingresa el nombre completo del invitado.</p>}
			{error && <p id="guest-name-error" role="alert" className="mt-3 mb-0 text-sm text-admin-danger">{error} Cancela la edición antes de volver a intentarlo.</p>}
			{saving && <p role="status" className="mt-3 mb-0 text-sm">Guardando nombre...</p>}
			<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
				<Button variant="secondary" type="button" disabled={saving} onClick={() => { if (!submitting.current) onCancel(); }}>Cancelar</Button>
				<Button variant="primary" type="submit" disabled={saving || submitted || !allowed || !normalized || !changed}>{saving ? 'Guardando...' : 'Guardar'}</Button>
			</div>
		</form>
	);
}
