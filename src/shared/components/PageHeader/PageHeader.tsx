import type { ReactNode } from 'react';

interface PageHeaderProps {
	eyebrow: string;
	title: string;
	description: string;
	titleId?: string;
	action?: ReactNode;
	className?: string;
}

export function PageHeader({
	eyebrow,
	title,
	description,
	titleId,
	action,
	className = '',
}: PageHeaderProps) {
	return (
		<header className={`${action ? 'flex max-w-none items-end justify-between gap-6 max-[36rem]:flex-col max-[36rem]:items-stretch max-[36rem]:gap-4' : 'max-w-2xl'} ${className}`}>
			<div>
				<p className="m-0 text-admin-eyebrow font-extrabold tracking-[0.12em] text-[#927039] uppercase">{eyebrow}</p>
				<h1 className="mt-0.5 mb-1 font-admin-serif text-[clamp(1.75rem,2.5vw,1.95rem)] font-medium tracking-[-0.025em] max-md:text-[1.75rem]" id={titleId}>{title}</h1>
				<p className="m-0 text-[0.9rem] leading-[1.55] text-admin-muted">{description}</p>
			</div>
			{action && <div className="max-[36rem]:flex max-[36rem]:[&>*]:w-full">{action}</div>}
		</header>
	);
}
