import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const tooltipId = `tooltip-${useId()}`;
  let trigger: ReactNode;

  if (isValidElement(children)) {
    const element = children as ReactElement<{ 'aria-describedby'?: string }>;
    const describedBy = [element.props['aria-describedby'], tooltipId].filter(Boolean).join(' ');
    trigger = cloneElement(element, { 'aria-describedby': describedBy });
  } else {
    trigger = (
      <span aria-describedby={tooltipId} tabIndex={0}>
        {children}
      </span>
    );
  }

  return (
    <span className="group/tooltip relative inline-flex max-w-full align-middle">
      {trigger}
      <span
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[var(--km-radius-md)] bg-text px-3 py-2 text-xs leading-5 text-canvas opacity-0 shadow-floating transition-[opacity,visibility] duration-150 motion-reduce:transition-none group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
