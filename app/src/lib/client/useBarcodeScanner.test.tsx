// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRef, useState } from 'react';
import type { RefObject } from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { useBarcodeScanner } from './useBarcodeScanner';

afterEach(cleanup);

function Harness({
  onScan,
  inputRef,
  enabled,
  onDropped,
}: {
  onScan: (barcode: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  enabled?: boolean;
  onDropped?: (raw: string) => void;
}) {
  const scanner = useBarcodeScanner(onScan, { isEnabled: () => enabled ?? true, onDropped });
  const [coffees, setCoffees] = useState(0);

  return (
    <div>
      <input
        data-testid="scan"
        ref={(node) => {
          scanner.scanInputRef.current = node;
          if (inputRef) inputRef.current = node;
        }}
        value={scanner.scanValue}
        onChange={scanner.handleScanChange}
        onKeyDown={scanner.handleScanKeyDown}
      />
      <button onClick={() => setCoffees((c) => c + 1)}>Café {coffees}</button>
      <input data-testid="quantity" />
    </div>
  );
}

/**
 * Types a barcode the way a hardware scanner does: character by character, with
 * no pause for React to catch up, then Enter.
 *
 * Everything happens inside one `act` so React batches the state updates, which
 * is what a real scanner burst does to the render loop.
 */
function scanBurst(input: HTMLInputElement, barcode: string, { enter = true } = {}) {
  act(() => {
    for (let i = 1; i <= barcode.length; i++) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )!.set!;
      nativeSetter.call(input, barcode.slice(0, i));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (enter) {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
    }
  });
}

describe('useBarcodeScanner submitting on Enter', () => {
  it('submits the whole code even when React has not re-rendered yet', () => {
    // The regression: the Enter handler used to read React state, which lags a
    // fast scanner. A stale value is short or empty, so the scan was dropped in
    // silence — the item simply never reached the cart.
    const onScan = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={onScan} inputRef={inputRef} />);

    scanBurst(inputRef.current!, '0064420001030');

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('0064420001030');
  });

  it('still submits correctly right after another control re-rendered the page', () => {
    // The reported sequence: log in, add a coffee, then scan.
    const onScan = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={onScan} inputRef={inputRef} />);

    act(() => {
      screen.getByRole('button', { name: /Café/ }).click();
    });
    scanBurst(inputRef.current!, '0064420001030');

    expect(onScan).toHaveBeenCalledWith('0064420001030');
  });

  it('submits two consecutive scans in full', () => {
    const onScan = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={onScan} inputRef={inputRef} />);

    scanBurst(inputRef.current!, '1111111111111');
    scanBurst(inputRef.current!, '2222222222222');

    expect(onScan.mock.calls.map((c) => c[0])).toEqual([
      '1111111111111',
      '2222222222222',
    ]);
  });

  it('clears the input after a scan so codes cannot concatenate', () => {
    const onScan = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={onScan} inputRef={inputRef} />);

    scanBurst(inputRef.current!, '0064420001030');

    expect(inputRef.current!.value).toBe('');
  });

  it('ignores Enter on an empty input', () => {
    const onScan = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={onScan} inputRef={inputRef} />);

    act(() => {
      inputRef.current!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
    });

    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores a code too short to be a barcode', () => {
    const onScan = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={onScan} inputRef={inputRef} />);

    scanBurst(inputRef.current!, '12');

    expect(onScan).not.toHaveBeenCalled();
  });

  it('submits a scanner burst that never sends Enter', () => {
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      const inputRef = createRef<HTMLInputElement>();
      render(<Harness onScan={onScan} inputRef={inputRef} />);

      scanBurst(inputRef.current!, '0064420001030', { enter: false });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onScan).toHaveBeenCalledWith('0064420001030');
    } finally {
      vi.useRealTimers();
    }
  });
});

/** Types into the page at large, as a scanner does when the input lost focus. */
function scanAtDocument(
  barcode: string,
  { target = document.body, enter = true }: { target?: Element; enter?: boolean } = {}
) {
  act(() => {
    for (const char of barcode) {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    }
    if (enter) {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
  });
}

describe('useBarcodeScanner when the hidden input has lost focus', () => {
  it('still captures a scan typed into the page', () => {
    // The reported bug: the user taps a button, focus leaves the hidden input,
    // and the next scan goes nowhere at all. Recovering focus on the next click
    // is too late — the keystrokes have to be caught as they arrive.
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    scanAtDocument('0064420001030');

    expect(onScan).toHaveBeenCalledWith('0064420001030');
  });

  it('pulls focus back to the input on the first stray keystroke', () => {
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={vi.fn()} inputRef={inputRef} />);
    expect(document.activeElement).not.toBe(inputRef.current);

    scanAtDocument('006', { enter: false });

    expect(document.activeElement).toBe(inputRef.current);
  });

  it('captures a scan that follows tapping a quick-add button', () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    const coffee = screen.getByRole('button', { name: /Café/ });
    act(() => {
      coffee.focus();
      coffee.click();
    });
    scanAtDocument('0064420001030', { target: coffee });

    expect(onScan).toHaveBeenCalledWith('0064420001030');
  });

  it('leaves another field alone while it is being typed in', () => {
    // A quantity field in a dialog must keep its own digits.
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);
    const quantity = screen.getByTestId('quantity');

    scanAtDocument('0064420001030', { target: quantity });

    expect(onScan).not.toHaveBeenCalled();
  });

  it('stays out of the way when disabled', () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} enabled={false} />);

    scanAtDocument('0064420001030');

    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores keys a scanner never sends', () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    act(() => {
      for (const key of ['Shift', 'Tab', 'ArrowLeft', 'a', '-']) {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      }
    });
    scanAtDocument('0064420001030');

    expect(onScan).toHaveBeenCalledWith('0064420001030');
  });

  it('does not merge a stray burst into the following scan', () => {
    const onScan = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={onScan} inputRef={inputRef} />);

    scanAtDocument('1111111111111');
    scanBurst(inputRef.current!, '2222222222222');

    expect(onScan.mock.calls.map((c) => c[0])).toEqual([
      '1111111111111',
      '2222222222222',
    ]);
  });
});

/** A page that renders nothing until its first request comes back. */
function LoadingHarness({ onScan, ready }: { onScan: (b: string) => void; ready: boolean }) {
  const scanner = useBarcodeScanner(onScan);
  if (!ready) return null;
  return (
    <input
      data-testid="scan"
      ref={scanner.scanInputRef}
      value={scanner.scanValue}
      onChange={scanner.handleScanChange}
      onKeyDown={scanner.handleScanKeyDown}
    />
  );
}

describe('useBarcodeScanner before the input exists', () => {
  it('keeps a scan made while the page is still loading', () => {
    // On a slow connection the tab screen shows nothing for a while: the hidden
    // input is not mounted yet, so there is nothing to type into and nothing to
    // focus. The keystrokes still have to be kept.
    const onScan = vi.fn();
    render(<LoadingHarness onScan={onScan} ready={false} />);

    scanAtDocument('0064420001030');

    expect(onScan).toHaveBeenCalledWith('0064420001030');
  });

  it('still works once the input appears', () => {
    const onScan = vi.fn();
    const { rerender } = render(<LoadingHarness onScan={onScan} ready={false} />);

    scanAtDocument('1111111111111');
    rerender(<LoadingHarness onScan={onScan} ready />);
    scanAtDocument('2222222222222');

    expect(onScan.mock.calls.map((c) => c[0])).toEqual([
      '1111111111111',
      '2222222222222',
    ]);
  });
});

describe('useBarcodeScanner recovering from a misread', () => {
  it('does not let a short burst without Enter prefix the next scan', () => {
    // A misread of two digits never reaches submit on its own: no Enter comes,
    // and the auto-submit needs a plausible length. Left in the buffer it would
    // turn the next scan into an unknown product.
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      render(<Harness onScan={onScan} />);

      scanAtDocument('12', { enter: false });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      scanAtDocument('0064420001030');

      expect(onScan).toHaveBeenCalledWith('0064420001030');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports the misread instead of discarding it quietly', () => {
    vi.useFakeTimers();
    try {
      const onDropped = vi.fn();
      render(<Harness onScan={vi.fn()} onDropped={onDropped} />);

      scanAtDocument('12', { enter: false });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onDropped).toHaveBeenCalledWith('12');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops treating Enter as a scan once the misread is gone', () => {
    // While a buffer lingers the fallback swallows every Enter on the page,
    // which would stop buttons and dialogs responding to it.
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      render(<Harness onScan={onScan} />);

      scanAtDocument('12', { enter: false });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const enter = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        document.body.dispatchEvent(enter);
      });

      expect(enter.defaultPrevented).toBe(false);
      expect(onScan).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not cut a real scan short mid-burst', () => {
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      render(<Harness onScan={onScan} />);

      scanAtDocument('0064420001030', { enter: false });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onScan).toHaveBeenCalledWith('0064420001030');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not submit a scan after the screen has gone', () => {
    // The auto-submit timer outliving the component would log a scan for an
    // item that no cart is left to hold.
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      const { unmount } = render(<Harness onScan={onScan} />);

      scanAtDocument('0064420001030', { enter: false });
      unmount();
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onScan).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useBarcodeScanner reporting dropped scans', () => {
  it('reports a code too short to look up', () => {
    const onDropped = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={vi.fn()} inputRef={inputRef} onDropped={onDropped} />);

    scanBurst(inputRef.current!, '12');

    expect(onDropped).toHaveBeenCalledWith('12');
  });

  it('says nothing when Enter is pressed on an empty input', () => {
    const onDropped = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={vi.fn()} inputRef={inputRef} onDropped={onDropped} />);

    act(() => {
      inputRef.current!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
    });

    expect(onDropped).not.toHaveBeenCalled();
  });

  it('does not let a dropped code prefix the next scan', () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    scanAtDocument('12');
    scanAtDocument('0064420001030');

    expect(onScan).toHaveBeenCalledWith('0064420001030');
  });

  it('says nothing when a scan goes through', () => {
    const onDropped = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(<Harness onScan={vi.fn()} inputRef={inputRef} onDropped={onDropped} />);

    scanBurst(inputRef.current!, '0064420001030');

    expect(onDropped).not.toHaveBeenCalled();
  });
});
