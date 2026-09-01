import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary';

const baseClassName = 'inline-flex min-h-10 items-center justify-center rounded-lg px-3.5 py-2 text-admin-control font-bold no-underline transition-colors duration-150';
const variantClassNames = {
	primary: 'border border-admin-green-900 bg-admin-green-900 text-white hover:bg-admin-green-700 disabled:cursor-not-allowed disabled:opacity-50',
	secondary: 'border border-[#b9c5bf] bg-transparent text-admin-green-700 hover:border-[#92a69c] hover:bg-admin-green-100 disabled:cursor-not-allowed disabled:opacity-50',
	text: 'min-h-0 rounded-none border-0 px-1.5 py-2.5 text-[#52645c] underline underline-offset-[0.2rem]',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant: ButtonVariant;
}

export function Button({ variant, className = '', ...props }: ButtonProps) {
	return <button className={`${baseClassName} ${variantClassNames[variant]} ${className}`} {...props} />;
}

interface ButtonLinkProps {
	to: string;
	children: ReactNode;
	variant: ButtonVariant | 'text';
	className?: string;
}

export function ButtonLink({ to, children, variant, className = '' }: ButtonLinkProps) {
	return (
		<Link className={`${baseClassName} ${variantClassNames[variant]} ${className}`} to={to}>
			{children}
		</Link>
	);
}
