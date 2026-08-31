import { useState } from 'react';

export default function AddItem({ onAdd, disabled }: { onAdd: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('');

  function submit() {
    const t = text.trim();
    if (!t || disabled) return;
    onAdd(t);
    setText('');
  }

  return (
    <form
      className="add-bar"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        className="input add-input"
        placeholder="Añadir a la compra…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <button type="submit" className="btn btn-primary add-btn" aria-label="Añadir" disabled={disabled}>
        ➕
      </button>
    </form>
  );
}
