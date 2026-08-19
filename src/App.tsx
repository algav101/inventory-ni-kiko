import { useEffect, useState } from 'react';
import { seedDatabaseIfEmpty } from './db/database';
import { MobileShell } from './components/layout/MobileShell';
import { Dashboard } from './components/dashboard/Dashboard';
import { InventoryList } from './components/inventory/InventoryList';
import { ItemDetail } from './components/inventory/ItemDetail';
import { OcrIntake } from './components/intake/OcrIntake';
import { ManualIntake } from './components/intake/ManualIntake';
import { DeliveryPlans } from './components/delivery/DeliveryPlans';
import { BackOrderManager } from './components/backorder/BackOrderManager';
import { AuditTrailView } from './components/history/AuditTrailView';
import { ReceiveStockModal } from './components/stock/ReceiveStockModal';
import { StockCorrectionModal } from './components/stock/StockCorrectionModal';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Modals state
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveModalItemId, setReceiveModalItemId] = useState<number | undefined>(undefined);

  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionModalItemId, setCorrectionModalItemId] = useState<number | null>(null);

  // Seed DB on mount
  useEffect(() => {
    seedDatabaseIfEmpty().catch(console.error);
  }, []);

  const handleSelectItem = (id: number) => {
    setSelectedItemId(id);
  };

  const handleOpenReceiveModal = (id?: number) => {
    setReceiveModalItemId(id);
    setIsReceiveModalOpen(true);
  };

  const handleOpenCorrectionModal = (id: number) => {
    setCorrectionModalItemId(id);
    setIsCorrectionModalOpen(true);
  };

  return (
    <MobileShell
      activeTab={activeTab}
      setActiveTab={tab => {
        setSelectedItemId(null);
        setActiveTab(tab);
      }}
      onOpenReceiveModal={() => handleOpenReceiveModal(selectedItemId ?? undefined)}
    >
      {/* Tab Routing */}
      {selectedItemId !== null ? (
        <ItemDetail
          itemId={selectedItemId}
          onBack={() => setSelectedItemId(null)}
          onOpenReceiveModal={handleOpenReceiveModal}
          onOpenCorrectionModal={handleOpenCorrectionModal}
        />
      ) : activeTab === 'dashboard' ? (
        <Dashboard
          setActiveTab={setActiveTab}
          onOpenReceiveModal={() => handleOpenReceiveModal()}
          onOpenManualIntake={() => setActiveTab('manual_intake')}
          onSelectItem={handleSelectItem}
        />
      ) : activeTab === 'inventory' ? (
        <InventoryList
          onSelectItem={handleSelectItem}
          onOpenManualIntake={() => setActiveTab('manual_intake')}
          onOpenReceiveModal={handleOpenReceiveModal}
        />
      ) : activeTab === 'ocr_intake' ? (
        <OcrIntake
          onFinishCommit={() => setActiveTab('inventory')}
          onOpenManualIntake={() => setActiveTab('manual_intake')}
        />
      ) : activeTab === 'manual_intake' ? (
        <ManualIntake
          onBack={() => setActiveTab('inventory')}
          onFinished={() => setActiveTab('inventory')}
        />
      ) : activeTab === 'delivery' ? (
        <DeliveryPlans />
      ) : activeTab === 'backorder' ? (
        <BackOrderManager />
      ) : activeTab === 'history' ? (
        <AuditTrailView />
      ) : (
        <Dashboard
          setActiveTab={setActiveTab}
          onOpenReceiveModal={() => handleOpenReceiveModal()}
          onOpenManualIntake={() => setActiveTab('manual_intake')}
          onSelectItem={handleSelectItem}
        />
      )}

      {/* Global Modals */}
      <ReceiveStockModal
        itemId={receiveModalItemId}
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
      />

      {correctionModalItemId && (
        <StockCorrectionModal
          itemId={correctionModalItemId}
          isOpen={isCorrectionModalOpen}
          onClose={() => {
            setIsCorrectionModalOpen(false);
            setCorrectionModalItemId(null);
          }}
        />
      )}
    </MobileShell>
  );
}

export default App;
