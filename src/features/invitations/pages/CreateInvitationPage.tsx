import { type FormEvent, useRef, useState } from 'react';

import { Button, ButtonLink } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { createInvitation } from '../api/invitationService';
import { CreationSuccess } from '../components/CreationSuccess';
import { InvitationSummary } from '../components/InvitationSummary';
import type {
	CreateInvitationInput,
	Invitation,
} from '../model/invitation.types';
import './CreateInvitationPage.css';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

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
	const submittingRef = useRef(false);

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
		if (submittingRef.current) return;

		const input = validate();
		if (!input) return;

		submittingRef.current = true;
		setStatus('submitting');

		try {
			const invitation = await createInvitation(input);
			setCreatedInvitation(invitation);
			setStatus('success');
		} catch {
			setStatus('error');
		} finally {
			submittingRef.current = false;
		}
	};

	if (status === 'success' && createdInvitation) {
		return (
			<CreationSuccess
				displayName={createdInvitation.displayName}
				id={createdInvitation.id}
			/>
		);
	}

	const isSubmitting = status === 'submitting';
	const namedPeopleCount = knownGuests.filter((name) => name.trim()).length;
	const parsedVisualOpenSlots = Number(openSlots);
	const visualOpenSlots =
		/^\d+$/.test(openSlots) && Number.isSafeInteger(parsedVisualOpenSlots)
			? parsedVisualOpenSlots
			: 0;
	const visualTotal = namedPeopleCount + visualOpenSlots;

	return (
		<section
			className="w-full text-[0.9rem] max-md:text-[0.9375rem]"
			aria-labelledby="create-invitation-title"
		>
			<PageHeader
				className="min-[75rem]:max-w-[46rem] min-[75rem]:[&_h1]:text-[1.95rem] min-[75rem]:[&_p:last-child]:text-[0.88rem]"
				eyebrow="Gestión de invitaciones"
				title="Nueva invitación"
				titleId="create-invitation-title"
				description="Crea una invitación personalizada y define las personas y lugares disponibles."
			/>

			<form className="create-invitation-form" onSubmit={handleSubmit} noValidate>
				<div className="create-invitation-form__main">
					<div className="create-invitation-form__section">
					<div className="create-invitation-form__section-heading">
						<p className="create-invitation-form__eyebrow">Información principal</p>
						<h2>Información de la invitación</h2>
					</div>
					<label className="create-invitation-form__field-label">
						<span>Nombre de la invitación</span>
						<input
							type="text"
							value={displayName}
							onChange={(event) => setDisplayName(event.target.value)}
							placeholder="Ej. Familia Ruiz"
							disabled={isSubmitting}
						/>
					</label>
					{errors.displayName && (
						<p className="create-invitation-form__inline-error">{errors.displayName}</p>
					)}
					</div>

					<fieldset className="create-invitation-form__section" disabled={isSubmitting}>
					<legend className="visually-hidden">Personas incluidas</legend>
					<div className="create-invitation-form__section-heading">
						<p className="create-invitation-form__eyebrow">Personas</p>
						<h2>Personas incluidas</h2>
						<p>Agrega a las personas que ya conoces por nombre.</p>
					</div>
					<div className="create-invitation-form__guests">
						{knownGuests.map((guest, index) => (
							<div className="create-invitation-form__guest-row" key={index}>
								<label>
									<span className="visually-hidden">
										Nombre de la persona {index + 1}
									</span>
									<input
										type="text"
										value={guest}
										onChange={(event) =>
											updateKnownGuest(index, event.target.value)
										}
										placeholder="Nombre de la persona"
									/>
								</label>
								<button
									className="create-invitation-form__remove-person"
									type="button"
									onClick={() => removeKnownGuest(index)}
								>
									Quitar
								</button>
							</div>
						))}
					</div>
					<button
						className="create-invitation-form__add-person"
						type="button"
						onClick={() => setKnownGuests((guests) => [...guests, ''])}
					>
						+ Agregar persona
					</button>
					{errors.knownGuests && (
						<p className="create-invitation-form__inline-error">{errors.knownGuests}</p>
					)}
					</fieldset>
				</div>

				<div className="create-invitation-form__side">
					<div className="create-invitation-form__section create-invitation-form__section-grid">
					<div>
						<div className="create-invitation-form__section-heading">
							<p className="create-invitation-form__eyebrow">Capacidad</p>
							<h2>Lugares adicionales</h2>
							<p>
								Lugares disponibles para acompañantes que todavía no tienen un
								nombre definido.
							</p>
						</div>
						<label className="create-invitation-form__field-label create-invitation-form__number-field">
							<span className="visually-hidden">Lugares adicionales</span>
							<input
								type="number"
								min="0"
								step="1"
								inputMode="numeric"
								value={openSlots}
								onChange={(event) => setOpenSlots(event.target.value)}
								disabled={isSubmitting}
							/>
						</label>
						{errors.openSlots && (
							<p className="create-invitation-form__inline-error">{errors.openSlots}</p>
						)}
					</div>

					<div className="create-invitation-form__preferences">
						<div className="create-invitation-form__section-heading">
							<p className="create-invitation-form__eyebrow">Preferencias</p>
							<h2>¿Permitir sustituciones?</h2>
						</div>
						<label className="create-invitation-form__checkbox">
							<input
								type="checkbox"
								checked={replacementsAllowed}
								onChange={(event) =>
									setReplacementsAllowed(event.target.checked)
								}
								disabled={isSubmitting}
							/>
							<span>Permitir sustituciones</span>
						</label>
						<p className="create-invitation-form__help">
							Permite que una persona que no asistirá pueda ser sustituida por
							otra.
						</p>
					</div>
					</div>

					<InvitationSummary
						namedPeopleCount={namedPeopleCount}
						openSlots={visualOpenSlots}
						total={visualTotal}
						replacementsAllowed={replacementsAllowed}
					/>

					{errors.capacity && (
						<p className="create-invitation-form__alert">{errors.capacity}</p>
					)}
					{status === 'error' && (
						<p className="create-invitation-form__alert" role="alert">
							No fue posible crear la invitación.
						</p>
					)}

					<div className="create-invitation-form__actions">
						<Button variant="primary" type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Creando...' : 'Crear invitación'}
						</Button>
						<ButtonLink variant="text" to="/invitaciones">
							Volver a invitaciones
						</ButtonLink>
					</div>
				</div>
			</form>
		</section>
	);
}
