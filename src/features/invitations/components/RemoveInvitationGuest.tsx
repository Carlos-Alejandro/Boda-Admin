import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../services/http/apiClient';
import { Button } from '../../../shared/components/Button/Button';
import { removeInvitationGuest } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';

interface RemoveInvitationGuestProps {
	invitation: Invitation;
	guestIndex: number;
	onCancel: () => void;
	onRemoved: (invitation: Invitation) => void;
	onUnavailable: () => void;
	onRefresh: (message: string) => void;
}

export function RemoveInvitationGuest({ invitation, guestIndex, onCancel, onRemoved, onUnavailable, onRefresh }: RemoveInvitationGuestProps) {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const submitting = useRef(false);
	const mounted = useRef(false);
	const heading = useRef<HTMLHeadingElement>(null);
	const guest = invitation.guests[guestIndex];
	const allowed = guest && (guest.type === 'known' || guest.type === 'open') && invitation.maxGuests > 1;
	const visibleName = guest?.name.trim() || (guest?.type === 'open' ? 'Espacio abierto' : guest?.shortName || 'Invitado');

	useEffect(() => {
		mounted.current = true;
		heading.current?.focus();
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

	const remove = async () => {
		if (submitting.current || !allowed) return;
		if (!invitation.version) {
			onRefresh('Necesitamos actualizar la invitación. Revisa los datos antes de eliminar al invitado.');
			return;
		}
		submitting.current = true;
		setSaving(true);
		setError('');
		try {
			const updated = await removeInvitationGuest(invitation.id, guestIndex, invitation.version);
			if (mounted.current) onRemoved(updated);
		} catch (removeError) {
			if (!mounted.current) return;
			if (removeError instanceof ApiError && removeError.status === 412) {
				onRefresh('La invitación cambió desde que la abriste. Revisa los datos actualizados antes de eliminar.');
			} else if (removeError instanceof ApiError && removeError.status === 404) {
				onUnavailable();
			} else if (removeError instanceof ApiError && removeError.status === 400) {
				setError('No se puede eliminar este invitado con los datos actuales. Cancela y revisa la invitación.');
			} else if (removeError instanceof ApiError && (removeError.status === 401 || removeError.status === 403)) {
				setError('No pudimos autorizar la eliminación. Comprueba tu sesión y tus permisos.');
			} else {
				onRefresh('No pudimos confirmar el resultado. Revisa la invitación actualizada antes de intentar otra acción.');
			}
		} finally {
			// After an automatic refresh, keep this confirmation unusable until unmounted.
			if (mounted.current) setSaving(false);
		}
	};

	return (
		<section aria-labelledby="remove-guest-title" aria-busy={saving} className="mt-3 rounded-lg border border-admin-border bg-surface-soft p-3">
			<h4 ref={heading} tabIndex={-1} id="remove-guest-title" className="m-0 font-admin-serif text-base font-medium">Eliminar a {visibleName}</h4>
			<p className="mt-2 mb-0 text-sm">Se eliminará este invitado y la capacidad de la invitación bajará de {invitation.maxGuests} a {invitation.maxGuests - 1} lugares.</p>
			<p className="mt-2 mb-0 text-xs text-admin-muted">{guest?.type === 'known' ? 'Es un invitado original.' : 'Es un espacio de invitado/acompañante.'}</p>
			{error && <p role="alert" className="mt-3 mb-0 text-sm text-admin-danger">{error}</p>}
			{saving && <p role="status" className="mt-3 mb-0 text-sm">Eliminando invitado...</p>}
			<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
				<Button variant="secondary" type="button" disabled={saving} onClick={onCancel}>Cancelar</Button>
				<Button variant="secondary" className="text-admin-danger" type="button" disabled={saving || Boolean(error) || !allowed} onClick={() => void remove()}>{saving ? 'Eliminando...' : 'Eliminar invitado'}</Button>
			</div>
		</section>
	);
}
