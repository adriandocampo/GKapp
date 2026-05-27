import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const players = [
  { id: 1, role: "GK", x: 710, y: 700 },
  { id: 3, role: "LB", x: 390, y: 520 },
  { id: 4, role: "LCB", x: 560, y: 560 },
  { id: 5, role: "RCB", x: 860, y: 560 },
  { id: 2, role: "RB", x: 1030, y: 520 },
  { id: 8, role: "LCM", x: 520, y: 360 },
  { id: 6, role: "DM", x: 710, y: 300 },
  { id: 10, role: "RCM", x: 900, y: 360 },
  { id: 11, role: "LW", x: 460, y: 140 },
  { id: 9, role: "ST", x: 710, y: 110 },
  { id: 7, role: "RW", x: 960, y: 140 }
];

const playerMap = Object.fromEntries(players.map(p => [p.id, p]));

const passes = [
  { from: 1, to: 3, attempts: 24, success: 0.91 },
  { from: 1, to: 4, attempts: 15, success: 0.85 },
  { from: 1, to: 5, attempts: 12, success: 0.70 },
  { from: 1, to: 2, attempts: 8, success: 0.60 },
  { from: 3, to: 1, attempts: 5, success: 0.95 }
];

const GKPassMap = ({ passFlow = [] }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 1. Background
    svg.append("rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "#071b2b");

    // 2. Sidebar
    svg.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 260)
      .attr("height", 800)
      .attr("fill", "#0f172a");

    // 3. Pitch (mitad inferior)
    svg.append("rect")
      .attr("x", 280)
      .attr("y", 40)
      .attr("width", 860)
      .attr("height", 720)
      .attr("fill", "#1e293b")
      .attr("stroke", "white")
      .attr("stroke-width", 1);
    
    // Marcas de campo simple
    svg.append("line").attr("x1", 280).attr("y1", 400).attr("x2", 1140).attr("y2", 400).attr("stroke", "white").attr("stroke-width", 1); // Línea medio campo
    svg.append("circle").attr("cx", 710).attr("cy", 400).attr("r", 50).attr("fill", "none").attr("stroke", "white").attr("stroke-width", 1); // Círculo central

    // 6. Escala de Color
    const colorScale = d3.scaleLinear()
      .domain([0.5, 0.7, 0.85, 1])
      .range(["#d73027", "#fc8d59", "#fee08b", "#1a9850"]);

    // 7. Escala de Grosor
    const widthScale = d3.scaleSqrt()
      .domain([1, 30])
      .range([1.5, 10]);

    // 8. Curvas
    function curvedPath(source, target, curvature) {
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const nx = -dy;
      const ny = dx;
      const cx = mx + nx * curvature;
      const cy = my + ny * curvature;
      return `M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`;
    }

    // 10. Flechas (una para cada dirección)
    svg.append("defs")
      .append("marker")
      .attr("id", "arrow-from")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 14)
      .attr("refY", 0)
      .attr("markerWidth", 3)
      .attr("markerHeight", 3)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#d0d7de");
      
    svg.append("defs")
      .append("marker")
      .attr("id", "arrow-to")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 14)
      .attr("refY", 0)
      .attr("markerWidth", 3)
      .attr("markerHeight", 3)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#d0d7de");

    // 11. Dibujar Links
    svg.selectAll(".pass")
      .data(passes)
      .enter()
      .append("path")
      .attr("class", "pass")
      .attr("d", d => {
        const source = playerMap[d.from];
        const target = playerMap[d.to];
        const curvature = d.from === 1 ? 0.18 : -0.18;
        return curvedPath(source, target, curvature);
      })
      .attr("fill", "none")
      .attr("stroke", d => colorScale(d.success))
      .attr("stroke-width", d => widthScale(d.attempts))
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.85)
      .attr("marker-end", d => d.from === 1 ? "url(#arrow-from)" : "url(#arrow-to)");

    // 12. Jugadores
    const nodes = svg.selectAll(".player")
      .data(players)
      .enter()
      .append("g")
      .attr("class", "player")
      .attr("transform", d => `translate(${d.x}, ${d.y})`);

    nodes.append("circle")
      .attr("r", 26)
      .attr("fill", d => d.id === 1 ? "#d94b5f" : "#0f172a")
      .attr("stroke", "rgba(255,255,255,0.75)")
      .attr("stroke-width", 2);

    nodes.append("text")
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .attr("font-size", 20)
      .attr("font-weight", 700)
      .attr("fill", "white")
      .text(d => d.id);

    nodes.append("text")
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "white")
      .attr("opacity", 0.7)
      .text(d => d.role);

      // 13. Leyenda en Sidebar
      const legend = svg.append("g").attr("transform", "translate(20, 50)");
      legend.append("text").text("LEYENDA").attr("fill", "white").attr("font-size", 16).attr("font-weight", "bold");
      // ... añadir items de leyenda aquí (colores, grosores)
      
  }, [passFlow]);

  return (
    <svg ref={svgRef} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto' }} />
  );
};

export default GKPassMap;
