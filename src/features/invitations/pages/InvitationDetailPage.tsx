import { type PointerEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../../../services/http/apiClient';
import { Button, ButtonLink } from '../../../shared/components/Button/Button';
import { notify } from '../../../shared/notifications/notify';
import { getInvitationById } from '../api/invitationService';
import { InvitationStatusBadge } from '../components/InvitationStatusBadge';
import { InvitationEditForm } from '../components/InvitationEditForm';
import { InvitationCapacityForm } from '../components/InvitationCapacityForm';
import { RestoreInvitationReplacement } from '../components/RestoreInvitationReplacement';
import { RemoveInvitationGuest } from '../components/RemoveInvitationGuest';
import { EditInvitationGuestName } from '../components/EditInvitationGuestName';
import { EditInvitationOverride, type OverrideAction } from '../components/EditInvitationOverride';
import { InvitationArchiveConfirmation } from '../components/InvitationArchiveConfirmation';
import type { GuestType, Invitation } from '../model/invitation.types';
import { getPublicInvitationUrl } from '../model/publicInvitationUrl';
import './InvitationDetailPage.css';

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Cancun', day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function formatDate(value: string | null, fallback = 'Fecha no disponible') {
  if (value === null) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : dateFormatter.format(date);
}
const guestLabels: Record<GuestType, string> = {
  known: 'Invitado', open: 'Lugar sin asignar', replacement: 'Invitado de sustitución',
};
type DetailState = { status: 'loading' | 'not-found' | 'error' } | { status: 'success'; invitation: Invitation };
type CardKey = 'people' | 'data' | 'admin';
interface CardDragSession {
  pointerId: number;
  source: CardKey;
  sourceIndex: number;
  startY: number;
  rects: Map<CardKey, DOMRect>;
  targetIndex: number;
  active: boolean;
}
const defaultCardOrder: CardKey[] = ['people', 'data', 'admin'];
const cardTitles: Record<CardKey, string> = { people: 'Personas', data: 'Datos de la invitación', admin: 'Administración' };
const cardOrderStorageKey = 'boda-admin:invitation-detail-card-order:v1';

function readCardOrder(): CardKey[] {
  try {
    const saved = JSON.parse(localStorage.getItem(cardOrderStorageKey) || 'null');
    if (Array.isArray(saved) && saved.length === defaultCardOrder.length && defaultCardOrder.every((key) => saved.includes(key))) return saved as CardKey[];
  } catch {
    // Browser storage may be unavailable; keep the default order for this session.
  }
  return [...defaultCardOrder];
}

function DetailIcon({ name }: { name: 'people' | 'invitation' | 'settings' }) {
  const paths = {
    people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 5" /></>,
    invitation: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2m0 15v2M2.5 12h2m15 0h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4m0-13.4-1.4 1.4M6.7 17.3l-1.4 1.4" /></>,
  };
  return <span className="invitation-detail__section-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>;
}
function DetailSection({ title, icon, description, children, action, orderControls }: { title: string; icon: 'people' | 'invitation' | 'settings'; description: string; children: ReactNode; action?: ReactNode; orderControls: ReactNode }) {
  return <section className="invitation-detail__section" aria-label={title}>
    <div className="invitation-detail__section-heading"><div className="invitation-detail__section-intro"><DetailIcon name={icon} /><div><h2>{title}</h2><p>{description}</p></div></div><div className="invitation-detail__section-actions">{action}{orderControls}</div></div>
    {children}
  </section>;
}
function DetailRow({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return <div className="invitation-detail__data-row"><dt>{label}</dt><dd>{children}</dd>{action && <div className="invitation-detail__row-action">{action}</div>}</div>;
}
function TextAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="invitation-detail__text-action" onClick={onClick}>{children}</button>;
}

export function InvitationDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <InvitationDetail key={id} id={id} />;
}
function InvitationDetail({ id }: { id: string | undefined }) {
  const [state, setState] = useState<DetailState>({ status: id ? 'loading' : 'not-found' });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<'name' | 'replacements' | null>(null);
  const [changingCapacity, setChangingCapacity] = useState(false);
  const [restoringIndex, setRestoringIndex] = useState<number | null>(null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [editingNameIndex, setEditingNameIndex] = useState<number | null>(null);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [overrideAction, setOverrideAction] = useState<OverrideAction | null>(null);
  const [changingArchive, setChangingArchive] = useState(false);
  const [notice, setNotice] = useState('');
  const [cardOrder, setCardOrder] = useState<CardKey[]>(readCardOrder);
  const [draggedCard, setDraggedCard] = useState<CardKey | null>(null);
  const [dropCard, setDropCard] = useState<CardKey | null>(null);
  const [orderAnnouncement, setOrderAnnouncement] = useState('');
  const dragSession = useRef<CardDragSession | null>(null);
  const cardList = useRef<HTMLDivElement>(null);
  const beforeMove = useRef<Map<CardKey, DOMRect> | null>(null);

  useLayoutEffect(() => {
    const previous = beforeMove.current;
    if (!previous) return;
    beforeMove.current = null;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const elements = cardList.current?.querySelectorAll<HTMLElement>('[data-card-key]');
    if (!reducedMotion) elements?.forEach((element) => {
      const oldRect = previous.get(element.dataset.cardKey as CardKey);
      if (!oldRect) return;
      const distance = oldRect.top - element.getBoundingClientRect().top;
      if (Math.abs(distance) < 1) return;
      element.getAnimations?.().forEach((animation) => animation.cancel());
      element.animate?.(
        [{ transform: `translate3d(0, ${distance}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
        { duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)' },
      );
    });
    requestAnimationFrame(() => elements?.forEach((element) => { element.style.transition = ''; }));
  }, [cardOrder]);

  useEffect(() => {
    const controller = new AbortController();
    if (!id) return () => controller.abort();
    void getInvitationById(id, controller.signal).then(
      (invitation) => { if (!controller.signal.aborted) setState({ status: 'success', invitation }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ status: error instanceof ApiError && error.status === 404 ? 'not-found' : 'error' }); },
    );
    return () => controller.abort();
  }, [id, attempt]);

  useEffect(() => {
    if (openMenuIndex === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        document.querySelector<HTMLButtonElement>('.invitation-detail__menu-trigger[aria-expanded="true"]')?.focus();
        setOpenMenuIndex(null);
      }
    };
    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Element && !event.target.closest('.invitation-detail__menu-wrap')) setOpenMenuIndex(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('mousedown', closeOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('mousedown', closeOutside);
    };
  }, [openMenuIndex]);

  const invitation = state.status === 'success' ? state.invitation : null;
  const idle = editing === null && !changingCapacity && removingIndex === null && restoringIndex === null && editingNameIndex === null && !changingArchive && overrideAction === null;
  const unavailable = () => { setNotice('Esta invitación ya no está disponible.'); setState({ status: 'not-found' }); };
  const reload = (message = '') => { setNotice(message); setState({ status: 'loading' }); setAttempt((current) => current + 1); };
  const copyLink = async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(getPublicInvitationUrl(invitation.id));
      notify.success('Enlace copiado', { description: `Ya puedes compartir la invitación de ${invitation.displayName}.` });
    } catch {
      notify.error('No se pudo copiar el enlace', { description: 'Inténtalo nuevamente.' });
    }
  };
  const confirmedCount = invitation?.guests.filter((guest) => guest.attending === true).length ?? 0;
  const pendingCount = invitation?.guests.filter((guest) => guest.attending === null).length ?? 0;
  const readCardRects = () => new Map<CardKey, DOMRect>(Array.from(cardList.current?.querySelectorAll<HTMLElement>('[data-card-key]') ?? [], (element) => [element.dataset.cardKey as CardKey, element.getBoundingClientRect()]));
  const clearCardTransforms = (immediate = false) => cardList.current?.querySelectorAll<HTMLElement>('[data-card-key]').forEach((element) => {
    if (immediate) element.style.transition = 'none';
    element.style.transform = '';
  });
  const moveCard = (source: CardKey, target: CardKey, previous?: Map<CardKey, DOMRect>) => {
    if (source === target) return;
    beforeMove.current = previous ?? readCardRects();
    const movingDown = cardOrder.indexOf(source) < cardOrder.indexOf(target);
    const next = cardOrder.filter((key) => key !== source);
    next.splice(next.indexOf(target) + (movingDown ? 1 : 0), 0, source);
    setCardOrder(next);
    setOrderAnnouncement(`Tarjeta ${cardTitles[source]} movida a la posición ${next.indexOf(source) + 1}.`);
    try { localStorage.setItem(cardOrderStorageKey, JSON.stringify(next)); } catch { /* The current page still keeps the selected order. */ }
  };
  const startCardDrag = (event: PointerEvent<HTMLDivElement>, key: CardKey) => {
    if (!idle || event.button !== 0 || event.pointerType === 'touch' || (event.target instanceof Element && event.target.closest('button, a, input, textarea, select'))) return;
    dragSession.current = { pointerId: event.pointerId, source: key, sourceIndex: cardOrder.indexOf(key), startY: event.clientY, rects: readCardRects(), targetIndex: cardOrder.indexOf(key), active: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveCardDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const offset = event.clientY - session.startY;
    if (!session.active && Math.abs(offset) < 6) return;
    if (!session.active) { session.active = true; window.getSelection()?.removeAllRanges(); setDraggedCard(session.source); }
    event.preventDefault();
    const sourceRect = session.rects.get(session.source);
    if (!sourceRect) return;
    event.currentTarget.style.transform = `translate3d(0, ${offset}px, 0)`;
    const center = sourceRect.top + sourceRect.height / 2 + offset;
    let targetIndex = session.sourceIndex;
    if (offset > 0) {
      for (let index = session.sourceIndex + 1; index < cardOrder.length; index++) {
        const rect = session.rects.get(cardOrder[index]);
        if (rect && center > rect.top + rect.height / 2) targetIndex = index;
      }
    } else {
      for (let index = session.sourceIndex - 1; index >= 0; index--) {
        const rect = session.rects.get(cardOrder[index]);
        if (rect && center < rect.top + rect.height / 2) targetIndex = index;
      }
    }
    if (targetIndex === session.targetIndex) return;
    session.targetIndex = targetIndex;
    setDropCard(targetIndex === session.sourceIndex ? null : cardOrder[targetIndex]);
    const nextRect = session.rects.get(cardOrder[session.sourceIndex + 1]);
    const gap = nextRect ? Math.max(0, nextRect.top - sourceRect.bottom) : 16;
    const shift = sourceRect.height + gap;
    cardList.current?.querySelectorAll<HTMLElement>('[data-card-key]').forEach((element) => {
      const index = cardOrder.indexOf(element.dataset.cardKey as CardKey);
      if (index === session.sourceIndex) return;
      const displaced = targetIndex > session.sourceIndex
        ? index > session.sourceIndex && index <= targetIndex
        : index >= targetIndex && index < session.sourceIndex;
      element.style.transform = displaced ? `translate3d(0, ${targetIndex > session.sourceIndex ? -shift : shift}px, 0)` : '';
    });
  };
  const endCardDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const previous = session.active ? readCardRects() : undefined;
    const changed = session.active && session.targetIndex !== session.sourceIndex;
    clearCardTransforms(changed);
    dragSession.current = null;
    setDraggedCard(null);
    setDropCard(null);
    if (changed && previous) moveCard(session.source, cardOrder[session.targetIndex], previous);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const cancelCardDrag = () => { clearCardTransforms(); dragSession.current = null; setDraggedCard(null); setDropCard(null); };
  const cardOrderControls = (key: CardKey, index: number) => <div className="invitation-detail__order-controls">
    <span className="invitation-detail__drag-grip" aria-hidden="true" title="Arrastra la tarjeta para moverla">⠿</span>
    <button type="button" aria-label={`Mover ${cardTitles[key]} arriba`} title="Mover arriba" disabled={!idle || index === 0} onClick={() => moveCard(key, cardOrder[index - 1])}>↑</button>
    <button type="button" aria-label={`Mover ${cardTitles[key]} abajo`} title="Mover abajo" disabled={!idle || index === cardOrder.length - 1} onClick={() => moveCard(key, cardOrder[index + 1])}>↓</button>
  </div>;

  return <section className="invitation-detail" aria-labelledby="invitation-detail-title">
    <ButtonLink variant="text" to="/invitaciones" className="invitation-detail__back">← Volver a invitaciones</ButtonLink>
    <header className="invitation-detail__header"><div><p className="invitation-detail__eyebrow">Gestión de invitaciones</p><h1 id="invitation-detail-title">Detalles de la invitación</h1><p className="invitation-detail__description">Consulta las respuestas y ajusta la información de esta invitación.</p></div>{invitation && <div className="invitation-detail__header-actions"><InvitationStatusBadge status={invitation.rsvpStatus} />{!invitation.isArchived && <Button variant="secondary" type="button" onClick={() => void copyLink()}>Copiar enlace</Button>}</div>}</header>
    {notice && state.status !== 'not-found' && <p role="status" className="invitation-detail__notice">{notice}</p>}
    {state.status === 'loading' && <p role="status" className="invitation-detail__feedback">Cargando invitación...</p>}
    {(state.status === 'not-found' || state.status === 'error') && <div role="alert" className="invitation-detail__feedback">
      <h2>{state.status === 'not-found' ? (notice || 'Invitación no encontrada') : 'No pudimos cargar la invitación.'}</h2>
      <p>{state.status === 'not-found' ? 'No encontramos una invitación con este ID. Puedes volver al listado para buscarla.' : 'Inténtalo de nuevo o vuelve al listado de invitaciones.'}</p>
      {state.status === 'error' && <Button variant="secondary" type="button" onClick={() => reload()}>Reintentar</Button>}
    </div>}
    {invitation && <>
      <div className="invitation-detail__overview" aria-label="Resumen de la invitación">
        <div><span>Lugares</span><strong>{invitation.maxGuests}</strong><small>Capacidad total</small></div>
        <div><span>Confirmados</span><strong>{confirmedCount}</strong><small>Asistirán</small></div>
        <div><span>Pendientes</span><strong>{pendingCount}</strong><small>Sin respuesta</small></div>
      </div>
      <p className="invitation-detail__reorder-help">Arrastra las tarjetas para cambiar su orden o usa las flechas de cada una.</p>
      <p className="visually-hidden" role="status" aria-live="polite">{orderAnnouncement}</p>
      <div ref={cardList} className="invitation-detail__card-list">
      {cardOrder.map((card, index) => <div key={card} data-card-key={card} className={`invitation-detail__card-slot invitation-detail__card-slot--${index + 1}${draggedCard === card ? ' is-dragging' : ''}${dropCard === card && draggedCard !== card ? ` is-drop-target ${draggedCard && cardOrder.indexOf(draggedCard) < index ? 'is-drop-after' : 'is-drop-before'}` : ''}`} onPointerDown={(event) => startCardDrag(event, card)} onPointerMove={moveCardDrag} onPointerUp={endCardDrag} onPointerCancel={cancelCardDrag}>
      {card === 'people' ? <DetailSection title={`Personas (${invitation.guests.length})`} icon="people" description="Asistencia y lugares de esta invitación" orderControls={cardOrderControls(card, index)} action={<div className="invitation-detail__places">
        <span>{invitation.maxGuests} {invitation.maxGuests === 1 ? 'lugar' : 'lugares'}</span>
        {idle && <><span aria-hidden="true">·</span><TextAction onClick={() => { setNotice(''); setChangingCapacity(true); }}>Ajustar lugares</TextAction></>}
      </div>}>
        {changingCapacity && <InvitationCapacityForm invitation={invitation} onCancel={() => setChangingCapacity(false)} onSaved={(updated) => { setState({ status: 'success', invitation: updated }); setChangingCapacity(false); notify.success('Lugares actualizados'); }} onUnavailable={() => { setChangingCapacity(false); unavailable(); }} onReload={() => { setChangingCapacity(false); reload(); }} />}
        <ol className="invitation-detail__people">
          {invitation.guests.map((guest, index) => {
            const canEdit = guest.name.trim() !== '';
            const canRemove = guest.type === 'known' || guest.type === 'open';
            return <li key={index} className="invitation-detail__person">
              <span className="invitation-detail__person-number">{index + 1}</span>
              <div className="invitation-detail__person-info"><h3>{guest.name.trim() || guest.shortName || 'Acompañante'}</h3><p>{guestLabels[guest.type]}</p>
                {guest.type === 'replacement' && <p>Invitado original: {guest.originalName || 'Nombre no disponible'}</p>}
              </div>
              <span className={`invitation-detail__person-status ${guest.attending === true ? 'is-attending' : guest.attending === false ? 'is-declined' : 'is-pending'}`}>
                {guest.attending === true ? 'Asiste' : guest.attending === false ? 'No asiste' : 'Sin respuesta'}
              </span>
              {idle && (canEdit || canRemove || guest.type === 'replacement') && <div className="invitation-detail__menu-wrap">
                <button type="button" className="invitation-detail__menu-trigger" aria-label={`Acciones para ${guest.name.trim() || guest.shortName || `persona ${index + 1}`}`} aria-expanded={openMenuIndex === index} onClick={() => setOpenMenuIndex(openMenuIndex === index ? null : index)}>⋮</button>
                {openMenuIndex === index && <div className="invitation-detail__menu">
                  {canEdit && <button type="button" onClick={() => { setOpenMenuIndex(null); setNotice(''); setEditingNameIndex(index); }}>Editar nombre</button>}
                  {guest.type === 'replacement' && <button type="button" onClick={() => { setOpenMenuIndex(null); setNotice(''); setRestoringIndex(index); }}>Restaurar invitado original</button>}
                  {canRemove && <button type="button" disabled={invitation.maxGuests <= 1} title={invitation.maxGuests <= 1 ? 'No se puede eliminar el último invitado.' : undefined} onClick={() => { setOpenMenuIndex(null); setNotice(''); setRemovingIndex(index); }}>Eliminar invitado</button>}
                  {canRemove && invitation.maxGuests <= 1 && <p>No se puede eliminar el último invitado.</p>}
                </div>}
              </div>}
              {editingNameIndex === index && <div className="invitation-detail__person-form"><EditInvitationGuestName invitation={invitation} guestIndex={index} onCancel={() => setEditingNameIndex(null)} onSaved={(updated) => { setState({ status: 'success', invitation: updated }); setEditingNameIndex(null); notify.success('Nombre actualizado'); }} onUnavailable={() => { setEditingNameIndex(null); unavailable(); }} onRefresh={(message) => { setEditingNameIndex(null); reload(message); }} /></div>}
              {restoringIndex === index && <div className="invitation-detail__person-form"><RestoreInvitationReplacement invitation={invitation} guestIndex={index} onCancel={() => setRestoringIndex(null)} onRestored={(updated) => { setState({ status: 'success', invitation: updated }); setRestoringIndex(null); notify.success('Invitado original restaurado'); }} onUnavailable={() => { setRestoringIndex(null); unavailable(); }} onRefresh={(message) => { setRestoringIndex(null); reload(message); }} /></div>}
              {removingIndex === index && <div className="invitation-detail__person-form"><RemoveInvitationGuest invitation={invitation} guestIndex={index} onCancel={() => setRemovingIndex(null)} onRemoved={(updated) => { setState({ status: 'success', invitation: updated }); setRemovingIndex(null); notify.success('Invitado eliminado'); }} onUnavailable={() => { setRemovingIndex(null); unavailable(); }} onRefresh={(message) => { setRemovingIndex(null); reload(message); }} /></div>}
            </li>;
          })}
        </ol>
      </DetailSection>
      : card === 'data' ? <DetailSection title="Datos de la invitación" icon="invitation" description="Información que identifica y acompaña esta invitación" orderControls={cardOrderControls(card, index)}>
        <dl className="invitation-detail__data">
          <DetailRow label="Nombre" action={idle && <TextAction onClick={() => { setNotice(''); setEditing('name'); }}>Editar nombre</TextAction>}>{invitation.displayName}</DetailRow>
          <DetailRow label="Código">{invitation.id}</DetailRow>
          <DetailRow label="Mensaje"><span className="whitespace-pre-wrap">{invitation.message || 'Sin mensaje'}</span></DetailRow>
          <DetailRow label="Sustituciones" action={idle && <TextAction onClick={() => { setNotice(''); setEditing('replacements'); }}>Cambiar</TextAction>}>{invitation.replacementsAllowed ? 'Permitidas' : 'No permitidas'}</DetailRow>
        </dl>
        {editing && <InvitationEditForm key={editing} invitation={invitation} field={editing} onCancel={() => setEditing(null)} onSaved={(updated) => { setState({ status: 'success', invitation: updated }); setEditing(null); notify.success('Cambios guardados'); }} onUnavailable={() => { setEditing(null); unavailable(); }} onReload={() => { setEditing(null); reload(); }} />}
      </DetailSection>
      : <DetailSection title="Administración" icon="settings" description="Permisos, estado y actividad reciente" orderControls={cardOrderControls(card, index)}>
        <EditInvitationOverride key={`${invitation.version}-${overrideAction}`} invitation={invitation} action={overrideAction} idle={idle} onSelect={(action) => { setNotice(''); setOverrideAction(action); }} onCancel={() => setOverrideAction(null)} onSaved={(updated) => { setState({ status: 'success', invitation: updated }); setOverrideAction(null); notify.success(updated.editOverrideUntil === null ? 'Permiso revocado' : 'Permiso actualizado'); }} onUnavailable={() => { setOverrideAction(null); unavailable(); }} onRefresh={(message) => { setOverrideAction(null); reload(message); }} />
        <dl className="invitation-detail__data">
          <DetailRow label="Estado"><InvitationStatusBadge status={invitation.isArchived ? 'archived' : 'active'} /></DetailRow>
          {invitation.isArchived && <DetailRow label="Fecha de archivo">{formatDate(invitation.archivedAt)}</DetailRow>}
          <DetailRow label="Última actualización">{formatDate(invitation.updatedAt)}</DetailRow>
        </dl>
        {idle && <div className="invitation-detail__archive"><Button variant="secondary" type="button" className={invitation.isArchived ? '' : 'text-admin-danger'} onClick={() => { setNotice(''); setChangingArchive(true); }}>{invitation.isArchived ? 'Restaurar invitación' : 'Archivar invitación'}</Button></div>}
        {changingArchive && <InvitationArchiveConfirmation invitation={invitation} onCancel={() => setChangingArchive(false)} onSaved={(updated) => { setState({ status: 'success', invitation: updated }); setChangingArchive(false); }} onUnavailable={() => { setChangingArchive(false); unavailable(); }} onRefresh={(message) => { setChangingArchive(false); reload(message); }} />}
      </DetailSection>}
      </div>)}
      </div>
    </>}
  </section>;
}
