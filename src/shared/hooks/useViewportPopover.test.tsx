// @vitest-environment jsdom
import { useRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useViewportPopover } from './useViewportPopover';

function Fixture({ open }: { open: boolean }) {
	const anchor = useRef<HTMLDivElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const space = useViewportPopover(open, anchor, panel);
	return <>
		<div ref={anchor} data-testid="anchor" />
		<div ref={panel} data-testid="panel" />
		<output data-testid="placement">{space.above ? 'above' : 'below'}:{space.maxHeight}</output>
	</>;
}

describe('useViewportPopover', () => {
	afterEach(cleanup);

	it('elige el lado con espacio y recalcula al cambiar el viewport', () => {
		const view = render(<Fixture open={false} />);
		const anchor = screen.getByTestId('anchor');
		const panel = screen.getByTestId('panel');
		anchor.getBoundingClientRect = () => ({ top: 650, bottom: 700 } as DOMRect);
		Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 240 });
		view.rerender(<Fixture open />);
		expect(screen.getByTestId('placement').textContent).toBe('above:630');

		anchor.getBoundingClientRect = () => ({ top: 100, bottom: 150 } as DOMRect);
		fireEvent(window, new Event('resize'));
		expect(screen.getByTestId('placement').textContent).toBe('below:598');
	});
});
