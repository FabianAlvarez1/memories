// =========================================================
// BRAIN PAGE — Main 3D neuron graph visualization
// Chunk-based temporal navigation
// =========================================================

import { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import { useMemoryStore, CHUNK_SIZE } from '@/store/useMemoryStore';

// Lazy load the heavy 3D graph
const BrainGraph = lazy(() => import('@/components/brain/BrainGraph'));

export default function BrainPage() {
  const navigate = useNavigate();
  const { user, cryptoKey, logout } = useAuthStore();
  const { initialize, visibleMemories, isLoading, selectedMemoryId, selectMemory,
    viewDate, navigateChunk, navigateDay, oldestMemoryDate, setViewDate,
    jumpToNextMemory, jumpToPrevMemory, memoryIndex, loadingChunks,
    ensureChunksLoaded } = useMemoryStore();
  const hasLoaded = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showChunkBounds, setShowChunkBounds] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Initialize — load lightweight index + initial chunks
  useEffect(() => {
    if (cryptoKey && !hasLoaded.current) {
      hasLoaded.current = true;
      initialize(cryptoKey);
    }
  }, [cryptoKey, initialize]);

  // When viewDate changes, ensure chunks are loaded around it
  useEffect(() => {
    if (cryptoKey && hasLoaded.current) {
      ensureChunksLoaded(cryptoKey);
    }
  }, [viewDate, cryptoKey, ensureChunksLoaded]);

  useEffect(() => {
    if (selectedMemoryId) {
      navigate(`/memory/${selectedMemoryId}`);
      selectMemory(null);
    }
  }, [selectedMemoryId, navigate, selectMemory]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Temporal navigation: Shift+Scroll for chunks, plain arrows for days
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        navigateChunk(e.deltaY > 0 ? -1 : 1);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && e.shiftKey) { navigateChunk(-1); e.preventDefault(); }
      if (e.key === 'ArrowUp' && e.shiftKey) { navigateChunk(1); e.preventDefault(); }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKey);
    };
  }, [navigateChunk]);

  // Computed temporal info
  const vd = new Date(viewDate);
  const windowStart = new Date(vd);
  windowStart.setDate(windowStart.getDate() - CHUNK_SIZE);
  const isToday = new Date().toDateString() === vd.toDateString();
  const canGoDeeper = oldestMemoryDate ? new Date(oldestMemoryDate) < windowStart : false;

  // Jump buttons use the lightweight index (all memories, not just visible)
  const hasNewerMemory = memoryIndex.some(m => new Date(m.created_at) > vd);
  const hasOlderMemory = memoryIndex.some(m => new Date(m.created_at) < windowStart);

  // Search logic — uses memoryIndex (lightweight, all titles)
  const searchResults = searchQuery.trim().length > 0
    ? memoryIndex.filter(m => {
      const q = searchQuery.toLowerCase();
      const titleMatch = m.title.toLowerCase().includes(q);
      const dateStr = new Date(m.created_at).toLocaleDateString('es', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).toLowerCase();
      const dateMatch = dateStr.includes(q);
      return titleMatch || dateMatch;
    }).slice(0, 8) // Max 8 results
    : [];

  function handleSearchSelect(memoryId: string, memoryDate: string) {
    // Navigate temporal view to the memory's date
    setViewDate(memoryDate);
    setSearchQuery('');
    setIsSearchOpen(false);
    // Also select the memory to fly the camera to it
    selectMemory(memoryId);
  }

  // Close search on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Is a chunk loading right now?
  const isChunkLoading = loadingChunks.size > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg-base)', overflow: 'hidden' }}>

      {/* Top bar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(to bottom, rgba(9,9,9,0.9) 0%, transparent 100%)',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}
            className="gradient-brand-text">
            Memories
          </span>
          <span style={{
            fontSize: 11, color: 'var(--color-text-tertiary)',
            background: 'rgba(255,255,255,0.06)', borderRadius: 4,
            padding: '2px 7px', border: '1px solid var(--color-border-subtle)',
          }}>
            {memoryIndex.length} {memoryIndex.length === 1 ? 'memoria' : 'memorias'}
          </span>
          {/* Chunk loading indicator */}
          {isChunkLoading && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                fontSize: 10, color: '#00d4bf',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span className="animate-spin-slow" style={{
                width: 10, height: 10, border: '1.5px solid rgba(0,212,191,0.2)',
                borderTopColor: '#00d4bf', borderRadius: '50%', display: 'inline-block',
              }} />
              cargando...
            </motion.span>
          )}
        </div>

        {/* Search Bar */}
        <div ref={searchRef} style={{ position: 'relative', flex: '0 1 380px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${isSearchOpen ? 'rgba(0,212,191,0.35)' : 'var(--color-border-subtle)'}`,
            borderRadius: 10, padding: '7px 14px',
            transition: 'border-color 0.2s, background 0.2s',
          }}>
            <span style={{ fontSize: 14, color: 'var(--color-text-tertiary)', lineHeight: 1 }}>⌕</span>
            <input
              id="brain-search"
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Buscar por título o fecha..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)',
                fontSize: 13, letterSpacing: '-0.01em',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-tertiary)', fontSize: 14, padding: 0, lineHeight: 1,
                }}
              >✕</button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
                background: 'rgba(12,12,12,0.96)', backdropFilter: 'blur(20px)',
                border: '1px solid var(--color-border-normal)', borderRadius: 12,
                padding: 6, maxHeight: 340, overflowY: 'auto',
                boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
              }}
            >
              {searchResults.map(m => {
                const d = new Date(m.created_at);
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSearchSelect(m.id, m.created_at)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.1s',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Emotion dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: m.color || 'var(--color-text-tertiary)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {m.title || 'Sin título'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                        {d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    {/* Arrow indicator */}
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>→</span>
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* No results state */}
          {isSearchOpen && searchQuery.trim().length > 0 && searchResults.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
                background: 'rgba(12,12,12,0.96)', backdropFilter: 'blur(20px)',
                border: '1px solid var(--color-border-normal)', borderRadius: 12,
                padding: '20px 16px', textAlign: 'center',
                boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                No se encontraron memorias
              </div>
            </motion.div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* New memory button */}
          <motion.button
            id="btn-new-memory"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/memory/new')}
            style={{
              background: 'linear-gradient(135deg, #00d4bf 0%, #0386ac 100%)',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              color: '#fff', fontFamily: 'var(--font-sans)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Nueva memoria
          </motion.button>

          {/* User menu */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: 'rgba(255,255,255,0.03)',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00d4bf, #0386ac)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>
              {user?.username?.[0]?.toUpperCase() ?? 'M'}
            </div>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {user?.username}
            </span>
            <button
              id="btn-logout"
              onClick={handleLogout}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-tertiary)', fontSize: 12,
                padding: '2px 4px', borderRadius: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#F0A19D'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--color-text-tertiary)'}
              title="Cerrar sesión"
            >
              salir
            </button>
          </div>
        </div>
      </motion.header>

      {/* 3D Brain Graph */}
      <Suspense fallback={<BrainLoading />}>
        <BrainGraph showChunkBounds={showChunkBounds} />
      </Suspense>

      {/* Temporal Navigation Panel */}
      {memoryIndex.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          style={{
            position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            background: 'rgba(9,9,9,0.8)', backdropFilter: 'blur(14px)',
            border: '1px solid var(--color-border-subtle)', borderRadius: 14,
            padding: '14px 10px', minWidth: 100,
          }}
        >
          {/* Jump to next memory (skip) */}
          <button
            id="btn-time-jump-newer"
            onClick={jumpToNextMemory}
            disabled={!hasNewerMemory}
            style={{
              ...timeBtnStyle,
              opacity: hasNewerMemory ? 1 : 0.15,
              cursor: hasNewerMemory ? 'pointer' : 'default',
              fontSize: 10,
            }}
            title="Saltar a siguiente memoria"
          >⏫</button>

          {/* Go newer (up) — 1 chunk (7 days) */}
          <button
            id="btn-time-newer"
            onClick={() => navigateChunk(1)}
            disabled={isToday}
            style={{
              ...timeBtnStyle,
              opacity: isToday ? 0.25 : 1,
              cursor: isToday ? 'default' : 'pointer',
            }}
            title={`+${CHUNK_SIZE} días`}
          >▲</button>

          {/* Date range display */}
          <div style={{ textAlign: 'center', padding: '6px 0', lineHeight: 1.5 }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.03em' }}>
              {windowStart.toLocaleDateString('es', { day: 'numeric', month: 'short' })}
            </div>
            <div style={{ fontSize: 9, color: 'var(--color-border-normal)', margin: '1px 0' }}>—</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
              {vd.toLocaleDateString('es', { day: 'numeric', month: 'short' })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {vd.getFullYear()}
            </div>
            {isToday && (
              <span style={{
                fontSize: 9, color: '#00d4bf', fontWeight: 700,
                background: 'rgba(0,212,191,0.1)', borderRadius: 4,
                padding: '1px 6px', marginTop: 3, display: 'inline-block',
              }}>HOY</span>
            )}
          </div>

          {/* Go older (down) — 1 chunk (7 days) */}
          <button
            id="btn-time-older"
            onClick={() => navigateChunk(-1)}
            disabled={!canGoDeeper}
            style={{
              ...timeBtnStyle,
              opacity: canGoDeeper ? 1 : 0.25,
              cursor: canGoDeeper ? 'pointer' : 'default',
            }}
            title={`-${CHUNK_SIZE} días`}
          >▼</button>

          {/* Jump to prev memory (skip) */}
          <button
            id="btn-time-jump-older"
            onClick={jumpToPrevMemory}
            disabled={!hasOlderMemory}
            style={{
              ...timeBtnStyle,
              opacity: hasOlderMemory ? 1 : 0.15,
              cursor: hasOlderMemory ? 'pointer' : 'default',
              fontSize: 10,
            }}
            title="Saltar a memoria anterior"
          >⏬</button>

          {/* Chunk info */}
          <div style={{
            fontSize: 8, color: 'var(--color-text-tertiary)', marginTop: 2,
            opacity: 0.6, textAlign: 'center', lineHeight: 1.4,
          }}>
            <div>Shift+Scroll</div>
            <div style={{ marginTop: 2, color: 'rgba(0,212,191,0.5)' }}>
              {visibleMemories.length} visible{visibleMemories.length !== 1 ? 's' : ''}
            </div>
          </div>
        </motion.div>
      )}

      {/* Chunk bounds toggle — bottom left */}
      {memoryIndex.length > 0 && (
        <motion.button
          id="btn-toggle-chunk-bounds"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          onClick={() => setShowChunkBounds(v => !v)}
          title={showChunkBounds ? 'Ocultar límites de chunks' : 'Mostrar límites de chunks'}
          style={{
            position: 'absolute', bottom: 20, left: 20, zIndex: 10,
            width: 34, height: 34, borderRadius: 8,
            background: showChunkBounds ? 'rgba(0,212,191,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${showChunkBounds ? 'rgba(0,212,191,0.4)' : 'var(--color-border-subtle)'}`,
            color: showChunkBounds ? '#00d4bf' : 'var(--color-text-tertiary)',
            fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            fontFamily: 'var(--font-sans)',
          }}
        >
          ▦
        </motion.button>
      )}

      {/* Bottom hint */}
      {memoryIndex.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            fontSize: 12, color: 'var(--color-text-tertiary)',
            pointerEvents: 'none', textAlign: 'center',
          }}
        >
          Arrastra para explorar · Haz click en una neurona para ver la memoria
        </motion.div>
      )}

      {/* Empty state */}
      {!isLoading && memoryIndex.length === 0 && (
        <EmptyBrainState onNew={() => navigate('/memory/new')} />
      )}
    </div>
  );
}

function BrainLoading() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16,
    }}>
      <div className="animate-spin-slow" style={{
        width: 48, height: 48, border: '2px solid rgba(0,212,191,0.15)',
        borderTopColor: '#00d4bf', borderRadius: '50%',
      }} />
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
        Cargando el cerebro...
      </p>
    </div>
  );
}

function EmptyBrainState({ onNew }: { onNew: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: 24, textAlign: 'center',
      }}
    >
      {/* Pulsing neuron placeholder */}
      <div className="animate-pulse-brand" style={{
        width: 80, height: 80, borderRadius: '50%',
        border: '2px solid rgba(0,212,191,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(0,212,191,0.4)',
        }} />
      </div>

      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Tu cerebro está vacío
        </h2>
        <p style={{ color: 'var(--color-text-tertiary)', fontSize: 15, maxWidth: 320 }}>
          Comienza guardando tu primera memoria. Cada una será una neurona en tu espacio personal.
        </p>
      </div>

      <motion.button
        id="btn-first-memory"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNew}
        style={{
          background: 'linear-gradient(135deg, #00d4bf 0%, #0386ac 100%)',
          border: 'none', borderRadius: 12, padding: '14px 28px',
          color: '#fff', fontFamily: 'var(--font-sans)',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ✦ Crear primera memoria
      </motion.button>
    </motion.div>
  );
}

const timeBtnStyle: React.CSSProperties = {
  width: 32, height: 28, borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text-secondary)',
  fontSize: 12, fontFamily: 'var(--font-sans)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s',
};
