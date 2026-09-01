import { type FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { createInvitation } from '../api/invitationService';
import type {
	CreateInvitationInput,
	Invitation,
} from '../model/invitation.types';

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
			<section
				className="create-invitation-page create-invitation-success"
				aria-labelledby="create-invitation-title"
			>
				<div className="success-card">
					<span className="success-mark" aria-hidden="true">
						✓
					</span>
					<p className="section-eyebrow">Invitación registrada</p>
					<h1 id="create-invitation-title">
						Invitación creada correctamente.
					</h1>
					<p className="success-name">{createdInvitation.displayName}</p>
					<p className="invitation-id">
						<span>ID generado</span>
						<strong>{createdInvitation.id}</strong>
					</p>
					<Link className="primary-link" to="/invitaciones">
						Volver a invitaciones
					</Link>
				</div>
			</section>
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
			className="create-invitation-page"
			aria-labelledby="create-invitation-title"
		>
			<header className="create-invitation-heading">
				<p className="section-eyebrow">Gestión de invitaciones</p>
				<h1 id="create-invitation-title">Nueva invitación</h1>
				<p>
					Crea una invitación personalizada y define las personas y lugares
					disponibles.
				</p>
			</header>

			<form className="invitation-form" onSubmit={handleSubmit} noValidate>
				<div className="form-main-column">
					<div className="form-section">
					<div className="form-section-heading">
						<p className="section-eyebrow">Información principal</p>
						<h2>Información de la invitación</h2>
					</div>
					<label className="field-label">
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
						<p className="error-message">{errors.displayName}</p>
					)}
					</div>

					<fieldset className="form-section" disabled={isSubmitting}>
					<legend className="visually-hidden">Personas incluidas</legend>
					<div className="form-section-heading">
						<p className="section-eyebrow">Personas</p>
						<h2>Personas incluidas</h2>
						<p>Agrega a las personas que ya conoces por nombre.</p>
					</div>
					<div className="known-guests-list">
						{knownGuests.map((guest, index) => (
							<div className="known-guest-row" key={index}>
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
									className="remove-person-button"
									type="button"
									onClick={() => removeKnownGuest(index)}
								>
									Quitar
								</button>
							</div>
						))}
					</div>
					<button
						className="add-person-button"
						type="button"
						onClick={() => setKnownGuests((guests) => [...guests, ''])}
					>
						+ Agregar persona
					</button>
					{errors.knownGuests && (
						<p className="error-message">{errors.knownGuests}</p>
					)}
					</fieldset>
				</div>

				<div className="form-side-column">
					<div className="form-section form-section-grid">
					<div>
						<div className="form-section-heading">
							<p className="section-eyebrow">Capacidad</p>
							<h2>Lugares adicionales</h2>
							<p>
								Lugares disponibles para acompañantes que todavía no tienen un
								nombre definido.
							</p>
						</div>
						<label className="field-label compact-number-field">
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
							<p className="error-message">{errors.openSlots}</p>
						)}
					</div>

					<div className="preferences-panel">
						<div className="form-section-heading">
							<p className="section-eyebrow">Preferencias</p>
							<h2>¿Permitir sustituciones?</h2>
						</div>
						<label className="checkbox-label">
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
						<p className="field-help">
							Permite que una persona que no asistirá pueda ser sustituida por
							otra.
						</p>
					</div>
					</div>

					<aside className="invitation-summary" aria-label="Resumen de invitación">
					<div className="form-section-heading">
						<p className="section-eyebrow">Vista previa</p>
						<h2>Resumen de invitación</h2>
					</div>
					<dl>
						<div>
							<dt>Personas con nombre</dt>
							<dd>{namedPeopleCount}</dd>
						</div>
						<div>
							<dt>Lugares adicionales</dt>
							<dd>{visualOpenSlots}</dd>
						</div>
						<div className="summary-total">
							<dt>Lugares totales</dt>
							<dd>{visualTotal}</dd>
						</div>
					</dl>
					<p className="summary-preference">
						{replacementsAllowed
							? 'Sustituciones permitidas'
							: 'Sustituciones no permitidas'}
					</p>
					</aside>

					{errors.capacity && (
						<p className="error-message form-alert">{errors.capacity}</p>
					)}
					{status === 'error' && (
						<p className="error-message form-alert" role="alert">
							No fue posible crear la invitación.
						</p>
					)}

					<div className="form-actions">
						<button className="primary-button" type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Creando...' : 'Crear invitación'}
						</button>
						<Link className="secondary-link" to="/invitaciones">
							Volver a invitaciones
						</Link>
					</div>
				</div>
			</form>
		</section>
	);
}
