// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as renderRaw, screen, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Providers } from '@/app/providers';
import { ScannedItemList } from './ScannedItemList';
import type { ScannedProduct } from '@/app/tab/[cardNumber]/types';

afterEach(cleanup);

// Rendered through the app's own provider so the component is exercised with
// the real theme rather than a stand-in.
const render = (ui: ReactElement) => renderRaw(<Providers>{ui}</Providers>);

const items: ScannedProduct[] = [
  { lineId: 'a', barcode: '111', name: 'Chips', price: 2.5, qty: 1, productId: 'p1' },
  { lineId: 'b', barcode: '222', name: 'Jus', price: 1.25, qty: 3, productId: 'p2' },
];

describe('ScannedItemList', () => {
  it('shows each line with its quantity and line total', () => {
    render(<ScannedItemList items={items} />);

    expect(screen.getByText(/Chips/)).toBeTruthy();
    expect(screen.getByText('2.50$')).toBeTruthy();
    // Three at 1.25 is 3.75: the line total, not the unit price.
    expect(screen.getByText(/Jus\s*x3/)).toBeTruthy();
    expect(screen.getByText('3.75$')).toBeTruthy();
  });

  it('offers editing when a handler is given', () => {
    const onEdit = vi.fn();
    render(<ScannedItemList items={items} onEdit={onEdit} />);

    screen.getByText(/Chips/).click();

    expect(onEdit).toHaveBeenCalledWith(items[0]);
    expect(screen.getAllByText(/Modifier/).length).toBeGreaterThan(0);
  });

  it('is inert without a handler, as in the confirmation dialog', () => {
    // The recap is the last look before the sale is committed. Nothing there
    // should be able to change the cart out from under the totals beside it.
    render(<ScannedItemList items={items} />);

    expect(screen.queryByText(/Modifier/)).toBeNull();
    expect(screen.queryByText(/Touchez un article/)).toBeNull();
  });

  it('renders nothing but itself when the cart is empty', () => {
    render(<ScannedItemList items={[]} onEdit={vi.fn()} />);

    expect(screen.queryByText(/Touchez un article/)).toBeNull();
  });
});
