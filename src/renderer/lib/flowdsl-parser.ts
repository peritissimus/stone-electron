/**
 * FlowDSL Parser - Converts custom diagram syntax to Mermaid
 *
 * Syntax:
 * - title My Diagram Title
 * - direction right|left|down|up
 * - Node name [shape: oval, color: blue, icon: star]
 * - Group name [props] { ... } for subgraphs
 * - Node1 > Node2 for connections
 * - Node1 > Node2: Label for labeled connections
 * - Node1 < Node2 for reverse connections
 * - // comments
 */

interface NodeDefinition {
  id: string;
  label: string;
  shape?: string;
  color?: string;
  icon?: string;
}

interface Relationship {
  from: string;
  to: string;
  label?: string;
}

interface Subgraph {
  id: string;
  label: string;
  nodes: string[];
  color?: string;
  icon?: string;
}

interface ParsedDiagram {
  title?: string;
  direction: string;
  nodes: Map<string, NodeDefinition>;
  relationships: Relationship[];
  subgraphs: Subgraph[];
}

// Color mapping to hex values for Mermaid styling
const colorMap: Record<string, string> = {
  lightblue: '#ADD8E6',
  blue: '#4A90D9',
  darkblue: '#2C5282',
  lightgreen: '#90EE90',
  green: '#48BB78',
  darkgreen: '#276749',
  yellow: '#F6E05E',
  orange: '#ED8936',
  red: '#FC8181',
  pink: '#FBB6CE',
  purple: '#B794F4',
  teal: '#38B2AC',
  cyan: '#76E4F7',
  gray: '#A0AEC0',
  white: '#FFFFFF',
  black: '#1A202C',
};

// Shape mapping to Mermaid syntax
const shapeMap: Record<string, [string, string]> = {
  rectangle: ['[', ']'],
  oval: ['([', '])'],
  stadium: ['([', '])'],
  diamond: ['{', '}'],
  hexagon: ['{{', '}}'],
  parallelogram: ['[/', '/]'],
  trapezoid: ['[/', '\\]'],
  circle: ['((', '))'],
  database: ['[(', ')]'],
  subroutine: ['[[', ']]'],
  asymmetric: ['>', ']'],
};

// Mermaid reserved keywords that cannot be used as node IDs
const MERMAID_RESERVED = new Set([
  'end',
  'subgraph',
  'graph',
  'flowchart',
  'direction',
  'click',
  'style',
  'linkstyle',
  'classDef',
  'class',
  'callback',
  'call',
  'init',
  'default',
]);

// Generate a safe ID from a label
function generateId(label: string): string {
  let id = label
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

  // Prefix reserved keywords to avoid Mermaid conflicts
  if (MERMAID_RESERVED.has(id)) {
    id = `node_${id}`;
  }

  return id;
}

// Parse node properties from [key: value, key: value] format
function parseProperties(propsStr: string): Record<string, string> {
  const props: Record<string, string> = {};
  if (!propsStr) return props;

  // Remove brackets
  const inner = propsStr.slice(1, -1).trim();
  if (!inner) return props;

  // Split by comma, handling potential values with spaces
  const pairs = inner.split(/,\s*/);
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split(':');
    if (key && valueParts.length > 0) {
      props[key.trim()] = valueParts.join(':').trim();
    }
  }

  return props;
}

// Parse the FlowDSL content
export function parseFlowDSL(content: string): ParsedDiagram {
  const lines = content.split('\n');
  const diagram: ParsedDiagram = {
    direction: 'TB',
    nodes: new Map(),
    relationships: [],
    subgraphs: [],
  };

  let currentSubgraph: Subgraph | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('//')) continue;

    // Parse title
    if (line.startsWith('title ')) {
      diagram.title = line.slice(6).trim();
      continue;
    }

    // Parse direction
    if (line.startsWith('direction ')) {
      const dir = line.slice(10).trim().toLowerCase();
      const dirMap: Record<string, string> = {
        right: 'LR',
        left: 'RL',
        down: 'TB',
        up: 'BT',
        lr: 'LR',
        rl: 'RL',
        tb: 'TB',
        bt: 'BT',
      };
      diagram.direction = dirMap[dir] || 'TB';
      continue;
    }

    // Check for subgraph end
    if (line === '}') {
      if (currentSubgraph) {
        diagram.subgraphs.push(currentSubgraph);
        currentSubgraph = null;
      }
      continue;
    }

    // Check for relationship lines (contains > or <)
    if (line.includes(' > ') || line.includes(' < ')) {
      const relationships = parseRelationshipLine(line);
      diagram.relationships.push(...relationships);
      continue;
    }

    // Check for subgraph start (line ends with {)
    if (line.endsWith('{')) {
      const subgraphMatch = line.match(/^(.+?)(?:\s*\[([^\]]*)\])?\s*\{$/);
      if (subgraphMatch) {
        const label = subgraphMatch[1].trim().replace(/^["']|["']$/g, '');
        const props = parseProperties(subgraphMatch[2] ? `[${subgraphMatch[2]}]` : '');
        currentSubgraph = {
          id: generateId(label),
          label,
          nodes: [],
          color: props.color,
          icon: props.icon,
        };
      }
      continue;
    }

    // Parse node definition
    const nodeMatch = line.match(/^(.+?)(?:\s*\[([^\]]*)\])?$/);
    if (nodeMatch) {
      const label = nodeMatch[1].trim().replace(/^["']|["']$/g, '');
      const props = parseProperties(nodeMatch[2] ? `[${nodeMatch[2]}]` : '');

      // Skip if this looks like a relationship we missed
      if (label.includes('>') || label.includes('<')) continue;

      const id = generateId(label);
      const node: NodeDefinition = {
        id,
        label,
        shape: props.shape,
        color: props.color,
        icon: props.icon,
      };

      diagram.nodes.set(id, node);

      // Add to current subgraph if we're inside one
      if (currentSubgraph) {
        currentSubgraph.nodes.push(id);
      }
    }
  }

  return diagram;
}

// Parse a relationship line
function parseRelationshipLine(line: string): Relationship[] {
  const relationships: Relationship[] = [];

  // Split by relationship operators while preserving the operator
  const parts = line.split(/\s+([><])\s+/);

  for (let i = 0; i < parts.length - 2; i += 2) {
    const fromPart = parts[i].trim();
    const operator = parts[i + 1];
    let toPart = parts[i + 2].trim();
    let label: string | undefined;

    // Check for label (: Label)
    const labelMatch = toPart.match(/^(.+?):\s*(.+)$/);
    if (labelMatch) {
      toPart = labelMatch[1].trim();
      label = labelMatch[2].trim();
    }

    // Clean up quotes
    const from = fromPart.replace(/^["']|["']$/g, '');
    const to = toPart.replace(/^["']|["']$/g, '');

    if (operator === '>') {
      relationships.push({
        from: generateId(from),
        to: generateId(to),
        label,
      });
    } else if (operator === '<') {
      relationships.push({
        from: generateId(to),
        to: generateId(from),
        label,
      });
    }
  }

  return relationships;
}

// Convert parsed diagram to Mermaid syntax
export function toMermaid(diagram: ParsedDiagram): string {
  const lines: string[] = [];

  // Add flowchart declaration with direction
  lines.push(`flowchart ${diagram.direction}`);

  // Add title as a comment
  if (diagram.title) {
    lines.push(`  %% ${diagram.title}`);
  }

  // Generate node definitions
  const nodeStyles: string[] = [];

  for (const [id, node] of diagram.nodes) {
    const [openBracket, closeBracket] = shapeMap[node.shape || 'rectangle'] || ['[', ']'];

    // Add icon to label if specified
    let displayLabel = node.label;
    if (node.icon) {
      // Use fa icons if available, otherwise just show the icon name
      displayLabel = `fa:fa-${node.icon} ${node.label}`;
    }

    lines.push(`  ${id}${openBracket}"${displayLabel}"${closeBracket}`);

    // Add style for colored nodes
    if (node.color) {
      const hexColor = colorMap[node.color.toLowerCase()] || node.color;
      // Determine text color based on background brightness
      const textColor = isLightColor(hexColor) ? '#1A202C' : '#FFFFFF';
      nodeStyles.push(`  style ${id} fill:${hexColor},stroke:${hexColor},color:${textColor}`);
    }
  }

  // Add empty line before subgraphs
  if (diagram.subgraphs.length > 0) {
    lines.push('');
  }

  // Generate subgraphs
  for (const subgraph of diagram.subgraphs) {
    lines.push(`  subgraph ${subgraph.id}["${subgraph.label}"]`);
    for (const nodeId of subgraph.nodes) {
      // Reference existing nodes
      lines.push(`    ${nodeId}`);
    }
    lines.push('  end');

    // Style subgraph if colored
    if (subgraph.color) {
      const hexColor = colorMap[subgraph.color.toLowerCase()] || subgraph.color;
      nodeStyles.push(`  style ${subgraph.id} fill:${hexColor}20,stroke:${hexColor}`);
    }
  }

  // Add empty line before relationships
  if (diagram.relationships.length > 0) {
    lines.push('');
  }

  // Generate relationships
  for (const rel of diagram.relationships) {
    if (rel.label) {
      lines.push(`  ${rel.from} -->|"${rel.label}"| ${rel.to}`);
    } else {
      lines.push(`  ${rel.from} --> ${rel.to}`);
    }
  }

  // Add styles at the end
  if (nodeStyles.length > 0) {
    lines.push('');
    lines.push(...nodeStyles);
  }

  return lines.join('\n');
}

// Helper to determine if a color is light
function isLightColor(hex: string): boolean {
  // Remove # if present
  hex = hex.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5;
}

// Main conversion function
export function convertFlowDSLToMermaid(content: string): string {
  try {
    const diagram = parseFlowDSL(content);
    return toMermaid(diagram);
  } catch (error) {
    // Import logger lazily to avoid circular dependencies
    import('@renderer/utils/logger').then(({ logger }) => {
      logger.error('FlowDSL parse error:', error);
    });
    throw new Error(
      `Failed to parse FlowDSL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Example template for new flowdsl blocks
export const flowDSLTemplate = `title My Flow Chart
direction down

// Define your nodes
Start [shape: oval, color: lightgreen, icon: play]
Process [color: lightblue]
Decision [shape: diamond, color: yellow, icon: help-circle]
End [shape: oval, color: gray, icon: check]

// Define relationships
Start > Process
Process > Decision
Decision > End: Yes
Decision > Process: No, retry
`;
