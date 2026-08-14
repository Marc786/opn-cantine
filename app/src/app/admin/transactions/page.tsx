'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Text,
  DialogRoot,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogBackdrop,
  DialogTitle,
  DialogCloseTrigger,
} from '@chakra-ui/react';
import {
  useTable,
  flexRender,
  tableFeatures,
  createColumnHelper,
  createCoreRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_datetime,
  sortFn_basic,
  type SortingState,
} from '@tanstack/react-table';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  cardNumber: string;
  employeeNumber: string;
  tab: number;
}

interface TransactionItem {
  barcode: string;
  name: string;
  price: number;
  quantity: number;
}

interface Transaction {
  id?: string;
  cardNumber: string;
  items: TransactionItem[];
  totalAmount: number;
  timestamp: string;
}

interface PagedResult {
  data: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface TxRow {
  id: string;
  timestamp: string;
  employeeNumber: string;
  articles: string;
  totalAmount: number;
}

// ─── TanStack Table setup (outside component — stable references) ─────────────

const _features = tableFeatures({
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
});

const colHelper = createColumnHelper<typeof _features, TxRow>();

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString('fr-CA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const COLUMNS = [
  colHelper.accessor('timestamp', {
    header: 'Date / Heure',
    cell: (info) => (
      <Text fontSize="sm" color="fg.muted">{formatDate(info.getValue())}</Text>
    ),
    sortFn: sortFn_datetime,
  }),
  colHelper.accessor('employeeNumber', {
    header: 'Employé',
    cell: (info) => (
      <Text fontSize="sm" fontWeight="600">{info.getValue()}</Text>
    ),
  }),
  colHelper.accessor('articles', {
    header: 'Articles',
    enableSorting: false,
    cell: (info) => (
      <Text fontSize="sm" color="fg.muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
        {info.getValue()}
      </Text>
    ),
  }),
  colHelper.accessor('totalAmount', {
    header: 'Montant',
    sortFn: sortFn_basic,
    cell: (info) => (
      <Text fontSize="sm" fontWeight="700" textAlign="right">{info.getValue().toFixed(2)}$</Text>
    ),
  }),
];

function SortIcon({ dir }: { dir: false | 'asc' | 'desc' }) {
  if (!dir) return <Box as="span" color="fg.muted" fontSize="10px" ml={1}>⇅</Box>;
  return <Box as="span" fontSize="10px" ml={1}>{dir === 'asc' ? '↑' : '↓'}</Box>;
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function AdminTransactionsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});
  const [allItems, setAllItems] = useState<string[]>([]);

  const [cardNumber, setCardNumber] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState('');

  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PagedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }]);

  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/employees/all')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Employee[]) => {
        setEmployees(data.sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber)));
        const map: Record<string, string> = {};
        data.forEach((e) => { map[e.cardNumber] = e.employeeNumber; });
        setEmployeeMap(map);
      })
      .catch(() => null);

    fetch('/api/transactions/items')
      .then((r) => r.ok ? r.json() : [])
      .then((data: string[]) => setAllItems(data))
      .catch(() => null);
  }, []);

  const fetchPage = useCallback(async (p: number, cn: string, items: string[]) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (cn) params.set('cardNumber', cn);
      if (items.length > 0) params.set('items', items.join(','));
      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      fetchPage(page, cardNumber, selectedItems);
    }, 150);
    return () => { if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current); };
  }, [page, cardNumber, selectedItems, fetchPage]);

  const rows = useMemo<TxRow[]>(() =>
    (result?.data ?? []).map((tx, i) => ({
      id: tx.id ?? String(i),
      timestamp: tx.timestamp,
      employeeNumber: employeeMap[tx.cardNumber] ?? tx.cardNumber,
      articles: tx.items.map((it) => `${it.name}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(', '),
      totalAmount: tx.totalAmount,
    })),
    [result, employeeMap]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = useTable({
    features: _features,
    data: rows,
    columns: COLUMNS as any,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCardNumber(e.target.value);
    setPage(1);
  };

  const toggleDraftItem = (name: string) => {
    setModalDraft((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const removeItem = (name: string) => {
    setSelectedItems((prev) => prev.filter((n) => n !== name));
    setPage(1);
  };

  return (
    <>
      <Flex direction="column" px={8} py={6} gap={6} pb={8}>
        <Heading size="2xl" fontWeight="800" letterSpacing="-0.02em">
          Transactions
        </Heading>

        {/* Filters */}
        <Flex gap={4} align="flex-start" wrap="wrap">
          <Box position="relative" minW="220px">
            <select
              value={cardNumber}
              onChange={handleEmployeeChange}
              style={{
                width: '100%',
                padding: '12px 36px 12px 14px',
                fontSize: '1rem',
                fontWeight: '600',
                borderRadius: '10px',
                border: '1px solid var(--chakra-colors-border)',
                background: 'var(--chakra-colors-bg)',
                color: 'var(--chakra-colors-fg)',
                appearance: 'none',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">Tous les employés</option>
              {employees.map((e) => (
                <option key={e.cardNumber} value={e.cardNumber}>
                  {e.employeeNumber}
                </option>
              ))}
            </select>
            <Box position="absolute" right={3} top="50%" transform="translateY(-50%)" pointerEvents="none" color="fg.muted" fontSize="xs">▼</Box>
          </Box>

          <Button
            variant="outline"
            fontWeight="600"
            onClick={() => { setModalDraft(selectedItems); setItemSearch(''); setItemModalOpen(true); }}
            size="md"
          >
            {selectedItems.length === 0
              ? 'Filtrer par article'
              : `${selectedItems.length} article${selectedItems.length > 1 ? 's' : ''} sélectionné${selectedItems.length > 1 ? 's' : ''}`}
          </Button>
        </Flex>

        {/* Active item chips */}
        {selectedItems.length > 0 && (
          <HStack gap={2} wrap="wrap">
            {selectedItems.map((name) => (
              <HStack key={name} gap={1} px={3} py={1} borderRadius="full" bg="bg.subtle" borderWidth="1px" borderColor="border" fontSize="sm" fontWeight="600">
                <Text>{name}</Text>
                <Box cursor="pointer" color="fg.muted" _hover={{ color: 'fg' }} onClick={() => removeItem(name)} px={1}>✕</Box>
              </HStack>
            ))}
            <Button variant="ghost" size="sm" color="fg.muted" onClick={() => { setSelectedItems([]); setPage(1); }}>
              Tout effacer
            </Button>
          </HStack>
        )}

        {/* Results summary */}
        {result && !loading && (
          <Text fontSize="sm" color="fg.muted">
            {result.total} transaction{result.total !== 1 ? 's' : ''}
            {result.totalPages > 1 && ` — page ${result.page} / ${result.totalPages}`}
          </Text>
        )}

        {/* Table */}
        <Box borderWidth="1px" borderColor="border" borderRadius="xl" overflow="hidden">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} style={{ background: 'var(--chakra-colors-bg-subtle)', borderBottom: '2px solid var(--chakra-colors-border)' }}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        padding: '12px 20px',
                        textAlign: header.column.id === 'totalAmount' ? 'right' : 'left',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        color: 'var(--chakra-colors-fg-muted)',
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <SortIcon dir={header.column.getIsSorted()} />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--chakra-colors-border-muted)', opacity: 0.4 + (i % 3) * 0.1 }}>
                      {[2, 2, 4, 1].map((f, j) => (
                        <td key={j} style={{ padding: '16px 20px' }}>
                          <Box h="14px" bg="var(--chakra-colors-bg-subtle)" borderRadius="6px" style={{ width: `${f * 60}px` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : table.getRowModel().rows.length === 0
                  ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--chakra-colors-fg-muted)' }}>
                        Aucune transaction trouvée.
                      </td>
                    </tr>
                  )
                  : table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: '1px solid var(--chakra-colors-border-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--chakra-colors-bg-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      {row.getAllCells().map((cell) => (
                        <td
                          key={cell.id}
                          style={{
                            padding: '14px 20px',
                            textAlign: cell.column.id === 'totalAmount' ? 'right' : 'left',
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </Box>

        {/* Pagination */}
        {result && result.totalPages > 1 && (
          <HStack justify="center" gap={4}>
            <Button variant="outline" size="md" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} fontWeight="600">
              ← Précédent
            </Button>
            <Text fontWeight="600" fontSize="md">{page} / {result.totalPages}</Text>
            <Button variant="outline" size="md" disabled={page >= result.totalPages} onClick={() => setPage((p) => p + 1)} fontWeight="600">
              Suivant →
            </Button>
          </HStack>
        )}
      </Flex>

      {/* Item selection modal */}
      <DialogRoot open={itemModalOpen} onOpenChange={(e) => { if (!e.open) setItemModalOpen(false); }} placement="center" size="xl">
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent maxH="85dvh" minW={{ base: '90vw', md: '680px' }} display="flex" flexDirection="column">
            <DialogHeader flexShrink={0}>
              <DialogTitle fontSize="xl" fontWeight="700">Filtrer par article</DialogTitle>
              <DialogCloseTrigger />
            </DialogHeader>

            {/* Search */}
            {allItems.length > 8 && (
              <Box px={6} pb={3} flexShrink={0}>
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Rechercher un article…"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '0.95rem',
                    borderRadius: '8px',
                    border: '1px solid var(--chakra-colors-border)',
                    background: 'var(--chakra-colors-bg)',
                    color: 'var(--chakra-colors-fg)',
                    outline: 'none',
                  }}
                />
              </Box>
            )}

            <DialogBody overflowY="auto" flex={1} px={4} css={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-track': { background: 'transparent' }, '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-border)', borderRadius: '4px' } }}>
              {allItems.length === 0
                ? <Text color="fg.muted" py={4} textAlign="center">Aucun article trouvé.</Text>
                : (() => {
                    const filtered = allItems.filter((n) =>
                      n.toLowerCase().includes(itemSearch.toLowerCase())
                    );
                    if (filtered.length === 0) {
                      return <Text color="fg.muted" py={4} textAlign="center">Aucun résultat.</Text>;
                    }
                    return (
                      <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1}>
                        {filtered.map((name) => {
                          const checked = modalDraft.includes(name);
                          return (
                            <Flex
                              key={name}
                              align="center"
                              gap={3}
                              px={3}
                              py={2}
                              borderRadius="lg"
                              cursor="pointer"
                              bg={checked ? 'bg.subtle' : undefined}
                              borderWidth="1px"
                              borderColor={checked ? 'border' : 'transparent'}
                              _hover={{ bg: 'bg.subtle' }}
                              onClick={() => toggleDraftItem(name)}
                              userSelect="none"
                            >
                              <Box
                                w="18px" h="18px" borderRadius="5px" borderWidth="2px"
                                borderColor={checked ? 'fg' : 'border'}
                                bg={checked ? 'fg' : 'transparent'}
                                display="flex" alignItems="center" justifyContent="center"
                                flexShrink={0} color="bg" fontSize="10px" fontWeight="800"
                              >
                                {checked && '✓'}
                              </Box>
                              <Text fontWeight="500" fontSize="sm" overflow="hidden" style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Text>
                            </Flex>
                          );
                        })}
                      </Box>
                    );
                  })()
              }
            </DialogBody>
            <DialogFooter flexShrink={0} pt={4}>
              <HStack gap={3} w="full">
                <Button flex={1} variant="outline" size="lg" onClick={() => setModalDraft([])}>
                  Tout désélectionner
                </Button>
                <Button flex={1} colorPalette="gray" size="lg" onClick={() => { setSelectedItems(modalDraft); setItemModalOpen(false); setPage(1); }}>
                  Appliquer ({modalDraft.length})
                </Button>
              </HStack>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </>
  );
}
