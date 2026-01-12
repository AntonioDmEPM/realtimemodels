/**
 * Accessibility utilities for improving app usability
 * Provides helpers for ARIA labels, keyboard navigation, and screen reader support
 */

/**
 * Announces a message to screen readers
 * @param message - The message to announce
 * @param priority - 'polite' (default) or 'assertive'
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Manages focus trap for modals and dialogs
 */
export class FocusTrap {
  private element: HTMLElement;
  private focusableElements: HTMLElement[];
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;
  private previouslyFocused: HTMLElement | null = null;

  constructor(element: HTMLElement) {
    this.element = element;
    this.focusableElements = this.getFocusableElements();
    this.firstFocusable = this.focusableElements[0] || null;
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1] || null;
  }

  private getFocusableElements(): HTMLElement[] {
    const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.element.querySelectorAll(selector)) as HTMLElement[];
  }

  activate(): void {
    this.previouslyFocused = document.activeElement as HTMLElement;
    this.element.addEventListener('keydown', this.handleKeyDown);
    if (this.firstFocusable) {
      this.firstFocusable.focus();
    }
  }

  deactivate(): void {
    this.element.removeEventListener('keydown', this.handleKeyDown);
    if (this.previouslyFocused) {
      this.previouslyFocused.focus();
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable?.focus();
      }
    }
  };
}

/**
 * Gets accessible label for connection status
 */
export function getConnectionStatusLabel(isConnected: boolean, isConnecting: boolean): string {
  if (isConnecting) {
    return 'Connecting to session...';
  }
  return isConnected ? 'Connected to session' : 'Disconnected from session';
}

/**
 * Gets accessible label for sentiment
 */
export function getSentimentLabel(sentiment: string | null): string {
  if (!sentiment) return 'No sentiment detected';

  const labels: Record<string, string> = {
    positive: 'Positive sentiment detected',
    negative: 'Negative sentiment detected',
    neutral: 'Neutral sentiment detected',
    mixed: 'Mixed sentiment detected',
  };

  return labels[sentiment] || 'Unknown sentiment';
}

/**
 * Formats cost for screen readers
 */
export function formatCostForScreenReader(cost: number): string {
  return `Cost: ${cost.toFixed(4)} dollars`;
}

/**
 * Formats token count for screen readers
 */
export function formatTokensForScreenReader(tokens: number, type: string): string {
  return `${tokens} ${type} tokens`;
}
