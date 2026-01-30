import { Modal } from '../ui/modal'
import { VersionList } from './version-list'
import { Button } from '../ui/button'
import { useCronogramaStore } from '../../stores/cronograma-store'
import type { Cronograma } from '../../types/domain'

type VersionSelectorModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function VersionSelectorModal({ isOpen, onClose }: VersionSelectorModalProps) {
  const selectCronogramaVersion = useCronogramaStore((state) => state.selectCronogramaVersion)
  const versions = useCronogramaStore((state) => state.cronogramaVersions)

  const handleSelectVersion = async (version: Cronograma) => {
    await selectCronogramaVersion(version.id)
    onClose()
  }

  const footer = (
    <div className="flex justify-end">
      <Button variant="secondary" onClick={onClose}>
        Fechar
      </Button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Historico de Cronogramas (${versions.length})`}
      footer={footer}
    >
      <VersionList onSelectVersion={handleSelectVersion} />
    </Modal>
  )
}
