'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react';
import type { WeatherTheme } from '@/lib/domain/entities/config.entity';

const THEME_OPTIONS: { value: WeatherTheme; label: string }[] = [
  { value: 'default', label: 'Par défaut' },
  { value: 'sunny',   label: '☀️  Soleil' },
  { value: 'rainy',   label: '🌧️  Pluie' },
  { value: 'snow',    label: '❄️  Neige' },
  { value: 'storm',   label: '⛈️  Orage' },
  { value: 'sunset',  label: '🌅  Coucher de soleil' },
];

export default function AdminConfigPage() {
  const [theme, setTheme] = useState<WeatherTheme>('default');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.theme) setTheme(data.theme); })
      .catch(() => null);
  }, []);

  const handleChange = async (value: WeatherTheme) => {
    setTheme(value);
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex direction="column" px={8} py={6} gap={8}>
      <Heading size="2xl" fontWeight="800" letterSpacing="-0.02em">
        Configuration
      </Heading>

      <VStack align="stretch" gap={6} maxW="480px">
        {/* Weather theme section */}
        <Box
          borderWidth="1px"
          borderColor="border"
          borderRadius="2xl"
          p={6}
          bg="bg.subtle"
        >
          <VStack align="stretch" gap={4}>
            <VStack align="start" gap={1}>
              <Text fontWeight="700" fontSize="lg">
                Thème visuel
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Applique une ambiance animée sur les écrans clients.
              </Text>
            </VStack>

            <Box position="relative">
              <select
                value={theme}
                disabled={saving}
                onChange={(e) => handleChange(e.target.value as WeatherTheme)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '1.05rem',
                  fontWeight: '600',
                  borderRadius: '12px',
                  border: '1px solid var(--chakra-colors-border)',
                  background: 'var(--chakra-colors-bg)',
                  color: 'var(--chakra-colors-fg)',
                  appearance: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  outline: 'none',
                }}
              >
                {THEME_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {/* Chevron */}
              <Box
                position="absolute"
                right={4}
                top="50%"
                transform="translateY(-50%)"
                pointerEvents="none"
                color="fg.muted"
                fontSize="sm"
              >
                ▼
              </Box>
            </Box>

            {saved && (
              <Text fontSize="sm" color="green.500" fontWeight="600">
                ✓ Sauvegardé
              </Text>
            )}
          </VStack>
        </Box>
      </VStack>
    </Flex>
  );
}
