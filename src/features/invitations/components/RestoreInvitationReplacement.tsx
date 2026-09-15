import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../services/http/apiClient';
import { Button } from '../../../shared/components/Button/Button';
import { restoreInvitationReplacement } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';

interface RestoreInvitationReplacementProps {
	invitation: Invitation;
	guestIndex: number;
	onCancel: () => void;
	onRestored: (invitation: Invitation) => void;
	onUnavailable: () => void;
	onRefresh: (message: string) => void;
}

export function RestoreInvitationReplacement({ invitation, guestIndex, onCancel, onRestored, onUnavailable, onRefresh }: RestoreInvitationReplacementProps) {
	const [saving, setSaving] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState('');
	const submitting = useRef(false);
	const attempted = useRef(false);
	const mounted = useRef(false);
	const heading = useRef<HTMLHeadingElement>(null);
	const guest = invitation.guests[guestIndex];
	const allowed = guest?.type === 'replacement';

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

	const restore = async () => {
		if (attempted.current || !allowed) return;
		attempted.current = true;
		setSubmitted(true);
		if (!invitation.version) {
			onRefresh('Necesitamos actualizar la invitación. Revisa los datos antes de restaurar al invitado original.');
			return;
		}
		submitting.current = true;
		setSaving(true);
		setError('');
		try {
			const updated = await restoreInvitationReplacement(invitation.id, guestIndex, invitation.version);
			if (mounted.current) onRestored(updated);
		} catch (restoreError) {
			if (!mounted.current) return;
			if (restoreError instanceof ApiError && restoreError.status === 412) {
				onRefresh('La invitación cambió desde que la abriste. Revisa los datos actualizados y vuelve a seleccionar al invitado que deseas restaurar.');
			} else if (restoreError instanceof ApiError && restoreError.status === 404) {
				onUnavailable();
			} else if (restoreError instanceof ApiError && restoreError.status === 400) {
				setError(restoreError.validationMessage || 'No se puede restaurar este invitado con los datos actuales. Cancela y revisa la invitación.');
			} else if (restoreError instanceof ApiError && (restoreError.status === 401 || restoreError.status === 403)) {
				setError('No pudimos autorizar la restauración. Comprueba tu sesión y tus permisos.');
			} else {
				onRefresh('No pudimos confirmar el resultado de la restauración. Recargaremos la invitación; revisa su estado antes de intentar otra acción.');
			}
		} finally {
			submitting.current = false;
			// Each confirmation permits only one attempt, including uncertain outcomes.
			if (mounted.current) setSaving(false);
		}
	};

	return (
		<section aria-labelledby="restore-replacement-title" aria-busy={saving} className="mt-3 rounded-lg border border-admin-border bg-surface-soft p-3">
			<h4 ref={heading} tabIndex={-1} id="restore-replacement-title" className="m-0 font-admin-serif text-base font-medium">Restaurar invitado original</h4>
			<p className="mt-2 mb-0 text-sm">Actualmente este lugar está ocupado por: <strong>{guest?.name}</strong>.</p>
			<p className="mt-2 mb-0 text-sm">Se restaurará al invitado original: <strong>{guest?.originalName || 'Nombre no disponible'}</strong>.</p>
			<p className="mt-2 mb-0 text-sm text-admin-muted">La respuesta de asistencia de este lugar volverá a estar pendiente. La capacidad no cambiará.</p>
			{error && <p role="alert" className="mt-3 mb-0 text-sm text-admin-danger">{error}</p>}
			{saving && <p role="status" className="mt-3 mb-0 text-sm">Restaurando invitado...</p>}
			<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
				<Button variant="secondary" type="button" disabled={saving} onClick={() => { if (!submitting.current) onCancel(); }}>Cancelar</Button>
				<Button variant="primary" type="button" disabled={saving || submitted || !allowed} onClick={() => void restore()}>{saving ? 'Restaurando...' : 'Restaurar invitado'}</Button>
			</div>
		</section>
	);
}
