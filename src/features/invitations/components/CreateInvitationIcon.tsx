const iconPaths = {
	invitation: <><path d="M6 3.5h8l4 4V20H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V8h4M8 12h6M8 15h6" /></>,
	people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a2.5 2.5 0 0 1 0 5M16 14a5 5 0 0 1 4.5 6" /></>,
	swap: <><path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4" /></>,
	info: <><circle cx="12" cy="12" r="9" /><path d="M12 10.5v5M12 7.5h.01" /></>,
};

export function CreateInvitationIcon({ kind }: { kind: keyof typeof iconPaths }) {
	return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{iconPaths[kind]}</svg>;
}
