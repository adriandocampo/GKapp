# Skill: Build Athletic-Style Football Dashboards

## Purpose
Create premium editorial-style football analytics dashboards inspired by the visual storytelling quality of modern sports media platforms such as The Athletic. The focus is not only analytical accuracy, but also exceptional visual design, hierarchy, readability, and emotional impact.

The dashboards should feel cinematic, modern, data-rich, and publication-ready.

Primary emphasis:
- Shotmaps
- Heatmaps
- Goal-mouth visualizations
- Passing networks
- Touch maps
- Possession territory maps
- Match momentum visuals
- Expected goals (xG) storytelling
- High-end typography and spacing
- Elegant color systems
- Dense information with clean readability

---

# Core Design Philosophy

## 1. Editorial First
Every dashboard should feel like a feature article graphic rather than a BI dashboard.

Avoid:
- Generic corporate dashboard layouts
- Excessive tables
- Default plotting styles
- Spreadsheet aesthetics
- Overuse of borders and boxes

Prioritize:
- Narrative hierarchy
- Strong visual focal points
- Negative space
- Layered information density
- Premium typography
- Controlled color accents
- Minimal clutter

---

# Visual Style Requirements

## Overall Aesthetic
Target aesthetic:
- The Athletic
- Tifo Football
- StatsBomb media graphics
- Copa90 editorial visuals
- Modern football analytics Twitter graphics
- Apple-like interface polish

Characteristics:
- Dark mode preferred
- Muted palettes with selective bright accents
- Thin grid lines
- Soft contrast
- Large margins
- Elegant typography pairing
- Subtle transparency
- Cinematic composition

---

# Color System

## Backgrounds
Preferred:
- Charcoal (#0B0F14)
- Deep navy (#0E1726)
- Matte black (#111111)
- Dark slate (#161B22)

Avoid:
- Pure black
- Bright white backgrounds

---

## Accent Colors
Use only 1–2 strong accent colors.

Examples:
- Neon green
- Soft cyan
- Warm gold
- Crimson red
- Ice blue
- Electric purple

Accent colors should:
- Highlight key players
- Emphasize shots/xG
- Direct user attention
- Establish team identity

---

# Typography

## Font Style
Use modern editorial sans-serif fonts.

Preferred:
- Inter
- Geist
- Söhne
- SF Pro Display
- Helvetica Now
- IBM Plex Sans
- Manrope

Hierarchy:
- Massive headlines
- Small elegant labels
- Condensed metadata
- Numeric emphasis

Avoid:
- Decorative fonts
- Heavy serif usage
- Excessive bolding

---

# Layout Principles

## Structure
Design should resemble magazine spreads.

Use:
- Asymmetrical layouts
- Large hero visuals
- Floating stat cards
- Layered annotations
- Modular sections
- Grid alignment
- Generous spacing

Avoid:
- Uniform card grids
- Equal-sized components everywhere
- Traditional BI dashboards

---

# Required Dashboard Components

## 1. Shotmap

### Requirements
Create premium shotmaps with:
- Accurate pitch dimensions
- xG-sized circles
- Goal markers
- Outcome-based coloring
- Minute annotations
- Player highlighting
- Team separation
- Shot trajectory when useful

### Styling
- Subtle pitch lines
- Matte pitch texture
- Semi-transparent markers
- Glow effects for goals
- Layer depth
- Soft shadows

### Advanced Features
Support:
- Freeze-frame overlays
- Pressure context
- Shot clustering
- Shot sequence storytelling
- Animated replay modes
- Before/after substitution filtering

---

## 2. Heatmaps

### Requirements
Generate sophisticated positional heatmaps.

Support:
- Touch density
- Possession zones
- Pressure zones
- Progressive carries
- Defensive activity
- Team shape heatmaps

### Rendering Style
Avoid harsh gradients.

Preferred:
- Smooth gaussian blurs
- Soft diffusion
- Layer transparency
- Organic shapes
- Terrain-like intensity maps

### Visual Direction
Heatmaps should feel atmospheric rather than scientific.

Good references:
- Infrared imagery
- Weather maps
- Cinematic contour maps

---

## 3. Goal Mouth Visuals

### Requirements
Create premium goal-mouth analytics visuals.

Support:
- Shot placement maps
- Keeper save locations
- Goal probability zones
- Finishing clusters
- Penalty placement maps
- Post-hit visualizations

### Style
Use:
- Clean white goal frame
- Dark background contrast
- Shot trails
- Ball impact glows
- Soft depth layering
- Subtle perspective effects

### Key Goal
Goal-mouth visuals should instantly communicate:
- Finishing quality
- Goalkeeper tendencies
- Shot precision
- Dangerous areas

---

## 4. Passing Network

### Requirements
Create elegant passing networks.

Features:
- Average player positions
- Weighted pass connections
- Formation inference
- Centrality indicators
- Progressive pass highlighting

### Styling
- Thin elegant lines
- Opacity scaling
- Minimal node clutter
- Team color accents
- Soft player labels
- Layered transparency

Avoid:
- Overcrowded spaghetti visuals

---

## 5. Match Momentum Timeline

### Requirements
Visualize momentum swings elegantly.

Include:
- xG momentum
- Territory dominance
- Pressing intensity
- Dangerous attacks
- Match state changes

### Style
Use:
- Area curves
- Smooth transitions
- Elegant annotation markers
- Goal-event interruptions
- Tactical phase labeling

---

# Data Storytelling Rules

## Every Visual Must Answer a Question
Examples:
- Where was the game won?
- Which half-space was overloaded?
- How dangerous were the shots?
- Which player controlled territory?
- Where did pressing traps occur?

Avoid visuals without narrative purpose.

---

# Annotation Philosophy

## Minimal But Insightful
Annotations should feel curated.

Good examples:
- “Liverpool repeatedly targeted the left half-space.”
- “Most shots came from low-probability zones.”
- “The keeper struggled high to his right.”

Avoid:
- Paragraphs of text
- Excessive labels
- Visual clutter

---

# Interaction Design

## Hover States
When interactive:
- Smooth transitions
- Elegant tooltips
- Motion easing
- Context-aware highlights
- Cross-filtering

Tooltips should feel premium.

Include:
- Player image
- xG value
- Minute
- Body part
- Assist type
- Shot speed if available

---

# Motion Design

## Animation Principles
Animations should feel cinematic.

Use:
- Slow fades
- Smooth interpolation
- Motion blur effects
- Organic transitions
- Layered entrances

Avoid:
- Aggressive bouncing
- Fast dashboard animations
- Overly playful effects

---

# Technical Implementation Recommendations

## Frontend
Preferred stack:
- React
- Next.js
- TypeScript
- TailwindCSS
- Framer Motion
- D3.js
- SVG-first rendering
- Canvas for large-density maps

---

## Visualization Libraries
Preferred:
- D3.js
- Observable Plot
- nivo
- visx
- custom SVG systems

Avoid overreliance on:
- Plotly defaults
- Tableau-style visuals
- Generic chart libraries

---

# Rendering Principles

## SVG Priority
Use SVG for:
- Shotmaps
- Passing networks
- Goal maps
- Annotated visuals

Use Canvas/WebGL for:
- Large heatmaps
- High-density tracking data
- Animated particle systems

---

# Spatial Design Rules

## Negative Space
Whitespace is a feature.

Rules:
- Let visuals breathe
- Avoid edge crowding
- Use framing intentionally
- Create visual rhythm

---

# Component Style Guide

## Cards
Cards should:
- Blend into background
- Use subtle elevation
- Avoid hard borders
- Use soft corner radius
- Include internal spacing

---

## Charts
Charts should:
- Reduce axis clutter
- Minimize gridlines
- Use selective labels
- Emphasize shapes over scaffolding

---

# Pitch Rendering Standards

## Football Pitch Design
Pitch should be:
- Geometrically accurate
- Elegant and minimal
- Thin-lined
- Low contrast
- Scalable

Support:
- Vertical pitch
- Horizontal pitch
- Half-pitch
- Third-zone pitch
- Goal-mouth crop

---

# Accessibility

## Required
Ensure:
- Sufficient contrast
- Colorblind-safe alternatives
- Responsive typography
- Mobile adaptability
- Keyboard interaction support

---

# Responsive Design

## Mobile Experience
Mobile dashboards should:
- Preserve storytelling
- Use vertical stacking
- Prioritize hero visuals
- Simplify secondary charts
- Maintain premium feel

---

# Output Quality Standard

Every dashboard should be:
- Presentation-ready
- Social-share ready
- Article-embed ready
- Broadcast-quality
- Suitable for sports journalism

---

# Dashboard Composition Example

## Example Layout

Top Section:
- Match title
- Scoreline
- Hero shotmap
- Key tactical insight

Middle Section:
- Team heatmaps
- Passing network
- xG race chart

Bottom Section:
- Goal-mouth visuals
- Individual player touch maps
- Tactical annotations

---

# Prompting Rules For AI Generation

When generating dashboards:

Always:
- Prioritize aesthetics over density
- Reduce unnecessary UI chrome
- Think like an editorial designer
- Use visual hierarchy aggressively
- Emphasize storytelling
- Make the data emotionally readable

Never:
- Generate generic admin dashboards
- Use default chart colors
- Over-label visuals
- Overuse borders
- Create corporate BI aesthetics

---

# Specialized Shotmap Rules

## Shot Encoding
Use:
- Circle size = xG
- Color = outcome
- Stroke = body part or pressure
- Glow = goals
- Opacity = recency or sequence

### Goal Styling
Goals should visually dominate.

Possible techniques:
- Halo glow
- Pulse animation
- Trail effect
- Bright accent edge

---

# Specialized Heatmap Rules

## Heatmap Quality
Heatmaps should:
- Preserve spatial nuance
- Avoid muddy blending
- Maintain pitch readability
- Reveal tactical structure

Support:
- Multi-layer heatmaps
- Comparative overlays
- Team-vs-team territory blending

---

# Goal Mouth Analytics Rules

## Spatial Clarity
Goal-mouth graphics must instantly reveal:
- Keeper weakness zones
- Shot placement trends
- Finishing precision
- Height distribution
- Corner targeting

Use:
- Hexbin overlays
- Impact clusters
- Shot vectors
- Goal frame segmentation

---

# Premium Details

## Small Touches Matter
Add:
- Tiny metadata labels
- Elegant timestamps
- Soft gradients
- Subtle blur panels
- Thin dividers
- Motion easing
- Carefully aligned legends

These details create premium perception.

---

# Inspiration Sources

Study:
- The Athletic football graphics
- StatsBomb media outputs
- FiveThirtyEight sports graphics
- UEFA Champions League broadcast visuals
- Tifo Football diagrams
- Apple keynote visual hierarchy
- Bloomberg editorial dashboards

---

# Final Objective

The final product should feel like:
- elite sports journalism
- luxury data storytelling
- cinematic football intelligence
- modern editorial design
- tactical analysis as visual art

The user should immediately think:
“This looks premium enough to publish professionally.”

