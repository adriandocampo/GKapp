import { useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import CellEditPopover from './CellEditPopover';
import { MICROCICLO_DIMENSIONS, FISICO_TIPOS, DIAS_LETRA } from '../data/microcicloItems';

const FONT = "Arial, Helvetica, sans-serif";
const BD = '#222';
const BD_LIGHT = '#888';
const BD_DASH = '#666';

const REST_YELLOW = '#ffe566';
const MATCH_BLUE = '#b8e0f0';
const MATCH_BOX = '#a8d8f0';

const C_DIM = '#7cb342';
const C_SIT = '#43a047';
const C_CAT = '#1b5e20';
const C_FIS = '#e53935';

const rowLabelStyle = {
  background: '#e8e8e8',
  fontWeight: 'bold',
  color: '#555',
  textAlign: 'center',
  padding: '6px 4px',
  fontSize: 10,
  minWidth: 78,
  borderRight: `1px solid ${BD}`,
  borderBottom: `1px solid ${BD}`,
  writingMode: 'horizontal-tb',
};

function formatDDMMYY(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatRange(start, end) {
  if (!start || !end) return '';
  return `${formatDDMMYY(start)} - ${formatDDMMYY(end)}`;
}

function Pill({ text, color, onRemove, readonly }) {
  if (!text) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        background: color,
        color: '#fff',
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: 0.2,
        padding: '3px 6px',
        borderRadius: 4,
        margin: '1px 0',
        lineHeight: 1.25,
        textAlign: 'center',
        maxWidth: '100%',
        wordBreak: 'break-word',
      }}
    >
      {text}
      {!readonly && onRemove && (
        <span
          onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ cursor: 'pointer', opacity: 0.85, display: 'inline-flex' }}
        >
          <X size={9} />
        </span>
      )}
    </span>
  );
}

function InlineInput({ value, onChange, placeholder, style, readonly }) {
  if (readonly) return <span style={{ fontSize: 10, ...style }}>{value || ''}</span>;
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ fontSize: 10, border: 'none', background: 'transparent', width: '100%', outline: 'none', padding: 0, ...style }}
    />
  );
}

function dayColBg(day) {
  if (day.isRestDay) return { background: REST_YELLOW };
  if (day.match?.hasMatch) return { background: MATCH_BLUE };
  return { background: '#fff' };
}

function DraggableItem({ label, type, dimensionId, color }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={e => e.dataTransfer.setData('application/x-microciclo-item', JSON.stringify({ type, label, dimensionId }))}
      style={{
        display: 'block', width: '100%', textAlign: 'left', border: 'none', borderRadius: 5,
        background: color, color: '#fff', padding: '6px 8px', marginBottom: 4, fontSize: 9,
        fontWeight: 700, cursor: 'grab', lineHeight: 1.2,
      }}
    >
      {label}
    </button>
  );
}

function ItemPalette() {
  return (
    <aside style={{ width: 220, flexShrink: 0, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#f7f7f7', border: '1px solid #ccc', borderRadius: 8, padding: 10 }}>
      <div style={{ color: '#168b1c', fontWeight: 800, fontSize: 14, textAlign: 'center', marginBottom: 10 }}>ÍTEMS A TRABAJAR</div>
      {MICROCICLO_DIMENSIONS.map(dimension => {
        const color = dimension.id === 'fisico' ? C_FIS : dimension.id === 'defensa-porteria' ? C_DIM : dimension.id === 'defensa-espacio' ? C_SIT : C_CAT;
        return (
          <section key={dimension.id} style={{ marginBottom: 12 }}>
            <div style={{ color, fontWeight: 800, fontSize: 10, marginBottom: 5 }}>{dimension.name}</div>
            <DraggableItem label={dimension.name} type="dimension" dimensionId={dimension.id} color={color} />
            {dimension.id !== 'fisico' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#555', margin: '4px 0' }}>SITUACIÓN</div>
                  {dimension.situations.map(item => <DraggableItem key={item} label={item} type="situacion" dimensionId={dimension.id} color={C_SIT} />)}
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#555', margin: '4px 0' }}>CATEGORÍA</div>
                  {dimension.categories.map(item => <DraggableItem key={item} label={item} type="categoria" dimensionId={dimension.id} color={C_CAT} />)}
                </div>
              </div>
            )}
            {dimension.id === 'fisico' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#555', margin: '4px 0' }}>SITUACIÓN</div>
                  {FISICO_TIPOS.filter(item => dimension.situations.includes(item)).map(item => <DraggableItem key={item} label={item} type="fisicoTipo" color={C_FIS} />)}
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#555', margin: '4px 0' }}>CATEGORÍA</div>
                  {dimension.categories.map(item => <DraggableItem key={item} label={item} type="fisicoTipo" color={C_FIS} />)}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}

export default function MicrocicloTemplate({
  name, seasonName, rival, days, dateStart, dateEnd,
  proposito, tipologiaTareas, observacionesPre, observacionesPost,
  teamName, teamCrest, secondaryImage, numSesiones, seasonId, seasons,
  corporateColor = '#2e7d32',
  readOnly,
  onChangeName, onChangeSeason, onChangeRival, onDatesChange,
  onUpdateDay, onUpdateDayGrid, onUpdateDayFisico, onUpdateDayMatch,
  onCycleDay, onAddFisicoField, onRemoveFisicoField, onUpdateFisicoCustom,
  onChangeProposito, onChangeTipologia, onChangePre, onChangePost,
  onDropItem,
}) {
  const cellRefs = useRef({});
  const [editing, setEditing] = useState(null);
  const CC = corporateColor;
  const ed = editing;

  function openCell(dayIndex, rowType, e) {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    cellRefs.current[`${dayIndex}-${rowType}`] = rect;
    setEditing({ dayIndex, rowType });
  }

  function closeCell() { setEditing(null); }

  function dropItem(dayIndex, rowType, e) {
    e.preventDefault();
    if (readOnly || !onDropItem || days[dayIndex]?.isRestDay) return;
    try {
      const item = JSON.parse(e.dataTransfer.getData('application/x-microciclo-item'));
      if (item?.type === rowType) onDropItem(dayIndex, rowType, item);
    } catch {
      // Ignore drops from unrelated sources.
    }
  }

  function getSituations(dimension) {
    const dimensions = Array.isArray(dimension) ? dimension : (dimension ? [dimension] : []);
    return [...new Set(MICROCICLO_DIMENSIONS.filter(d => dimensions.includes(d.name)).flatMap(d => d.situations))];
  }

  function getCategories(dimension) {
    const dimensions = Array.isArray(dimension) ? dimension : (dimension ? [dimension] : []);
    return [...new Set(MICROCICLO_DIMENSIONS.filter(d => dimensions.includes(d.name)).flatMap(d => d.categories))];
  }

  function cellBorder(i) {
    return {
      borderBottom: `1px solid ${BD}`,
      borderLeft: i === 0 ? `1px solid ${BD}` : `1px dashed ${BD_DASH}`,
      padding: '4px 3px',
      verticalAlign: 'top',
      fontSize: 10,
    };
  }

  return (
    <div style={{ display: readOnly ? 'block' : 'flex', alignItems: 'flex-start', gap: 12 }}>
      {!readOnly && <ItemPalette />}
      <div style={{ flex: 1, minWidth: 0, fontFamily: FONT, color: '#000', background: '#fff', border: `4px solid ${CC}`, borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
      {/* Header */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: 56, padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
              {teamCrest ? <img src={teamCrest} alt="" style={{ maxWidth: 42, maxHeight: 42 }} /> : null}
            </td>
            <td style={{ textAlign: 'center', padding: '8px 4px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: CC, letterSpacing: 0.3 }}>{teamName || 'Club'}</div>
            </td>
            <td style={{ width: 56, padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
              {secondaryImage ? <img src={secondaryImage} alt="" style={{ maxWidth: 42, maxHeight: 42 }} /> : null}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Info bar + day letters (como imagen) */}
      <div style={{ display: 'flex', borderTop: `2px solid ${CC}`, borderBottom: `1px solid ${BD}` }}>
        <table style={{ flex: 1, borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px', borderRight: `1px solid ${BD}`, fontSize: 11 }}>
                Temporada <b style={{ color: CC }}>{readOnly ? seasonName : (
                  <select value={seasonId || ''} onChange={e => onChangeSeason(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 700, color: CC, outline: 'none', fontSize: 11 }}>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}</b>
              </td>
              <td style={{ padding: '4px 8px', borderRight: `1px solid ${BD}`, fontSize: 11 }}>
                N° microciclo: <b style={{ color: CC }}>{readOnly ? name : (
                  <input value={name} onChange={e => onChangeName(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 700, color: CC, width: 40, outline: 'none', fontSize: 11 }} />
                )}</b>
              </td>
              <td style={{ padding: '4px 8px', borderRight: `1px solid ${BD}`, fontSize: 11 }}>
                N° sesiones: <b style={{ color: CC }}>{numSesiones}</b>
              </td>
              <td style={{ padding: '4px 8px', fontSize: 11 }}>
                Rival: <b>{readOnly ? rival : (
                  <input value={rival} onChange={e => onChangeRival(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 700, width: 90, outline: 'none', fontSize: 11 }} />
                )}</b>
              </td>
            </tr>
          </tbody>
        </table>
        <table style={{ borderCollapse: 'collapse', borderLeft: `1px solid ${BD}` }}>
          <tbody>
            <tr>
              {days.map((day, i) => {
                const isRest = day.isRestDay;
                const isMatch = day.match?.hasMatch;
                let bg = '#fff';
                if (isRest) bg = REST_YELLOW;
                else if (isMatch) bg = MATCH_BLUE;
                return (
                  <td
                    key={day.date}
                    onClick={e => {
                      if (readOnly) return;
                      const willBeMatch = !day.isRestDay && !day.match?.hasMatch;
                      if (willBeMatch) {
                        cellRefs.current[`${i}-match`] = e.currentTarget.getBoundingClientRect();
                      }
                      onCycleDay(i);
                      if (willBeMatch) setEditing({ dayIndex: i, rowType: 'match' });
                    }}
                    title={isRest ? 'Descanso → Partido' : isMatch ? 'Partido → Entrenamiento' : 'Entrenamiento → Descanso'}
                    style={{
                      width: 28, textAlign: 'center', fontWeight: 700, fontSize: 11,
                      borderLeft: i === 0 ? 'none' : `1px solid ${BD}`,
                      borderBottom: `1px solid ${BD}`,
                      padding: '2px 4px',
                      background: bg,
                      cursor: readOnly ? 'default' : 'pointer',
                      color: isRest || isMatch ? '#222' : '#111',
                    }}
                  >
                    {DIAS_LETRA[i % 7]}
                  </td>
                );
              })}
            </tr>
            <tr>
              {days.map((day, i) => {
                const isRest = day.isRestDay;
                const isMatch = day.match?.hasMatch;
                let bg = '#fff';
                if (isRest) bg = REST_YELLOW;
                else if (isMatch) bg = MATCH_BLUE;
                return (
                  <td
                    key={day.date}
                    onClick={e => {
                      if (readOnly) return;
                      const willBeMatch = !day.isRestDay && !day.match?.hasMatch;
                      if (willBeMatch) {
                        cellRefs.current[`${i}-match`] = e.currentTarget.getBoundingClientRect();
                      }
                      onCycleDay(i);
                      if (willBeMatch) setEditing({ dayIndex: i, rowType: 'match' });
                    }}
                    style={{
                      width: 28, textAlign: 'center', fontSize: 11,
                      borderLeft: i === 0 ? 'none' : `1px solid ${BD}`,
                      padding: '2px 4px',
                      background: bg,
                      cursor: readOnly ? 'default' : 'pointer',
                      fontWeight: isRest ? 700 : 400,
                    }}
                  >
                    {isRest ? '/' : new Date(day.date).getDate()}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Focos + Objetivos */}
      <div style={{ display: 'flex', gap: 10, padding: '8px 6px', borderBottom: `1px solid ${BD_LIGHT}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: CC, padding: '2px 0 6px' }}>Focos</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BD}` }}>
            <thead>
              <tr>
                <th style={{ background: '#c8c8c8', fontSize: 9, padding: '3px 4px', border: `1px solid ${BD}`, width: 70 }}>Día</th>
                <th style={{ background: '#c8c8c8', fontSize: 9, padding: '3px 4px', border: `1px solid ${BD}` }}>FOCO 1</th>
                <th style={{ background: '#c8c8c8', fontSize: 9, padding: '3px 4px', border: `1px solid ${BD}` }}>FOCO 2</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, i) => {
                const isRest = day.isRestDay;
                const isMatch = day.match?.hasMatch;
                const dayBg = isRest ? REST_YELLOW : (isMatch ? MATCH_BLUE : CC);
                const dayColor = isRest || isMatch ? '#222' : '#fff';
                return (
                  <tr key={day.date}>
                    <td style={{ background: dayBg, color: dayColor, fontWeight: 700, fontSize: 9, padding: '3px 4px', border: `1px solid ${BD}`, textAlign: 'left' }}>
                      {day.dayName}
                    </td>
                    {isRest || isMatch ? (
                      <td colSpan={2} style={{ padding: '2px 4px', border: `1px solid ${BD}`, background: isRest ? REST_YELLOW : MATCH_BLUE, textAlign: 'center', fontWeight: 700, fontSize: 9 }}>
                        {isRest ? 'DESCANSO' : 'PARTIDO'}
                      </td>
                    ) : (
                      <>
                        <td style={{ padding: '2px 4px', border: `1px solid ${BD}`, background: '#fff' }}>
                          <InlineInput value={day.foco1} onChange={v => onUpdateDay(i, { foco1: v })} placeholder="" readonly={readOnly} />
                        </td>
                        <td style={{ padding: '2px 4px', border: `1px solid ${BD}`, background: '#fff' }}>
                          <InlineInput value={day.foco2} onChange={v => onUpdateDay(i, { foco2: v })} placeholder="" readonly={readOnly} />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1.35 }}>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: CC, padding: '2px 0 6px' }}>Objetivos</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BD}` }}>
            <thead>
              <tr>
                <th style={{ background: '#c8c8c8', fontSize: 9, padding: '3px 4px', border: `1px solid ${BD}`, width: 70 }}>Día</th>
                <th style={{ background: '#c8c8c8', fontSize: 9, padding: '3px 4px', border: `1px solid ${BD}` }}>OBJETIVO 1</th>
                <th style={{ background: '#c8c8c8', fontSize: 9, padding: '3px 4px', border: `1px solid ${BD}` }}>OBJETIVO 2</th>
                <th style={{ background: '#c8c8c8', fontSize: 9, padding: '3px 4px', border: `1px solid ${BD}` }}>OBJETIVO 3</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, i) => {
                const isRest = day.isRestDay;
                const isMatch = day.match?.hasMatch;
                const dayBg = isRest ? REST_YELLOW : (isMatch ? MATCH_BLUE : CC);
                const dayColor = isRest || isMatch ? '#222' : '#fff';
                return (
                  <tr key={day.date}>
                    <td style={{ background: dayBg, color: dayColor, fontWeight: 700, fontSize: 9, padding: '3px 4px', border: `1px solid ${BD}`, textAlign: 'left' }}>
                      {day.dayName}
                    </td>
                    {isRest || isMatch ? (
                      <td colSpan={3} style={{ padding: '2px 4px', border: `1px solid ${BD}`, background: isRest ? REST_YELLOW : MATCH_BLUE, textAlign: 'center', fontWeight: 700, fontSize: 9 }}>
                        {isRest ? 'DESCANSO' : 'PARTIDO'}
                      </td>
                    ) : (
                      ['objetivo1', 'objetivo2', 'objetivo3'].map(key => (
                        <td key={key} style={{ padding: '2px 4px', border: `1px solid ${BD}`, background: '#fff' }}>
                          <InlineInput value={day[key]} onChange={v => onUpdateDay(i, { [key]: v })} placeholder="" readonly={readOnly} />
                        </td>
                      ))
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Microciclo title */}
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, color: CC, padding: '8px 0 4px' }}>Microciclo</div>

      {/* Grid */}
      <div style={{ overflowX: 'auto', padding: '0 4px 4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: `2px solid ${BD}`, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 78 }} />
            {days.map((_, i) => <col key={i} />)}
          </colgroup>
          <thead>
            <tr>
              <th
                style={{ background: '#1a237e', color: '#fff', fontWeight: 700, textAlign: 'center', padding: '5px 3px', fontSize: 9, border: `1px solid ${BD}`, cursor: readOnly ? 'default' : 'pointer' }}
                onClick={e => { if (!readOnly) openCell('dates', 'dates', e); }}
              >
                {formatRange(dateStart, dateEnd)}
              </th>
              {days.map((day, i) => {
                const isRest = day.isRestDay;
                const isMatch = day.match?.hasMatch;
                let bg = '#1a237e';
                let color = '#fff';
                if (isRest) { bg = REST_YELLOW; color = '#222'; }
                else if (isMatch) { bg = MATCH_BLUE; color = '#0d47a1'; }
                return (
                  <th key={day.date} style={{ background: bg, color, fontWeight: 700, textAlign: 'center', padding: '5px 2px', fontSize: 10, border: `1px solid ${BD}`, borderLeft: `1px dashed ${BD_DASH}` }}>
                    {(day.dayName || '').toUpperCase()} {isRest ? '' : new Date(day.date).getDate()}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* DIMENSIÓN */}
            <tr>
              <td style={{ ...rowLabelStyle, color: '#888', fontStyle: 'italic', fontSize: 9 }}>DIMENSIÓN</td>
              {days.map((day, i) => (
                <td
                  key={day.date}
                  style={{ ...cellBorder(i), ...dayColBg(day), textAlign: 'center' }}
                  onClick={e => { if (!day.isRestDay) openCell(i, 'dimension', e); }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => dropItem(i, 'dimension', e)}
                >
                  {day.isRestDay ? null : (Array.isArray(day.grid.dimension) ? day.grid.dimension : (day.grid.dimension ? [day.grid.dimension] : [])).map(dimension => (
                    <Pill
                      key={dimension}
                      text={dimension}
                      color={C_DIM}
                      readonly={readOnly}
                      onRemove={!readOnly ? (() => onUpdateDayGrid(i, { dimension: (Array.isArray(day.grid.dimension) ? day.grid.dimension : [day.grid.dimension]).filter(item => item !== dimension) })) : null}
                    />
                  ))}
                </td>
              ))}
            </tr>

            {/* SITUACIÓN */}
            <tr>
              <td style={{ ...rowLabelStyle, color: '#888', fontStyle: 'italic', fontSize: 9 }}>SITUACIÓN</td>
              {days.map((day, i) => (
                <td
                  key={day.date}
                  style={{ ...cellBorder(i), ...dayColBg(day) }}
                  onClick={e => { if (!day.isRestDay) openCell(i, 'situacion', e); }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => dropItem(i, 'situacion', e)}
                >
                  {day.isRestDay ? null : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      {day.grid.situacion.map(s => (
                        <Pill
                          key={s}
                          text={s}
                          color={C_SIT}
                          readonly={readOnly}
                          onRemove={!readOnly ? (() => onUpdateDayGrid(i, { situacion: day.grid.situacion.filter(x => x !== s) })) : null}
                        />
                      ))}
                    </div>
                  )}
                </td>
              ))}
            </tr>

            {/* CATEGORÍA */}
            <tr>
              <td style={{ ...rowLabelStyle, color: '#888', fontStyle: 'italic', fontSize: 9 }}>CATEGORÍA</td>
              {days.map((day, i) => (
                <td
                  key={day.date}
                  style={{ ...cellBorder(i), ...dayColBg(day) }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => dropItem(i, 'categoria', e)}
                >
                  {day.isRestDay ? null : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div
                        className="cursor-pointer"
                        onClick={e => openCell(i, 'categoria', e)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}
                      >
                        {day.grid.categoria.map(c => (
                          <Pill
                            key={c}
                            text={c}
                            color={C_CAT}
                            readonly={readOnly}
                            onRemove={!readOnly ? (() => onUpdateDayGrid(i, { categoria: day.grid.categoria.filter(x => x !== c) })) : null}
                          />
                        ))}
                      </div>
                      {/* Match activation box (como imagen original) */}
                      {day.match?.hasMatch && (
                        <div
                          className="cursor-pointer"
                          onClick={e => { e.stopPropagation(); openCell(i, 'match', e); }}
                          style={{
                            marginTop: 4,
                            background: MATCH_BOX,
                            border: '1px solid #7ec8e8',
                            borderRadius: 6,
                            padding: '8px 6px',
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#1565c0',
                            textAlign: 'center',
                            lineHeight: 1.3,
                            width: '92%',
                          }}
                        >
                          {day.match.rival || day.match.jornada
                            ? <>{day.match.jornada ? `J.${day.match.jornada}` : ''}{day.match.rival ? ` ${day.match.rival}` : ''}{day.match.hora ? ` ${day.match.hora}` : ''}<br /><span style={{ fontSize: 8, fontWeight: 600 }}>{day.match.location === 'home' ? 'LOCAL' : 'VISITANTE'}</span></>
                            : <>¿ACTIVACIÓN<br />DE PARTIDO?</>}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              ))}
            </tr>

            {/* FÍSICO */}
            <tr>
              <td style={{ ...rowLabelStyle, color: '#c62828', fontStyle: 'italic', fontSize: 9, borderBottom: 'none' }}>FÍSICO</td>
              {days.map((day, i) => (
                <td
                  key={day.date}
                  style={{ ...cellBorder(i), ...dayColBg(day), borderBottom: 'none' }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => dropItem(i, 'fisicoTipo', e)}
                >
                  {day.isRestDay ? (
                    <div style={{ fontSize: 8, color: '#666', paddingTop: 2 }}>
                      <div>N° REPES:</div>
                      <div>TT:</div>
                      <div>RPE:</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div className="cursor-pointer" onClick={e => openCell(i, 'fisicoTipo', e)}>
                        {day.grid.fisico.tipo ? (
                          <Pill
                            text={day.grid.fisico.tipo}
                            color={C_FIS}
                            readonly={readOnly}
                            onRemove={!readOnly ? (() => onUpdateDayFisico(i, { tipo: '' })) : null}
                          />
                        ) : null}
                      </div>
                      <div style={{ width: '100%', fontSize: 8, color: '#444', marginTop: 2, lineHeight: 1.4 }}>
                        {readOnly ? (
                          <>
                            <div>N° REPES: {day.grid.fisico.repes || ''}</div>
                            <div>TT: {day.grid.fisico.tt || ''}</div>
                            <div>RPE: {day.grid.fisico.rpe || ''}</div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <span>N° REPES:</span>
                              <input value={day.grid.fisico.repes} onChange={e => onUpdateDayFisico(i, { repes: e.target.value })} placeholder="4-6" style={{ width: 32, fontSize: 8, border: 'none', borderBottom: '1px solid #ccc', background: 'transparent', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <span>TT:</span>
                              <input value={day.grid.fisico.tt} onChange={e => onUpdateDayFisico(i, { tt: e.target.value })} placeholder="35'" style={{ width: 32, fontSize: 8, border: 'none', borderBottom: '1px solid #ccc', background: 'transparent', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <span>RPE:</span>
                              <input value={day.grid.fisico.rpe} onChange={e => onUpdateDayFisico(i, { rpe: e.target.value })} placeholder="6-7" style={{ width: 32, fontSize: 8, border: 'none', borderBottom: '1px solid #ccc', background: 'transparent', outline: 'none' }} />
                            </div>
                            {day.grid.fisico.customFields.map(f => (
                              <div key={f.id} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                <input value={f.label} onChange={e => onUpdateFisicoCustom(i, f.id, { ...f, label: e.target.value })} placeholder="Campo" style={{ width: 36, fontSize: 8, border: 'none', borderBottom: '1px solid #ccc', background: 'transparent', outline: 'none' }} />
                                <input value={f.value} onChange={e => onUpdateFisicoCustom(i, f.id, { ...f, value: e.target.value })} placeholder="Valor" style={{ width: 28, fontSize: 8, border: 'none', borderBottom: '1px solid #ccc', background: 'transparent', outline: 'none' }} />
                                <span className="cursor-pointer" onClick={() => onRemoveFisicoField(i, f.id)} style={{ color: '#c62828' }}><X size={8} /></span>
                              </div>
                            ))}
                            <span className="cursor-pointer" onClick={() => onAddFisicoField(i)} style={{ color: '#888', fontSize: 8, display: 'inline-flex', alignItems: 'center', gap: 1 }}><Plus size={8} /> campo</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: 7.5, color: '#888', padding: '2px 4px' }}>*TT= Tiempo total</div>
      </div>

      {/* Bottom 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '8px 8px 10px' }}>
        {[
          { title: 'PROPÓSITO - OBJETIVO SEMANAL', value: proposito, onChange: onChangeProposito },
          { title: 'TIPOLOGÍA DE TAREAS', value: tipologiaTareas, onChange: onChangeTipologia },
          { title: 'OBSERVACIONES - PRE SEMANA', value: observacionesPre, onChange: onChangePre },
          { title: 'OBSERVACIONES - POST SEMANA', value: observacionesPost, onChange: onChangePost },
        ].map(s => (
          <div key={s.title} style={{ border: `1px solid ${BD}` }}>
            <div style={{
              background: `linear-gradient(180deg, #81c784 0%, ${CC} 100%)`,
              color: '#fff',
              fontWeight: 700,
              fontSize: 10,
              padding: '4px 8px',
              textAlign: 'center',
              borderBottom: `1px solid ${BD}`,
            }}>
              {s.title}
            </div>
            {readOnly ? (
              <div style={{ fontSize: 12, color: '#222', padding: '6px 8px', minHeight: 48, whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>{s.value}</div>
            ) : (
              <textarea
                value={s.value}
                onChange={e => s.onChange(e.target.value)}
                rows={3}
                style={{ width: '100%', fontSize: 12, border: 'none', padding: '6px 8px', background: '#fff', color: '#222', outline: 'none', resize: 'vertical', fontFamily: FONT, boxSizing: 'border-box', minHeight: 48, lineHeight: 1.35 }}
              />
            )}
          </div>
        ))}
      </div>

      {ed && !readOnly && (
        <CellEditPopover
          type={ed.rowType}
          position={cellRefs.current[`${ed.dayIndex}-${ed.rowType}`] || { x: 0, y: 0 }}
           value={ed.rowType === 'dimension' ? days[ed.dayIndex]?.grid.dimension : ed.rowType === 'fisicoTipo' ? days[ed.dayIndex]?.grid.fisico.tipo : ''}
          selected={ed.rowType === 'situacion' ? days[ed.dayIndex]?.grid.situacion : ed.rowType === 'categoria' ? days[ed.dayIndex]?.grid.categoria : []}
          options={ed.rowType === 'situacion' ? getSituations(days[ed.dayIndex]?.grid.dimension) : ed.rowType === 'categoria' ? getCategories(days[ed.dayIndex]?.grid.dimension) : []}
          onChange={v => {
             if (ed.rowType === 'dimension') onUpdateDayGrid(ed.dayIndex, { dimension: v });
            if (ed.rowType === 'fisicoTipo') onUpdateDayFisico(ed.dayIndex, { tipo: v });
          }}
          onChangeMulti={v => {
            if (ed.rowType === 'situacion') onUpdateDayGrid(ed.dayIndex, { situacion: v });
            if (ed.rowType === 'categoria') onUpdateDayGrid(ed.dayIndex, { categoria: v });
          }}
          match={days[ed.dayIndex]?.match || {}}
          onUpdateMatch={u => onUpdateDayMatch(ed.dayIndex, u)}
          dateStart={dateStart}
          dateEnd={dateEnd}
          onDatesChange={onDatesChange}
          dimensionId={days[ed.dayIndex]?.grid.dimension}
          onClose={closeCell}
        />
      )}
      </div>
    </div>
  );
}
