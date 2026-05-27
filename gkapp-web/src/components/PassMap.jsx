import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getSuccessColor } from '../utils/xmlParser';

// Normalized pitch coordinates (0-100)
const FIELD_W = 100;
const FIELD_H = 100;

// Professional 4-3-3 fixed coordinates
const DEFAULT_POS = {
  '1.':  { x: 50, y: 92, label: 'POR', color: '#f43f5e' }, // Goalkeeper
  '13.': { x: 50, y: 92, label: 'POR', color: '#f43f5e' },
  '3.':  { x: 15, y: 65, label: 'LI', color: '#2dd4bf' },
  '4.':  { x: 35, y: 68, label: 'DFC', color: '#2dd4bf' },
  '16.': { x: 65, y: 68, label: 'DFC', color: '#2dd4bf' },
  '15.': { x: 85, y: 65, label: 'LD', color: '#2dd4bf' },
  '14.': { x: 22, y: 45, label: 'MC', color: '#fbbf24' },
  '6.':  { x: 38, y: 48, label: 'MC', color: '#fbbf24' },
  '10.': { x: 50, y: 42, label: 'MC', color: '#fbbf24' },
  '8.':  { x: 62, y: 48, label: 'MC', color: '#fbbf24' },
  '5.':  { x: 78, y: 45, label: 'MC', color: '#fbbf24' },
  '20.': { x: 12, y: 25, label: 'EI', color: '#2dd4bf' },
  '11.': { x: 32, y: 22, label: 'MI', color: '#2dd4bf' },
  '18.': { x: 50, y: 18, label: 'DC', color: '#2dd4bf' },
  '19.': { x: 68, y: 22, label: 'MD', color: '#2dd4bf' },
  '7.':  { x: 88, y: 25, label: 'ED', color: '#2dd4bf' },
  '9.':  { x: 22, y: 12, label: 'DEL', color: '#2dd4bf' },
  '17.': { x: 50, y: 8, label: 'DEL', color: '#2dd4bf' },
  '25.': { x: 78, y: 12, label: 'DEL', color: '#2dd4bf' },
};

function getPlayerPos(code) {
  if (!code) return { x: 50, y: 50, label: '?' };
  const numPart = code.split('.')[0] || code.split(' ')[0];
  for (const [key, pos] of Object.entries(DEFAULT_POS)) {
    if (code.startsWith(key) || numPart === key.replace('.','')) return pos;
  }
  return { x: 50, y: 30, label: numPart };
}

// Pure Quadratic Bezier Path generator
function curvedPath(source, target, curvature = 0.15) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  const nx = -dy;
  const ny = dx;
  const cx = mx + nx * curvature;
  const cy = my + ny * curvature;
  return `M${source.x},${source.y} Q${cx},${cy} ${target.x},${target.y}`;
}

export default function PassMap({ passFlow = [], goalkeeperCode = '', title = 'Pass Map (4-3-3)' }) {
  const svgRef = useRef(null);
  const [hoveredLine, setHoveredLine] = useState(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = FIELD_W;
    const height = FIELD_H;
    const g = svg.append('g');

    // --- Minimalist Dark Pitch ---
    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#0f172a');

    const strokeColor = '#334155';
    const strokeWidth = 0.3;

    // Outer border
    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'none')
      .attr('stroke', strokeColor)
      .attr('stroke-width', strokeWidth);

    // Center line
    g.append('line').attr('x1', 0).attr('y1', height / 2).attr('x2', width).attr('y2', height / 2).attr('stroke', strokeColor).attr('stroke-width', strokeWidth);
    // Center circle
    g.append('circle').attr('cx', width / 2).attr('cy', height / 2).attr('r', 9.15).attr('fill', 'none').attr('stroke', strokeColor).attr('stroke-width', strokeWidth);
    // Center spot
    g.append('circle').attr('cx', width / 2).attr('cy', height / 2).attr('r', 0.5).attr('fill', strokeColor);
    // Penalty areas
    g.append('rect').attr('x', 0).attr('y', height / 2 - 20.12).attr('width', 16.5).attr('height', 40.23).attr('fill', 'none').attr('stroke', strokeColor).attr('stroke-width', strokeWidth).attr('opacity', 0.3);
    g.append('rect').attr('x', width - 16.5).attr('y', height / 2 - 20.12).attr('width', 16.5).attr('height', 40.23).attr('fill', 'none').attr('stroke', strokeColor).attr('stroke-width', strokeWidth).attr('opacity', 0.3);
    // Goal areas
    g.append('rect').attr('x', 0).attr('y', height / 2 - 9.32).attr('width', 5.5).attr('height', 18.64).attr('fill', 'none').attr('stroke', strokeColor).attr('stroke-width', strokeWidth).attr('opacity', 0.3);
    g.append('rect').attr('x', width - 5.5).attr('y', height / 2 - 9.32).attr('width', 5.5).attr('height', 18.64).attr('fill', 'none').attr('stroke', strokeColor).attr('stroke-width', strokeWidth).attr('opacity', 0.3);
    // Penalty spots
    g.append('circle').attr('cx', 11).attr('cy', height / 2).attr('r', 0.5).attr('fill', strokeColor);
    g.append('circle').attr('cx', width - 11).attr('cy', height / 2).attr('r', 0.5).attr('fill', strokeColor);

    // --- SVG Markers for Arrows ---
    const defs = svg.append('defs');
    const marker = defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 5)
      .attr('refY', 0)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto');
    marker.append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'currentColor');

    // --- Nodes ---
    const gkPos = getPlayerPos(goalkeeperCode);
    const nodeMap = new Map();
    nodeMap.set('GK', { ...gkPos, number: '1', position: 'POR', isGK: true });
    
    passFlow.forEach(p => {
      const pos = getPlayerPos(p.code);
      nodeMap.set(p.code, {
        ...pos,
        number: p.code.split('.')[0] || p.code.split(' ')[0],
        position: p.position || pos.label,
        isGK: false,
        totalPasses: (p.gkToPlayer || 0) + (p.playerToGk || 0),
        ...p,
      });
    });

    const nodes = Array.from(nodeMap.values());
    const maxFlow = Math.max(...passFlow.map(p => (p.gkToPlayer || 0) + (p.playerToGk || 0)), 1);
    const sizeScale = d3.scaleLinear().domain([0, maxFlow]).range([2.5, 5]);

    // --- Connection Layers ---
    const lineGroup = g.append('g').attr('class', 'connections');
    
    passFlow.forEach(p => {
      const startNode = nodeMap.get('GK');
      const endNode = nodeMap.get(p.code);
      if (!endNode) return;

      // GK -> Player (Positive Curvature)
      if (p.gkToPlayer > 0) {
        const color = getSuccessColor(p.gkSuccessRate);
        const width = 0.5 + (p.gkToPlayer / maxFlow) * 4;

        lineGroup.append('path')
          .attr('d', curvedPath(startNode, endNode, 0.15))
          .attr('stroke', color)
          .attr('stroke-width', width)
          .attr('fill', 'none')
          .attr('stroke-linecap', 'round')
          .attr('marker-end', 'url(#arrowhead)')
          .attr('opacity', 0.8)
          .attr('cursor', 'pointer')
          .on('mouseenter', () => setHoveredLine({ code: p.code, ...p }))
          .on('mouseleave', () => setHoveredLine(null));
      }

      // Player -> GK (Negative Curvature)
      if (p.playerToGk > 0) {
        const color = getSuccessColor(p.playerSuccessRate);
        const width = 0.5 + (p.playerToGk / maxFlow) * 4;

        lineGroup.append('path')
          .attr('d', curvedPath(endNode, startNode, -0.15))
          .attr('stroke', color)
          .attr('stroke-width', width)
          .attr('fill', 'none')
          .attr('stroke-linecap', 'round')
          .attr('marker-end', 'url(#arrowhead)')
          .attr('opacity', 0.8)
          .attr('cursor', 'pointer')
          .on('mouseenter', () => setHoveredLine({ code: p.code, ...p }))
          .on('mouseleave', () => setHoveredLine(null));
      }
    });

    // --- Nodes Layer ---
    const nodeGroup = g.append('g').attr('class', 'nodes');
    nodes.forEach(node => {
      const nodeG = nodeGroup.append('g').attr('cursor', 'pointer');
      const color = node.color || (node.isGK ? '#f43f5e' : '#2dd4bf');
      const radius = sizeScale(node.totalPasses || 0);

      nodeG.append('circle')
        .attr('cx', node.x).attr('cy', node.y).attr('r', radius)
        .attr('fill', color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.3);
      
      nodeG.append('text')
        .attr('x', node.x).attr('y', node.y + 7)
        .attr('fill', '#94a3b8').attr('font-size', '2').attr('text-anchor', 'middle')
        .text(node.number || '');
    });
  }, [passFlow, goalkeeperCode]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gk-text-primary">{title}</h3>
      </div>

      {/* Legend - Minimalist StatsBomb Style */}
      <div className="flex items-center justify-between px-4 py-2 bg-gk-card/50 rounded-lg border border-gk-border mb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gk-text-tertiary">Possession value</span>
            <div className="w-24 h-3 rounded-sm bg-gradient-to-r from-[#d73027] via-[#fee08b] to-[#1a9850]"></div>
            <span className="text-[10px] text-gk-text-tertiary">low to high</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gk-text-tertiary">Pass count</span>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-gk-text-tertiary"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-gk-text-tertiary"></div>
            <div className="w-2 h-2 rounded-full bg-gk-text-tertiary"></div>
            <span className="text-[10px] text-gk-text-tertiary ml-1">low to high</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-lg border border-gk-border bg-gk-page" style={{ height: '380px' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
          className="w-full h-full"
        />
        {hoveredLine && (
          <div className="absolute top-2 right-2 bg-gk-card/90 border border-gk-border-hover rounded px-2 py-1 text-xs text-gk-text-primary shadow-lg whitespace-nowrap pointer-events-none">
            <div className="font-semibold">{hoveredLine.name}</div>
            <div>GK→: {hoveredLine.gkToPlayer} ✓ ({Math.round((hoveredLine.gkSuccessRate || 0) * 100)}%)</div>
            <div>→GK: {hoveredLine.playerToGk} ✓ ({Math.round((hoveredLine.playerSuccessRate || 0) * 100)}%)</div>
          </div>
        )}
      </div>
    </div>
  );
}