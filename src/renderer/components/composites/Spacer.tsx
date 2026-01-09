/**
 * Spacer Component - layout spacing without divs
 *
 * Replaces: style={{ paddingLeft: "..." }} and other manual spacing
 */

import React from 'react';
import { spacerSizeClasses } from './tokens';

export interface SpacerProps {
  /** Spacing size */
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Direction */
  direction?: 'vertical' | 'horizontal';
}

/**
 * Spacer - layout spacing without divs.
 *
 * @example
 * <div>
 *   <Text>Top</Text>
 *   <Spacer size="md" direction="vertical" />
 *   <Text>Bottom</Text>
 * </div>
 */
export const Spacer: React.FC<SpacerProps> = ({ size, direction = 'vertical' }) => {
  const classes = spacerSizeClasses[size][direction];
  return <div className={classes} />;
};
Spacer.displayName = 'Spacer';
