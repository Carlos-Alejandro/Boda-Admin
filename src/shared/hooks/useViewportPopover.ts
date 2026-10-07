import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

interface PopoverSpace {
	above: boolean;
	maxHeight?: number;
}

export function useViewportPopover(
	open: boolean,
	anchor: RefObject<HTMLElement | null>,
	panel: RefObject<HTMLElement | null>,
): PopoverSpace {
	const [space, setSpace] = useState<PopoverSpace>({ above: false });

	useLayoutEffect(() => {
		if (!open) return;
		const update = () => {
			if (!anchor.current || !panel.current) return;
			const rect = anchor.current.getBoundingClientRect();
			const viewportTop = window.visualViewport?.offsetTop ?? 0;
			const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
			const gapAndMargin = 20;
			const below = viewportTop + viewportHeight - rect.bottom - gapAndMargin;
			const above = rect.top - viewportTop - gapAndMargin;
			const placeAbove = below < panel.current.scrollHeight && above > below;
			const maxHeight = Math.max(0, Math.floor(placeAbove ? above : below));
			setSpace((current) => current.above === placeAbove && current.maxHeight === maxHeight
				? current : { above: placeAbove, maxHeight });
		};
		update();
		window.addEventListener('resize', update);
		window.addEventListener('scroll', update, true);
		window.visualViewport?.addEventListener('resize', update);
		return () => {
			window.removeEventListener('resize', update);
			window.removeEventListener('scroll', update, true);
			window.visualViewport?.removeEventListener('resize', update);
		};
	}, [open, anchor, panel]);

	return space;
}
