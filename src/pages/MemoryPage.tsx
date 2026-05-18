// =========================================================
// MEMORY PAGE — Create / View / Edit a memory
// =========================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import { MemoryRepository } from '@/services/database/repositories/MemoryRepository';
import { getEmotion, PLUTCHIK_EMOTIONS } from '@/utils/plutchikColors';
import type { Memory, MemoryScope } from '@/types/memory';
import { v4 as uuidv4 } from 'uuid';

export default function MemoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cryptoKey } = useAuthStore();
  const { addMemory, updateMemory: storeUpdate, removeMemory } = useMemoryStore();

  const isNew = id === 'new';

  const [memory, setMemory] = useState<Memory | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<MemoryScope>('private');
  const [memoryDate, setMemoryDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [selectedEmotionId, setSelectedEmotionId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEmotionPicker, setShowEmotionPicker] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNew && id && cryptoKey) {
      MemoryRepository.getById(id, cryptoKey).then(m => {
        if (m) {
          setMemory(m);
          setTitle(m.title);
          setContent(m.content);
          setScope(m.scope);
          setSelectedEmotionId(m.emotion_analysis?.primary_emotion_id ?? null);
          
          const d = new Date(m.created_at);
          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
          setMemoryDate(d.toISOString().slice(0, 16));
        }
      });
    }
  }, [id, isNew, cryptoKey]);

  async function handleSave() {
    if (!cryptoKey) return;
    if (!content.trim() && !title.trim()) {
      setError('Escribe algo para guardar.');
      return;
    }
    setIsSaving(true);
    setError('');

    try {
      if (isNew) {
        const newMemory = await MemoryRepository.create({
          title: title.trim() || 'Sin título',
          content: content.trim(),
          scope,
          created_at: new Date(memoryDate).toISOString(),
          emotion_analysis: selectedEmotionId ? {
            primary_emotion_id: selectedEmotionId,
            scores: [{ emotion_id: selectedEmotionId, score: 1 }],
            analyzed_at: new Date().toISOString(),
            is_manual: true,
          } : null,
          people: [],
          tags: [],
        }, cryptoKey);
        addMemory(newMemory);
        navigate('/brain');
      } else if (memory) {
        await MemoryRepository.update(memory.id, {
          title: title.trim() || 'Sin título',
          content: content.trim(),
          scope,
          created_at: new Date(memoryDate).toISOString(),
          emotion_analysis: selectedEmotionId ? {
            primary_emotion_id: selectedEmotionId,
            scores: [{ emotion_id: selectedEmotionId, score: 1 }],
            analyzed_at: new Date().toISOString(),
            is_manual: true,
          } : memory.emotion_analysis,
        }, cryptoKey);
        storeUpdate(memory.id, {
          title: title.trim(),
          content: content.trim(),
          scope,
          created_at: new Date(memoryDate).toISOString(),
        });
        setIsEditing(false);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!memory) return;
    if (!confirm('¿Eliminar esta memoria? Esta acción no se puede deshacer.')) return;
    setIsDeleting(true);
    try {
      await MemoryRepository.delete(memory.id);
      removeMemory(memory.id);
      navigate('/brain');
    } catch (err) {
      setError(String(err));
      setIsDeleting(false);
    }
  }

  const selectedEmotion = getEmotion(selectedEmotionId);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg-base)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'rgba(9,9,9,0.95)',
          backdropFilter: 'blur(20px)',
          position: 'sticky', top: 0, zIndex: 10,
        }}
      >
        <button
          id="btn-back"
          onClick={() => navigate('/brain')}
          style={{
            background: 'none', border: '1px solid var(--color-border-normal)',
            borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
            color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)',
            fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          ← Volver al cerebro
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Emotion badge */}
          {selectedEmotion && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 8,
              background: `${selectedEmotion.color}18`,
              border: `1px solid ${selectedEmotion.color}40`,
            }}>
              <div className="emotion-dot" style={{ backgroundColor: selectedEmotion.color }} />
              <span style={{ fontSize: 12, color: selectedEmotion.color, fontWeight: 500 }}>
                {selectedEmotion.name}
              </span>
            </div>
          )}

          {!isNew && !isEditing && (
            <>
              <button
                id="btn-edit-memory"
                onClick={() => setIsEditing(true)}
                style={actionBtnStyle}
              >
                Editar
              </button>
              <button
                id="btn-delete-memory"
                onClick={handleDelete}
                disabled={isDeleting}
                style={{ ...actionBtnStyle, color: '#F0A19D', borderColor: 'rgba(240,161,157,0.3)' }}
              >
                {isDeleting ? '...' : 'Eliminar'}
              </button>
            </>
          )}

          {(isNew || isEditing) && (
            <>
              {!isNew && (
                <button
                  id="btn-cancel-edit"
                  onClick={() => setIsEditing(false)}
                  style={actionBtnStyle}
                >
                  Cancelar
                </button>
              )}
              <motion.button
                id="btn-save-memory"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  ...actionBtnStyle,
                  background: 'linear-gradient(135deg, #00d4bf, #0386ac)',
                  border: 'none', color: '#fff', fontWeight: 600,
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </motion.button>
            </>
          )}
        </div>
      </motion.header>

      {/* Body */}
      <div style={{ flex: 1, maxWidth: 740, width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Title */}
          {isEditing || isNew ? (
            <input
              id="memory-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título (opcional)"
              style={{
                width: '100%', background: 'none', border: 'none',
                fontSize: 28, fontWeight: 600, color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)', outline: 'none',
                letterSpacing: '-0.02em', marginBottom: 24,
                borderBottom: '1px solid var(--color-border-subtle)',
                paddingBottom: 16,
              }}
            />
          ) : (
            <h1 style={{ fontSize: 28, marginBottom: 24, paddingBottom: 16,
                         borderBottom: '1px solid var(--color-border-subtle)' }}>
              {title || 'Sin título'}
            </h1>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            {/* Scope selector */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['private', 'public', 'restricted'] as MemoryScope[]).map(s => (
                <button
                  key={s}
                  id={`scope-${s}`}
                  onClick={() => (isEditing || isNew) && setScope(s)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12,
                    fontFamily: 'var(--font-sans)', cursor: (isEditing || isNew) ? 'pointer' : 'default',
                    background: scope === s ? 'rgba(0,212,191,0.12)' : 'transparent',
                    border: scope === s ? '1px solid rgba(0,212,191,0.4)' : '1px solid var(--color-border-subtle)',
                    color: scope === s ? '#00d4bf' : 'var(--color-text-tertiary)',
                    fontWeight: scope === s ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {s === 'private' ? '🔒 Privada' : s === 'public' ? '🌐 Pública' : '👥 Restringida'}
                </button>
              ))}
            </div>

            {/* Emotion picker */}
            <div style={{ position: 'relative' }}>
              <button
                id="btn-emotion-picker"
                onClick={() => (isEditing || isNew) && setShowEmotionPicker(v => !v)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12,
                  fontFamily: 'var(--font-sans)', cursor: (isEditing || isNew) ? 'pointer' : 'default',
                  background: 'transparent', border: '1px solid var(--color-border-subtle)',
                  color: selectedEmotionId ? selectedEmotion?.color ?? 'var(--color-text-tertiary)' : 'var(--color-text-tertiary)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {selectedEmotion ? (
                  <>
                    <div className="emotion-dot" style={{ backgroundColor: selectedEmotion.color, width: 8, height: 8 }} />
                    {selectedEmotion.name}
                  </>
                ) : '◐ Emoción'}
              </button>

              {showEmotionPicker && (
                <EmotionPicker
                  selected={selectedEmotionId}
                  onSelect={id => { setSelectedEmotionId(id); setShowEmotionPicker(false); }}
                  onClose={() => setShowEmotionPicker(false)}
                />
              )}
            </div>
          </div>

          {/* Content */}
          {isEditing || isNew ? (
            <textarea
              id="memory-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Escribe tu memoria... ¿Qué sucedió? ¿Cómo te sentiste? ¿Con quién estabas?"
              rows={14}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--color-border-subtle)', borderRadius: 12,
                padding: '20px', color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-sans)', fontSize: 16, lineHeight: 1.75,
                outline: 'none', resize: 'vertical',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(0,212,191,0.4)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border-subtle)'}
            />
          ) : (
            <div style={{
              fontSize: 16, lineHeight: 1.75,
              color: 'var(--color-text-secondary)',
              whiteSpace: 'pre-wrap',
            }}>
              {content || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Sin contenido.</span>}
            </div>
          )}

          {/* Date */}
          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
              {isNew ? 'Fecha de la memoria:' : 'Creada el'}
            </span>
            {isEditing || isNew ? (
              <input
                id="memory-date"
                type="datetime-local"
                value={memoryDate}
                onChange={e => setMemoryDate(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border-subtle)',
                  borderRadius: 6, padding: '4px 8px', color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none',
                }}
              />
            ) : (
              <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                {memory ? new Date(memory.created_at).toLocaleDateString('es', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                }) : ''}
              </span>
            )}
          </div>

          {/* Error */}
          {error && (
            <p style={{ color: '#F0A19D', fontSize: 13, marginTop: 16 }}>{error}</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ---- Emotion Picker ----
function EmotionPicker({ selected, onSelect, onClose }: {
  selected: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 8,
          zIndex: 50, width: 320, maxHeight: 380, overflowY: 'auto',
          background: 'var(--color-bg-overlay)',
          border: '1px solid var(--color-border-normal)',
          borderRadius: 12, padding: 12,
          display: 'flex', flexWrap: 'wrap', gap: 6,
        }}
      >
        {PLUTCHIK_EMOTIONS.map(e => (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
              background: selected === e.id ? `${e.color}25` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${selected === e.id ? e.color + '60' : 'transparent'}`,
              color: e.color, fontWeight: selected === e.id ? 600 : 400,
              transition: 'all 0.1s',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.color, display: 'inline-block' }} />
            {e.name}
          </button>
        ))}
      </motion.div>
    </>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8, fontSize: 13,
  fontFamily: 'var(--font-sans)', cursor: 'pointer',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--color-border-normal)',
  color: 'var(--color-text-secondary)',
  transition: 'all 0.15s',
};
