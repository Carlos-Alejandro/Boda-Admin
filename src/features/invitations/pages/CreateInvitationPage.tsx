import { type FormEvent, useEffect, useRef, useState } from 'react';

import { Button, ButtonLink } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { notify } from '../../../shared/notifications/notify';
import { ApiError, ApiOutcomeUnknownError, ApiResponseError } from '../../../services/http/apiClient';
import { createInvitation } from '../api/invitationService';
import { CreateInvitationIcon } from '../components/CreateInvitationIcon';
import { InvitationSummary } from '../components/InvitationSummary';
import type {
	CreateInvitationInput,
	Invitation,
} from '../model/invitation.types';
import { getPublicInvitationUrl } from '../model/publicInvitationUrl';
import './CreateInvitationPage.css';

type FormStatus = 'idle' | 'submitting' | 'error' | 'unknown';

interface FormErrors {
	displayName?: string;
	knownGuests?: string;
	openSlots?: string;
	capacity?: string;
}

export function CreateInvitationPage() {
	const [displayName, setDisplayName] = useState('');
	const [knownGuests, setKnownGuests] = useState<string[]>([]);
	const [openSlots, setOpenSlots] = useState('0');
	const [replacementsAllowed, setReplacementsAllowed] = useState(false);
	const [errors, setErrors] = useState<FormErrors>({});
	const [status, setStatus] = useState<FormStatus>('idle');
	const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(
		null,
	);
	const successDialogRef = useRef<HTMLDialogElement>(null);
	const submittingRef = useRef(false);

	useEffect(() => {
		const dialog = successDialogRef.current;
		if (createdInvitation && dialog && !dialog.open) dialog.showModal();
	}, [createdInvitation]);

	const resetForm = () => {
		setDisplayName('');
		setKnownGuests([]);
		setOpenSlots('0');
		setReplacementsAllowed(false);
		setErrors({});
		setCreatedInvitation(null);
		setStatus('idle');
	};

	const closeSuccessDialog = () => {
		const dialog = successDialogRef.current;
		if (dialog?.open) dialog.close();
		resetForm();
	};

	const copyInvitationLink = async () => {
		if (!createdInvitation) return;

		try {
			await navigator.clipboard.writeText(getPublicInvitationUrl(createdInvitation.id));
			notify.success('Enlace copiado', {
				description: `Puedes compartir la invitación de ${createdInvitation.displayName}.`,
			});
		} catch {
			notify.error('No se pudo copiar el enlace', {
				description: 'Inténtalo nuevamente.',
			});
		}
	};

	const updateKnownGuest = (index: number, name: string) => {
		setKnownGuests((currentGuests) =>
			currentGuests.map((guest, guestIndex) =>
				guestIndex === index ? name : guest,
			),
		);
	};

	const removeKnownGuest = (index: number) => {
		setKnownGuests((currentGuests) =>
			currentGuests.filter((_, guestIndex) => guestIndex !== index),
		);
	};

	const validate = (): CreateInvitationInput | null => {
		const nextErrors: FormErrors = {};
		const trimmedDisplayName = displayName.trim();
		const parsedOpenSlots = Number(openSlots);
		const hasInvalidGuest = knownGuests.some((name) => !name.trim());

		if (!trimmedDisplayName) {
			nextErrors.displayName = 'Ingresa el nombre de la invitación.';
		}

		if (hasInvalidGuest) {
			nextErrors.knownGuests =
				'Completa o quita los invitados que no tengan nombre.';
		}

		if (!/^\d+$/.test(openSlots) || !Number.isSafeInteger(parsedOpenSlots)) {
			nextErrors.openSlots =
				'Los espacios abiertos deben ser un número entero mayor o igual a cero.';
		}

		const normalizedGuests = knownGuests
			.map((name) => name.trim())
			.filter(Boolean)
			.map((name) => ({ name }));

		if (
			!nextErrors.openSlots &&
			normalizedGuests.length + parsedOpenSlots < 1
		) {
			nextErrors.capacity =
				'Agrega al menos un invitado o un espacio abierto.';
		}

		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return null;

		return {
			displayName: trimmedDisplayName,
			knownGuests: normalizedGuests,
			openSlots: parsedOpenSlots,
			replacementsAllowed,
		};
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (submittingRef.current || status === 'unknown') return;

		const input = validate();
		if (!input) return;

		submittingRef.current = true;
		setStatus('submitting');

		try {
			const invitation = await createInvitation(input);
			setCreatedInvitation(invitation);
			setStatus('idle');
		} catch (error) {
			const outcomeMayHaveCompleted = error instanceof ApiOutcomeUnknownError ||
				(error instanceof ApiResponseError && error.mayHaveCompleted) ||
				(error instanceof ApiError && error.mayHaveCompleted);
			if (outcomeMayHaveCompleted) {
				setStatus('unknown');
				return;
			}
			setStatus('error');
			notify.error('No se pudo crear la invitación', {
				description: 'Revisa los datos e inténtalo nuevamente.',
			});
		} finally {
			submittingRef.current = false;
		}
	};

	const isSubmitting = status === 'submitting';
	const isOutcomeUnknown = status === 'unknown';
	const formDisabled = isSubmitting || isOutcomeUnknown;
	const namedPeopleCount = knownGuests.filter((name) => name.trim()).length;
	const parsedVisualOpenSlots = Number(openSlots);
	const visualOpenSlots =
		/^\d+$/.test(openSlots) && Number.isSafeInteger(parsedVisualOpenSlots)
			? parsedVisualOpenSlots
			: 0;
	const visualTotal = namedPeopleCount + visualOpenSlots;

	return (
		<section
			className="create-invitation-page w-full"
			aria-labelledby="create-invitation-title"
		>
			<PageHeader
				className="invitation-page-header"
				title="Nueva invitación"
				titleId="create-invitation-title"
				description="Crea una invitación personalizada y define las personas y lugares disponibles."
			/>

			<form className="create-invitation-form" onSubmit={handleSubmit} noValidate>
				<div className="create-invitation-form__main">
					<div className="create-invitation-form__row">
						<span className="create-invitation-form__icon"><CreateInvitationIcon kind="invitation" /></span>
						<div className="create-invitation-form__row-content">
							<label className="create-invitation-form__field-label" htmlFor="create-invitation-name">Nombre de la invitación</label>
							<input
								id="create-invitation-name"
								type="text"
								value={displayName}
								onChange={(event) => setDisplayName(event.target.value)}
								placeholder="Ej. Familia Ruiz"
								disabled={formDisabled}
							/>
							{errors.displayName && <p className="create-invitation-form__inline-error">{errors.displayName}</p>}
						</div>
					</div>

					<div className="create-invitation-form__row">
						<span className="create-invitation-form__icon"><CreateInvitationIcon kind="people" /></span>
						<div className="create-invitation-form__row-content">
							<div className="create-invitation-form__number-line">
								<label className="create-invitation-form__field-label" htmlFor="create-open-slots">Lugares adicionales</label>
								<input
									id="create-open-slots"
									type="number"
									min="0"
									step="1"
									inputMode="numeric"
									value={openSlots}
									onChange={(event) => setOpenSlots(event.target.value)}
									disabled={formDisabled}
								/>
							</div>
							<p className="create-invitation-form__help">Lugares disponibles para acompañantes que todavía no tienen un nombre definido.</p>
							{errors.openSlots && <p className="create-invitation-form__inline-error">{errors.openSlots}</p>}
						</div>
					</div>

					<fieldset className="create-invitation-form__row" disabled={formDisabled}>
						<legend className="visually-hidden">Personas incluidas</legend>
						<span className="create-invitation-form__icon"><CreateInvitationIcon kind="people" /></span>
						<div className="create-invitation-form__row-content">
							<h2>Personas incluidas</h2>
							<p className="create-invitation-form__help">Agrega a las personas que ya conoces por nombre.</p>
							<div className="create-invitation-form__guests">
								{knownGuests.map((guest, index) => (
									<div className="create-invitation-form__guest-row" key={index}>
										<label>
											<span className="visually-hidden">Nombre de la persona {index + 1}</span>
											<input
												type="text"
												value={guest}
												onChange={(event) => updateKnownGuest(index, event.target.value)}
												placeholder="Nombre de la persona"
											/>
										</label>
										<button className="create-invitation-form__remove-person" type="button" onClick={() => removeKnownGuest(index)}>Quitar</button>
									</div>
								))}
							</div>
							<button className="create-invitation-form__add-person" type="button" onClick={() => setKnownGuests((guests) => [...guests, ''])}>+ Agregar persona</button>
							{errors.knownGuests && <p className="create-invitation-form__inline-error">{errors.knownGuests}</p>}
						</div>
					</fieldset>

					<div className="create-invitation-form__row">
						<span className="create-invitation-form__icon"><CreateInvitationIcon kind="swap" /></span>
						<div className="create-invitation-form__row-content create-invitation-form__toggle-line">
							<div>
								<h2>Permitir sustituciones</h2>
								<p className="create-invitation-form__help">Permite que una persona que no asistirá pueda ser sustituida por otra.</p>
							</div>
							<label className="create-invitation-form__switch">
								<input type="checkbox" checked={replacementsAllowed} onChange={(event) => setReplacementsAllowed(event.target.checked)} disabled={formDisabled} />
								<span className="visually-hidden">Permitir sustituciones</span>
							</label>
						</div>
					</div>
				</div>

				<div className="create-invitation-form__side">
					<InvitationSummary namedPeopleCount={namedPeopleCount} openSlots={visualOpenSlots} total={visualTotal} replacementsAllowed={replacementsAllowed} />
					<div className="create-invitation-form__info">
						<span className="create-invitation-form__info-icon"><CreateInvitationIcon kind="info" /></span>
						<p>El resumen se actualiza mientras completas la invitación.</p>
					</div>
					{errors.capacity && <p className="create-invitation-form__alert">{errors.capacity}</p>}
					{isOutcomeUnknown && <p role="alert" className="create-invitation-form__alert">No se pudo confirmar el resultado. La invitación podría haberse creado. Revisa el listado antes de volver a intentarlo. <ButtonLink variant="text" to="/invitaciones">Ir al listado</ButtonLink></p>}
					<div className="create-invitation-form__actions">
						<ButtonLink variant="secondary" to="/invitaciones">Cancelar</ButtonLink>
						<Button variant="primary" type="submit" disabled={formDisabled}>{isSubmitting ? 'Creando...' : 'Crear invitación'}</Button>
					</div>
				</div>
			</form>

			{createdInvitation && (
				<dialog
					ref={successDialogRef}
					className="create-invitation-success"
					aria-labelledby="create-invitation-success-title"
					aria-describedby="create-invitation-success-description"
					aria-modal="true"
					onClose={resetForm}
					onKeyDown={(event) => {
						if (event.key === 'Escape') {
							event.preventDefault();
							closeSuccessDialog();
						}
					}}
					onCancel={(event) => {
						event.preventDefault();
						closeSuccessDialog();
					}}
					onClick={(event) => {
						if (event.target === event.currentTarget) closeSuccessDialog();
					}}
				>
					<div className="create-invitation-success__content">
						<span className="create-invitation-success__mark" aria-hidden="true">✓</span>
						<h2 id="create-invitation-success-title">Invitación creada</h2>
						<p id="create-invitation-success-description">
							{createdInvitation.displayName} se creó correctamente.
						</p>
						<p className="create-invitation-success__code">
							<span>Código de invitación</span>
							<strong>{createdInvitation.id}</strong>
						</p>
						<div className="create-invitation-success__actions">
							<ButtonLink
								variant="primary"
								to={`/invitaciones/${encodeURIComponent(createdInvitation.id)}`}
							>
								Ver invitación
							</ButtonLink>
							<Button variant="secondary" type="button" onClick={() => void copyInvitationLink()}>
								<svg className="mr-2 h-4 w-4" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
									<rect x="8" y="8" width="12" height="12" rx="2" />
									<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
								</svg>
								Copiar enlace
							</Button>
							<Button variant="secondary" type="button" onClick={closeSuccessDialog}>
								Crear otra invitación
							</Button>
						</div>
						<Button
							className="create-invitation-success__close"
							variant="secondary"
							type="button"
							onClick={closeSuccessDialog}
						>
							Cerrar
						</Button>
					</div>
				</dialog>
			)}
		</section>
	);
}
