import { ButtonLink } from '../../../shared/components/Button/Button';

interface CreationSuccessProps {
	displayName: string;
	id: string;
}

export function CreationSuccess({ displayName, id }: CreationSuccessProps) {
	return (
		<section
			className="grid min-h-[min(28rem,calc(100vh-8rem))] w-full place-items-center text-[0.9rem] max-md:text-[0.9375rem]"
			aria-labelledby="create-invitation-title"
		>
			<div className="w-full max-w-[30rem] rounded-2xl border border-[#dfd4bd] bg-surface p-[clamp(1.75rem,5vw,2.4rem)] text-center shadow-admin">
				<span className="mx-auto mb-3.5 grid h-[2.65rem] w-[2.65rem] place-items-center rounded-full bg-admin-green-100 text-xl font-extrabold text-admin-green-700" aria-hidden="true">✓</span>
				<p className="m-0 text-admin-eyebrow font-extrabold tracking-[0.12em] text-[#927039] uppercase">Invitación registrada</p>
				<h1 className="mt-1 mb-0 font-admin-serif text-[clamp(1.7rem,4vw,2rem)] font-medium" id="create-invitation-title">Invitación creada correctamente.</h1>
				<p className="mt-4 mb-0 text-[#52645c]">{displayName}</p>
				<p className="my-5 grid gap-1 rounded-lg border border-admin-border bg-cream p-3.5">
					<span className="text-[0.7rem] font-bold tracking-[0.08em] text-[#79857f] uppercase">ID generado</span>
					<strong className="text-[1.15rem] tracking-[0.08em]">{id}</strong>
				</p>
				<ButtonLink variant="primary" to="/invitaciones">
					Volver a invitaciones
				</ButtonLink>
			</div>
		</section>
	);
}
