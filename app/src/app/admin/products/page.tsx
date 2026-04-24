'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  Text,
  VStack,
  DialogRoot,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogBackdrop,
  DialogTitle,
  Separator,
} from '@chakra-ui/react';

interface Product {
  id: string;
  barcodes: string[];
  name: string;
  price: number;
  quantity: number;
}

const RAPID_INPUT_THRESHOLD_MS = 80;
const AUTO_SUBMIT_DELAY_MS = 300;
const MIN_LENGTH = 4;

export default function AdminProductsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Barcode scanner state
  const [scanValue, setScanValue] = useState('');
  const lastKeystrokeRef = useRef(0);
  const rapidCountRef = useRef(0);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Known product restock modal
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('');

  // Unknown barcode modal
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [newProductMode, setNewProductMode] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newQty, setNewQty] = useState('');
  const [associateSearch, setAssociateSearch] = useState('');

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Inline quantity edits
  const [quantityEdits, setQuantityEdits] = useState<Record<string, number>>({});
  const [priceEdits, setPriceEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // Error/feedback
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setMounted(true);
    fetch('/api/admin/check').then((res) => {
      if (res.ok) setAuthenticated(true);
    });
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/products');
    if (!res.ok) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }
    data.sort((a: Product, b: Product) => a.name.localeCompare(b.name));
    setProducts(data);
    setQuantityEdits({});
    setPriceEdits({});
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authenticated) fetchProducts();
  }, [authenticated, fetchProducts]);

  const handlePin = async () => {
    setPinError('');
    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (data.valid) {
      setAuthenticated(true);
    } else {
      setPinError('NIP invalide.');
      setPin('');
    }
  };

  // Barcode scan handler
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      const value = barcode.trim();
      if (!value || value.length < MIN_LENGTH) return;

      const res = await fetch(
        `/api/products/lookup?barcode=${encodeURIComponent(value)}`
      );
      const data = await res.json();

      if (data.found) {
        setRestockProduct(data.product);
        setRestockQty('1');
      } else {
        setUnknownBarcode(value);
        setNewProductMode(true);
        setNewName('');
        setNewPrice('');
        setNewQty('1');
        setAssociateSearch('');
      }

      setScanValue('');
    },
    []
  );

  // Restock save
  const handleRestock = async () => {
    if (!restockProduct) return;
    const qty = parseInt(restockQty);
    if (isNaN(qty) || qty < 1) return;

    await fetch('/api/products/restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          { id: restockProduct.id, quantity: restockProduct.quantity + qty },
        ],
      }),
    });

    setRestockProduct(null);
    setRestockQty('');
    fetchProducts();
  };

  // Create new product
  const handleCreateProduct = async () => {
    const price = parseFloat(newPrice);
    const qty = parseInt(newQty);
    if (!newName || isNaN(price) || price < 0 || isNaN(qty) || qty < 0) return;

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcodes: [unknownBarcode],
        name: newName,
        price,
        quantity: qty,
      }),
    });

    if (res.ok) {
      setUnknownBarcode('');
      fetchProducts();
    } else {
      const data = await res.json();
      setFeedback(data.error || 'Erreur');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // Associate barcode with existing product
  const handleAssociateBarcode = async (productId: string) => {
    const res = await fetch(`/api/products/${productId}/barcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: unknownBarcode }),
    });

    if (res.ok) {
      setUnknownBarcode('');
      fetchProducts();
    } else {
      const data = await res.json();
      setFeedback(data.error || 'Erreur');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  // Inline quantity change
  const handleQuantityChange = (productId: string, newQty: number) => {
    setQuantityEdits((prev) => ({ ...prev, [productId]: newQty }));
  };

  // Bulk save quantities and prices
  const handleBulkSave = async () => {
    if (!hasEdits) return;

    setSaving(true);

    // Collect all edited product IDs
    const editedIds = new Set([
      ...Object.keys(quantityEdits),
      ...Object.keys(priceEdits),
    ]);

    const promises = Array.from(editedIds).map((id) => {
      const updates: Record<string, number> = {};
      if (quantityEdits[id] !== undefined) updates.quantity = quantityEdits[id];
      if (priceEdits[id] !== undefined) updates.price = priceEdits[id];
      return fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    });

    await Promise.all(promises);

    setSaving(false);
    fetchProducts();
  };

  // Delete product
  const handleDelete = async () => {
    if (!deleteTarget) return;

    const res = await fetch(`/api/products/${deleteTarget.id}`, {
      method: 'DELETE',
    });

    setDeleteTarget(null);

    if (!res.ok) {
      setAuthenticated(false);
      return;
    }

    fetchProducts();
  };

  const hasEdits = Object.keys(quantityEdits).length > 0 || Object.keys(priceEdits).length > 0;

  // Filter products for association search
  const filteredProducts = associateSearch
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(associateSearch.toLowerCase()) ||
          p.barcodes.some((b) => b.includes(associateSearch))
      )
    : products;

  if (!mounted) {
    return <Flex minH="100dvh" />;
  }

  if (!authenticated) {
    return (
      <Flex
        minH="100dvh"
        align="center"
        justify="center"
        px={8}
        direction="column"
        gap={6}
      >
        <IconButton
          aria-label="Retour"
          variant="outline"
          size="lg"
          color="fg.muted"
          fontSize="xl"
          position="absolute"
          top={6}
          right={6}
          onClick={() => router.push('/admin')}
        >
          ✕
        </IconButton>

        <Heading
          size={{ base: '2xl', md: '4xl' }}
          fontWeight="800"
          letterSpacing="-0.02em"
        >
          Produits
        </Heading>
        <Text color="fg.muted" fontSize={{ base: 'lg', md: 'xl' }}>
          Entrez le NIP
        </Text>

        <VStack gap={4} w="full" maxW="400px">
          <Input
            type="password"
            inputMode="numeric"
            placeholder="NIP"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setPinError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handlePin()}
            textAlign="center"
            fontSize={{ base: '3xl', md: '5xl' }}
            fontWeight="600"
            letterSpacing="0.2em"
            py={10}
            h="auto"
            autoFocus
          />
          {pinError && (
            <Text color="red.500" fontSize="lg">
              {pinError}
            </Text>
          )}
          <Button
            w="full"
            h="auto"
            py={6}
            colorPalette="gray"
            onClick={handlePin}
            fontWeight="600"
            fontSize={{ base: 'xl', md: '2xl' }}
          >
            Continuer
          </Button>
        </VStack>
      </Flex>
    );
  }

  return (
    <>
      <Flex minH="100dvh" direction="column" px={8} py={6}>
        {/* Top bar */}
        <Flex justify="space-between" align="center">
          <Heading
            size={{ base: '2xl', md: '4xl' }}
            fontWeight="800"
            letterSpacing="-0.02em"
          >
            Produits
          </Heading>
          <IconButton
            aria-label="Fermer"
            variant="outline"
            size="lg"
            color="fg.muted"
            fontSize="xl"
            onClick={() => router.push('/admin')}
          >
            ✕
          </IconButton>
        </Flex>

        {/* Scanner section */}
        <Box mt={8} position="relative">
          <Text fontSize="md" fontWeight="600" color="fg.muted" mb={2}>
            Scanner un code-barres pour ajouter ou réapprovisionner
          </Text>
          <Input
            ref={scanInputRef}
            value={scanValue}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setScanValue(val);

              const now = Date.now();
              if (now - lastKeystrokeRef.current < RAPID_INPUT_THRESHOLD_MS) {
                rapidCountRef.current++;
              } else {
                rapidCountRef.current = 1;
              }
              lastKeystrokeRef.current = now;

              if (autoSubmitTimerRef.current) {
                clearTimeout(autoSubmitTimerRef.current);
              }

              if (rapidCountRef.current >= 3 && val.length >= MIN_LENGTH) {
                autoSubmitTimerRef.current = setTimeout(() => {
                  handleBarcodeScan(val);
                }, AUTO_SUBMIT_DELAY_MS);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (autoSubmitTimerRef.current)
                  clearTimeout(autoSubmitTimerRef.current);
                handleBarcodeScan(scanValue);
              }
            }}
            placeholder="Code-barres..."
            fontSize={{ base: 'lg', md: 'xl' }}
            py={6}
            h="auto"
            autoFocus
          />
        </Box>

        {feedback && (
          <Text color="red.500" fontSize="md" mt={2}>
            {feedback}
          </Text>
        )}

        {/* Summary */}
        {!loading && products.length > 0 && (
          <Flex
            mt={6}
            py={5}
            px={6}
            borderRadius="xl"
            bg="bg.subtle"
            justify="space-between"
            align="center"
          >
            <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="600">
              {products.length} produit{products.length > 1 ? 's' : ''}
            </Text>
            <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="800">
              {products
                .reduce((sum, p) => sum + p.price * p.quantity, 0)
                .toFixed(2)}
              $ en inventaire
            </Text>
          </Flex>
        )}

        {/* Products table */}
        <VStack gap={0} w="full" mt={6}>
          {/* Header */}
          <Flex
            w="full"
            py={4}
            px={6}
            borderBottom="2px solid"
            borderColor="border"
          >
            <Text
              flex={3}
              fontWeight="700"
              fontSize={{ base: 'sm', md: 'md' }}
              color="fg.muted"
            >
              Nom
            </Text>
            <Text
              flex={2}
              fontWeight="700"
              fontSize={{ base: 'sm', md: 'md' }}
              color="fg.muted"
            >
              Code-barres
            </Text>
            <Text
              flex={1}
              fontWeight="700"
              fontSize={{ base: 'sm', md: 'md' }}
              color="fg.muted"
              textAlign="right"
            >
              Prix
            </Text>
            <Text
              flex={1}
              fontWeight="700"
              fontSize={{ base: 'sm', md: 'md' }}
              color="fg.muted"
              textAlign="right"
            >
              Qté
            </Text>
            <Box flex={0.5} />
          </Flex>

          {loading && (
            <Flex py={12} justify="center" w="full">
              <Text color="fg.muted" fontSize="lg">
                Chargement...
              </Text>
            </Flex>
          )}

          {!loading && products.length === 0 && (
            <Flex py={12} justify="center" w="full">
              <Text color="fg.muted" fontSize="lg">
                Aucun produit. Scannez un code-barres pour commencer.
              </Text>
            </Flex>
          )}

          {products.map((product) => {
            const editedQty = quantityEdits[product.id];
            const currentQty =
              editedQty !== undefined ? editedQty : product.quantity;

            return (
              <Flex
                key={product.id}
                w="full"
                py={4}
                px={6}
                borderBottom="1px solid"
                borderColor="border.muted"
                align="center"
                _hover={{ bg: 'bg.subtle' }}
              >
                <Text
                  flex={3}
                  fontSize={{ base: 'md', md: 'lg' }}
                  fontWeight="600"
                >
                  {product.name}
                </Text>
                <Text
                  flex={2}
                  fontSize={{ base: 'sm', md: 'md' }}
                  color="fg.muted"
                >
                  {product.barcodes.join(', ')}
                </Text>
                <Flex flex={1} justify="end">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceEdits[product.id] !== undefined ? priceEdits[product.id] : product.price}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        setPriceEdits((prev) => ({ ...prev, [product.id]: val }));
                      }
                    }}
                    w="90px"
                    textAlign="center"
                    fontWeight="600"
                    fontSize={{ base: 'md', md: 'lg' }}
                  />
                </Flex>
                <Flex flex={1} justify="end">
                  <Input
                    type="number"
                    value={currentQty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        handleQuantityChange(product.id, val);
                      }
                    }}
                    w="80px"
                    textAlign="center"
                    fontWeight="600"
                    fontSize={{ base: 'md', md: 'lg' }}
                    color={
                      currentQty === 0
                        ? 'red.500'
                        : currentQty < 5
                          ? 'yellow.500'
                          : undefined
                    }
                  />
                </Flex>
                <Flex flex={0.5} justify="end">
                  <IconButton
                    aria-label="Supprimer"
                    variant="ghost"
                    size="sm"
                    color="fg.muted"
                    onClick={() => setDeleteTarget(product)}
                  >
                    ✕
                  </IconButton>
                </Flex>
              </Flex>
            );
          })}
        </VStack>

        {/* Bulk save button */}
        {hasEdits && (
          <>
            <Separator mt={6} />
            <Button
              mt={4}
              w="full"
              h="auto"
              py={6}
              colorPalette="gray"
              onClick={handleBulkSave}
              loading={saving}
              fontWeight="600"
              fontSize={{ base: 'xl', md: '2xl' }}
            >
              Sauvegarder
            </Button>
          </>
        )}
      </Flex>

      {/* Restock modal (known product) */}
      <DialogRoot
        open={!!restockProduct}
        onOpenChange={(e) => {
          if (!e.open) {
            setRestockProduct(null);
            setRestockQty('');
          }
        }}
        placement="center"
        size="lg"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent p={8}>
            <DialogHeader pb={4}>
              <DialogTitle fontSize="2xl" fontWeight="700">
                Réapprovisionner
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <VStack gap={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="lg" color="fg.muted">
                    Produit
                  </Text>
                  <Text fontSize="lg" fontWeight="700">
                    {restockProduct?.name}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="lg" color="fg.muted">
                    Prix
                  </Text>
                  <Text fontSize="lg" fontWeight="700">
                    {restockProduct?.price.toFixed(2)}$
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="lg" color="fg.muted">
                    Stock actuel
                  </Text>
                  <Text fontSize="lg" fontWeight="700">
                    {restockProduct?.quantity}
                  </Text>
                </HStack>
                <Separator />
                <Text fontSize="md" fontWeight="600">
                  Quantité à ajouter
                </Text>
                <Input
                  type="number"
                  min={1}
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  fontSize={{ base: '2xl', md: '3xl' }}
                  fontWeight="600"
                  textAlign="center"
                  py={6}
                  h="auto"
                  autoFocus
                />
                {restockProduct && restockQty && (
                  <Text
                    fontSize="md"
                    color="fg.muted"
                    textAlign="center"
                  >
                    Nouveau stock :{' '}
                    {restockProduct.quantity + (parseInt(restockQty) || 0)}
                  </Text>
                )}
              </VStack>
            </DialogBody>
            <DialogFooter pt={6}>
              <HStack gap={3} w="full">
                <Button
                  flex={1}
                  variant="outline"
                  size="lg"
                  fontSize="lg"
                  onClick={() => {
                    setRestockProduct(null);
                    setRestockQty('');
                  }}
                >
                  Annuler
                </Button>
                <Button
                  flex={1}
                  colorPalette="gray"
                  size="lg"
                  fontSize="lg"
                  onClick={handleRestock}
                  disabled={!restockQty || parseInt(restockQty) < 1}
                >
                  Réapprovisionner
                </Button>
              </HStack>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>

      {/* Unknown barcode modal */}
      <DialogRoot
        open={!!unknownBarcode}
        onOpenChange={(e) => {
          if (!e.open) setUnknownBarcode('');
        }}
        placement="center"
        size="lg"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent p={8}>
            <DialogHeader pb={4}>
              <DialogTitle fontSize="2xl" fontWeight="700">
                Code-barres inconnu
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text fontSize="md" color="fg.muted" mb={4}>
                Code-barres : <strong>{unknownBarcode}</strong>
              </Text>

              {/* Mode toggle */}
              <HStack gap={2} mb={6}>
                <Button
                  flex={1}
                  size="sm"
                  variant={newProductMode ? 'solid' : 'outline'}
                  colorPalette="gray"
                  onClick={() => setNewProductMode(true)}
                >
                  Nouveau produit
                </Button>
                <Button
                  flex={1}
                  size="sm"
                  variant={!newProductMode ? 'solid' : 'outline'}
                  colorPalette="gray"
                  onClick={() => setNewProductMode(false)}
                >
                  Associer
                </Button>
              </HStack>

              {newProductMode ? (
                <VStack gap={4} align="stretch">
                  <Input
                    placeholder="Nom du produit"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    fontSize="lg"
                    py={4}
                    h="auto"
                    autoFocus
                  />
                  <Input
                    placeholder="Prix"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    fontSize="lg"
                    py={4}
                    h="auto"
                  />
                  <Input
                    placeholder="Quantité"
                    type="number"
                    min="0"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    fontSize="lg"
                    py={4}
                    h="auto"
                  />
                </VStack>
              ) : (
                <VStack gap={3} align="stretch">
                  <Input
                    placeholder="Rechercher un produit..."
                    value={associateSearch}
                    onChange={(e) => setAssociateSearch(e.target.value)}
                    fontSize="md"
                    autoFocus
                  />
                  <Box maxH="300px" overflowY="auto">
                    {filteredProducts.length === 0 && (
                      <Text color="fg.muted" fontSize="md" py={4} textAlign="center">
                        Aucun produit trouvé
                      </Text>
                    )}
                    {filteredProducts.map((p) => (
                      <Flex
                        key={p.id}
                        py={3}
                        px={4}
                        borderBottom="1px solid"
                        borderColor="border.muted"
                        align="center"
                        justify="space-between"
                        cursor="pointer"
                        _hover={{ bg: 'bg.subtle' }}
                        onClick={() => handleAssociateBarcode(p.id)}
                        borderRadius="md"
                      >
                        <VStack align="start" gap={0}>
                          <Text fontWeight="600">{p.name}</Text>
                          <Text fontSize="sm" color="fg.muted">
                            {p.barcodes.join(', ')}
                          </Text>
                        </VStack>
                        <Text fontWeight="600">{p.price.toFixed(2)}$</Text>
                      </Flex>
                    ))}
                  </Box>
                </VStack>
              )}
            </DialogBody>
            {newProductMode && (
              <DialogFooter pt={6}>
                <HStack gap={3} w="full">
                  <Button
                    flex={1}
                    variant="outline"
                    size="lg"
                    fontSize="lg"
                    onClick={() => setUnknownBarcode('')}
                  >
                    Annuler
                  </Button>
                  <Button
                    flex={1}
                    colorPalette="gray"
                    size="lg"
                    fontSize="lg"
                    onClick={handleCreateProduct}
                    disabled={
                      !newName ||
                      !newPrice ||
                      parseFloat(newPrice) < 0 ||
                      !newQty ||
                      parseInt(newQty) < 0
                    }
                  >
                    Créer
                  </Button>
                </HStack>
              </DialogFooter>
            )}
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>

      {/* Delete confirmation modal */}
      <DialogRoot
        open={!!deleteTarget}
        onOpenChange={(e) => {
          if (!e.open) setDeleteTarget(null);
        }}
        placement="center"
        size="lg"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent p={8}>
            <DialogHeader pb={4}>
              <DialogTitle fontSize="2xl" fontWeight="700">
                Supprimer un produit
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text fontSize="lg">
                Le produit{' '}
                <Text as="span" fontWeight="700">
                  {deleteTarget?.name}
                </Text>{' '}
                sera supprimé définitivement. Cette action est irréversible.
              </Text>
            </DialogBody>
            <DialogFooter pt={6}>
              <HStack gap={3} w="full">
                <Button
                  flex={1}
                  variant="outline"
                  size="lg"
                  fontSize="lg"
                  onClick={() => setDeleteTarget(null)}
                >
                  Annuler
                </Button>
                <Button
                  flex={1}
                  colorPalette="red"
                  size="lg"
                  fontSize="lg"
                  onClick={handleDelete}
                >
                  Supprimer
                </Button>
              </HStack>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </>
  );
}
