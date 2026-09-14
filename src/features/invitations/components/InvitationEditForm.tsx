import { type FormEvent, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../services/http/apiClient';
import { Button } from '../../../shared/components/Button/Button';
import { updateInvitation } from '../api/invitationService';
import type { Invitation, UpdateInvitationInput } from '../model/invitation.types';

interface InvitationEditFormProps {
	invitation: Invitation;
	onCancel: () => void;
	onSaved: (invitation: Invitation) => void;
	onUnavailable: () => void;
	onReload: () => void;
}

export function InvitationEditForm({ invitation, onCancel, onSaved, onUnavailable, onReload }: InvitationEditFormProps) {
	const [displayName, setDisplayName] = useState(invitation.displayName);
	const [replacementsAllowed, setReplacementsAllowed] = useState(invitation.replacementsAllowed);
	const [saving, setSaving] = useState(false);
	const [uncertain, setUncertain] = useState(false);
	const [error, setError] = useState('');
	const [nameError, setNameError] = useState('');
	const submitting = useRef(false);
	const mounted = useRef(false);
	const nameInput = useRef<HTMLInputElement>(null);
	const trimmedName = displayName.trim();
	const changed = trimmedName !== invitation.displayName.trim() || replacementsAllowed !== invitation.replacementsAllowed;

	useEffect(() => {
		mounted.current = true;
		nameInput.current?.focus();
		const preventUnload = (event: BeforeUnloadEvent) => {
			if (submitting.current) {
				event.preventDefault();
				event.returnValue = '';
			}
		};
		// Keep link navigation from discarding an in-flight save's result.
		const preventNavigation = (event: MouseEvent) => {
			if (submitting.current && event.target instanceof Element && event.target.closest('a[href]')) {
				event.preventDefault();
				event.stopPropagation();
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
		if (submitting.current || uncertain) return;
		setError('');
		if (!trimmedName) {
			setNameError('Ingresa el nombre de la invitación.');
			nameInput.current?.focus();
			return;
		}
		setNameError('');
		if (!changed) return;
		const payload: UpdateInvitationInput = {};
		if (trimmedName !== invitation.displayName.trim()) payload.displayName = trimmedName;
		if (replacementsAllowed !== invitation.replacementsAllowed) payload.replacementsAllowed = replacementsAllowed;
		submitting.current = true;
		setSaving(true);
		try {
			const updated = await updateInvitation(invitation.id, payload);
			if (mounted.current) onSaved(updated);
		} catch (saveError) {
			if (!mounted.current) return;
			if (saveError instanceof ApiError && saveError.status === 404) {
				onUnavailable();
			} else if (saveError instanceof ApiError && saveError.status === 400) {
				setError('No pudimos guardar los cambios. Revisa la información ingresada.');
			} else if (saveError instanceof ApiError && (saveError.status === 401 || saveError.status === 403)) {
				setError('No pudimos autorizar el guardado. Comprueba tu sesión y tus permisos.');
			} else {
				setUncertain(true);
				setError('No pudimos confirmar si los cambios se guardaron. Recarga la invitación antes de volver a intentarlo.');
			}
		} finally {
			submitting.current = false;
			if (mounted.current) setSaving(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} noValidate aria-labelledby="edit-invitation-title" aria-describedby={error ? 'edit-invitation-error' : undefined} aria-busy={saving} className="mt-4 rounded-xl border border-admin-border bg-surface p-4 sm:p-5">
			<h2 id="edit-invitation-title" className="mt-0 mb-4 font-admin-serif text-[1.1rem] font-medium">Editar invitación</h2>
			<fieldset disabled={saving || uncertain} className="m-0 grid min-w-0 gap-4 border-0 p-0">
				<label className="grid gap-1.5 text-sm font-semibold" htmlFor="edit-display-name">
					Nombre de la invitación
					<input ref={nameInput} id="edit-display-name" type="text" required value={displayName} onChange={(event) => { setDisplayName(event.target.value); setNameError(''); }} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'edit-name-error' : undefined} className="min-h-10 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-base font-normal sm:text-sm" />
				</label>
				{nameError && <p id="edit-name-error" role="alert" className="m-0 text-sm text-admin-danger">{nameError}</p>}
				<label className="flex items-center gap-2 text-sm font-semibold">
					<input type="checkbox" checked={replacementsAllowed} onChange={(event) => setReplacementsAllowed(event.target.checked)} aria-describedby="edit-replacements-help" className="h-4 w-4 accent-admin-green-700" />
					Permitir reemplazos
				</label>
				<p id="edit-replacements-help" className="m-0 text-xs text-admin-muted">Permite sustituir a un invitado que no asistirá. No modifica los invitados existentes.</p>
			</fieldset>
			{error && <p id="edit-invitation-error" role="alert" className="mt-4 mb-0 text-sm text-admin-danger">{error}</p>}
			{saving && <p role="status" className="mt-3 mb-0 text-xs text-admin-muted">Guardando cambios. Espera antes de salir de la invitación.</p>}
			<div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
				{uncertain ? <Button variant="secondary" type="button" onClick={onReload}>Recargar invitación</Button> : <>
					<Button variant="secondary" type="button" disabled={saving} onClick={() => { if (!submitting.current) onCancel(); }}>Cancelar</Button>
					<Button variant="primary" type="submit" disabled={!changed || saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
				</>}
			</div>
		</form>
	);
}
