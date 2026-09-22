const paths = {
 invitation: 'M3 6h18v13H3z M3 7l9 7 9-7',
 people: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-2a7 7 0 0 1 14 0v2 M16 4a4 4 0 0 1 0 8 M18 15a6 6 0 0 1 4 6',
 check: 'M4 12l5 5L20 6',
 progress: 'M12 3v9l7 6 M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9',
 upload: 'M12 16V3 M6 9l6-6 6 6 M3 15v6h18v-6',
 list: 'M8 5h13 M8 12h13 M8 19h13 M3 5h1 M3 12h1 M3 19h1',
};
export function DashboardIcon({ kind }: { kind: keyof typeof paths }) {
 return <span className={`dashboard-icon dashboard-icon-${kind}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]} /></svg></span>;
}
