'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Flex,
  Text,
} from '@chakra-ui/react';
import { ChartCard } from './components/ChartCard';
import { InventoryChart } from './components/InventoryChart';
import { TransactionsByDayChart } from './components/TransactionsByDayChart';
import { StatCard } from './components/StatCard';

interface AnalyticsData {
  transactionsByDay: { date: string; count: number; amount: number }[];
  tabHistory: { date: string; cumulative: number }[];
  inventoryHistory: { date: string; value: number }[];
  totalUnpaidTabs: number;
  weeklyRevenue: {
    average: number;
    weeksCounted: number;
    partial: boolean;
  };
}

const EMPTY_WEEKLY_REVENUE: AnalyticsData['weeklyRevenue'] = {
  average: 0,
  weeksCounted: 0,
  partial: false,
};

function weeklyRevenueHint(weeklyRevenue: AnalyticsData['weeklyRevenue']): string {
  const { weeksCounted, partial } = weeklyRevenue;
  if (weeksCounted === 0) return 'Aucune vente enregistrée';
  if (partial) return 'Semaine en cours, encore incomplète';
  return `Moyenne sur ${weeksCounted} semaine${weeksCounted > 1 ? 's' : ''} complète${
    weeksCounted > 1 ? 's' : ''
  }`;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then((res) => (res.ok ? res.json() : null))
      // A cached response from an older build may predate weeklyRevenue; the
      // kiosk is a PWA, so tolerate it instead of blanking the dashboard.
      .then((json) => setData(json ? { ...json, weeklyRevenue: json.weeklyRevenue ?? EMPTY_WEEKLY_REVENUE } : null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Flex direction="column" px={8} py={6} pb={8}>
      {loading ? (
        <Flex justify="center" py={20}>
          <Text color="fg.muted" fontSize="lg">Chargement...</Text>
        </Flex>
      ) : !data ? (
        <Flex justify="center" py={20}>
          <Text color="red.500" fontSize="lg">Erreur de chargement des données.</Text>
        </Flex>
      ) : (
        <Box
          display="grid"
          gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gap={6}
        >
          <Box gridColumn={{ base: '1', lg: '1 / -1' }}>
            <ChartCard title="Valeur de l'inventaire">
              <InventoryChart data={data.inventoryHistory} />
            </ChartCard>
          </Box>
          <StatCard
            label="Total des ardoises impayées"
            value={`${data.totalUnpaidTabs.toFixed(2)}$`}
          />
          <StatCard
            label="Revenu moyen par semaine"
            value={`${data.weeklyRevenue.average.toFixed(2)}$`}
            hint={weeklyRevenueHint(data.weeklyRevenue)}
          />
          <Box gridColumn={{ base: '1', lg: '1 / -1' }}>
            <ChartCard title="Transactions par jour">
              <TransactionsByDayChart data={data.transactionsByDay} />
            </ChartCard>
          </Box>
        </Box>
      )}
    </Flex>
  );
}
