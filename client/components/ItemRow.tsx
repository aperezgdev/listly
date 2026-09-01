import { useRef, useState } from 'react';
import type { Item } from '../../shared/types';

interface Props {
  item: Item;
  disabled?: boolean;
  onUpdate: (id: number, patch: Partial<Item>) => void;
  onDelete: (id: number) => void;
}

const DELETE_WIDTH = 88;

export default function ItemRow({ item, onUpdate, onDelete, disabled = false }: Props) {
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState('');
  const [editingQty, setEditingQty] = useState(false);
  const [qtyDraft, setQtyDraft] = useState('');
  const [dragX, setDragX] = useState(0);
  const [open, setOpen] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const horizontal = useRef(false);

  function close() {
    setOpen(false);
    setDragX(0);
  }

  function startEditText() {
    if (disabled) return;
    if (open) {
      close();
      return;
    }
    setTextDraft(item.text);
    setEditingText(true);
  }

  function commitText() {
    const t = textDraft.trim();
    if (t && t !== item.text) onUpdate(item.id, { text: t });
    setEditingText(false);
  }

  function startEditPrice() {
    if (disabled) return;
    if (open) {
      close();
      return;
    }
    setPriceDraft(item.price == null ? '' : String(item.price));
    setEditingPrice(true);
  }

  function commitPrice() {
    const raw = priceDraft.trim().replace(',', '.');
    const value = raw === '' ? null : Number(raw);
    if (raw !== '' && Number.isNaN(value)) {
      setEditingPrice(false);
      return;
    }
    onUpdate(item.id, { price: value });
    setEditingPrice(false);
  }

  function startEditQty() {
    if (disabled) return;
    if (open) {
      close();
      return;
    }
    setQtyDraft(String(item.quantity));
    setEditingQty(true);
  }

  function commitQty() {
    const raw = qtyDraft.trim();
    const value = Number(raw);
    if (raw === '' || Number.isNaN(value)) {
      setEditingQty(false);
      return;
    }
    const quantity = Math.max(1, Math.min(999, Math.round(value)));
    onUpdate(item.id, { quantity });
    setEditingQty(false);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    horizontal.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!horizontal.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      horizontal.current = true;
    }
    if (horizontal.current) {
      const base = open ? -DELETE_WIDTH : 0;
      setDragX(Math.max(-DELETE_WIDTH, Math.min(0, base + dx)));
    }
  }

  function onTouchEnd() {
    if (horizontal.current) {
      if (dragX < -DELETE_WIDTH / 2) {
        setOpen(true);
        setDragX(-DELETE_WIDTH);
      } else {
        close();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    horizontal.current = false;
  }

  return (
    <li
      className={`item-row${open ? ' open' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button className="item-delete" onClick={() => onDelete(item.id)} disabled={disabled}>
        Borrar
      </button>

      <div className="item-content" style={{ transform: `translateX(${dragX}px)` }}>
        <label className="check">
          <input
            type="checkbox"
            checked={item.checked}
            disabled={disabled}
            onChange={(e) => onUpdate(item.id, { checked: e.target.checked })}
          />
          <span className="checkmark" />
        </label>

        <div className="item-body">
          {editingText ? (
            <input
              className="input item-edit-text"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitText();
                if (e.key === 'Escape') setEditingText(false);
              }}
              autoFocus
            />
          ) : (
            <button className={`item-text${item.checked ? ' checked' : ''}`} onClick={startEditText} disabled={disabled}>
              {item.text}
            </button>
          )}

          <div className="item-meta">
            <div className="qty">
              <button
                className="qty-btn"
                disabled={disabled || item.quantity <= 1}
                onClick={() => onUpdate(item.id, { quantity: item.quantity - 1 })}
                aria-label="Menos"
              >
                −
              </button>
              {editingQty ? (
                <input
                  className="qty-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={qtyDraft}
                  onChange={(e) => setQtyDraft(e.target.value)}
                  onBlur={commitQty}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitQty();
                    if (e.key === 'Escape') setEditingQty(false);
                  }}
                  autoFocus
                />
              ) : (
                <button
                  className="qty-value"
                  onClick={startEditQty}
                  disabled={disabled}
                  aria-label="Editar cantidad"
                  title="Editar cantidad"
                >
                  {item.quantity}
                </button>
              )}
              <button
                className="qty-btn"
                disabled={disabled}
                onClick={() => onUpdate(item.id, { quantity: item.quantity + 1 })}
                aria-label="Más"
              >
                +
              </button>
            </div>

            {editingPrice ? (
              <input
                className="input price-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0,00"
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitPrice();
                  if (e.key === 'Escape') setEditingPrice(false);
                }}
                autoFocus
              />
            ) : (
              <button className="price" onClick={startEditPrice} disabled={disabled}>
                {item.price == null ? '+ precio' : `${item.price.toFixed(2)} €`}
              </button>
            )}

            {item.createdBy && <span className="who">· {item.createdBy}</span>}
          </div>
        </div>

        <button className="row-trash" onClick={() => onDelete(item.id)} aria-label="Borrar" disabled={disabled}>
          🗑
        </button>
      </div>
    </li>
  );
}
