'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import {
  clearActionLog,
  downloadActionLog,
  readActionLog,
} from '@/lib/client/action-log.client';
import { LOG_CAPACITY, type ActionEntry } from '@/lib/client/action-log';

/** Newest first: debugging almost always starts from what just happened. */
const PREVIEW_LIMIT = 200;

export default function LogsPage() {
  const [entries, setEntries] = useState<ActionEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const refresh = useCallback(async () => {
    const all = await readActionLog();
    setEntries([...all].reverse());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleExport = async () => {
    setBusy(true);
    try {
      const exported = await downloadActionLog();
      setStatus(`${exported} action(s) exportée(s).`);
    } catch {
      setStatus("Échec de l'export.");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Effacer le journal local de cet appareil ?')) return;
    setBusy(true);
    await clearActionLog();
    await refresh();
    setStatus('Journal effacé.');
    setBusy(false);
  };

  return (
    <Flex direction="column" px={8} py={6} gap={4}>
      <Text fontSize="sm" color="fg.muted">
        Journal des actions enregistré <strong>sur cet appareil uniquement</strong> (max{' '}
        {LOG_CAPACITY} entrées, les plus anciennes sont supprimées). Exportez-le depuis
        l&apos;iPad concerné : il n&apos;est pas synchronisé avec le serveur.
      </Text>

      <Flex gap={3} align="center" wrap="wrap">
        <Button onClick={handleExport} disabled={busy || !entries?.length}>
          Exporter (.ndjson)
        </Button>
        <Button onClick={refresh} variant="outline" disabled={busy}>
          Rafraîchir
        </Button>
        <Button onClick={handleClear} variant="outline" colorPalette="red" disabled={busy}>
          Effacer
        </Button>
        {entries ? (
          <Text color="fg.muted" fontSize="sm">
            {entries.length} entrée(s)
          </Text>
        ) : null}
        {status ? (
          <Text color="fg.muted" fontSize="sm">
            {status}
          </Text>
        ) : null}
      </Flex>

      {entries === null ? (
        <Text color="fg.muted">Chargement...</Text>
      ) : entries.length === 0 ? (
        <Text color="fg.muted">Aucune action enregistrée sur cet appareil.</Text>
      ) : (
        <Box
          borderRadius="xl"
          border="1px solid"
          borderColor="border"
          overflowX="auto"
          fontFamily="mono"
          fontSize="xs"
        >
          {entries.slice(0, PREVIEW_LIMIT).map((entry) => (
            <Flex
              key={entry.seq}
              gap={3}
              px={4}
              py={1.5}
              borderBottom="1px solid"
              borderColor="border"
              whiteSpace="nowrap"
            >
              <Text color="fg.muted" minW="12">
                #{entry.seq}
              </Text>
              <Text color="fg.muted" minW="44">
                {entry.at}
              </Text>
              <Text fontWeight="700" minW="28">
                {entry.type}
              </Text>
              <Text color="fg.muted">{JSON.stringify(entry.detail)}</Text>
            </Flex>
          ))}
        </Box>
      )}

      {entries && entries.length > PREVIEW_LIMIT ? (
        <Text color="fg.muted" fontSize="sm">
          Seules les {PREVIEW_LIMIT} dernières actions sont affichées. L&apos;export contient
          tout.
        </Text>
      ) : null}
    </Flex>
  );
}
