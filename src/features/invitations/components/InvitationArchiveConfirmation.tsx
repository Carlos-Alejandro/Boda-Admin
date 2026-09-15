import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../services/http/apiClient';
import { Button } from '../../../shared/components/Button/Button';
import { archiveInvitation, restoreInvitation } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';

interface InvitationArchiveConfirmationProps {
	invitation: Invitation;
	onCancel: () => void;
	onSaved: (invitation: Invitation) => void;
	onUnavailable: () => void;
	onRefresh: (message: string) => void;
}

export function InvitationArchiveConfirmation({ invitation, onCancel, onSaved, onUnavailable, onRefresh }: InvitationArchiveConfirmationProps) {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const submitting = useRef(false);
	const mounted = useRef(false);
	const title = useRef<HTMLHeadingElement>(null);
	const restoring = invitation.isArchived;

	useEffect(() => {
		mounted.current = true;
		title.current?.focus();
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

	const confirm = async () => {
		if (submitting.current) return;
		submitting.current = true;
		setSaving(true);
		setError('');
		let refreshing = false;
		try {
			const updated = await (restoring ? restoreInvitation(invitation.id) : archiveInvitation(invitation.id));
			if (mounted.current) onSaved(updated);
		} catch (operationError) {
			if (!mounted.current) return;
			if (operationError instanceof ApiError && operationError.status === 404) {
				onUnavailable();
			} else if (operationError instanceof ApiError && operationError.status === 400) {
				setError('No fue posible realizar esta acción con el estado actual de la invitación. Cancela y revisa sus datos.');
			} else if (operationError instanceof ApiError && (operationError.status === 401 || operationError.status === 403)) {
				setError('No pudimos autorizar esta acción. Comprueba tu sesión y tus permisos.');
			} else {
				refreshing = true;
				onRefresh('No pudimos confirmar el resultado. Recargaremos la invitación; revisa su estado antes de intentar otra acción.');
			}
		} finally {
			if (!refreshing) submitting.current = false;
			if (mounted.current && !refreshing) setSaving(false);
		}
	};

	return (
		<section aria-labelledby="archive-confirmation-title" aria-busy={saving} className="mt-4 rounded-lg border border-admin-border bg-surface-soft p-3 [overflow-wrap:anywhere]">
			<h3 ref={title} tabIndex={-1} id="archive-confirmation-title" className="m-0 font-admin-serif text-base font-medium">{restoring ? 'Restaurar' : 'Archivar'} {invitation.displayName}</h3>
			<p className="mt-2 mb-0 text-sm text-admin-muted">{restoring ? 'La invitación volverá a estar activa y disponible para el invitado.' : 'La invitación archivada dejará de estar disponible para el invitado.'}</p>
			{error && <p role="alert" className="mt-3 mb-0 text-sm text-admin-danger">{error}</p>}
			{saving && <p role="status" className="mt-3 mb-0 text-sm">{restoring ? 'Restaurando invitación...' : 'Archivando invitación...'}</p>}
			<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
				<Button variant="secondary" type="button" disabled={saving} onClick={() => { if (!submitting.current) onCancel(); }}>Cancelar</Button>
				<Button variant="primary" type="button" disabled={saving || Boolean(error)} onClick={() => void confirm()}>{restoring ? 'Confirmar restauración' : 'Confirmar archivo'}</Button>
			</div>
		</section>
	);
}
