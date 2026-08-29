'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';

const NAV_LINKS = [
  { href: '/admin',                label: 'Employés' },
  { href: '/admin/transactions',   label: 'Transactions' },
  { href: '/admin/products',       label: 'Produits' },
  { href: '/admin/dashboard',      label: 'Tableau de bord' },
  { href: '/admin/restock',        label: 'Stocks' },
  { href: '/admin/announcements',  label: 'Annonces' },
  { href: '/admin/config',         label: 'Config' },
];

const NAV_H = '72px';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    setMounted(true);
    fetch('/api/admin/check')
      .then((res) => { if (res.ok) setAuthenticated(true); setCheckingAuth(false); })
      .catch(() => setCheckingAuth(false));
  }, []);

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

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/');
  };

  if (!mounted || checkingAuth) {
    return <Flex minH="100dvh" />;
  }

  if (!authenticated) {
    return (
      <Flex minH="100dvh" align="center" justify="center" px={8} direction="column" gap={6}>
        <IconButton
          aria-label="Retour"
          variant="outline"
          size="lg"
          color="fg.muted"
          fontSize="xl"
          position="absolute"
          top={6}
          right={6}
          onClick={() => router.push('/')}
        >
          ✕
        </IconButton>
        <Heading size={{ base: '2xl', md: '4xl' }} fontWeight="800" letterSpacing="-0.02em">
          Administration
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
            onChange={(e) => { setPin(e.target.value); setPinError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handlePin()}
            textAlign="center"
            fontSize={{ base: '3xl', md: '5xl' }}
            fontWeight="600"
            letterSpacing="0.2em"
            py={10}
            h="auto"
            autoFocus
          />
          {pinError && <Text color="red.500" fontSize="lg">{pinError}</Text>}
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
    <Box minH="100dvh" pb={NAV_H}>
      {/* Page content */}
      {children}

      {/* Fixed bottom nav */}
      <Flex
        as="nav"
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex={10}
        h={NAV_H}
        bg="bg"
        borderTop="1px solid"
        borderColor="border"
      >
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(href);
          return (
            <Flex
              key={href}
              flex={1}
              direction="column"
              align="center"
              justify="center"
              cursor="pointer"
              onClick={() => router.push(href)}
              gap="2px"
              position="relative"
              bg={isActive ? 'bg.subtle' : undefined}
              _hover={{ bg: 'bg.subtle' }}
              userSelect="none"
            >
              {/* Active indicator bar at top */}
              {isActive && (
                <Box
                  position="absolute"
                  top={0}
                  left="12%"
                  right="12%"
                  h="3px"
                  borderRadius="0 0 4px 4px"
                  bg="fg"
                />
              )}
              <Text
                fontSize="md"
                fontWeight={isActive ? '700' : '500'}
                color={isActive ? 'fg' : 'fg.muted'}
                lineHeight="1"
              >
                {label}
              </Text>
            </Flex>
          );
        })}

        {/* Logout */}
        <Flex
          w="72px"
          flexShrink={0}
          align="center"
          justify="center"
          borderLeft="1px solid"
          borderColor="border"
          cursor="pointer"
          color="fg.muted"
          _hover={{ bg: 'bg.subtle', color: 'fg' }}
          onClick={handleLogout}
          userSelect="none"
          fontSize="xl"
        >
          ✕
        </Flex>
      </Flex>
    </Box>
  );
}
